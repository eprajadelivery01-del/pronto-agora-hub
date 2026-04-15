import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Truck, Clock, CheckCircle, Loader2, MapPin, Package, Trash2, Phone, ShoppingBag, Bell, DollarSign, ArrowRight, User, TrendingUp, Zap, Search, Filter, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useCity } from "@/contexts/CityContext";
import { useDeliveries } from "@/services/deliveries";
import { format } from "date-fns";
import { DeliveryStatusBadge } from "@/components/admin/DeliveryStatusBadge";
import { DeliveryStatus, Order, Delivery } from "@/types/models";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/business/StatCard";
import { Skeleton } from "@/components/ui/skeleton";


const NewDeliveryForm = React.lazy(() => import("@/components/business/NewDeliveryForm"));
const OrderDetailModal = React.lazy(() => import("@/components/business/OrderDetailModal"));

export default function BusinessHomePage() {
  const { profile, user } = useAuth();
  const { selectedCity } = useCity();
  const [showNewDelivery, setShowNewDelivery] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isRinging, setIsRinging] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const qc = useQueryClient();
  
  const { data: companyData } = useQuery({
    queryKey: ["company-info", (profile as any)?.id || user?.id],
    queryFn: async () => {
      const currentId = (profile as any)?.id || user?.id;
      if (!currentId) return null;
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("user_id", currentId)
        .maybeSingle();
      return data;
    },
    enabled: !!((profile as any)?.id || user?.id)
  });

  const companyId = companyData?.id;

  const { data: deliveriesData, isLoading: isLoadingDeliveries } = useDeliveries({
    companyId: companyId || undefined,
    pageSize: 10
  });

  const { data: ordersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: ["marketplace-orders", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const { data } = await supabase
        .from("orders")
        .select(`*, customers (*), order_items (*, products (*))`)
        .eq("company_id", companyId)
        .or(`status.in.(pending,accepted,preparing,ready,in_route,in_transit),and(status.in.(completed,delivered),created_at.gte.${startOfDay})`)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!companyId
  });

  const deliveries = (deliveriesData?.data || []).filter(d => !["completed", "delivered", "cancelled"].includes(d.status));
  
  const marketplaceOrders = useMemo(() => {
    let filtered = ordersData || [];
    
    if (statusFilter !== "all") {
      filtered = filtered.filter(o => o.status === statusFilter);
    }
    
    if (orderSearchQuery) {
      const q = orderSearchQuery.toLowerCase();
      filtered = filtered.filter(o => 
        (o.customers?.name?.toLowerCase().includes(q)) || 
        (o.id.toLowerCase().includes(q)) ||
        ((o as any).customer_name?.toLowerCase().includes(q))
      );
    }
    
    return filtered;
  }, [ordersData, statusFilter, orderSearchQuery]);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audioRef.current.loop = true;
    }
    const hasPending = marketplaceOrders.some(o => o.status === "pending");
    if (hasPending && !isRinging) {
      audioRef.current.play()
        .then(() => setIsRinging(true))
        .catch(e => console.warn("Audio blocked by browser"));
    } else if (!hasPending && isRinging) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsRinging(false);
    }
  }, [marketplaceOrders, isRinging]);

  const handleMute = () => {
    if (audioRef.current) { audioRef.current.pause(); setIsRinging(false); }
  };

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel("business-home-deliveries")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries", filter: `company_id=eq.${companyId}` }, () => {
        qc.invalidateQueries({ queryKey: ["deliveries"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, qc]);

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel("business-home-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `company_id=eq.${companyId}` }, () => {
        qc.invalidateQueries({ queryKey: ["marketplace-orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, qc]);

  const stats = {
    pending: deliveries.filter(d => ["pending", "broadcasted"].includes(d.status)).length,
    inRoute: deliveries.filter(d => ["accepted", "collecting", "in_route", "in_transit"].includes(d.status)).length,
    completed: deliveries.filter(d => d.status === "completed").length,
    marketplacePending: marketplaceOrders.filter(o => o.status === "pending").length,
    marketplaceRevenue: marketplaceOrders
      .filter(o => ["completed", "delivered"].includes(o.status))
      .reduce((acc, o) => acc + (o.total || 0), 0)
  };

  const handleAdvanceOrder = async (orderId: string, nextStatus: string) => {
    try {
      const { error } = await supabase.from("orders").update({ status: nextStatus } as any).eq("id", orderId);
      if (error) throw error;
      const remainingPending = marketplaceOrders.filter(o => o.id !== orderId && o.status === "pending");
      if (remainingPending.length === 0 && audioRef.current) { audioRef.current.pause(); setIsRinging(false); }
      toast.success("Status do pedido atualizado!");
      if (nextStatus === "preparing" || nextStatus === "accepted") { setTimeout(() => window.print(), 500); }
      qc.invalidateQueries({ queryKey: ["marketplace-orders"] });
      setSelectedOrder(null);
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + err.message);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancelar esta entrega?")) return;
    try {
      const { error } = await supabase.from("deliveries").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
      toast.success("Entrega cancelada");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    }
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();

  return (
    <BusinessLayout title="Painel de Entregas">
      <React.Suspense fallback={<div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        {showNewDelivery ? (
          <NewDeliveryForm
            onClose={() => { setShowNewDelivery(false); setEditingDelivery(null); }}
            initialData={editingDelivery}
            companyId={companyId}
            companyData={companyData}
          />
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Hero Header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-info p-6 md:p-8 text-primary-foreground">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDE4YzAtOS45NC04LjA2LTE4LTE4LTE4UzAgOC4wNiAwIDE4czguMDYgMTggMTggMTggMTgtOC4wNiAxOC0xOCIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
              
              <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-warning" />
                    <span className="text-xs font-bold uppercase tracking-widest text-white/70">Painel em Tempo Real</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight">
                    {greeting}, {profile?.full_name?.split(" ")[0] || "Lojista"}!
                  </h2>
                  <p className="text-sm text-white/70 font-medium">
                    Gerencie entregas e pedidos do marketplace em um só lugar.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                   {isRinging && (
                    <div className="flex items-center gap-2 animate-in zoom-in duration-300">
                      <div className="flex h-11 items-center gap-2 px-4 rounded-xl bg-destructive text-destructive-foreground font-bold text-xs uppercase tracking-wider animate-pulse shadow-lg shadow-destructive/20 border border-white/20">
                        <Bell className="h-4 w-4 animate-bounce" />
                        Novos Pedidos!
                      </div>
                      <button
                        onClick={handleMute}
                        className="h-11 w-11 flex items-center justify-center rounded-xl bg-white/20 text-white hover:bg-white/30 transition-all border border-white/10"
                        title="Silenciar Alerta"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => setShowNewDelivery(true)}
                    className="h-11 px-6 rounded-xl bg-white text-primary font-bold text-sm flex items-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    <Plus className="h-5 w-5" />
                    Nova Entrega
                  </button>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <StatCard label="Pendentes" value={stats.pending} icon={Clock} color="warning" subtitle="Entregas manuais" />
              <StatCard label="Em Trânsito" value={stats.inRoute} icon={Truck} color="primary" subtitle="Em rota agora" />
              <StatCard label="Novos Pedidos" value={stats.marketplacePending} icon={Bell} color="info" subtitle="Marketplace" />
              <StatCard label="Vendas Hoje" value={`R$ ${stats.marketplaceRevenue.toFixed(2).replace('.', ',')}`} icon={DollarSign} color="success" subtitle="Marketplace" />
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Manual Deliveries */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Entregas Manuais
                  </h3>
                  <span className="text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                    {deliveries.length}
                  </span>
                </div>

                {isLoadingDeliveries ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="bg-card border border-border/50 rounded-xl p-4 flex gap-3">
                        <Skeleton className="w-10 h-10 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-12" /></div>
                          <Skeleton className="h-3 w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : deliveries.length > 0 ? (
                  <div className="space-y-2.5">
                    {deliveries.slice(0, 5).map((delivery, i) => (
                      <div
                        key={delivery.id}
                        className="bg-card border border-border/50 rounded-xl p-4 hover:border-primary/30 hover:shadow-card-hover transition-all duration-200 group"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                            <User className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <p className="text-sm font-bold text-foreground truncate">{delivery.customer_name}</p>
                              <DeliveryStatusBadge status={delivery.status as DeliveryStatus} />
                            </div>
                            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {delivery.address}
                            </p>
                          </div>
                          <button
                            onClick={() => handleCancel(delivery.id)}
                            className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
                    <Truck className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-bold text-muted-foreground/60">Nenhuma entrega em andamento</p>
                    <p className="text-xs text-muted-foreground/40 mt-1">Clique em "Nova Entrega" para começar</p>
                  </div>
                )}
              </div>

              {/* Marketplace Orders */}
              <div className="space-y-3">
                  <div className="flex flex-col gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input 
                        type="text" 
                        placeholder="Buscar pedido ou cliente..." 
                        value={orderSearchQuery}
                        onChange={(e) => setOrderSearchQuery(e.target.value)}
                        className="w-full bg-muted/50 border-none rounded-xl pl-10 pr-4 py-2 text-xs font-bold focus:ring-2 focus:ring-info/20 outline-none transition-all"
                      />
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {['all', 'pending', 'preparing', 'ready', 'in_route', 'in_transit'].map((status) => (
                        <button
                          key={status}
                          onClick={() => setStatusFilter(status)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shrink-0",
                            statusFilter === status 
                              ? "bg-info text-info-foreground shadow-md shadow-info/20" 
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}
                        >
                          {status === 'all' ? 'Todos' : 
                           status === 'pending' ? 'Novos' : 
                           status === 'preparing' ? 'Preparo' : 
                           status === 'ready' ? 'Prontos' : 'Em Trânsito'}
                        </button>
                      ))}
                    </div>
                  </div>

                {isLoadingOrders ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="bg-card border border-border/50 rounded-xl p-4 flex gap-3">
                        <Skeleton className="w-10 h-10 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-12" /></div>
                          <Skeleton className="h-3 w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : marketplaceOrders.length > 0 ? (
                  <div className="space-y-2.5">
                    {marketplaceOrders.map((order, i) => (
                      <div
                        key={order.id}
                        onClick={() => setSelectedOrder(order as any)}
                        className="bg-card border border-border/50 rounded-xl p-4 hover:border-info/30 hover:shadow-card-hover transition-all duration-200 group cursor-pointer"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 transition-colors",
                            order.status === 'pending' ? "bg-warning/10" : "bg-info/10"
                          )}>
                            <span className="text-[9px] font-black leading-none text-muted-foreground">{format(new Date(order.created_at), 'HH:mm')}</span>
                            <Clock className="h-3 w-3 text-muted-foreground mt-0.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <p className="text-sm font-bold text-foreground truncate">
                                {order.customers?.name || (order as any).customer_name || (order as any).customer?.name || "Cliente"}
                              </p>
                              <div className={cn(
                                "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
                                order.status === 'pending' ? "bg-warning/10 text-warning" : "bg-info/10 text-info"
                              )}>
                                {order.status === 'pending' ? 'Novo' : order.status}
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                <ShoppingBag className="h-3 w-3" />
                                {order.order_items?.length || 0} itens
                              </p>
                              <p className="text-sm font-black text-foreground">
                                R$ {order.total?.toFixed(2).replace('.', ',')}
                              </p>
                            </div>
                          </div>
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all shrink-0">
                            <ArrowRight className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
                    <ShoppingBag className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-bold text-muted-foreground/60">Aguardando pedidos</p>
                    <p className="text-xs text-muted-foreground/40 mt-1">Novos pedidos aparecerão aqui automaticamente</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <React.Suspense fallback={null}>
          <OrderDetailModal
            order={selectedOrder}
            isOpen={!!selectedOrder}
            onClose={() => setSelectedOrder(null)}
            onAdvance={handleAdvanceOrder}
          />
        </React.Suspense>
      </React.Suspense>
    </BusinessLayout>
  );
}
