import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useOnlineDrivers } from "@/services/drivers";
import { useDeliveries } from "@/services/deliveries";
import { useCity } from "@/contexts/CityContext";
import type { RegionRow } from "@/services/regions";

interface UnifiedMapProps {
  regions: RegionRow[];
  centerCity?: { name: string; lat: number; lng: number } | null;
  interactive?: boolean;
  darkTheme?: boolean;
}

export function UnifiedMap({ regions, centerCity: propCenterCity, interactive = false, darkTheme = false }: UnifiedMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const regionsRenderedRef = useRef<string[]>([]);
  const mapLoaded = useRef(false);

  const { selectedCityCoords } = useCity();
  const centerCity = propCenterCity || selectedCityCoords;

  const { data: drivers } = useOnlineDrivers();
  const { data: deliveriesData } = useDeliveries({ status: "in_route" });

  const calculateCentroid = (regs: RegionRow[]) => {
    if (!regs.length) return null;
    let totalLat = 0;
    let totalLng = 0;
    let count = 0;

    regs.forEach(r => {
      if (r.geometry && (r.geometry as any).coordinates?.[0]) {
        const coords = (r.geometry as any).coordinates[0];
        coords.forEach((c: [number, number]) => {
          totalLng += c[0];
          totalLat += c[1];
          count++;
        });
      }
    });

    return count > 0 ? [totalLng / count, totalLat / count] as [number, number] : null;
  };

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: darkTheme 
        ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: centerCity ? [centerCity.lng, centerCity.lat] : [-56.0974, -15.5989],
      zoom: 12,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "bottom-right");

    map.current.on("load", () => {
      mapLoaded.current = true;
      if (!centerCity && !regions.length && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            map.current?.flyTo({
              center: [pos.coords.longitude, pos.coords.latitude],
              zoom: 13,
              duration: 2000
            });
          },
          (err) => console.log("Geolocation error:", err)
        );
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Centering logic
  useEffect(() => {
    if (!map.current) return;

    if (centerCity) {
      map.current.flyTo({ center: [centerCity.lng, centerCity.lat], zoom: 13, duration: 1500 });
    } else if (regions.length > 0) {
      const centroid = calculateCentroid(regions);
      if (centroid) {
        map.current.flyTo({ center: centroid, zoom: 13, duration: 1500 });
      }
    }
  }, [centerCity?.lat, centerCity?.lng, regions]);

  // Render Regions and Labels
  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap || !regions) return;

    const render = () => {
      const m = map.current;
      if (!m) return;

      // Clear old regions
      regionsRenderedRef.current.forEach((id) => {
        [`rfill-${id}`, `rline-${id}`, `rlabel-${id}`].forEach(l => {
          if (m.getLayer(l)) m.removeLayer(l);
        });
        if (m.getSource(`rsrc-${id}`)) m.removeSource(`rsrc-${id}`);
      });
      regionsRenderedRef.current = [];

      regions.forEach((region) => {
        if (!region.geometry) return;
        const geojson = region.geometry as any;
        if (geojson.type !== "Polygon") return;

        const srcId = `rsrc-${region.id}`;
        
        m.addSource(srcId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: { 
              name: region.name, 
              price: `R$ ${Number((region as any).delivery_price ?? region.price ?? 0).toFixed(2)}` 
            },
            geometry: geojson,
          },
        });

        m.addLayer({
          id: `rfill-${region.id}`,
          type: "fill",
          source: srcId,
          paint: { "fill-color": (region as any).color || "#F59E0B", "fill-opacity": 0.25 },
        });

        m.addLayer({
          id: `rline-${region.id}`,
          type: "line",
          source: srcId,
          paint: { "line-color": (region as any).color || "#F59E0B", "line-width": 2, "line-opacity": 0.8 },
        });

        m.addLayer({
          id: `rlabel-${region.id}`,
          type: "symbol",
          source: srcId,
          layout: {
            "text-field": ["concat", ["get", "name"], "\n", ["get", "price"]],
            "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
            "text-size": 11,
            "text-anchor": "center",
            "text-allow-overlap": false,
            "text-offset": [0, 0],
            "text-line-height": 1.2,
          },
          paint: {
            "text-color": "#1a1a1a",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2,
          }
        });

        if (interactive) {
          m.on("mouseenter", `rfill-${region.id}`, () => {
            m.getCanvas().style.cursor = "pointer";
            m.setPaintProperty(`rfill-${region.id}`, "fill-opacity", 0.3);
          });
          m.on("mouseleave", `rfill-${region.id}`, () => {
            m.getCanvas().style.cursor = "";
            m.setPaintProperty(`rfill-${region.id}`, "fill-opacity", 0.15);
          });
        }

        regionsRenderedRef.current.push(region.id);
      });
    };

    if (currentMap.isStyleLoaded()) render();
    else currentMap.once("load", render);
  }, [regions, interactive]);

  // Realtime Drivers
  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap) return;

    markersRef.current.forEach(mk => mk.remove());
    markersRef.current = [];

    (drivers ?? []).forEach((driver) => {
      if (!driver.latitude || !driver.longitude) return;

      const escapeHTML = (str: string) => {
        if (!str) return "";
        return str.replace(/[&<>"']/g, (m) => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        }[m] || m));
      };

      const fullName = escapeHTML(driver.profiles?.full_name || "Entregador");
      const firstName = fullName.split(" ")[0];
      const phoneNumber = escapeHTML(driver.profiles?.phone || "").replace(/\D/g, "");

      const el = document.createElement("div");
      el.className = "driver-marker-container";
      
      // Premium Google-Maps-Style PIN with Pulse
      el.innerHTML = `
        <div class="pin-wrapper" style="
          position: relative;
          cursor: pointer;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
          transition: transform 0.2s;
        " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
          <!-- Pulse Effect -->
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 30px;
            height: 30px;
            background: #22c55e;
            border-radius: 50%;
            opacity: 0.6;
            animation: pinPulse 2s ease-out infinite;
          "></div>
          
          <!-- Outer Circle -->
          <div style="
            width: 44px; 
            height: 44px; 
            border-radius: 50%; 
            background: #22c55e; 
            border: 3px solid white; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            position: relative;
            z-index: 2;
          ">
            <!-- Icon Background -->
            <div style="
              width: 32px;
              height: 32px;
              border-radius: 50%;
              background: white;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            ">
              <img src="/logo.png" style="width: 22px; height: 22px; object-fit: contain;" alt="M" />
            </div>
          </div>
          
          <!-- Tooltip (Small and fast) -->
          <div style="
            position: absolute;
            bottom: -25px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 800;
            white-space: nowrap;
            z-index: 3;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
          ">${firstName}</div>
        </div>
        
        <style>
          @keyframes pinPulse {
            0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
            100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
          }
        </style>
      `;

      const popupContent = `
        <div style="
          padding: 16px; 
          font-family: 'Inter', sans-serif; 
          min-width: 200px;
          background: #ffffff;
          border-radius: 20px;
        ">
          <div style="display: flex; items-center; gap: 12px; margin-bottom: 12px;">
            <div style="width: 48px; height: 48px; border-radius: 12px; background: #f0fdf4; display: flex; align-items: center; justify-content: center;">
              <img src="/logo.png" style="width: 28px; height: 28px; object-fit: contain;" />
            </div>
            <div>
              <div style="font-size: 15px; font-weight: 800; color: #111827;">${fullName}</div>
              <div style="font-size: 12px; color: #22c55e; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                <div style="width: 6px; height: 6px; border-radius: 50%; background: #22c55e;"></div>
                Em Rota de Entrega
              </div>
            </div>
          </div>
          
          <div style="display: grid; grid-template-cols: 1fr; gap: 8px;">
            <a href="https://wa.me/${phoneNumber}" target="_blank" style="
              text-decoration: none;
              background: #25D366;
              color: white;
              padding: 10px;
              border-radius: 12px;
              text-align: center;
              font-size: 13px;
              font-weight: 700;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3);
              transition: transform 0.2s;
            ">
              WhatsApp Direto
            </a>
            <div style="font-size: 11px; text-align: center; color: #6b7280; font-weight: 500;">
              Avaliação: ⭐ ${Number(driver.rating).toFixed(1)}
            </div>
          </div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([driver.longitude, driver.latitude])
        .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(popupContent))
        .addTo(currentMap);

      markersRef.current.push(marker);
    });
  }, [drivers]);

  return <div ref={mapContainer} className="w-full h-full rounded-xl overflow-hidden shadow-inner bg-muted/20" />;
}
