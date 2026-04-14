import { Bell, ChevronDown } from "lucide-react";
import { useDeliveries } from "@/services/deliveries";
import { format } from "date-fns";

export function NotificationsPanel() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data } = useDeliveries({ pageSize: 10 });
  const deliveries = data?.data ?? [];

  const getIcon = (status: string) => {
    switch (status) {
      case "pending": return "📦";
      case "broadcasted": return "📡";
      case "accepted": return "✅";
      case "collecting": return "🏪";
      case "in_route": return "🏍️";
      case "completed": return "🎉";
      case "cancelled": return "❌";
      default: return "📦";
    }
  };

  const getTitle = (d: any) => {
    const name = d.companies?.name || "Empresa";
    switch (d.status) {
      case "pending": return `Novo pedido de ${name}`;
      case "broadcasted": return `Pedido enviado para motoboys`;
      case "accepted": return `Pedido aceito`;
      case "in_route": return `Entrega em rota`;
      case "completed": return `Entrega finalizada`;
      case "cancelled": return `Entrega cancelada`;
      default: return `Atualização: ${d.status}`;
    }
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-warning" />
          <h3 className="font-display font-semibold text-foreground text-sm">Notificações</h3>
        </div>
        <span className="text-xs text-muted-foreground">{deliveries.length} recentes</span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {deliveries.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma atividade recente</p>
          </div>
        ) : (
          deliveries.map((d) => (
            <div key={d.id} className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm">
                {getIcon(d.status)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">{getTitle(d)}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {d.customer_name} — R$ {Number((d as any).price ?? d.value ?? 0).toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(new Date(d.updated_at), "dd/MM HH:mm")}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
