import { useState } from "react";
import { Search, MessageSquare } from "lucide-react";
import { BikeIcon } from "@/components/icons/BikeIcon";
import { useNavigate } from "react-router-dom";
import { useDrivers } from "@/services/drivers";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function MotoboysSidebar() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"online" | "offline">("online");
  const navigate = useNavigate();
  const { data: drivers, isLoading } = useDrivers();

  const allDrivers = drivers ?? [];
  const online = allDrivers.filter((d) => d.is_online);
  const offline = allDrivers.filter((d) => !d.is_online);
  const list = (tab === "online" ? online : offline).filter((d) =>
    !search || (d.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <BikeIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground leading-tight">Frota</h3>
            <p className="text-[11px] text-muted-foreground">{online.length} online · {offline.length} offline</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 pt-3">
        <div className="flex bg-muted/40 rounded-lg p-0.5 gap-0.5">
          {(["online", "offline"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-bold transition-all",
                tab === t
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", t === "online" ? "bg-success" : "bg-muted-foreground/40")} />
              {t === "online" ? "Online" : "Offline"}
              <span className={cn(
                "ml-1 px-1.5 rounded-full text-[9px] tabular-nums",
                tab === t && t === "online" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
              )}>
                {t === "online" ? online.length : offline.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pt-2 pb-2">
        <div className="flex items-center gap-2 bg-muted/40 border border-border/30 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary/30 transition-all">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-xs outline-none w-full placeholder:text-muted-foreground/60"
            placeholder="Buscar motoboy..."
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 px-2 pb-2">
        {isLoading ? (
          <div className="p-2 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-2.5 py-2">
                <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="w-28 h-3 rounded" />
                  <Skeleton className="w-16 h-2.5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[120px] text-center py-8">
            <BikeIcon className="h-6 w-6 text-muted-foreground/30 mb-2" />
            <p className="text-xs font-medium text-muted-foreground">
              {search ? "Nenhum resultado" : tab === "online" ? "Nenhum motoboy online" : "Todos estão online"}
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {list.map((driver) => {
              const isOn = driver.is_online;
              return (
                <li key={driver.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate("/admin/drivers")}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/admin/drivers"); } }}
                    className={cn(
                      "group flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 cursor-pointer transition-all border border-transparent",
                      "hover:bg-primary/5 hover:border-primary/20 hover:shadow-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center text-sm border overflow-hidden",
                          isOn ? "bg-success/5 border-success/20" : "bg-muted border-border grayscale"
                        )}>
                          {driver.avatar_url ? (
                            <img src={driver.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : "🏍️"}
                        </div>
                        <span className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card",
                          isOn ? "bg-success" : "bg-muted-foreground/40"
                        )} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          {driver.full_name || "—"}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                          {driver.vehicle_type || "motorcycle"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/chat?userId=${driver.user_id}`); }}
                      className="p-1.5 rounded-lg bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/20 active:scale-95"
                      title="Chat"
                    >
                      <MessageSquare size={13} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
