import { Bell, Check, Trash2, Package, Truck, CheckCircle, XCircle, Radio } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: Date;
  read: boolean;
  type: "info" | "success" | "warning" | "error";
  icon: React.ReactNode;
}

const STATUS_MAP: Record<string, { title: string; type: AppNotification["type"]; icon: React.ReactNode }> = {
  pending: { title: "Novo pedido", type: "info", icon: <Package className="h-4 w-4" /> },
  broadcasted: { title: "Pedido enviado", type: "info", icon: <Radio className="h-4 w-4" /> },
  accepted: { title: "Pedido aceito", type: "success", icon: <CheckCircle className="h-4 w-4" /> },
  collecting: { title: "Coletando", type: "info", icon: <Package className="h-4 w-4" /> },
  in_route: { title: "Em rota", type: "info", icon: <Truck className="h-4 w-4" /> },
  completed: { title: "Entrega concluída", type: "success", icon: <CheckCircle className="h-4 w-4" /> },
  cancelled: { title: "Entrega cancelada", type: "error", icon: <XCircle className="h-4 w-4" /> },
};

const READ_KEY = "epj_notif_read_ids";

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

export function NotificationsPopover() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(getReadIds);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("deliveries")
        .select("id, status, customer_name, value, updated_at, companies(name), regions(name)")
        .order("updated_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const mapped: AppNotification[] = (data ?? []).map((d: any) => {
        const info = STATUS_MAP[d.status] ?? { title: `Status: ${d.status}`, type: "info" as const, icon: <Package className="h-4 w-4" /> };
        const companyName = d.companies?.name || "Empresa";
        const regionName = d.regions?.name;
        const value = Number(d.value ?? 0).toFixed(2);

        return {
          id: `${d.id}-${d.status}`,
          title: info.title,
          message: `${companyName} → ${d.customer_name || "Cliente"}${regionName ? ` (${regionName})` : ""} • R$ ${value}`,
          time: new Date(d.updated_at),
          read: readIds.has(`${d.id}-${d.status}`),
          type: info.type,
          icon: info.icon,
        };
      });

      setNotifications(mapped);
    } catch (err) {
      console.error("Erro ao buscar notificações:", err);
    } finally {
      setLoading(false);
    }
  }, [readIds]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime: listen for delivery changes
  useEffect(() => {
    const channel = supabase
      .channel("notif-deliveries")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    const allIds = new Set([...readIds, ...notifications.map(n => n.id)]);
    setReadIds(allIds);
    saveReadIds(allIds);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    const allIds = new Set([...readIds, ...notifications.map(n => n.id)]);
    setReadIds(allIds);
    saveReadIds(allIds);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const typeColors: Record<string, string> = {
    info: "text-primary bg-primary/10",
    success: "text-emerald-500 bg-emerald-500/10",
    warning: "text-amber-500 bg-amber-500/10",
    error: "text-destructive bg-destructive/10",
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-xl hover:bg-muted transition-colors outline-none">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <>
              <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-destructive border-2 border-card animate-pulse" />
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0 mr-4 mt-1 border-border shadow-2xl rounded-2xl overflow-hidden" align="end">
        <div className="bg-card">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm">Notificações</h4>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={markAllRead} title="Marcar todas como lidas">
                  <Check className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={clearAll} title="Limpar">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Bell className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-foreground">Nenhuma notificação</p>
                <p className="text-xs text-muted-foreground mt-1">Você está em dia!</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((n) => (
                  <div key={n.id} className={cn(
                    "flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer",
                    !n.read && "bg-primary/5 border-l-2 border-l-primary"
                  )}>
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5", typeColors[n.type] || typeColors.info)}>
                      {n.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-foreground">{n.title}</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(n.time, { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">{n.message}</p>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
