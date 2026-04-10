import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MapView } from "@/components/admin/MapView";
import { CityServiceList } from "@/components/admin/CityServiceList";

export default function MapPage() {
  const [centerCity, setCenterCity] = useState<{ name: string; lat: number; lng: number } | null>(null);

  return (
    <AdminLayout title="Mapa" subtitle="Rastreamento em tempo real">
      <div className="-m-4 md:-m-6 h-[calc(100vh-73px)] relative">
        <MapView centerCity={centerCity} />
        
        {/* City Filter Overlay */}
        <div className="absolute top-6 left-6 right-6 z-10">
          <CityServiceList 
            variant="horizontal"
            selectedCity={centerCity?.name}
            onSelect={(name, [lng, lat]) => setCenterCity({ name, lat, lng })}
            className="bg-background/40 backdrop-blur-xl p-4 rounded-3xl border border-white/20 shadow-2xl max-w-full overflow-hidden"
          />
        </div>
      </div>
    </AdminLayout>
  );
}
