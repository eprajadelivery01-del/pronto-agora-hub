import { DeliveryStatus } from "@/types/models";
import { cn } from "@/lib/utils";

const statusConfig: Record<DeliveryStatus, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-warning/10 text-warning" },
  broadcasted: { label: "Enviada", className: "bg-info/10 text-info" },
  accepted: { label: "Aceita", className: "bg-primary/10 text-primary" },
  collecting: { label: "Em Coleta", className: "bg-accent/10 text-accent" },
  in_route: { label: "Em Rota", className: "bg-violet-500/10 text-violet-600" },
  completed: { label: "Finalizada", className: "bg-success/10 text-success" },
  delivered: { label: "Finalizada", className: "bg-success/10 text-success" },
  cancelled: { label: "Cancelada", className: "bg-destructive/10 text-destructive" },
};

interface DeliveryStatusBadgeProps {
  status: DeliveryStatus;
}

export function DeliveryStatusBadge({ status }: DeliveryStatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", config.className)}>
      {config.label}
    </span>
  );
}
