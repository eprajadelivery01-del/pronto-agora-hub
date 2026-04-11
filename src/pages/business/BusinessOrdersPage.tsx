// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ShoppingBag, Clock, CheckCircle, XCircle, ChefHat,
  Truck, Bell, RefreshCw, Timer, Phone, MapPin, User, Package
} from "lucide-react";
import { cn } from "@/lib/utils";

type OrderStatus = "pending" | "accepted" | "preparing" | "ready" | "in_route" | "completed" | "cancelled";

interface Order {
  id: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  notes?: string;
  customer?: { name: string; phone?: string };
  delivery_address?: string;
  items?: { product_name: string; quantity: number; price: number }[];
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Aguardando",
  accepted: "Aceito",
  preparing: "Preparando",
  ready: "Pronto",
  in_route: "Em Rota",
  completed: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  accepted: "bg-primary/10 text-primary border-primary/20",
  preparing: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  ready: "bg-green-500/10 text-green-600 border-green-500/20",
  in_route: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  completed: "bg-success/10 text-success border-success/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const ACTIVE_STATUSES: OrderStatus[] = ["pending", "accepted", "preparing", "ready", "in_route"];
const COLUMNS: { key: OrderStatus; label: string; icon: any }[] = [
  { key: "pending", label: "Novos Pedidos", icon: Bell },
  { key: "preparing", label: "Em Preparo", icon: ChefHat },
  { key: "ready", label: "Pronto p/ Entrega", icon: CheckCircle },
  { key: "in_route", label: "Em Rota", icon: Truck },
];

export default function BusinessOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [counts, setCounts] = useState({ pending: 0, total_today: 0, revenue_today: 0 });

  const fetchOrders = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("orders")
      .select(`
        id, status, total, created_at, notes,
        customers (name, phone),
        deliveries (address)
      `)
      .eq("company_id", companyId)
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: false });

    if (data) {
      const mapped = data.map((o: any) => ({
        ...o,
        customer: o.customers,
        delivery_address: o.deliveries?.address,
      }));
      setOrders(mapped);
      setCounts({
        pending: mapped.filter(o => o.status === "pending").length,
        total_today: data.length,
        revenue_today: data.reduce((acc: number, o: any) => acc + (o.total || 0), 0),
      });
    }
  }, [companyId]);

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      setLoading(true);
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (company) setCompanyId(company.id);
      setLoading(false);
    };
    init();
  }, [user]);

  useEffect(() => {
    if (companyId) fetchOrders();
  }, [companyId, fetchOrders]);

  // Realtime subscription
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`orders-company-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `company_id=eq.${companyId}` },
        () => {
          fetchOrders();
          toast.info("📦 Novo pedido recebido!", { duration: 4000 });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, fetchOrders]);

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (error) { toast.error("Erro ao atualizar pedido"); return; }
    toast.success(`Pedido ${STATUS_LABELS[newStatus].toLowerCase()}!`);
    fetchOrders();
  };

  const getNextStatus = (status: OrderStatus): OrderStatus | null => {
    const flow: Record<OrderStatus, OrderStatus | null> = {
      pending: "preparing",
      accepted: "preparing",
      preparing: "ready",
      ready: "in_route",
      in_route: "completed",
      completed: null,
      cancelled: null,
    };
    return flow[status];
  };

  const getNextLabel = (status: OrderStatus): string => {
    const labels: Record<OrderStatus, string> = {
      pending: "✅ Aceitar Pedido",
      accepted: "👨‍🍳 Iniciar Preparo",
      preparing: "✅ Marcar Pronto",
      ready: "🛵 Despachar",
      in_route: "📦 Confirmar Entrega",
      completed: "",
      cancelled: "",
    };
    return labels[status];
  };

  const ordersByColumn = (status: OrderStatus) => orders.filter(o => o.status === status || (status === "preparing" && o.status === "accepted"));

  if (loading) {
    return (
      <BusinessLayout title="Pedidos">
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout title="Pedidos do Marketplace">
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-warning/10 border border-warning/20 rounded-2xl p-4 text-center">
            <p className="text-3xl font-black text-warning">{counts.pending}</p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Aguardando</p>
          </div>
          <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 text-center">
            <p className="text-3xl font-black text-primary">{counts.total_today}</p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Ativos Hoje</p>
          </div>
          <div className="bg-success/10 border border-success/20 rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-success">R$ {counts.revenue_today.toFixed(2).replace(".", ",")}</p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Faturado</p>
          </div>
        </div>

        {/* Kanban columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map(col => (
            <div key={col.key} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", STATUS_COLORS[col.key])}>
                  <col.icon className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm text-foreground">{col.label}</h3>
                <span className={cn("ml-auto text-xs font-black px-2 py-0.5 rounded-full border", STATUS_COLORS[col.key])}>
                  {ordersByColumn(col.key).length}
                </span>
              </div>

              <div className="space-y-3 min-h-[200px]">
                {ordersByColumn(col.key).length === 0 ? (
                  <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center">
                    <p className="text-xs text-muted-foreground font-medium">Nenhum pedido</p>
                  </div>
                ) : (
                  ordersByColumn(col.key).map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onAccept={() => updateStatus(order.id, "preparing")}
                      onAdvance={() => {
                        const next = getNextStatus(order.status);
                        if (next) updateStatus(order.id, next);
                      }}
                      onCancel={() => updateStatus(order.id, "cancelled")}
                      nextLabel={getNextLabel(order.status)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        {orders.length === 0 && (
          <div className="text-center py-16 bg-card border border-dashed border-border rounded-3xl">
            <ShoppingBag className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">Nenhum pedido ativo</h3>
            <p className="text-muted-foreground">Os pedidos do marketplace aparecerão aqui em tempo real.</p>
          </div>
        )}
      </div>
    </BusinessLayout>
  );
}

function OrderCard({ order, onAdvance, onCancel, nextLabel }: {
  order: Order;
  onAccept: () => void;
  onAdvance: () => void;
  onCancel: () => void;
  nextLabel: string;
}) {
  const age = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);

  return (
    <div className={cn(
      "bg-card border rounded-2xl p-4 shadow-sm space-y-3 hover:shadow-md transition-all",
      order.status === "pending" && "border-warning/40 ring-1 ring-warning/20 animate-pulse-subtle"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-black text-foreground text-sm">#{order.id.slice(-6).toUpperCase()}</p>
          <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider", STATUS_COLORS[order.status])}>
            {STATUS_LABELS[order.status]}
          </span>
        </div>
        <div className="text-right">
          <p className="font-black text-primary">R$ {(order.total || 0).toFixed(2).replace(".", ",")}</p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
            <Timer className="h-3 w-3" /> {age}min atrás
          </p>
        </div>
      </div>

      {order.customer && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold truncate">{order.customer.name}</span>
          </div>
          {order.customer.phone && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span>{order.customer.phone}</span>
            </div>
          )}
        </div>
      )}

      {order.delivery_address && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="line-clamp-2">{order.delivery_address}</span>
        </div>
      )}

      {order.notes && (
        <div className="bg-muted/50 rounded-xl p-2 text-xs text-muted-foreground">
          📝 {order.notes}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {nextLabel && (
          <button
            onClick={onAdvance}
            className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black hover:opacity-90 transition-opacity"
          >
            {nextLabel}
          </button>
        )}
        {(order.status === "pending" || order.status === "preparing") && (
          <button
            onClick={onCancel}
            className="p-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
