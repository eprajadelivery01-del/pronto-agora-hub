import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Navigation, MapPin, Truck, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveDeliveryMapProps {
  companyId?: string;
}

export function LiveDeliveryMap({ companyId }: LiveDeliveryMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Record<string, maplibregl.Marker>>({});
  const labelsRef = useRef<maplibregl.Marker[]>([]);
  const regionsRenderedRef = useRef<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDeliveries, setActiveDeliveries] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);

  const getCentroid = (coords: [number, number][]) => {
    let x = 0, y = 0;
    coords.forEach(([lng, lat]) => { x += lng; y += lat; });
    return [x / coords.length, y / coords.length] as [number, number];
  };

  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [-56.5126, -14.3986], // Centro aproximado de Diamantino - MT
      zoom: 13,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "bottom-right");

    map.current.on('load', () => {
      setLoading(false);
    });

    return () => {
      map.current?.remove();
    };
  }, []);

  // Fetch and Subscribe to Deliveries
  useEffect(() => {
    if (!companyId) return;

    const fetchActiveDeliveries = async () => {
      const { data } = await supabase
        .from('deliveries')
        .select(`
          *,
          drivers (
            id,
            full_name,
            latitude,
            longitude,
            vehicle_type
          )
        `)
        .eq('company_id', companyId)
        .in('status', ['pending', 'accepted', 'in_route'] as any);
        
      if (data) setActiveDeliveries(data);
    };

    fetchActiveDeliveries();

    // Fetch Regions for context
    const fetchRegions = async () => {
       const { data } = await supabase.from('regions').select('*').eq('is_active', true);
       if (data) setRegions(data);
    };
    fetchRegions();

    // Subscribe to changes
    const channel = supabase
      .channel('live-monitor')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'deliveries', 
        filter: `company_id=eq.${companyId}` 
      }, () => fetchActiveDeliveries())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'delivery_drivers'
      }, () => fetchActiveDeliveries()) // Update when driver moves
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  // Update Markers
  useEffect(() => {
    if (!map.current || loading) return;

    // Clear old markers that are no longer in activeDeliveries
    const currentIds = activeDeliveries.map(d => d.id);
    Object.keys(markers.current).forEach(id => {
      if (!currentIds.includes(id)) {
        markers.current[id].remove();
        delete markers.current[id];
      }
    });

    activeDeliveries.forEach(delivery => {
      const driver = delivery.drivers;
      const lat = driver?.latitude || delivery.delivery_latitude;
      const lng = driver?.longitude || delivery.delivery_longitude;

      if (!lat || !lng) return;

      if (!markers.current[delivery.id]) {
        const el = document.createElement('div');
        el.innerHTML = `
          <div class="relative group">
            <div style="
              width: 36px; height: 36px; border-radius: 50%;
              background: #22c55e;
              border: 3px solid white;
              display: flex; align-items: center; justify-content: center;
              box-shadow: 0 2px 8px rgba(0,0,0,0.25);
              font-size: 14px;
              cursor: pointer;
            ">🏍️</div>
            <div class="absolute -top-12 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-black px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              ${delivery.customer_name || 'Entrega'}
            </div>
          </div>
        `;

        markers.current[delivery.id] = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map.current!);
      } else {
        markers.current[delivery.id].setLngLat([lng, lat]);
      }
    });

    // Render Company Marker (Logged in business) - async IIFE
    if (companyId && map.current && !markers.current['company']) {
      const mapRef = map.current;
      (async () => {
        const { data: comp } = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle();
        const compAny = comp as any;
        if (compAny?.latitude && compAny?.longitude) {
          const el = document.createElement('div');
          el.innerHTML = `
            <div style="
              width: 36px; height: 36px; border-radius: 10px;
              background: #3b82f6;
              border: 3px solid white;
              display: flex; align-items: center; justify-content: center;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              font-size: 16px;
            ">🏪</div>
          `;
          markers.current['company'] = new maplibregl.Marker({ element: el })
            .setLngLat([compAny.longitude, compAny.latitude])
            .addTo(mapRef);
        }
      })();
    }
    // Auto-center if we have deliveries
  }, [activeDeliveries, loading, companyId]);

  // Render Regions Polygons and Labels
  useEffect(() => {
    const m = map.current;
    if (!m || loading || regions.length === 0) return;

    const render = () => {
      // Clear old labels
      labelsRef.current.forEach(mk => mk.remove());
      labelsRef.current = [];

      // Clear old regions
      regionsRenderedRef.current.forEach(id => {
        if (m.getLayer(`region-fill-${id}`)) m.removeLayer(`region-fill-${id}`);
        if (m.getLayer(`region-line-${id}`)) m.removeLayer(`region-line-${id}`);
        if (m.getSource(`region-src-${id}`)) m.removeSource(`region-src-${id}`);
      });
      regionsRenderedRef.current = [];

      regions.forEach(region => {
        if (!region.geometry) return;
        const srcId = `region-src-${region.id}`;
        const fillId = `region-fill-${region.id}`;
        const lineId = `region-line-${region.id}`;

        m.addSource(srcId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: region.geometry,
            properties: { name: region.name, price: region.price }
          }
        });

        m.addLayer({
          id: fillId,
          type: 'fill',
          source: srcId,
          paint: { 'fill-color': region.color || '#3b82f6', 'fill-opacity': 0.15 }
        });

        m.addLayer({
          id: lineId,
          type: 'line',
          source: srcId,
          paint: { 'line-color': region.color || '#3b82f6', 'line-width': 2, 'line-opacity': 0.6 }
        });

        // Floating Label (Price Tag)
        const geoJSON = region.geometry as any;
        if (geoJSON.coordinates?.[0]) {
          const centroid = getCentroid(geoJSON.coordinates[0]);
          const el = document.createElement("div");
          el.innerHTML = `
            <div style="
              background: rgba(255,255,255,0.95);
              padding: 4px 10px;
              border-radius: 8px;
              border: 1.5px solid ${region.color || '#3b82f6'};
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              text-align: center;
              min-width: 70px;
              pointer-events: none;
              transform: scale(0.9);
            ">
              <p style="margin:0; font-size: 9px; font-weight: 800; color: #666; border-bottom: 1px solid #eee; padding-bottom: 2px; margin-bottom: 2px;">${region.name}</p>
              <p style="margin:0; font-size: 11px; font-weight: 900; color: ${region.color || '#3b82f6'};">R$ ${Number(region.price).toFixed(2)}</p>
            </div>
          `;
          const labelMarker = new maplibregl.Marker({ element: el }).setLngLat(centroid).addTo(m);
          labelsRef.current.push(labelMarker);
        }

        regionsRenderedRef.current.push(region.id);
      });
    };

    if (m.isStyleLoaded()) render();
    else m.once('load', render);
  }, [regions, loading]);

  return (
    <div className="relative w-full h-[400px] rounded-[2.5rem] overflow-hidden border border-border bg-muted/20 shadow-card group">
      {loading && (
        <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-md flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Iniciando Monitoramento...</p>
        </div>
      )}
      
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Overlay UI */}
      <div className="absolute top-6 left-6 z-10 flex flex-col gap-2">
         <div className="px-4 py-2 bg-background/80 backdrop-blur-md border border-border/50 rounded-2xl shadow-xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Mapa Sincronizado</span>
         </div>
      </div>

      <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-2">
         <button className="h-10 w-10 bg-background/80 backdrop-blur-md border border-border/50 rounded-xl shadow-xl flex items-center justify-center text-foreground hover:bg-white transition-all">
            <Maximize2 className="h-4 w-4" />
         </button>
      </div>

      <div className="absolute bottom-6 left-6 z-10">
         <div className="flex -space-x-3">
            {activeDeliveries.slice(0, 3).map((d, i) => (
               <div key={i} className="w-10 h-10 rounded-full bg-primary border-2 border-card flex items-center justify-center text-white text-[10px] font-black shadow-lg">
                  {d.customer_name?.charAt(0) || "C"}
               </div>
            ))}
            {activeDeliveries.length > 3 && (
               <div className="w-10 h-10 rounded-full bg-muted border-2 border-card flex items-center justify-center text-muted-foreground text-[10px] font-black shadow-lg">
                  +{activeDeliveries.length - 3}
               </div>
            )}
         </div>
      </div>
    </div>
  );
}
