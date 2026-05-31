import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { supabase } from "@/lib/supabaseClient";
import { Truck, MapPin, Loader2 } from "lucide-react";
import { geocodeAddress } from "@/utils/freight";

interface DeliveryTrackingMapProps {
  deliveryId: string;
  driverId?: string | null;
  destinationAddress?: string;
}

export default function DeliveryTrackingMap({ deliveryId, driverId, destinationAddress }: DeliveryTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [loading, setLoading] = useState(true);
  const [eta, setEta] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initMap = async () => {
      try {
        setLoading(true);
        let destCoords = null;
        if (destinationAddress) {
          destCoords = await geocodeAddress(destinationAddress);
        }

        if (!mapContainerRef.current) {
          setLoading(false);
          return;
        }

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
          center: destCoords ? [destCoords.lon, destCoords.lat] : [-56.097, -15.601], // Default Cuiabá
          zoom: 14,
        });

        map.addControl(new maplibregl.NavigationControl(), "bottom-right");
        mapRef.current = map;

        if (destCoords) {
          new maplibregl.Marker({ color: "#ef4444" })
            .setLngLat([destCoords.lon, destCoords.lat])
            .setPopup(new maplibregl.Popup().setHTML("<b>Destino</b>"))
            .addTo(map);
        }

        setLoading(false);
      } catch (error) {
        console.error("[TrackingMap] Error initializing map:", error);
        setLoading(false);
      }
    };

    initMap();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [destinationAddress]);

  useEffect(() => {
    if (!mapRef.current || !driverId) return;

    // Monitor driver location in real-time
    const fetchAndMarkDriver = async () => {
      const { data: driver } = await supabase
        .from("delivery_drivers")
        .select("current_latitude, current_longitude")
        .eq("id", driverId)
        .single();

      if (driver?.current_latitude && driver?.current_longitude) {
        const coords: [number, number] = [driver.current_longitude, driver.current_latitude];
        
        if (!driverMarkerRef.current) {
          const el = document.createElement("div");
          el.className = "w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-pulse";
          el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-truck"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-5l-4-4h-3v10"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>';
          
          driverMarkerRef.current = new maplibregl.Marker(el)
            .setLngLat(coords)
            .addTo(mapRef.current!);
        } else {
          driverMarkerRef.current.setLngLat(coords);
        }

        // Auto center/fit bounds if first time or moving significantly
        // mapRef.current.easeTo({ center: coords });
      }
    };

    fetchAndMarkDriver();

    const channel = supabase
      .channel(`driver-location-${driverId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "delivery_drivers", filter: `id=eq.${driverId}` },
        (payload) => {
          const { current_latitude, current_longitude } = payload.new;
          if (current_latitude && current_longitude && driverMarkerRef.current) {
            driverMarkerRef.current.setLngLat([current_longitude, current_latitude]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [driverId]);

  return (
    <div className="relative w-full h-64 rounded-2xl overflow-hidden border border-border/50 bg-muted/20">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Carregando Mapa...</p>
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full" />
      
      {driverId && (
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-xl border border-white/20 pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <div>
                <p className="text-[9px] font-black text-muted-foreground uppercase leading-none mb-1">Entregador em Rota</p>
                <p className="text-xs font-black text-foreground leading-none">Acompanhando localização...</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
