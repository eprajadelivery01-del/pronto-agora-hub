import { AdminLayout } from "@/components/admin/AdminLayout";
import { MotoboysSidebar } from "@/components/admin/MotoboysSidebar";
import { BikeIcon } from "@/components/icons/BikeIcon";
import { NotificationsPanel } from "@/components/admin/NotificationsPanel";
import { useDeliveryStats, useDeliveries } from "@/services/deliveries";
import { useOnlineDrivers } from "@/services/drivers";
import { useCompanies } from "@/services/companies";
import { useAllRealtime } from "@/services/realtime";
import { useState } from "react";
import { useCity } from "@/contexts/CityContext";
import { useRegions, useCities } from "@/services/regions";
import { UnifiedMap } from "@/components/shared/UnifiedMap";
import { HeroMapSection } from "@/components/shared/HeroMapSection";
import {
  Package, Building2, DollarSign, TrendingUp, Clock, CheckCircle, Search, MapPin, Loader2
} from "lucide-react";

export default function DashboardPage() {

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showOnlyCompleted, setShowOnlyCompleted] = useState(false);
  const [filterCityId, setFilterCityId] = useState("");

  const { data: stats } = useDeliveryStats({ dateFrom, dateTo, cityId: filterCityId });
  const { data: onlineDrivers } = useOnlineDrivers();
  const { data: companies } = useCompanies();
  
  // Delivered count for the top stat card
  const { data: deliveredData } = useDeliveries({ status: "completed", dateFrom, dateTo, cityId: filterCityId });
  
  // In-transit count for the top stat card
  const { data: inTransitData } = useDeliveries({ status: "in_route", dateFrom, dateTo, cityId: filterCityId });

  // List of deliveries to show on the dashboard
  const { data: recentDeliveries, isLoading: loadingDeliveries } = useDeliveries({ 
    status: showOnlyCompleted ? "completed" : undefined,
    dateFrom,
    dateTo,
    cityId: filterCityId,
    pageSize: 15
  });

  const { data: adminCities } = useCities();

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
          {/* Dashboard Filters */}
          <div className="bg-card p-4 rounded-2xl shadow-card border border-border flex flex-col sm:flex-row items-center justify-between gap-4">
             <div className="flex items-center gap-3">
               <h3 className="text-sm font-bold text-foreground">Filtros do Painel:</h3>
             </div>
             <div className="flex flex-wrap items-center gap-3">
               <div className="flex items-center gap-2">
                 <input 
                   type="date" 
                   value={dateFrom} 
                   onChange={(e) => setDateFrom(e.target.value)}
                   className="bg-background border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
                 />
                 <span className="text-muted-foreground text-xs">até</span>
                 <input 
                   type="date" 
                   value={dateTo} 
                   onChange={(e) => setDateTo(e.target.value)}
                   className="bg-background border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
                 />
               </div>
               <div className="h-6 w-px bg-border hidden sm:block" />
               <select
                 value={filterCityId}
                 onChange={(e) => setFilterCityId(e.target.value)}
                 className="bg-background border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-primary min-w-[150px]"
               >
                 <option value="">Todas as Cidades</option>
                 {(adminCities || []).map((c: any) => (
                   <option key={c.id} value={c.id}>{c.name}</option>
                 ))}
               </select>
               <div className="h-6 w-px bg-border hidden sm:block" />
               <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                 <input 
                   type="checkbox" 
                   checked={showOnlyCompleted}
                   onChange={(e) => setShowOnlyCompleted(e.target.checked)}
                   className="rounded text-primary focus:ring-primary h-4 w-4"
                 />
                 Apenas Corridas Finalizadas
               </label>
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<Package className="h-5 w-5" />} label="Corridas Hoje" value={stats?.today ?? 0} iconBg="bg-warning/10" iconColor="text-warning" />
            <StatCard icon={<Clock className="h-5 w-5" />} label="Em Trânsito" value={inTransitCount} iconBg="bg-primary/10" iconColor="text-primary" pulse />
            <StatCard icon={<BikeIcon className="h-5 w-5" />} label="Motoboys Online" value={onlineDrivers?.length ?? 0} iconBg="bg-success/10" iconColor="text-success" pulse />
            <StatCard icon={<DollarSign className="h-5 w-5" />} label="Faturamento" value={`R$ ${(stats?.todayRevenue ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} iconBg="bg-info/10" iconColor="text-info" />
          </div>

          <div className="flex gap-3 flex-wrap">
            <MiniStat icon={<CheckCircle className="h-3.5 w-3.5 text-success" />} label="Entregues" value={deliveredCount} />
            <MiniStat icon={<Building2 className="h-3.5 w-3.5 text-primary" />} label="Empresas" value={companies?.length ?? 0} />
            <MiniStat icon={<TrendingUp className="h-3.5 w-3.5 text-accent" />} label="Total Geral" value={stats?.total ?? 0} />
          </div>

          {/* Deliveries List */}
          <div className="mt-4 bg-card rounded-2xl p-4 shadow-card border border-border flex-1 min-h-[300px]">
            <h3 className="text-sm font-bold text-foreground mb-4">
              {showOnlyCompleted ? "Corridas Finalizadas" : "Últimas Corridas"}
            </h3>
            
            {loadingDeliveries ? (
              <div className="flex items-center justify-center h-32">
                 <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : recentDeliveries?.data && recentDeliveries.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="pb-3 pr-4 font-medium">Data</th>
                      <th className="pb-3 pr-4 font-medium">Cliente</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 font-medium text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentDeliveries.data.map((delivery) => (
                      <tr key={delivery.id} className="hover:bg-muted/50 transition-colors">
                        <td className="py-3 pr-4 text-xs">
                          {new Date(delivery.created_at).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 pr-4 font-medium">
                          {delivery.customer_name}
                          <div className="text-[10px] text-muted-foreground font-normal">
                             {delivery.companies?.name || "Marketplace"}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            delivery.status === 'completed' || delivery.status === 'delivered' ? 'bg-success/10 text-success' :
                            delivery.status === 'cancelled' ? 'bg-destructive/10 text-destructive' :
                            'bg-primary/10 text-primary'
                          }`}>
                            {delivery.status === 'completed' || delivery.status === 'delivered' ? 'Finalizada' :
                             delivery.status === 'cancelled' ? 'Cancelada' :
                             delivery.status === 'pending' ? 'Pendente' :
                             delivery.status === 'in_route' || delivery.status === 'in_transit' ? 'Em Rota' :
                             delivery.status}
                          </span>
                        </td>
                        <td className="py-3 text-right font-bold text-xs">
                          R$ {Number((delivery as any).commission ?? delivery.value ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                Nenhuma corrida encontrada para os filtros atuais.
              </div>
            )}
          </div>
        </div>

        <div className="hidden xl:block w-80 flex-shrink-0">
          <NotificationsPanel />
        </div>
      </div>
      {/* ── BONASOFT Watermark ── */}
      <div className="mt-16 pb-8 text-center opacity-40 select-none pointer-events-none">
        <p className="text-[11px] font-black uppercase tracking-[0.6em] text-muted-foreground ml-2">BONASOFT</p>
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
