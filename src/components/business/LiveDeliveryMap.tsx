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
  const [loading, setLoading] = useState(true);
  const [activeDeliveries, setActiveDeliveries] = useState<any[]>([]);

  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json', // Estilo básico, recomendável usar Maptiler em prod
      center: [-56.5126, -14.3986], // Centro aproximado de Diamantino - MT
      zoom: 13,
    });

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
        .in('status', ['pending', 'accepted', 'in_route', 'ready']);
        
      if (data) setActiveDeliveries(data);
    };

    fetchActiveDeliveries();

    // Subscribe to changes
    const channel = supabase
      .channel('live-deliveries')
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
        el.className = 'marker-delivery';
        el.innerHTML = `
          <div class="relative group">
            <div class="w-10 h-10 bg-primary rounded-2xl shadow-xl flex items-center justify-center text-white border-2 border-white ring-4 ring-primary/20 animate-bounce">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3m1 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0m10 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M13 5h9v7h-9z"/></svg>
            </div>
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

    // Auto-center if we have deliveries
    if (activeDeliveries.length > 0 && !loading) {
       // Optional: fit bounds
    }
  }, [activeDeliveries, loading]);

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
