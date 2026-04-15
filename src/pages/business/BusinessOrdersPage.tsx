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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  const [stats, setStats] = useState({ pending: 0, preparing: 0, revenue_today: 0, open_total: 0 });
  const createDeliveryMut = useCreateDeliveryRequest();

  const fetchOrders = useCallback(async () => {
    if (!companyId) return;
    
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, status, total, created_at,
        customer_id,
        order_items (
          id, quantity, price, product_name, unit_price,
          products (id, name, image_url, description)
        )
      `)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Dashboard] Erro Crítico na busca de pedidos:", error.message, error.details, error.hint);
      toast.error("Erro ao carregar dados do banco.");
      setLoading(false);
      return;
    }

    console.log("[Dashboard] Pedidos brutos retornados pelo Supabase:", data?.length || 0);

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
                           .reduce((acc, o) => acc + (Number(o.total) || 0), 0),
        open_total: data.filter(o => !["completed", "delivered", "cancelled"].includes(o.status))
                           .reduce((acc, o) => {
                             const val = Number(o.total) || 0;
                             console.log(`[Dashboard] Somando pedido ${o.id}: R$ ${val} (Status: ${o.status})`);
                             return acc + val;
                           }, 0),
      });
      console.log("[Dashboard] Estatísticas finais:", {
        revenue: data.filter(o => ["completed", "delivered"].includes(o.status) && o.created_at.startsWith(todayStr)).length,
        open: data.filter(o => !["completed", "delivered", "cancelled"].includes(o.status)).length
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
      if (company) {
        setCompanyId(company.id);
        console.log("[Dashboard] Company encontrada:", company.id);
      } else {
        console.warn("[Dashboard] Nenhuma company vinculada ao usuário:", user.id);
      }
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
             // Try play notification sound (Mixkit Stable Ping)
             try { 
               const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
               audio.volume = 0.5;
               audio.play().catch(e => console.warn("[Audio] Bloqueio de auto-play pelo navegador:", e)); 
             } catch (err) {
               console.error("[Audio] Erro ao reproduzir som:", err);
             }
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
                 <p className="text-3xl font-black text-foreground tracking-tight">R$ {(stats as any).open_total?.toFixed(2).replace(".", ",") || "0,00"}</p>
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
                    onRefresh={fetchOrders}
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

function OrderCard({ order, onAdvance, onCancel, onRefresh, action }: {
  order: Order;
  onAdvance: () => void;
  onCancel: () => void;
  onRefresh: () => void;
  action: { label: string, next: OrderStatus } | null;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const age = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const isPending = order.status === "pending";

  return (
    <>
      <div className={cn(
        "bg-white border-2 border-transparent rounded-[2.5rem] p-6 shadow-card transition-all hover:shadow-2xl hover:border-primary/20 group animate-in zoom-in-95 duration-300 relative overflow-hidden cursor-pointer premium-shadow hover:-translate-y-1",
        isPending && "border-warning/30 shadow-warning/5 bg-warning/[0.01]"
      )}
      onClick={() => setIsModalOpen(true)}
      >
        {isPending && (
          <div className="absolute top-0 right-0 px-5 py-2 bg-warning text-white text-[10px] font-black uppercase tracking-widest rounded-bl-3xl shadow-lg">
            Aguardando Aceite
          </div>
        )}

        {/* Header: ID & Status Badge */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 opacity-70">Identificação</span>
            <p className="font-black text-xl text-foreground tracking-tight">#{order.id.slice(-6).toUpperCase()}</p>
          </div>
          {!isPending && (
            <div className={cn("px-4 py-2 rounded-2xl border-none font-black text-[10px] uppercase tracking-tighter shadow-sm", STATUS_COLORS[order.status])}>
               <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  {STATUS_LABELS[order.status]}
               </span>
            </div>
          )}
        </div>

        {/* Customer Info */}
        <div className="flex items-center gap-4 py-4">
          <div className="w-12 h-12 rounded-[1.25rem] bg-secondary/50 flex items-center justify-center shrink-0 border border-border/50 group-hover:scale-110 transition-transform">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-black text-foreground truncate">{order.customer?.name || "Cliente Marketplace"}</p>
            <div className="flex items-center gap-3 mt-1">
               <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-1">
                 <Timer className="h-3 w-3" /> {age} min
               </p>
               <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
               <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{order.payment_method || 'Pagamento Offline'}</p>
            </div>
          </div>
        </div>

        {/* Items Preview */}
        <div className="py-5 border-y border-border/40 group-hover:border-primary/10 transition-colors">
          <div className="space-y-2.5">
            {order.items && order.items.length > 0 ? (
              order.items.slice(0, 2).map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="font-black text-[10px] text-primary">{item.quantity}x</span>
                  </div>
                  <span className="font-bold text-foreground/80 truncate">{item.product_name || item.products?.name || "Produto"}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-2 py-1">
                <Package className="h-4 w-4 opacity-40" /> Toque para ver detalhes...
              </p>
            )}
            {order.items && order.items.length > 2 && (
              <div className="flex items-center gap-2 pt-1">
                 <div className="h-px flex-1 bg-border/40" />
                 <span className="text-[9px] text-primary font-black uppercase tracking-widest">Ver mais {order.items.length - 2} itens</span>
                 <div className="h-px flex-1 bg-border/40" />
              </div>
            )}
          </div>
        </div>

        {/* Action Button & Total */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-muted-foreground uppercase mb-0.5 opacity-60">Valor do Pedido</span>
            <p className="text-2xl font-black text-primary tracking-tighter italic">R$ {order.total.toFixed(2).replace(".", ",")}</p>
          </div>
          
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {isPending && (
              <button 
                onClick={onCancel}
                className="w-12 h-12 rounded-2xl bg-destructive/5 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-all premium-shadow"
                title="Recusar"
              >
                <XCircle className="h-5 w-5" />
              </button>
            )}
            {action && (
              <button
                onClick={onAdvance}
                className={cn(
                  "h-14 px-8 rounded-2xl font-black text-xs uppercase tracking-[0.1em] transition-all flex items-center gap-3 active:scale-95 group/btn",
                  isPending 
                    ? "bg-primary text-white shadow-xl shadow-primary/20 hover:shadow-primary/40" 
                    : "bg-foreground text-background shadow-xl hover:bg-foreground/90"
                )}
              >
                {action.label}
                <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </div>

      <OrderDetailsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        order={order}
        onStatusUpdate={onRefresh}
      />
    </>
  );
}

function OrderDetailsModal({ isOpen, onClose, order, onStatusUpdate }: {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  onStatusUpdate: () => void;
}) {
  const [items, setItems] = useState<any[]>(order.items || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && (!items || items.length === 0)) {
      fetchItems();
    }
  }, [isOpen]);

  const fetchItems = async () => {
    setLoading(true);
    console.log("[OrderDetailModal] Buscando itens para pedido:", order.id);
    const { data, error } = await supabase
      .from("order_items")
      .select(`
        id, quantity, price, product_name, unit_price,
        products (id, name, image_url, description)
      `)
      .eq("order_id", order.id);
    
    if (data) {
      console.log("[OrderDetailModal] Itens encontrados:", data.length);
      setItems(data);
    }
    if (error) console.error("[OrderDetailModal] Erro:", error);
    setLoading(false);
  };

  const parseImages = (imageUrl: string | null): string[] => {
    if (!imageUrl) return [];
    try {
      const parsed = JSON.parse(imageUrl);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      if (imageUrl.startsWith("http")) return [imageUrl];
    }
    return [];
  };

  const isPending = order.status === "pending";
  const action = getNextActions(order.status);

  const onAdvance = () => {
    if (action) {
      updateStatus(order.id, action.next);
      onStatusUpdate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden rounded-[3rem] border-none shadow-2xl glass-dark text-white/90">
        {/* Modern Glass Header */}
        <div className="bg-primary/90 backdrop-blur-3xl px-10 py-14 relative overflow-hidden border-b border-white/10">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                <ShoppingBag className="w-48 h-48 rotate-12" />
            </div>
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-[80px] pointer-events-none" />
            
            <DialogHeader className="relative z-10">
                <DialogDescription className="sr-only">Detalhes completos do pedido, itens e valores.</DialogDescription>
                <div className="flex items-center gap-4 mb-4">
                    <div className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border-none shadow-xl", STATUS_COLORS[order.status])}>
                        <span className="flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                           {STATUS_LABELS[order.status]}
                        </span>
                    </div>
                    <div className="h-1 w-1 rounded-full bg-white/30" />
                    <span className="text-white/60 text-xs font-bold leading-none">Efetuado há {Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)} min</span>
                </div>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <DialogTitle className="text-4xl lg:text-5xl font-black tracking-tighter text-white">Pedido #{order.id.slice(-6).toUpperCase()}</DialogTitle>
                        <div className="text-white/80 font-bold text-lg mt-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white backdrop-blur-md"><User className="w-5 h-5" /></div> 
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] uppercase tracking-widest text-white/40 font-black">Comprador</span>
                                {order.customer?.name || "Cliente Marketplace"}
                            </div>
                        </div>
                    </div>
                </div>
            </DialogHeader>
        </div>

        <div className="p-10 pb-0 space-y-10 max-h-[55vh] overflow-y-auto custom-scrollbar bg-white/95 text-foreground selection:bg-primary/10">
            {/* Items List */}
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <h3 className="font-black text-foreground/40 uppercase tracking-[0.3em] text-[10px] flex items-center gap-2">
                        <Package className="w-4 h-4 text-primary" /> composição do pedido
                    </h3>
                    <div className="h-px flex-1 mx-6 bg-border/40" />
                    <span className="font-black text-[10px] text-primary bg-primary/5 px-4 py-2 rounded-full tracking-widest">{items.length} ITENS</span>
                </div>

                {loading ? (
                    <div className="py-20 flex flex-col items-center gap-4">
                        <div className="w-12 h-12 rounded-3xl border-[6px] border-primary/10 border-t-primary animate-spin" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando Banco...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="py-20 flex flex-col items-center gap-6 bg-muted/20 rounded-[3rem] border-2 border-dashed border-border/60">
                        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-muted-foreground/30" />
                        </div>
                        <div className="text-center px-6">
                            <p className="text-sm font-black text-foreground/60 uppercase tracking-[0.1em]">Nenhum item detectado</p>
                            <p className="text-[10px] text-muted-foreground mt-2 font-bold max-w-xs mx-auto">Tente carregar novamente se o pedido acabou de ser realizado.</p>
                        </div>
                        <button onClick={fetchItems} className="px-8 py-3.5 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20">Recarregar agora</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-5">
                        {items.map((item, idx) => {
                            const images = parseImages(item.products?.image_url);
                            const mainImage = images[0];
                            return (
                                <div key={idx} className="flex gap-8 items-center p-8 rounded-[2.5rem] bg-white border border-border/40 hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 transition-all group relative overflow-hidden cursor-default">
                                    <div className="w-32 h-32 rounded-[2rem] bg-muted overflow-hidden shrink-0 border border-border/50 shadow-sm relative z-10 transition-transform group-hover:scale-105">
                                        {mainImage ? (
                                            <img src={mainImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
                                                <ImagePlus className="w-12 h-12" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 relative z-10">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center text-[12px] font-black shadow-lg shadow-primary/20">
                                                        {item.quantity}x
                                                    </div>
                                                    <h4 className="text-2xl font-black text-foreground tracking-tighter group-hover:text-primary transition-colors leading-none">
                                                        {item.product_name || item.products?.name || "Produto"}
                                                    </h4>
                                                </div>
                                                <p className="text-xs text-muted-foreground/70 font-semibold leading-relaxed max-w-sm ml-14 line-clamp-2">{item.products?.description || "A descrição deste item não foi fornecida pelo estabelecimento."}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-muted-foreground uppercase mb-0.5 opacity-40 select-none">Preço Unitário</p>
                                                <p className="font-black text-2xl text-foreground tracking-tighter italic">R$ {item.price.toFixed(2).replace(".", ",")}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Observation & Calculations */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 pt-12 border-t border-border/40 pb-10">
                <div className="lg:col-span-3 space-y-5">
                    <h3 className="font-black text-foreground/40 uppercase tracking-[0.3em] text-[10px] flex items-center gap-2">
                        <Bell className="w-4 h-4 text-primary" /> notas importantes
                    </h3>
                    <div className="p-10 rounded-[2.5rem] bg-warning/[0.03] border border-warning/10 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-125 transition-transform"><Bell className="w-16 h-16" /></div>
                        <p className={cn(
                            "text-lg italic font-semibold leading-relaxed",
                            order.notes ? "text-foreground" : "text-muted-foreground/40"
                        )}>
                            {order.notes ? `"${order.notes}"` : "O cliente não deixou nenhuma observação especial."}
                        </p>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-secondary/20 rounded-[3rem] p-10 space-y-6 border border-border/20 shadow-inner">
                    <div className="flex justify-between items-center text-[11px] font-black text-muted-foreground uppercase tracking-widest">
                        <span>Produtos</span>
                        <span className="text-foreground tracking-tighter font-black">R$ {(order.total - (order.delivery_fee || 0)).toFixed(2).replace(".", ",")}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] font-black text-primary uppercase tracking-widest">
                        <span>Taxa de Marketplace</span>
                        <span className="tracking-tighter font-black">R$ {(order.delivery_fee || 0).toFixed(2).replace(".", ",")}</span>
                    </div>
                    <div className="h-px bg-border/40 my-4" />
                    <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-foreground/30 uppercase mb-2 tracking-[0.2em]">Total Liquido</span>
                            <span className="text-5xl font-black text-primary tracking-tighter italic leading-none">R$ {order.total.toFixed(2).replace(".", ",")}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="p-10 flex flex-col sm:flex-row justify-end gap-5 bg-white border-t border-border/20">
            <button 
                onClick={onClose} 
                className="px-14 py-6 rounded-2xl bg-secondary text-foreground font-black uppercase tracking-widest text-[10px] hover:bg-muted transition-all active:scale-95"
            >
                Voltar à Gestão
            </button>
            {action && (
              <button 
                onClick={() => {
                   onAdvance();
                   onClose();
                }}
                className={cn(
                  "px-14 py-6 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-4 group/btn",
                  isPending ? "bg-primary text-white shadow-primary/30" : "bg-foreground text-background shadow-black/20"
                )}
              >
                {action.label}
                 <ArrowRight className="h-5 w-5 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
