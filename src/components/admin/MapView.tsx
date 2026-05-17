import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useOnlineDrivers } from "@/services/drivers";
import { useRegions, useUpdateRegion } from "@/services/regions";
import { useDeliveries } from "@/services/deliveries";
import { useCompanies } from "@/services/companies";
import { useToast } from "@/hooks/use-toast";

const escapeHtml = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

interface MapViewProps {
  centerCity?: { name: string; lat: number; lng: number } | null;
  darkTheme?: boolean;
}

export function MapView({ centerCity, darkTheme = false }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const labelsRef = useRef<maplibregl.Marker[]>([]);
  const regionsRenderedRef = useRef<string[]>([]);
  const { toast } = useToast();
  const updateRegion = useUpdateRegion();

  const { data: drivers } = useOnlineDrivers();
  const { data: regions } = useRegions();
  const { data: deliveriesData } = useDeliveries({ status: "in_transit" });
  const { data: companies } = useCompanies();

  const getCentroid = (coords: [number, number][]) => {
    let x = 0, y = 0;
    coords.forEach(([lng, lat]) => { x += lng; y += lat; });
    return [x / coords.length, y / coords.length] as [number, number];
  };

  const defaultCenter: [number, number] = centerCity
    ? [centerCity.lng, centerCity.lat]
    : [-56.0974, -15.5989];

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: darkTheme 
        ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: defaultCenter,
      zoom: 12,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "bottom-right");

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map.current || !centerCity) return;
    map.current.flyTo({ center: [centerCity.lng, centerCity.lat], zoom: 13, duration: 1500 });
  }, [centerCity?.lat, centerCity?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render region polygons
  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap || !regions) return;

    const render = () => {
      const m = map.current;
      if (!m) return;

      labelsRef.current.forEach(mk => mk.remove());
      labelsRef.current = [];

      regionsRenderedRef.current.forEach((id) => {
        if (m.getLayer(`region-fill-${id}`)) m.removeLayer(`region-fill-${id}`);
        if (m.getLayer(`region-line-${id}`)) m.removeLayer(`region-line-${id}`);
        if (m.getSource(`region-src-${id}`)) m.removeSource(`region-src-${id}`);
      });
      regionsRenderedRef.current = [];

      regions.forEach((region) => {
        if (!region.geometry) return;
        const geojson = region.geometry as any;
        if (geojson.type !== "Polygon") return;

        const srcId = `region-src-${region.id}`;
        const fillId = `region-fill-${region.id}`;
        const lineId = `region-line-${region.id}`;

        if (m.getSource(srcId)) {
          (m.getSource(srcId) as maplibregl.GeoJSONSource).setData({
            type: "Feature",
            properties: { name: region.name, price: region.price },
            geometry: geojson,
          });
        } else {
          m.addSource(srcId, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: { name: region.name, price: region.price },
              geometry: geojson,
            },
          });
        }

        if (!m.getLayer(fillId)) {
          m.addLayer({
            id: fillId,
            type: "fill",
            source: srcId,
            paint: { "fill-color": region.color, "fill-opacity": 0.18 },
          });
        } else {
          m.setPaintProperty(fillId, "fill-color", region.color);
        }

        if (!m.getLayer(lineId)) {
          m.addLayer({
            id: lineId,
            type: "line",
            source: srcId,
            paint: { "line-color": region.color, "line-width": 2.5, "line-opacity": 0.8 },
          });
        } else {
          m.setPaintProperty(lineId, "line-color", region.color);
        }

        const geoJSON = region.geometry as any;
        if (geoJSON.coordinates?.[0]) {
          const centroid = getCentroid(geoJSON.coordinates[0]);
          const el = document.createElement("div");
          el.className = "region-label";
          el.innerHTML = `
            <div style="
              background: rgba(255,255,255,0.92);
              padding: 4px 10px;
              border-radius: 8px;
              border: 1.5px solid ${region.color};
              box-shadow: 0 2px 6px rgba(0,0,0,0.1);
              text-align: center;
              min-width: 60px;
              pointer-events: none;
            ">
              <p style="margin:0; font-size: 10px; font-weight: 800; color: #444; border-bottom: 1px solid #eee; padding-bottom: 2px; margin-bottom: 2px;">${escapeHtml(region.name)}</p>
              <p style="margin:0; font-size: 11px; font-weight: 900; color: ${region.color};">R$ ${Number(region.price).toFixed(2)}</p>
            </div>
          `;
          const labelMarker = new maplibregl.Marker({ element: el }).setLngLat(centroid).addTo(m);
          labelsRef.current.push(labelMarker);
        }

        m.on("click", fillId, (e) => {
          const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: false })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="padding: 12px; min-width: 160px; font-family: sans-serif;">
                <h4 style="margin: 0 0 8px 0; font-size: 13px;">Preço: ${escapeHtml(region.name)}</h4>
                <input id="edit-price-${region.id}" type="number" step="0.50" value="${region.price}" 
                  style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; margin-bottom: 10px; box-sizing: border-box;"
                />
                <button id="save-price-${region.id}" style="
                  width: 100%; padding: 8px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;
                ">Salvar</button>
              </div>
            `)
            .addTo(m);

          setTimeout(() => {
            const btn = document.getElementById(`save-price-${region.id}`);
            const input = document.getElementById(`edit-price-${region.id}`) as HTMLInputElement;
            if (btn && input) {
              btn.addEventListener("click", async () => {
                const newPrice = parseFloat(input.value);
                try {
                  await updateRegion.mutateAsync({ id: region.id, updates: { price: newPrice } });
                  toast({ title: "Sucesso", description: `Preço de ${region.name} atualizado!` });
                  popup.remove();
                } catch (err) {
                  toast({ title: "Erro ao atualizar", variant: "destructive" });
                }
              });
            }
          }, 100);
        });

        regionsRenderedRef.current.push(region.id);
      });
    };

    if (currentMap.isStyleLoaded()) render();
    else currentMap.once("load", render);
  }, [regions]);

  // Render driver + company markers
  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap) return;

    markersRef.current.forEach((mk) => mk.remove());
    markersRef.current = [];

    (drivers ?? []).forEach((driver) => {
      const lat = driver.latitude;
      const lng = driver.longitude;
      if (!lat || !lng) return;

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
          ">${escapeHtml(driver.full_name?.split(" ")[0] || "Entregador")}</div>
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
              <div style="font-size: 15px; font-weight: 800; color: #111827;">${escapeHtml(driver.full_name || "Entregador")}</div>
              <div style="font-size: 12px; color: #22c55e; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                <div style="width: 6px; height: 6px; border-radius: 50%; background: #22c55e;"></div>
                Em Rota de Entrega
              </div>
            </div>
          </div>
          
          <div style="display: grid; grid-template-cols: 1fr; gap: 8px;">
            <a href="https://wa.me/${encodeURIComponent(driver.phone?.replace(/\D/g, "") || "")}" target="_blank" style="
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
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(popupContent))
        .addTo(currentMap);

      markersRef.current.push(marker);
    });

    (companies ?? []).forEach((company) => {
      if (!company.latitude || !company.longitude) return;

      const el = document.createElement("div");
      const statusColor = company.is_active ? "#22c55e" : "#ef4444";
      el.innerHTML = `
        <div style="
          width: 36px; height: 36px; border-radius: 10px;
          background: ${statusColor};
          border: 3px solid white;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          font-size: 16px;
        ">🏪</div>
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([company.longitude, company.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 20 }).setHTML(`
            <div style="font-family: sans-serif; padding: 4px; min-width: 120px;">
              <strong style="font-size: 14px;">${escapeHtml(company.name)}</strong><br/>
              <div style="margin-top: 4px; border-top: 1px solid #eee; padding-top: 4px;">
                <small style="color: #666;">${escapeHtml(company.address || "Sem endereço")}</small><br/>
                <span style="display: inline-block; margin-top: 4px; color: ${company.is_active ? "#22c55e" : "#ef4444"}; font-weight: 600; font-size: 11px;">
                  ● ${company.is_active ? "Aberta" : "Fechada"}
                </span>
              </div>
            </div>
          `)
        )
        .addTo(currentMap);

      markersRef.current.push(marker);
    });
  }, [drivers, companies]);

  return (
    <div ref={mapContainer} className="w-full h-full rounded-xl overflow-hidden" />
  );
}
