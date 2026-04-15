// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCreateDeliveryRequest } from "@/services/deliveries";
import {
  ShoppingBag, Clock, CheckCircle, XCircle, ChefHat,
  Truck, Bell, RefreshCw, Timer, Phone, MapPin, User, Package,
  ChevronRight, ArrowRight, MoreVertical, LayoutGrid, DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";

type OrderStatus = "pending" | "accepted" | "preparing" | "ready" | "in_route" | "completed" | "cancelled";

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  products?: { name: string };
}

interface Order {
  id: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  notes?: string;
  customer?: { name: string; phone?: string };
  delivery_address?: string;
  items?: OrderItem[];
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Novo",
  accepted: "Aceito",
  preparing: "Em Preparo",
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

const COLUMNS: { key: OrderStatus; label: string; icon: any; color: string }[] = [
  { key: "pending", label: "Novos", icon: Bell, color: "warning" },
  { key: "preparing", label: "Preparando", icon: ChefHat, color: "blue" },
  { key: "ready", label: "Prontos", icon: CheckCircle, color: "green" },
  { key: "in_route", label: "Despachados", icon: Truck, color: "purple" },
  { key: "completed", label: "Concluídos", icon: CheckCircle, color: "success" },
];

export default function BusinessOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [stats, setStats] = useState({ pending: 0, preparing: 0, revenue_today: 0 });
  const createDeliveryMut = useCreateDeliveryRequest();

  const fetchOrders = useCallback(async () => {
    if (!companyId) return;
    
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, status, total, created_at,
        customer_id,
        customers (name, phone),
        order_items (
          id, quantity, price,
          products (name)
        )
      `)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[OrdersPage] Erro:", error);
      setLoading(false);
      return;
    }

    if (data) {
      const todayStr = new Date().toISOString().split('T')[0];
      
      const filteredData = data.filter((o: any) => {
        if (o.status === "cancelled") return false;
        if (["completed", "delivered"].includes(o.status)) {
          return o.created_at.startsWith(todayStr);
        }
        return true;
      });

      const mapped = filteredData.map((o: any) => ({
        ...o,
        customer: o.customers,
        items: o.order_items || []
      }));
      
      setOrders(mapped);
      setStats({
        pending: mapped.filter(o => o.status === "pending" || !["accepted", "preparing", "ready", "in_route", "completed", "delivered", "cancelled"].includes(o.status)).length,
        preparing: mapped.filter(o => ["accepted", "preparing"].includes(o.status)).length,
        revenue_today: data.filter(o => ["completed", "delivered"].includes(o.status) && o.created_at.startsWith(todayStr))
                           .reduce((acc, o) => acc + (o.total || 0), 0),
      });
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      setLoading(true);
      console.log("[OrdersPage] user.id =", user.id);
      const { data: company, error: compErr } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      console.log("[OrdersPage] company lookup:", { company, compErr });
      if (company) setCompanyId(company.id);
      else console.warn("[OrdersPage] Nenhuma empresa encontrada para user_id:", user.id);
      setLoading(false);
    };
    init();
  }, [user]);

  useEffect(() => {
    if (companyId) fetchOrders();
  }, [companyId, fetchOrders]);

  // Realtime subscription with visual Ping
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`business-orders-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `company_id=eq.${companyId}` },
        (payload) => {
          fetchOrders();
          if (payload.eventType === "INSERT") {
             toast.success("📦 NOVO PEDIDO RECEBIDO!", {
               description: "Acesse a aba 'Novos' para aceitar.",
               duration: 8000,
               position: "top-center"
             });
             // Try play notification sound
             try { new Audio("/notification.mp3").play().catch(() => {}); } catch {}
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, fetchOrders]);

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (error) { toast.error("Erro ao atualizar!"); return; }
    
    const label = STATUS_LABELS[newStatus];
    toast.success(`Pedido movido para ${label}`, {
      duration: 3000,
    });
    fetchOrders();
  };

  const handleDispatch = async (order: Order) => {
    try {
      toast.info("Solicitando entregador...", { id: "dispatch" });
      await createDeliveryMut.mutateAsync(order.id);
      toast.success("🚚 Entregador Solicitado! Aguardando aceite.", { id: "dispatch" });
      fetchOrders();
    } catch (err: any) {
      toast.error(`Falha ao despachar: ${err.message}`, { id: "dispatch" });
    }
  };

  const getNextActions = (status: OrderStatus) => {
    const actions: Record<string, { label: string, next: OrderStatus }> = {
      pending: { label: "Aceitar Pedido", next: "preparing" },
      accepted: { label: "Começar Preparo", next: "preparing" },
      preparing: { label: "Marcar Pronto", next: "ready" },
      ready: { label: "Chamar Entregador", next: "in_route" },
      in_route: { label: "Concluir", next: "completed" }
    };
    return actions[status];
  };

  const ordersByColumn = (status: OrderStatus) => {
    if (status === "pending") {
      // Show pending AND any unknown active statuses in the first column
      const knownStatuses = ["accepted", "preparing", "ready", "in_route", "completed", "delivered", "cancelled"];
      return orders.filter(o => o.status === "pending" || !knownStatuses.includes(o.status));
    }
    if (status === "preparing") {
      return orders.filter(o => ["accepted", "preparing"].includes(o.status));
    }
    if (status === "completed") {
      return orders.filter(o => ["completed", "delivered"].includes(o.status));
    }
    return orders.filter(o => o.status === status);
  };

  if (loading) {
    return (
      <BusinessLayout title="Gestão de Pedidos">
        <div className="flex items-center justify-center py-40">
           <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <ShoppingBag className="h-6 w-6 text-primary absolute inset-0 m-auto" />
           </div>
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout title="Marketplace: Gestão de Pedidos">
      <div className="space-y-8 animate-in fade-in duration-700">
        
        {/* Superior Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-card border border-border rounded-3xl p-6 shadow-card hover:border-primary/20 transition-all flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-warning/10 flex items-center justify-center">
                 <Bell className="h-7 w-7 text-warning" />
              </div>
              <div>
                 <p className="text-3xl font-black text-foreground tracking-tight">{stats.pending}</p>
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Novos Pendentes</p>
              </div>
           </div>
           <div className="bg-card border border-border rounded-3xl p-6 shadow-card hover:border-primary/20 transition-all flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                 <ChefHat className="h-7 w-7 text-primary" />
              </div>
              <div>
                 <p className="text-3xl font-black text-foreground tracking-tight">{stats.preparing}</p>
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Na Cozinha</p>
              </div>
           </div>
           <div className="bg-card border border-border rounded-3xl p-6 shadow-card hover:border-primary/20 transition-all flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center">
                 <DollarSign className="h-7 w-7 text-success" />
              </div>
              <div>
                 <p className="text-2xl font-black text-foreground tracking-tight">R$ {stats.revenue_today.toFixed(2).replace(".", ",")}</p>
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total em Aberto</p>
              </div>
           </div>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar snap-x">
          {COLUMNS.map(col => (
            <div key={col.key} className="flex-none w-80 snap-start flex flex-col gap-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-6 rounded-full bg-primary", 
                    col.color === "warning" && "bg-warning",
                    col.color === "green" && "bg-success",
                    col.color === "purple" && "bg-purple-500",
                    col.color === "blue" && "bg-blue-500"
                  )} />
                  <h3 className="font-black text-sm text-foreground uppercase tracking-wider">{col.label}</h3>
                  <span className="bg-muted px-2 py-0.5 rounded-lg text-[10px] font-black text-muted-foreground">
                    {ordersByColumn(col.key).length}
                  </span>
                </div>
                <MoreVertical className="h-4 w-4 text-muted-foreground/30" />
              </div>

              <div className="space-y-4 min-h-[500px] bg-muted/30 rounded-[2.5rem] p-3 border border-border/50">
                {ordersByColumn(col.key).map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onAdvance={() => {
                        const action = getNextActions(order.status);
                        if (action) {
                           if (order.status === "ready") {
                              handleDispatch(order);
                           } else {
                              updateStatus(order.id, action.next);
                           }
                        }
                    }}
                    onCancel={() => updateStatus(order.id, "cancelled")}
                    action={getNextActions(order.status)}
                  />
                ))}
                
                {ordersByColumn(col.key).length === 0 && (
                  <div className="h-40 flex flex-col items-center justify-center text-center p-6 opacity-30">
                     <LayoutGrid className="h-8 w-8 mb-2 stroke-1" />
                     <p className="text-[10px] font-bold uppercase tracking-widest">Sem Pedidos</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </BusinessLayout>
  );
}

function OrderCard({ order, onAdvance, onCancel, action }: {
  order: Order;
  onAdvance: () => void;
  onCancel: () => void;
  action: { label: string, next: OrderStatus } | null;
}) {
  const age = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const isPending = order.status === "pending";

  return (
    <div className={cn(
      "bg-white border-2 border-transparent rounded-[2rem] p-5 shadow-sm space-y-4 hover:shadow-2xl hover:border-primary/30 transition-all group animate-in zoom-in-95 duration-300 relative overflow-hidden",
      isPending && "border-warning/40 shadow-warning/5 bg-warning/[0.02]"
    )}>
      {isPending && (
        <div className="absolute top-0 right-0 px-4 py-1.5 bg-warning text-white text-[9px] font-black uppercase tracking-widest rounded-bl-2xl">
          Novo Pedido
        </div>
      )}

      {/* Header: ID & Status Badge */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">ID do Pedido</span>
          <p className="font-black text-lg text-foreground leading-none">#{order.id.slice(-6).toUpperCase()}</p>
        </div>
        {!isPending && (
          <div className={cn("px-3 py-1.5 rounded-xl border flex items-center gap-2", STATUS_COLORS[order.status])}>
             <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-tighter">{STATUS_LABELS[order.status]}</span>
          </div>
        )}
      </div>

      {/* Customer Info */}
      <div className="flex items-center gap-3 pt-1">
        <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center shrink-0 border border-border">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-foreground truncate leading-tight">{order.customer?.name || "Cliente Marketplace"}</p>
          <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-1 mt-0.5">
            <Timer className="h-3 w-3" /> há {age} min
          </p>
        </div>
      </div>

      {/* Items Section (iFood Style) */}
      <div className="space-y-3 py-4 border-y-2 border-dashed border-border/50 group-hover:border-primary/20 transition-colors">
        <div className="space-y-2">
          {order.items?.map((item, idx) => (
            <div key={idx} className="flex gap-2 text-sm">
              <span className="font-black text-primary shrink-0">{item.quantity}x</span>
              <span className="font-bold text-foreground/80 leading-snug">{item.products?.name || "Produto"}</span>
            </div>
          ))}
          {(!order.items || order.items.length === 0) && (
            <p className="text-xs text-muted-foreground italic flex items-center gap-2">
              <Package className="h-3.5 w-3.5" /> Detalhes indisponíveis
            </p>
          )}
        </div>
        
        {order.notes && (
          <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1 flex items-center gap-1">
               <Bell className="h-3 w-3" /> Observação
            </p>
            <p className="text-xs font-semibold text-foreground/70 italic">"{order.notes}"</p>
          </div>
        )}
      </div>

      {/* Footer: Payment & Total & Action */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Total</p>
          <p className="text-xl font-black text-primary tracking-tight italic">R$ {order.total.toFixed(2).replace(".", ",")}</p>
        </div>
        <div className="flex gap-2">
          {isPending && (
            <button 
              onClick={onCancel}
              className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-all shadow-sm"
            >
              <XCircle className="h-5 w-5" />
            </button>
          )}
          {action && (
            <button
              onClick={onAdvance}
              className={cn(
                "h-12 px-6 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg flex items-center gap-2",
                isPending ? "bg-primary text-white shadow-primary/20" : "bg-foreground text-white shadow-black/10"
              )}
            >
              {action.label}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
