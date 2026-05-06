import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Truck, Clock, Loader2, MapPin, Trash2, Wallet, Zap, ShoppingBag } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useDeliveries, useDeliveryStats } from "@/services/deliveries";
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
  const [showNewDelivery, setShowNewDelivery] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const qc = useQueryClient();
  
  const { data: companyData } = useQuery({
    queryKey: ["company-info", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("user_id", user.id);
      
      if (!data || data.length === 0) return null;
      // Seleciona a melhor empresa (não teste ou a primeira)
      return data.find(c => !c.name.toLowerCase().includes("teste")) || data[0];
    },
    enabled: !!user?.id
  });

  const companyId = companyData?.id;

  // 1. Fetch Marketplace Orders with active deliveries
  const { data: marketplaceOrders, isLoading: isLoadingMarketplace } = useQuery({
    queryKey: ["marketplace-deliveries-active", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id, status, total, created_at, customer_id, delivery_id,
          delivery_address, payment_method, customer_name,
          order_items (
            id, quantity, price, product_name,
            products (id, name, image_url, description)
          )
        `)
        .eq("company_id", companyId)
        .not("delivery_id", "is", null)
        .not("status", "in", '("completed", "delivered", "cancelled")');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId
  });

  // 2. Fetch all active deliveries
  const { data: deliveriesData, isLoading: isLoadingDeliveries } = useDeliveries({
    companyId: companyId || undefined,
    pageSize: 50 // Increased page size
  });

  const { data: deliveryStats, isLoading: isLoadingStats } = useDeliveryStats({ companyId });

  const activeDeliveries = (deliveriesData?.data || []).filter(d => !["completed", "delivered", "cancelled"].includes(d.status));

  // 3. Separate Manual vs Marketplace
  const marketplaceDeliveryIds = new Set((marketplaceOrders || []).map(o => o.delivery_id));
  
  const manualDeliveries = activeDeliveries.filter(d => !marketplaceDeliveryIds.has(d.id));
  const marketplaceDeliveriesWithOrders = (marketplaceOrders || []).map(order => {
    // Tenta encontrar a entrega vinculada
    const delivery = activeDeliveries.find(d => d.id === order.delivery_id);
    return { ...order, deliveryInfo: delivery };
  });

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel("business-home-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries", filter: `company_id=eq.${companyId}` }, () => {
        qc.invalidateQueries({ queryKey: ["deliveries"] });
        qc.invalidateQueries({ queryKey: ["delivery-stats"] });
        qc.invalidateQueries({ queryKey: ["marketplace-deliveries-active"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `company_id=eq.${companyId}` }, () => {
        qc.invalidateQueries({ queryKey: ["marketplace-deliveries-active"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, qc]);


  const stats = useMemo(() => ({
    pending: deliveryStats?.pending ?? 0,
    inRoute: deliveryStats?.inTransit ?? 0,
    manualRevenue: deliveryStats?.todayCollection ?? 0
  }), [deliveryStats]);

  const handleAdvanceOrder = async (orderId: string, nextStatus: string) => {
    try {
      console.log("[Home] Atualizando status via UPDATE direto em orders...");
      const { error } = await supabase
        .from("orders")
        .update({ status: nextStatus as any })
        .eq("id", orderId);

      if (error) throw error;

      toast.success("Status do pedido atualizado");
      qc.invalidateQueries({ queryKey: ["marketplace-orders-active"] });
      qc.invalidateQueries({ queryKey: ["deliveries"] });
    } catch (error: any) {
      console.error("[Home] Falha na atualização:", error);
      toast.error("Erro ao atualizar: " + error.message);
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
                    Gerencie suas vendas e entregas em um só lugar.
                  </p>
                </div>

                <div className="flex items-center gap-3">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 font-black">
              {isLoadingStats ? (
                <>
                  <Skeleton className="h-32 rounded-2xl border-none shadow-sm" />
                  <Skeleton className="h-32 rounded-2xl border-none shadow-sm" />
                  <Skeleton className="h-32 rounded-2xl border-none shadow-sm" />
                </>
              ) : (
                <>
                  <StatCard label="Pendentes" value={stats.pending} icon={Clock} color="warning" subtitle="Entregas manuais" />
                  <StatCard label="Em Rota" value={stats.inRoute} icon={Truck} color="primary" subtitle="Em trânsito agora" />
                  <StatCard label="Hoje (Manual)" value={`R$ ${stats.manualRevenue.toFixed(2).replace('.', ',')}`} icon={Wallet} color="warning" subtitle="Cobrança Local" />
                </>
              )}
            </div>

            {/* Content Section - Marketplace Deliveries */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-primary rounded-full" />
                  <h3 className="text-lg font-black text-foreground tracking-tight">Entregas do Marketplace</h3>
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-lg text-[10px] font-black uppercase">{marketplaceDeliveriesWithOrders.length}</span>
                </div>
              </div>

              {isLoadingMarketplace || isLoadingDeliveries ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Skeleton className="h-32 rounded-2xl" />
                  <Skeleton className="h-32 rounded-2xl" />
                </div>
              ) : marketplaceDeliveriesWithOrders.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {marketplaceDeliveriesWithOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => {
                        setSelectedOrder({
                          ...order,
                          customer: { 
                            name: order.customer_name, 
                            address: order.delivery_address 
                          },
                          items: order.order_items || []
                        });
                      }}
                      className="bg-card border border-border/60 rounded-[2rem] p-5 hover:border-primary/40 hover:shadow-xl transition-all duration-300 group cursor-pointer relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                        <ShoppingBag className="w-16 h-16" />
                      </div>
                      
                      <div className="flex items-center justify-between mb-4">
                        <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
                          Marketplace
                        </div>
                        <DeliveryStatusBadge status={order.deliveryInfo?.status || "pending"} />
                      </div>

                      <div className="space-y-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1 opacity-60">Cliente</p>
                          <p className="text-base font-black text-foreground truncate">{order.customer_name}</p>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate">{order.delivery_address}</span>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-border/50">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Pedido</span>
                            <span className="text-sm font-black text-foreground">#{order.id.slice(-6).toUpperCase()}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Valor</span>
                            <p className="text-base font-black text-primary italic">R$ {order.total.toFixed(2).replace('.', ',')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-muted/30 border border-dashed border-border rounded-[2rem] p-12 text-center">
                  <ShoppingBag className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-xs font-black text-muted-foreground/50 uppercase tracking-widest">Nenhuma entrega do marketplace agora</p>
                </div>
              )}
            </div>

            {/* Content Section - Manual Deliveries */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-warning rounded-full" />
                  <h3 className="text-lg font-black text-foreground tracking-tight">Entregas Manuais</h3>
                  <span className="bg-warning/10 text-warning px-2 py-0.5 rounded-lg text-[10px] font-black uppercase">{manualDeliveries.length}</span>
                </div>
              </div>

              {isLoadingDeliveries ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Skeleton className="h-24 rounded-2xl" />
                </div>
              ) : manualDeliveries.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {manualDeliveries.map((delivery) => (
                    <div
                      key={delivery.id}
                      className="bg-card border border-border/60 rounded-[1.5rem] p-5 hover:border-warning/40 hover:shadow-xl transition-all duration-300 group relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0 border border-warning/10 group-hover:scale-105 transition-transform">
                            <Truck className="h-5 w-5 text-warning" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest opacity-60">Entrega Manual</p>
                            <p className="text-sm font-black text-foreground truncate max-w-[150px]">{delivery.customer_name}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <DeliveryStatusBadge status={delivery.status} />
                          <button
                            onClick={() => handleCancel(delivery.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                            title="Cancelar Entrega"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold mb-3">
                        <MapPin className="h-3.5 w-3.5 text-warning shrink-0" />
                        <span className="truncate">{delivery.address}</span>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border/50">
                        <span className="text-[10px] font-bold text-muted-foreground">Criado às {format(new Date(delivery.created_at), "HH:mm")}</span>
                        <p className="text-sm font-black text-warning italic">R$ {(delivery.value || 0).toFixed(2).replace('.', ',')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-muted/30 border border-dashed border-border rounded-[1.5rem] p-12 text-center">
                  <Truck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-xs font-black text-muted-foreground/50 uppercase tracking-widest">Sem entregas manuais em andamento</p>
                </div>
              )}
            </div>
          </div>
        )}

        <React.Suspense fallback={null}>
          <OrderDetailModal
            order={selectedOrder}
            isOpen={!!selectedOrder}
            onClose={() => setSelectedOrder(null)}
            updateStatus={handleAdvanceOrder}
          />
        </React.Suspense>
      </React.Suspense>
    </BusinessLayout>
  );
}
