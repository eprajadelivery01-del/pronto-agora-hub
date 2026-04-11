// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
];

export default function BusinessOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [stats, setStats] = useState({ pending: 0, preparing: 0, revenue_today: 0 });

  const fetchOrders = useCallback(async () => {
    if (!companyId) return;
    
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, status, total, created_at,
        customers (name, phone),
        order_items (
          id, quantity, price,
          products (name)
        )
      `)
      .eq("company_id", companyId)
      .in("status", ["pending", "accepted", "preparing", "ready", "in_route"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar pedidos:", error);
      return;
    }

    if (data) {
      const mapped = data.map((o: any) => ({
        ...o,
        customer: o.customers,
        items: o.order_items || []
      }));
      setOrders(mapped);
      setStats({
        pending: mapped.filter(o => o.status === "pending").length,
        preparing: mapped.filter(o => ["accepted", "preparing"].includes(o.status)).length,
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

  const getNextActions = (status: OrderStatus) => {
    const actions: Record<string, { label: string, next: OrderStatus }> = {
      pending: { label: "Aceitar Pedido", next: "preparing" },
      accepted: { label: "Começar Preparo", next: "preparing" },
      preparing: { label: "Marcar Pronto", next: "ready" },
      ready: { label: "Despachar", next: "in_route" },
      in_route: { label: "Concluir", next: "completed" }
    };
    return actions[status];
  };

  const ordersByColumn = (status: OrderStatus) => {
    if (status === "preparing") {
      return orders.filter(o => ["accepted", "preparing"].includes(o.status));
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
                        if (action) updateStatus(order.id, action.next);
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

  return (
    <div className={cn(
      "bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4 hover:shadow-xl hover:border-primary/20 transition-all group animate-in zoom-in-95 duration-300",
      order.status === "pending" && "border-warning/40 ring-1 ring-warning/20"
    )}>
      {/* Header Card */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-black tracking-[0.2em] text-muted-foreground uppercase mb-1">Pedido</p>
          <p className="font-black text-foreground">#{order.id.slice(-6).toUpperCase()}</p>
        </div>
        <div className={cn("px-2 py-1 rounded-lg flex items-center gap-1.5", STATUS_COLORS[order.status])}>
           <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", 
             order.status === "pending" ? "bg-warning" : "bg-current"
           )} />
           <span className="text-[9px] font-black uppercase">{STATUS_LABELS[order.status]}</span>
        </div>
      </div>

      {/* Basic Info */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-muted-foreground" />
           </div>
           <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{order.customer?.name || "Cliente Casual"}</p>
              <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                 <Timer className="h-3 w-3" /> há {age} min
              </p>
           </div>
        </div>

        {/* Items Summary */}
        <div className="bg-muted/50 rounded-2xl p-3 space-y-2">
           {order.items?.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-[10px] font-bold text-muted-foreground">
                 <span className="truncate flex-1">{item.quantity}x {item.products?.name || "Protudo"}</span>
                 <span className="shrink-0 ml-2">R$ {item.price.toFixed(2)}</span>
              </div>
           ))}
           {order.items && order.items.length > 3 && (
              <p className="text-[9px] text-primary font-black text-center pt-1">+ {order.items.length - 3} itens no total</p>
           )}
           {(!order.items || order.items.length === 0) && (
              <p className="text-[9px] text-muted-foreground italic text-center">Itens não detalhados</p>
           )}
        </div>

        <div className="flex items-center justify-between pt-1">
           <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total</p>
           <p className="text-lg font-black text-primary italic">R$ {order.total.toFixed(2).replace(".", ",")}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-dashed border-border group-hover:border-primary/20 transition-colors">
        {action && (
          <button
            onClick={onAdvance}
            className="flex-1 py-3 rounded-2xl bg-foreground text-background text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-all flex items-center justify-center gap-2"
          >
            {action.label} <ArrowRight className="h-3 h-3" />
          </button>
        )}
        {order.status === "pending" && (
           <button 
             onClick={onCancel}
             className="w-11 h-11 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive transition-all"
           >
              <XCircle className="h-5 h-5" />
           </button>
        )}
      </div>
    </div>
  );
}
