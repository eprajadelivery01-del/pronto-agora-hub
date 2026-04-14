import React, { useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Info, Navigation } from "lucide-react";

interface RegionPickerMapProps {
  cityId?: string;
  onRegionSelect?: (fee: number, regionId: string) => void;
}

export function RegionPickerMap({ cityId, onRegionSelect }: RegionPickerMapProps) {
  const mapContainer = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<maplibregl.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<any[]>([]);

  useEffect(() => {
    const fetchRegions = async () => {
      let query = supabase.from('regions').select('*').eq('active', true);
      if (cityId) query = query.eq('city_id', cityId);
      
      const { data } = await query;
      if (data) setRegions(data);
    };

    fetchRegions();
  }, [cityId]);

  useEffect(() => {
    if (!mapContainer.current || regions.length === 0) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-56.5126, -14.3986], // Centro padrão Diamantino
      zoom: 12,
    });

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 15
    });

    map.current.on('load', () => {
      setLoading(false);

      regions.forEach(region => {
        if (!region.geometry) return;

        const sourceId = `region-${region.id}`;
        const fillId = `${sourceId}-fill`;
        const lineId = `${sourceId}-line`;
        
        map.current?.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: region.geometry,
            properties: { 
              name: region.name, 
              price: region.delivery_fee || region.price 
            }
          }
        });

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

        // Click interaction
        map.current?.on('click', fillId, () => {
           onRegionSelect?.(region.delivery_fee || region.price, region.id);
        });

        // Hover effect & Popup (Matching Admin)
        map.current?.on('mouseenter', fillId, (e) => {
          map.current!.getCanvas().style.cursor = 'pointer';
          map.current!.setPaintProperty(fillId, 'fill-opacity', 0.45);
          
          const fee = (region.delivery_fee || region.price || 0);
          popup
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="font-family: sans-serif; padding: 4px; color: #fff;">
                <strong style="display: block; font-size: 12px; margin-bottom: 2px;">${region.name}</strong>
                <span style="color: #10b981; font-weight: 800; font-size: 14px;">R$ ${Number(fee).toFixed(2).replace('.', ',')}</span>
              </div>
            `)
            .addTo(map.current!);
        });

        map.current?.on('mouseleave', fillId, () => {
          map.current!.getCanvas().style.cursor = '';
          map.current!.setPaintProperty(fillId, 'fill-opacity', 0.25);
          popup.remove();
        });
      });
    });

    return () => {
      map.current?.remove();
    };
  }, [regions]);

  return (
    <div className="relative w-full h-[300px] rounded-2xl overflow-hidden border border-border bg-muted/20">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
           <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full" />
      <div className="absolute top-4 left-4 z-10 p-3 bg-background/80 backdrop-blur-md rounded-xl border border-border shadow-lg max-w-[200px]">
         <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
            <Info className="h-3 w-3" /> Info Regiões
         </p>
         <p className="text-[9px] font-bold text-foreground leading-tight">Clique em uma região colorida para definir o valor da entrega automaticamente.</p>
      </div>
    </div>
  );
}
