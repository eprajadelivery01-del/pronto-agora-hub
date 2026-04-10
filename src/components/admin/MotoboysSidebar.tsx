import { useState } from "react";
import { Search, ChevronDown, ChevronUp, Bike, Building2 } from "lucide-react";
import { useDrivers } from "@/services/drivers";
import { useCompanies } from "@/services/companies";

export function MotoboysSidebar() {
  const [search, setSearch] = useState("");
  const [showOnline, setShowOnline] = useState(true);
  const [showOffline, setShowOffline] = useState(true);
  const [showLocais, setShowLocais] = useState(true);

  const { data: drivers } = useDrivers();
  const { data: companies } = useCompanies();

  const allDrivers = drivers ?? [];
  const online = allDrivers.filter((d) => d.is_online);
  const offline = allDrivers.filter((d) => !d.is_online);

  const filterBySearch = (name: string) => !search || name.toLowerCase().includes(search.toLowerCase());

  return (
    <div className="space-y-6">
      {/* CARD 1: MOTOBOYS */}
      <div className="rounded-2xl bg-card shadow-card flex flex-col overflow-hidden border border-border">
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Bike className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Status dos Motoboys</h3>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
              placeholder="Buscar motoboy..."
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[400px]">
          <div>
            <button onClick={() => setShowOnline(!showOnline)} className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:bg-muted/50">
              Online ({online.length})
              {showOnline ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showOnline && online.filter((d) => filterBySearch(d.profiles?.full_name || "")).map((driver) => (
              <div key={driver.id} className="flex items-center justify-between px-4 py-2 hover:bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center text-sm overflow-hidden">
                    {driver.profiles?.avatar_url ? <img src={driver.profiles?.avatar_url} alt="" className="h-full w-full object-cover" /> : "🏍️"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{driver.profiles?.full_name || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{driver.vehicle || "—"}</p>
                  </div>
                </div>
                <span className="h-2 w-2 rounded-full bg-success shrink-0" />
              </div>
            ))}
          </div>

          <div>
            <button onClick={() => setShowOffline(!showOffline)} className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:bg-muted/50">
              Offline ({offline.length})
              {showOffline ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showOffline && offline.filter((d) => filterBySearch(d.profiles?.full_name || "")).map((driver) => (
              <div key={driver.id} className="flex items-center justify-between px-4 py-2 hover:bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm overflow-hidden opacity-60">
                    {driver.profiles?.avatar_url ? <img src={driver.profiles?.avatar_url} alt="" className="h-full w-full object-cover" /> : "🏍️"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground/70 truncate">{driver.profiles?.full_name || "—"}</p>
                    <p className="text-[10px] text-muted-foreground/60">{driver.vehicle || "—"}</p>
                  </div>
                </div>
                <span className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CARD 2: LOCAIS ATIVOS */}
      <div className="rounded-2xl bg-card shadow-card flex flex-col overflow-hidden border border-border">
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-accent" />
            <h3 className="text-sm font-bold text-foreground">Locais Ativos</h3>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[300px]">
          {companies?.filter(c => c.is_active).length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-xs text-muted-foreground">Nenhum local ativo no momento</p>
            </div>
          ) : (
            (companies ?? []).filter(c => c.is_active && filterBySearch(c.name)).map((company) => (
              <div key={company.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 border-b border-border/50 last:border-0">
                <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center text-lg">
                  🏪
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{company.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{company.address || company.phone || "—"}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
