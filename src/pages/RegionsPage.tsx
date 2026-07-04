import { useState, useEffect, useRef, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useRegions, useCreateRegion, useUpdateRegion, useDeleteRegion } from "@/services/regions";
import type { RegionRow } from "@/services/regions";
import { MapPin, Plus, Trash2, Save, Pencil, Loader2, DollarSign, Search, X, MousePointer, PenTool } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CityServiceList } from "@/components/admin/CityServiceList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PricingTablesManager } from "@/components/admin/PricingTablesManager";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useDrivers } from "@/services/drivers";

const escapeHtml = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

type DrawMode = "none" | "points" | "freehand";

export default function RegionsPage() {
  const { data: regions, isLoading } = useRegions();
  const { data: allDrivers } = useDrivers();
  // Show all online drivers with a known location on the map
  const drivers = allDrivers?.filter(d => d.is_online === true && d.latitude != null && d.longitude != null) || [];
  const createRegion = useCreateRegion();
  const updateRegion = useUpdateRegion();
  const deleteRegion = useDeleteRegion();
  const { toast } = useToast();

  const [selectedRegion, setSelectedRegion] = useState<RegionRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#3B82F6");
  const [editPrice, setEditPrice] = useState("0");
  const [editCity, setEditCity] = useState("");
  const [drawMode, setDrawMode] = useState<DrawMode>("none");
  const [drawnPoints, setDrawnPoints] = useState<[number, number][]>([]);
  const isDrawingFreehand = useRef(false);

  // City search
  const [citySearch, setCitySearch] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<any[]>([]);
  const [searchingCity, setSearchingCity] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Region config modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [pendingGeometry, setPendingGeometry] = useState<any>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const renderedRegionIdsRef = useRef<string[]>([]);
  const driverMarkersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const m = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [-56.4461, -14.4086],
      zoom: 11,
    });
    m.addControl(new maplibregl.NavigationControl(), "bottom-right");
    mapRef.current = m;
    return () => { m.remove(); mapRef.current = null; };
  }, []);

  // Auto-center map on regions when they first load
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !regions || regions.length === 0) return;
    const allCoords: [number, number][] = [];
    regions.forEach((region) => {
      if (!region.geometry) return;
      const geom = region.geometry as any;
      if (geom.type === "Polygon") {
        geom.coordinates[0]?.forEach((c: [number, number]) => allCoords.push(c));
      } else if (geom.type === "MultiPolygon") {
        geom.coordinates.forEach((poly: any) => poly[0]?.forEach((c: [number, number]) => allCoords.push(c)));
      }
    });
    if (allCoords.length === 0) return;
    const lngs = allCoords.map(c => c[0]);
    const lats = allCoords.map(c => c[1]);
    const bounds = new maplibregl.LngLatBounds(
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)]
    );
    const fitMap = () => m.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 1000 });
    if (m.isStyleLoaded()) fitMap();
    else m.on("load", fitMap);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions?.length === 0 ? undefined : regions?.[0]?.id]);

  // Render regions on map
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !regions) return;
    const handleLoad = () => {
      // Clean old layers (using tracking ref to catch deletions)
      renderedRegionIdsRef.current.forEach((id) => {
        [`region-fill-${id}`, `region-line-${id}`, `region-highlight-${id}`].forEach((l) => {
          if (m.getLayer(l)) m.removeLayer(l);
        });
        if (m.getSource(`region-${id}`)) m.removeSource(`region-${id}`);
      });
      renderedRegionIdsRef.current = [];

      regions.forEach((region) => {
        if (!region.geometry) return;
        const geojson = region.geometry as any;
        if (geojson.type !== "Polygon") return;

        m.addSource(`region-${region.id}`, {
          type: "geojson",
          data: { type: "Feature", properties: { name: region.name, price: region.price }, geometry: geojson },
        });

        m.addLayer({
          id: `region-fill-${region.id}`,
          type: "fill",
          source: `region-${region.id}`,
          paint: { "fill-color": region.color, "fill-opacity": 0.25 },
        });

        m.addLayer({
          id: `region-line-${region.id}`,
          type: "line",
          source: `region-${region.id}`,
          paint: { "line-color": region.color, "line-width": 2.5 },
        });

        // Click selection only (no hover popup)
        m.on("mouseenter", `region-fill-${region.id}`, () => {
          if (drawMode !== "none") return;
          m.getCanvas().style.cursor = "pointer";
          m.setPaintProperty(`region-fill-${region.id}`, "fill-opacity", 0.45);
        });

        m.on("mouseleave", `region-fill-${region.id}`, () => {
          if (drawMode !== "none") return;
          m.getCanvas().style.cursor = "";
          m.setPaintProperty(`region-fill-${region.id}`, "fill-opacity", 0.25);
        });

        m.on("click", `region-fill-${region.id}`, () => {
          if (drawMode !== "none") return;
          setSelectedRegion(region);
          setEditName(region.name);
          setEditColor(region.color);
          setEditPrice(String(region.price));
          setDrawMode("none");
          setDrawnPoints([]);
        });

        renderedRegionIdsRef.current.push(region.id);
      });

      // Clean drawing layers
      ["draw-fill", "draw-line", "draw-points"].forEach((l) => { if (m.getLayer(l)) m.removeLayer(l); });
      if (m.getSource("draw")) m.removeSource("draw");
    };
    if (m.isStyleLoaded()) handleLoad();
    else m.on("load", handleLoad);
  }, [regions, drawMode]);

  // Render driver markers
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;

    driverMarkersRef.current.forEach((mk) => mk.remove());
    driverMarkersRef.current = [];

    (drivers ?? []).forEach((driver) => {
      const lat = driver.latitude;
      const lng = driver.longitude;
      if (!lat || !lng) return;

      const el = document.createElement("div");
      el.className = "driver-marker-container";
      
      el.innerHTML = `
        <div class="pin-wrapper" style="
          position: relative; cursor: pointer; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
          transition: transform 0.2s;
        " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 30px; height: 30px; background: #22c55e; border-radius: 50%; opacity: 0.6; animation: pinPulse 2s ease-out infinite;"></div>
          <div style="width: 44px; height: 44px; border-radius: 50%; background: #22c55e; border: 3px solid white; display: flex; align-items: center; justify-content: center; position: relative; z-index: 2;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; overflow: hidden;">
              <img src="/logo.png" style="width: 22px; height: 22px; object-fit: contain;" alt="M" />
            </div>
          </div>
          <div style="position: absolute; bottom: -25px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; white-space: nowrap; z-index: 3; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
            ${escapeHtml(driver.full_name?.split(" ")[0] || "Entregador")}
          </div>
        </div>
        <style>@keyframes pinPulse { 0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; } 100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; } }</style>
      `;

      const popupContent = `
        <div style="padding: 16px; font-family: 'Inter', sans-serif; min-width: 200px; background: #ffffff; border-radius: 20px;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <div style="width: 48px; height: 48px; border-radius: 12px; background: #f0fdf4; display: flex; align-items: center; justify-content: center;">
              <img src="/logo.png" style="width: 28px; height: 28px; object-fit: contain;" />
            </div>
            <div>
              <div style="font-size: 15px; font-weight: 800; color: #111827;">${escapeHtml(driver.full_name || "Entregador")}</div>
              <div style="font-size: 12px; color: #22c55e; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                <div style="width: 6px; height: 6px; border-radius: 50%; background: #22c55e;"></div>
                Em Rota
              </div>
            </div>
          </div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(popupContent))
        .addTo(m);

      driverMarkersRef.current.push(marker);
    });
  }, [drivers]);

  // Points drawing mode - click to add vertices
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const handleClick = (e: maplibregl.MapMouseEvent) => {
      if (drawMode !== "points") return;
      setDrawnPoints((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
    };
    m.on("click", handleClick);
    return () => { m.off("click", handleClick); };
  }, [drawMode]);

  // Freehand drawing mode - drag to draw
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (drawMode !== "freehand") return;

    const canvas = m.getCanvas();
    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      isDrawingFreehand.current = true;
      m.dragPan.disable();
      setDrawnPoints([]);
      const lngLat = m.unproject([e.offsetX, e.offsetY]);
      setDrawnPoints([[lngLat.lng, lngLat.lat]]);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDrawingFreehand.current) return;
      const lngLat = m.unproject([e.offsetX, e.offsetY]);
      setDrawnPoints((prev) => {
        // Downsample: only add if distance > threshold
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          const dx = lngLat.lng - last[0];
          const dy = lngLat.lat - last[1];
          if (Math.sqrt(dx * dx + dy * dy) < 0.0003) return prev;
        }
        return [...prev, [lngLat.lng, lngLat.lat]];
      });
    };
    const onMouseUp = () => {
      if (!isDrawingFreehand.current) return;
      isDrawingFreehand.current = false;
      m.dragPan.enable();
    };
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      m.dragPan.enable();
    };
  }, [drawMode]);

  // Update cursor
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (drawMode === "points") m.getCanvas().style.cursor = "crosshair";
    else if (drawMode === "freehand") m.getCanvas().style.cursor = "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22><circle cx=%2212%22 cy=%2212%22 r=%224%22 fill=%22%233B82F6%22/></svg>') 12 12, crosshair";
    else m.getCanvas().style.cursor = "";
  }, [drawMode]);

  // Drawing visualization
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !m.isStyleLoaded()) return;
    ["draw-fill", "draw-line", "draw-points"].forEach((l) => { if (m.getLayer(l)) m.removeLayer(l); });
    if (m.getSource("draw")) m.removeSource("draw");
    if (drawnPoints.length === 0) return;

    const coords = [...drawnPoints];
    const isClosed = coords.length > 2;
    if (isClosed) coords.push(coords[0]);

    m.addSource("draw", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: isClosed
              ? { type: "Polygon", coordinates: [coords] }
              : { type: "LineString", coordinates: coords },
          },
          ...drawnPoints.map((p) => ({
            type: "Feature" as const,
            properties: {},
            geometry: { type: "Point" as const, coordinates: p },
          })),
        ],
      },
    });

    if (isClosed) {
      m.addLayer({
        id: "draw-fill",
        type: "fill",
        source: "draw",
        filter: ["==", "$type", "Polygon"],
        paint: { "fill-color": editColor, "fill-opacity": 0.3 },
      });
      m.addLayer({
        id: "draw-line",
        type: "line",
        source: "draw",
        filter: ["==", "$type", "Polygon"],
        paint: { "line-color": editColor, "line-width": 2.5 },
      });
    } else {
      m.addLayer({
        id: "draw-line",
        type: "line",
        source: "draw",
        filter: ["==", "$type", "LineString"],
        paint: { "line-color": editColor, "line-width": 2, "line-dasharray": [2, 2] },
      });
    }

    m.addLayer({
      id: "draw-points",
      type: "circle",
      source: "draw",
      filter: ["==", "$type", "Point"],
      paint: { "circle-radius": 5, "circle-color": editColor, "circle-stroke-width": 2, "circle-stroke-color": "#fff" },
    });
  }, [drawnPoints, editColor]);

  // City search
  const searchCity = useCallback((query: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim()) { setCitySuggestions([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearchingCity(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=br`);
        const data = await res.json();
        setCitySuggestions(data);
      } catch { setCitySuggestions([]); }
      setSearchingCity(false);
    }, 400);
  }, []);

  const selectCity = (item: any) => {
    const m = mapRef.current;
    // zoom 11 = city level instead of neighborhood
    if (m) m.flyTo({ center: [parseFloat(item.lon), parseFloat(item.lat)], zoom: 11, duration: 1500 });
    setCitySearch(item.display_name.split(",")[0]);
    setEditCity(item.display_name.split(",")[0]);
    setCitySuggestions([]);
  };

  const startDrawing = (mode: DrawMode) => {
    setDrawMode(mode);
    setDrawnPoints([]);
    setSelectedRegion(null);
    setEditName("");
    setEditColor("#3B82F6");
    setEditPrice("0");
    setEditCity("");
  };

  const cancelDrawing = () => {
    setDrawMode("none");
    setDrawnPoints([]);
    isDrawingFreehand.current = false;
    mapRef.current?.dragPan.enable();
  };

  const undoLastPoint = () => setDrawnPoints((prev) => prev.slice(0, -1));

  const finishDrawing = () => {
    if (drawnPoints.length < 3) {
      toast({ title: "Desenhe pelo menos 3 pontos", variant: "destructive" });
      return;
    }
    const coords = [...drawnPoints, drawnPoints[0]];
    setPendingGeometry({ type: "Polygon", coordinates: [coords] });
    setShowConfigModal(true);
  };

  const saveNewRegion = async () => {
    if (!pendingGeometry) return;
    if (!editName.trim()) {
      toast({ title: "Digite um nome para a região", variant: "destructive" });
      return;
    }
    try {
      await createRegion.mutateAsync({
        name: editName,
        color: editColor,
        price: parseFloat(editPrice) || 0,
        geometry: pendingGeometry as any,
      });
      toast({ title: "Região criada!" });
      setDrawMode("none");
      setDrawnPoints([]);
      setShowConfigModal(false);
      setPendingGeometry(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const saveEditRegion = async () => {
    if (!selectedRegion) return;
    try {
      await updateRegion.mutateAsync({
        id: selectedRegion.id,
        updates: { name: editName, color: editColor, price: parseFloat(editPrice) || 0 },
      });
      toast({ title: "Região atualizada!" });
      setSelectedRegion(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRegion.mutateAsync(id);
      toast({ title: "Região excluída" });
      setSelectedRegion(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <AdminLayout title="Regiões" subtitle="Gestão de regiões e precificação" fullHeight>
      <Tabs defaultValue="map" className="flex flex-col h-[calc(100vh-73px)] w-full">
        <div className="px-6 py-3 border-b border-border bg-card z-20">
          <TabsList className="bg-muted/50 border border-border">
            <TabsTrigger value="map" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium">Regiões Mapeadas</TabsTrigger>
            <TabsTrigger value="pricing" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium">Tabelas de Preço</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="map" className="flex-1 mt-0 m-0 flex-col lg:flex-row relative data-[state=active]:flex data-[state=inactive]:hidden">
          {/* Map */}
        <div className="flex-1 relative h-full min-h-[300px]">
          <div ref={mapContainerRef} className="absolute inset-0" />

          {/* City search */}
          <div className="absolute top-4 right-4 w-72 z-10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={citySearch}
                onChange={(e) => { setCitySearch(e.target.value); searchCity(e.target.value); }}
                placeholder="Buscar cidade..."
                className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-card border border-border text-sm outline-none focus:border-primary shadow-md"
              />
              {citySearch && (
                <button onClick={() => { setCitySearch(""); setCitySuggestions([]); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
            {citySuggestions.length > 0 && (
              <div className="mt-1 bg-card rounded-xl border border-border shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                {citySuggestions.map((s, i) => (
                  <button key={i} onClick={() => selectCity(s)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors border-b border-border last:border-0">
                    <p className="font-medium text-foreground truncate">{s.display_name.split(",")[0]}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.display_name}</p>
                  </button>
                ))}
              </div>
            )}
            {searchingCity && (
              <div className="mt-1 bg-card rounded-xl border border-border shadow-lg p-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Buscando...</span>
              </div>
            )}
          </div>

          {/* Drawing controls */}
          <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
            {drawMode === "none" ? (
              <div className="flex gap-2">
                <button
                  onClick={() => startDrawing("points")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-md hover:bg-primary/90"
                >
                  <MousePointer className="h-4 w-4" /> Modo Pontos
                </button>
                <button
                  onClick={() => startDrawing("freehand")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-medium shadow-md hover:bg-accent/90"
                >
                  <PenTool className="h-4 w-4" /> Modo Lápis
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={finishDrawing}
                  disabled={drawnPoints.length < 3 || createRegion.isPending}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-md disabled:opacity-50"
                >
                  {createRegion.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Finalizar
                </button>
                {drawMode === "points" && drawnPoints.length > 0 && (
                  <button onClick={undoLastPoint} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card text-foreground text-sm font-medium shadow-md">
                    Desfazer
                  </button>
                )}
                <button onClick={cancelDrawing} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card text-foreground text-sm font-medium shadow-md">
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {/* Drawing mode indicator */}
          {drawMode !== "none" && (
            <div className="absolute bottom-4 left-4 bg-card rounded-xl p-3 shadow-md z-10 flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full animate-pulse ${drawMode === "points" ? "bg-primary" : "bg-accent"}`} />
              <span className="text-xs text-muted-foreground">
                {drawMode === "points"
                  ? `Clique para adicionar vértices • ${drawnPoints.length} ponto(s) • Mín. 3`
                  : `Arraste para desenhar • ${drawnPoints.length} ponto(s) • Solte para parar`}
              </span>
            </div>
          )}
        </div>

        {/* Region config modal overlay */}
        {showConfigModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card rounded-2xl p-6 w-96 shadow-xl space-y-4">
              <h3 className="font-bold text-lg text-foreground">Configurar Região</h3>
              <div>
                <label className="text-sm font-medium mb-1.5 block text-foreground">Nome da região *</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ex: Centro"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1.5 block text-foreground">Cor</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0" />
                    <input value={editColor} onChange={(e) => setEditColor(e.target.value)} className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none font-mono" />
                  </div>
                </div>
                <div className="w-28">
                  <label className="text-sm font-medium mb-1.5 block text-foreground">Preço (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block text-foreground">Cidade</label>
                <input
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  placeholder="Ex: Cuiabá"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setShowConfigModal(false); setPendingGeometry(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveNewRegion}
                  disabled={createRegion.isPending || !editName.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createRegion.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar Região
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sidebar */}
        <div className="w-full lg:w-80 bg-card border-l border-border overflow-y-auto">
          {selectedRegion && (
            <div className="p-4 border-b border-border space-y-3">
              <h3 className="font-bold text-foreground text-sm">Editar Região</h3>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Cor</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                    <input value={editColor} onChange={(e) => setEditColor(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none font-mono" />
                  </div>
                </div>
                <div className="w-28">
                  <label className="text-xs text-muted-foreground mb-1 block">Preço (R$)</label>
                  <input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary" />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveEditRegion}
                  disabled={updateRegion.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                >
                  {updateRegion.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar
                </button>
                <button
                  onClick={() => handleDelete(selectedRegion.id)}
                  disabled={deleteRegion.isPending}
                  className="px-4 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-medium disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="p-4 space-y-6">
            <CityServiceList 
              onSelect={(cityName, coords) => {
                mapRef.current?.flyTo({ center: coords, zoom: 11, duration: 1500 });
              }}
            />

            <hr className="border-border" />

            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Regiões ({regions?.length ?? 0})
            </h3>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="animate-pulse rounded-xl bg-muted h-20" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {(regions ?? []).map((region) => (
                  <button
                    key={region.id}
                    onClick={() => {
                      setSelectedRegion(region);
                      setEditName(region.name);
                      setEditColor(region.color);
                      setEditPrice(String(region.price));
                      setDrawMode("none");
                      setDrawnPoints([]);
                      const geo = region.geometry as any;
                      if (geo?.type === "Polygon" && geo.coordinates?.[0]) {
                        const coords = geo.coordinates[0] as [number, number][];
                        const avgLng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
                        const avgLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
                        mapRef.current?.flyTo({ center: [avgLng, avgLat], zoom: 14, duration: 1000 });
                      }
                    }}
                    className={`w-full text-left rounded-xl p-3 transition-all ${
                      selectedRegion?.id === region.id
                        ? "bg-primary/10 border border-primary/30"
                        : "bg-muted/50 hover:bg-muted border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${region.color}20` }}>
                        <MapPin className="h-4 w-4" style={{ color: region.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{region.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: region.color }} />
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <DollarSign className="h-3 w-3" /> R$ {Number(region.price).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        </TabsContent>
        
        <TabsContent value="pricing" className="flex-1 mt-0 m-0 data-[state=active]:block data-[state=inactive]:hidden h-[calc(100vh-130px)]">
          <PricingTablesManager />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

