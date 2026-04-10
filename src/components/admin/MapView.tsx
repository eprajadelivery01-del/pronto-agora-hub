import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useOnlineDrivers } from "@/services/drivers";
import { useRegions, useUpdateRegion } from "@/services/regions";
import { useDeliveries } from "@/services/deliveries";
import { useCompanies } from "@/services/companies";
import { useToast } from "@/hooks/use-toast";

interface MapViewProps {
  centerCity?: { name: string; lat: number; lng: number } | null;
}

export function MapView({ centerCity }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const labelsRef = useRef<maplibregl.Marker[]>([]);
  const regionsRenderedRef = useRef<string[]>([]); // track which regions are on map
  const { toast } = useToast();
  const updateRegion = useUpdateRegion();

  const { data: drivers } = useOnlineDrivers();
  const { data: regions } = useRegions();
  const { data: deliveriesData } = useDeliveries({ status: "in_route" });
  const { data: companies } = useCompanies();

  const getCentroid = (coords: [number, number][]) => {
    let x = 0, y = 0;
    coords.forEach(([lng, lat]) => { x += lng; y += lat; });
    return [x / coords.length, y / coords.length] as [number, number];
  };

  // Default center (Cuiabá-MT) or persisted city
  const defaultCenter: [number, number] = centerCity
    ? [centerCity.lng, centerCity.lat]
    : [-56.0974, -15.5989];

  // Init map ONCE — never destroy on city change
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: defaultCenter,
      zoom: 12,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "bottom-right");

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fly to city when it changes (without recreating the map)
  useEffect(() => {
    if (!map.current || !centerCity) return;
    map.current.flyTo({ center: [centerCity.lng, centerCity.lat], zoom: 13, duration: 1500 });
  }, [centerCity?.lat, centerCity?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render region polygons whenever regions change
  useEffect(() => {
    const m = map.current;
    if (!m || !regions) return;

    const render = () => {
      // Clear old labels
      labelsRef.current.forEach(mk => mk.remove());
      labelsRef.current = [];

      // Remove previously rendered regions that are no longer in the list
      regionsRenderedRef.current.forEach((id) => {
        if (m.getLayer(`region-fill-${id}`)) m.removeLayer(`region-fill-${id}`);
        if (m.getLayer(`region-line-${id}`)) m.removeLayer(`region-line-${id}`);
        if (m.getSource(`region-src-${id}`)) m.removeSource(`region-src-${id}`);
        m.off("click", `region-fill-${id}`, () => {});
      });
      regionsRenderedRef.current = [];

      regions.forEach((region) => {
        if (!region.geometry) return;
        const geojson = region.geometry as any;
        if (geojson.type !== "Polygon") return;

        const srcId = `region-src-${region.id}`;
        const fillId = `region-fill-${region.id}`;
        const lineId = `region-line-${region.id}`;

        // If source already exists (e.g. second render), update data
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

        // SINGLE CENTRAL LABEL
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
              <p style="margin:0; font-size: 10px; font-weight: 800; color: #444; border-bottom: 1px solid #eee; padding-bottom: 2px; margin-bottom: 2px;">${region.name}</p>
              <p style="margin:0; font-size: 11px; font-weight: 900; color: ${region.color};">R$ ${Number(region.price).toFixed(2)}</p>
            </div>
          `;
          const labelMarker = new maplibregl.Marker({ element: el }).setLngLat(centroid).addTo(m);
          labelsRef.current.push(labelMarker);
        }

        // CLICK TO EDIT PRICE
        m.on("click", fillId, (e) => {
          const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: false })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="padding: 12px; min-width: 160px; font-family: sans-serif;">
                <h4 style="margin: 0 0 8px 0; font-size: 13px;">Preço: ${region.name}</h4>
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

    if (m.isStyleLoaded()) render();
    else m.once("load", render);
  }, [regions]);

  // Render driver markers (realtime)
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    markersRef.current.forEach((mk) => mk.remove());
    markersRef.current = [];

    (drivers ?? []).forEach((driver) => {
      if (!driver.current_latitude || !driver.current_longitude) return;

      const el = document.createElement("div");
      el.innerHTML = `
        <div style="
          width: 36px; height: 36px; border-radius: 50%;
          background: #22c55e;
          border: 3px solid white;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          font-size: 14px;
        ">🏍️</div>
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([driver.current_longitude, driver.current_latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 20 }).setHTML(`
            <div style="font-family: sans-serif; padding: 4px;">
              <strong>${driver.profiles?.full_name || "Entregador"}</strong><br/>
              <span style="color: #22c55e">● Online</span><br/>
              <small>${driver.vehicle_type} • ⭐ ${Number(driver.rating).toFixed(1)}</small>
            </div>
          `)
        )
        .addTo(m);

      markersRef.current.push(marker);
    });

    // Render company markers
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
          transition: all 0.2s;
        ">🏪</div>
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([company.longitude, company.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 20 }).setHTML(`
            <div style="font-family: sans-serif; padding: 4px; min-width: 120px;">
              <strong style="font-size: 14px;">${company.name}</strong><br/>
              <div style="margin-top: 4px; border-top: 1px solid #eee; padding-top: 4px;">
                <small style="color: #666;">${company.address || "Sem endereço"}</small><br/>
                <span style="display: inline-block; margin-top: 4px; color: ${company.is_active ? "#22c55e" : "#ef4444"}; font-weight: 600; font-size: 11px;">
                  ● ${company.is_active ? "Aberta" : "Fechada"}
                </span>
              </div>
            </div>
          `)
        )
        .addTo(m);

      markersRef.current.push(marker);
    });
  }, [drivers, companies]);

  return (
    <div ref={mapContainer} className="w-full h-full rounded-xl overflow-hidden" />
  );
}
