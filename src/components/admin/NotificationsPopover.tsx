import { Bell, Check, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "info" | "success" | "warning";
}

const STORAGE_KEY = "epj_notifications_cleared";

export function NotificationsPopover() {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const cleared = localStorage.getItem(STORAGE_KEY);
      if (cleared === "true") return [];
      const saved = localStorage.getItem("epj_notifications");
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return [];
  });

  // Persist state
  useEffect(() => {
    try {
      localStorage.setItem("epj_notifications", JSON.stringify(notifications));
    } catch { /* ignore */ }
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
      localStorage.setItem("epj_notifications", "[]");
    } catch { /* ignore */ }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-xl hover:bg-muted transition-colors outline-none">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-destructive border-2 border-card animate-pulse" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 mr-4 mt-1 border-border shadow-2xl rounded-2xl overflow-hidden" align="end">
        <div className="bg-card">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h4 className="font-bold text-sm">Notificações</h4>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={markAllRead} title="Marcar todas como lidas">
                  <Check className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={clearAll} title="Limpar tudo">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Bell className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-foreground">Nenhuma notificação</p>
                <p className="text-xs text-muted-foreground mt-1">Você está em dia com os alertas.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((n) => (
                  <div key={n.id} className={cn(
                    "p-4 hover:bg-muted/50 transition-colors cursor-pointer",
                    !n.read && "bg-primary/5"
                  )}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={cn(
                        "text-xs font-bold uppercase tracking-wider",
                        n.type === "warning" ? "text-warning" : n.type === "success" ? "text-success" : "text-primary"
                      )}>
                        {n.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{n.time}</span>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">{n.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {notifications.length > 0 && (
            <div className="p-3 border-t border-border bg-muted/20 text-center">
              <Link to="/admin/logs">
                <Button variant="link" className="text-xs h-auto p-0 font-bold">Ver todo o histórico</Button>
              </Link>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
