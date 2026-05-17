import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useOnlineDrivers } from "@/services/drivers";
import { useDeliveries } from "@/services/deliveries";
import { useCity } from "@/contexts/CityContext";
import type { RegionRow } from "@/services/regions";
import { Search, Loader2, X, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const escapeHtml = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

interface UnifiedMapProps {
  regions: RegionRow[];
  centerCity?: { name: string; lat: number; lng: number } | null;
  interactive?: boolean;
}

export function UnifiedMap({ regions, centerCity: propCenterCity, interactive = false }: UnifiedMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const regionsRenderedRef = useRef<string[]>([]);
  const mapLoaded = useRef(false);

  // Geocoding state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const { selectedCityCoords } = useCity();
  const centerCity = propCenterCity || selectedCityCoords;

  const { data: drivers } = useOnlineDrivers();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery || searchQuery.length < 3) return;
    
    setIsSearching(true);
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`);
      const data = await resp.json();
      setSearchResults(data);
    } catch (err) {
      console.error("Geocoding error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const goToLocation = (lat: string, lon: string) => {
    if (!map.current) return;
    map.current.flyTo({
      center: [parseFloat(lon), parseFloat(lat)],
      zoom: 16,
      duration: 2500
    });
    setSearchResults([]);
    setSearchQuery("");
  };

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

    // Use a Satellite/Hybrid style
    // For "Real Colors" without Mapbox key, we use a custom Carto or Maptiler style that looks real,
    // or we can use the default MapLibre style with a satellite raster source.
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: centerCity ? [centerCity.lng, centerCity.lat] : [-56.0974, -15.5989],
      zoom: 12,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "bottom-right");

    map.current.on("load", () => {
      mapLoaded.current = true;
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

  // Render Regions
  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap || !regions) return;

    const renderRegions = () => {
      const m = map.current;
      if (!m) return;

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
              price: `R$ ${Number(region.price).toFixed(2)}` 
            },
            geometry: geojson,
          },
        });

        m.addLayer({
          id: `rfill-${region.id}`,
          type: "fill",
          source: srcId,
          paint: { "fill-color": (region as any).color || "#F59E0B", "fill-opacity": 0.35 },
        });

        m.addLayer({
          id: `rline-${region.id}`,
          type: "line",
          source: srcId,
          paint: { "line-color": "#ffffff", "line-width": 2.5, "line-opacity": 0.9 },
        });

        m.addLayer({
          id: `rlabel-${region.id}`,
          type: "symbol",
          source: srcId,
          layout: {
            "text-field": ["concat", ["get", "name"], "\n", ["get", "price"]],
            "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
            "text-size": 12,
            "text-anchor": "center",
            "text-allow-overlap": false,
            "text-offset": [0, 0],
            "text-line-height": 1.2,
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "#000000",
            "text-halo-width": 2,
          }
        });

        regionsRenderedRef.current.push(region.id);
      });
    };

    if (currentMap.isStyleLoaded()) renderRegions();
    else currentMap.once("load", renderRegions);
  }, [regions]);

  // Realtime Drivers
  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap) return;

    markersRef.current.forEach(mk => mk.remove());
    markersRef.current = [];

    (drivers ?? []).forEach((driver) => {
      if (!driver.latitude || !driver.longitude) return;

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
        .setLngLat([driver.longitude, driver.latitude])
        .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(popupContent))
        .addTo(currentMap);

      markersRef.current.push(marker);
    });
  }, [drivers]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-muted/20 border border-border shadow-2xl">
      {/* Search Overlay */}
      <div className="absolute top-4 left-4 z-10 w-full max-w-sm pointer-events-auto">
        <form onSubmit={handleSearch} className="relative group">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-xl rounded-2xl shadow-2xl ring-1 ring-black/10 group-focus-within:ring-primary/50 transition-all" />
          <div className="relative flex items-center px-4 py-3 gap-3">
             {isSearching ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Search className="h-5 w-5 text-muted-foreground" />}
             <input 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               placeholder="Buscar endereço no mapa..."
               className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-foreground placeholder:text-muted-foreground/60"
             />
             {searchQuery && (
               <button onClick={() => setSearchQuery("")} type="button" className="p-1 hover:bg-muted rounded-full">
                  <X className="h-4 w-4" />
               </button>
             )}
          </div>
        </form>

        {/* Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="mt-3 bg-background/90 backdrop-blur-2xl border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
             {searchResults.map((res, i) => (
                <button 
                  key={i}
                  onClick={() => goToLocation(res.lat, res.lon)}
                  className="w-full flex items-start gap-3 p-4 text-left hover:bg-primary/10 border-b border-border/50 last:border-none transition-colors"
                >
                   <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                   <div>
                      <p className="text-sm font-black text-foreground line-clamp-1">{res.display_name.split(",")[0]}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{res.display_name}</p>
                   </div>
                </button>
             ))}
          </div>
        )}
      </div>

      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}

