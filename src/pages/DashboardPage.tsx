import { AdminLayout } from "@/components/admin/AdminLayout";
import { MotoboysSidebar } from "@/components/admin/MotoboysSidebar";
import { NotificationsPanel } from "@/components/admin/NotificationsPanel";
import { useDeliveryStats, useDeliveries } from "@/services/deliveries";
import { useOnlineDrivers } from "@/services/drivers";
import { useCompanies } from "@/services/companies";
import { useAllRealtime } from "@/services/realtime";
import { useState } from "react";
import { useCity } from "@/contexts/CityContext";
import { useRegions } from "@/services/regions";
import { UnifiedMap } from "@/components/shared/UnifiedMap";
import { HeroMapSection } from "@/components/shared/HeroMapSection";
import {
  Package, Bike, Building2, DollarSign, TrendingUp, Clock, CheckCircle, Search, MapPin, Loader2
} from "lucide-react";

export default function DashboardPage() {

  const { data: stats } = useDeliveryStats();
  const { data: onlineDrivers } = useOnlineDrivers();
  const { data: companies } = useCompanies();
  const { data: inTransitData } = useDeliveries({ status: "in_route" });
  const { data: deliveredData } = useDeliveries({ status: "completed" });

  const { selectedCity, setCity } = useCity();
  const { data: regions } = useRegions(selectedCity || undefined);

  const inTransitCount = inTransitData?.count ?? 0;
  const deliveredCount = deliveredData?.count ?? 0;

  const [cityQuery, setCityQuery] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<Array<{ name: string; lat: number; lng: number }>>([]);
  const [searchingCity, setSearchingCity] = useState(false);

  const searchCity = async () => {
    if (cityQuery.length < 2) return;
    setSearchingCity(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityQuery)}&limit=5&addressdetails=1`
      );
      const data = await res.json();
      setCitySuggestions(
        data.map((r: any) => ({
          name: r.display_name.split(",")[0],
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
        }))
      );
    } catch {}
    setSearchingCity(false);
  };

  const selectCity = (city: { name: string; lat: number; lng: number }) => {
    setCity(city.name);
    setCitySuggestions([]);
    setCityQuery("");
  };

  return (
    <AdminLayout title="Painel">
      <HeroMapSection 
        title="Central de Comando Lojista" 
        subtitle="Gestão da sua loja e entregas em tempo real." 
      />
      <div className="flex flex-col xl:flex-row gap-8 p-4 md:p-6 w-full min-h-0">
        <div className="hidden xl:block w-72 flex-shrink-0">
          <MotoboysSidebar />
        </div>

        <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
          {/* City selector moved to Hero or shared context */}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<Package className="h-5 w-5" />} label="Corridas Hoje" value={stats?.today ?? 0} iconBg="bg-warning/10" iconColor="text-warning" />
            <StatCard icon={<Clock className="h-5 w-5" />} label="Em Trânsito" value={inTransitCount} iconBg="bg-primary/10" iconColor="text-primary" pulse />
            <StatCard icon={<Bike className="h-5 w-5" />} label="Motoboys Online" value={onlineDrivers?.length ?? 0} iconBg="bg-success/10" iconColor="text-success" pulse />
            <StatCard icon={<DollarSign className="h-5 w-5" />} label="Faturamento" value={`R$ ${(stats?.todayRevenue ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} iconBg="bg-info/10" iconColor="text-info" />
          </div>

          <div className="flex gap-3 flex-wrap">
            <MiniStat icon={<CheckCircle className="h-3.5 w-3.5 text-success" />} label="Entregues" value={deliveredCount} />
            <MiniStat icon={<Building2 className="h-3.5 w-3.5 text-primary" />} label="Empresas" value={companies?.length ?? 0} />
            <MiniStat icon={<TrendingUp className="h-3.5 w-3.5 text-accent" />} label="Total Geral" value={stats?.total ?? 0} />
          </div>

          {/* Map moved to Hero */}
        </div>

        <div className="hidden xl:block w-80 flex-shrink-0">
          <NotificationsPanel />
        </div>
      </div>
    </AdminLayout>
  );
}

function StatCard({ icon, label, value, iconBg, iconColor, pulse }: {
  icon: React.ReactNode; label: string; value: string | number;
  iconBg: string; iconColor: string; pulse?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-card hover:shadow-card-hover transition-shadow">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg} ${iconColor} ${pulse ? "animate-pulse" : ""}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-card-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 shadow-card text-sm">
      {icon}
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
