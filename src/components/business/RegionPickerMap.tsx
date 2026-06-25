import React, { useEffect, useState, useRef, memo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Info } from "lucide-react";

interface RegionPickerMapProps {
  cityId?: string;
  companyId?: string;
  onRegionSelect?: (fee: number, regionId: string) => void;
}

// Using memo to prevent re-renders unless cityId or onRegionSelect actually change
export const RegionPickerMap = memo(({ cityId, companyId, onRegionSelect }: RegionPickerMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const labelsRef = useRef<maplibregl.Marker[]>([]);
  const onRegionSelectRef = useRef(onRegionSelect);
  const hasFittedBounds = useRef<string | null>(null); // Track which cityId was fitted
  
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<any[]>([]);
  const [pricingRules, setPricingRules] = useState<any[]>([]);

  // Keep callback ref up to date without re-triggering effects
  useEffect(() => {
    onRegionSelectRef.current = onRegionSelect;
  }, [onRegionSelect]);

  const getCentroid = (coords: [number, number][]) => {
    let x = 0, y = 0;
    coords.forEach(([lng, lat]) => { x += lng; y += lat; });
    return [x / coords.length, y / coords.length] as [number, number];
  };

  // 1. Fetch Regions
  useEffect(() => {
    const fetchRegions = async () => {
      const { data } = await supabase.from('regions').select('*');
      const filtered = (data ?? []).filter((r: any) => r.is_active !== false && (!cityId || r.city_id === cityId));
      setRegions(filtered);

      if (companyId) {
        // Fetch custom pricing rules
        const { data: comp } = await supabase.from('companies').select('pricing_table_id, region_id').eq('id', companyId).single();
        if (comp) {
          let tableId = comp.pricing_table_id;
          if (tableId && comp.region_id) {
            const { data: rules } = await supabase
              .from('pricing_rules')
              .select('*')
              .eq('pricing_table_id', tableId)
              .eq('origin_region_id', comp.region_id);
            if (rules) setPricingRules(rules);
          }
        }
      }
    };
    fetchRegions();
  }, [cityId, companyId]);

  const getRegionFee = (region: any) => {
    const rule = pricingRules.find(r => r.destination_region_id === region.id);
    if (rule) return Number(rule.base_value);
    return Number(region.delivery_fee || region.price || 0);
  };

  // 2. Initialize Map (Strictly Once)
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [-56.5126, -14.3986],
      zoom: 12,
      attributionControl: false // Cleaner UI
    });

    map.current.on('load', () => {
      setLoading(false);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // 3. Draw Regions (Defensive)
  useEffect(() => {
    if (!map.current || regions.length === 0) return;

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 15
    });

    const draw = () => {
      if (!map.current?.loaded()) {
        setTimeout(draw, 100);
        return;
      }

      // Cleanup old labels
      labelsRef.current.forEach(mk => mk.remove());
      labelsRef.current = [];

      const bounds = new maplibregl.LngLatBounds();
      let hasValidGeometry = false;

      regions.forEach(region => {
        if (!region.geometry) return;
        
        const sourceId = `region-${region.id}`;
        const fillId = `${sourceId}-fill`;
        const lineId = `${sourceId}-line`;
        
        // Remove existing to avoid duplicates on city switch
        if (map.current?.getSource(sourceId)) {
          if (map.current.getLayer(fillId)) map.current.removeLayer(fillId);
          if (map.current.getLayer(lineId)) map.current.removeLayer(lineId);
          map.current.removeSource(sourceId);
        }

        map.current?.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: region.geometry,
            properties: { name: region.name, price: getRegionFee(region) }
          }
        });

        if (region.geometry.type === 'Polygon') {
          hasValidGeometry = true;
          region.geometry.coordinates[0].forEach((coord: [number, number]) => {
            bounds.extend(coord);
          });
        }

        map.current?.addLayer({
          id: fillId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': region.color || '#3b82f6',
            'fill-opacity': 0.25
          }
        });

        map.current?.addLayer({
          id: lineId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': region.color || '#3b82f6',
            'line-width': 2.5
          }
        });

        // Price Label
        const geoJSON = region.geometry as any;
        if (geoJSON.coordinates?.[0]) {
          const centroid = getCentroid(geoJSON.coordinates[0]);
          const el = document.createElement("div");
          el.className = "region-label";
          const fee = getRegionFee(region);
          el.innerHTML = `
            <div style="background:rgba(255,255,255,0.92);padding:4px 10px;border-radius:8px;border:1.5px solid ${region.color || '#3b82f6'};box-shadow:0 2px 6px rgba(0,0,0,0.1);text-align:center;min-width:60px;pointer-events:none;">
              <p style="margin:0;font-size:10px;font-weight:800;color:#444;border-bottom:1px solid #eee;padding-bottom:2px;margin-bottom:2px;">${region.name}</p>
              <p style="margin:0;font-size:11px;font-weight:900;color:${region.color || '#3b82f6'};">R$ ${Number(fee).toFixed(2).replace('.', ',')}</p>
            </div>
          `;
          const labelMarker = new maplibregl.Marker({ element: el }).setLngLat(centroid).addTo(map.current!);
          labelsRef.current.push(labelMarker);
        }

        // Listener using REF to prevent effect re-triggering
        map.current?.off('click', fillId as any); // Ensure single listener
        map.current?.on('click', fillId as any, () => {
           onRegionSelectRef.current?.(getRegionFee(region), region.id);
        });
        
        map.current?.on('mouseenter', fillId, (e) => {
          map.current!.getCanvas().style.cursor = 'pointer';
          map.current!.setPaintProperty(fillId, 'fill-opacity', 0.45);
          const fee = getRegionFee(region);
          popup.setLngLat(e.lngLat).setHTML(`
            <div style="font-family:sans-serif;padding:4px;color:#fff;">
              <strong style="display:block;font-size:12px;margin-bottom:2px;">${region.name}</strong>
              <span style="color:#10b981;font-weight:800;font-size:14px;">R$ ${Number(fee).toFixed(2).replace('.', ',')}</span>
            </div>
          `).addTo(map.current!);
        });

        map.current?.on('mouseleave', fillId, () => {
          map.current!.getCanvas().style.cursor = '';
          map.current!.setPaintProperty(fillId, 'fill-opacity', 0.25);
          popup.remove();
        });
      });

      // Fit bounds ONLY ONCE per cityId
      if (hasValidGeometry && hasFittedBounds.current !== cityId) {
        map.current?.fitBounds(bounds, { padding: 50, duration: 2000 });
        hasFittedBounds.current = cityId || "global";
      }
    };

    draw();
  }, [regions, cityId, pricingRules]); // Explicitly exclude onRegionSelect from deps

  return (
    <div className="relative w-full h-[320px] rounded-[2rem] overflow-hidden border border-border bg-muted/20 shadow-inner">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
           <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full" />
      <div className="absolute top-4 left-4 z-10 p-3 bg-background/80 backdrop-blur-md rounded-xl border border-border shadow-lg max-w-[200px] pointer-events-none">
         <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
            <Info className="h-3 w-3" /> Info Regiões
         </p>
         <p className="text-[9px] font-bold text-foreground leading-tight">Clique em uma região colorida para definir o valor da entrega.</p>
      </div>
    </div>
  );
});

RegionPickerMap.displayName = "RegionPickerMap";

