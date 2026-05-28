import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Plus, Truck, Clock, CheckCircle, Loader2, Package, Trash2, Pencil, MapPin, ShoppingBag, Zap, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useDeliveries, useDeliveryStats, type DeliveryWithRelations } from "@/services/deliveries";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { DeliveryStatusBadge } from "@/components/admin/DeliveryStatusBadge";
import type { DeliveryStatus, Delivery } from "@/types/models";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const NewDeliveryForm = React.lazy(() => import("@/components/business/NewDeliveryForm"));
const OrderDetailModal = React.lazy(() => import("@/components/business/OrderDetailModal"));

const CLOSED_DELIVERY_STATUSES = ["completed", "delivered", "cancelled"];
const MOVING_DELIVERY_STATUSES = ["accepted", "collecting", "in_route", "in_transit"];

type MarketplaceOrder = {
  id: string;
  status: string;
  total?: number | null;
  created_at?: string;
  customer_id?: string | null;
  delivery_id?: string | null;
  delivery_address?: string | null;
  payment_method?: string | null;
  customers?: { name?: string | null } | { name?: string | null }[] | null;
  order_items?: unknown[];
  deliveryInfo?: DeliveryWithRelations;
};

export default function BusinessHomePage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [showNewDelivery, setShowNewDelivery] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [optimisticManualDeliveries, setOptimisticManualDeliveries] = useState<DeliveryWithRelations[]>([]);
  const qc = useQueryClient();
  
  const { companyId, company: companyData } = useCurrentCompany();

  // 1. Fetch Marketplace Orders with active deliveries
  const { data: marketplaceOrders, isLoading: isLoadingMarketplace } = useQuery({
    queryKey: ["marketplace-deliveries-active", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id, status, total, created_at, customer_id, delivery_id,
          delivery_address, payment_method,
          customers (name),
          order_items (
            id, quantity, price, notes,
            products (id, name, image_url, description)
          )
        `)
        .eq("company_id", companyId)
        .not("delivery_id", "is", null)
        .not("status", "in", '("delivered","cancelled")');
      
      if (error) throw error;
      return (data || []) as MarketplaceOrder[];
    },
    enabled: !!companyId
  });

  // 2. Fetch all active deliveries
  const { data: deliveriesData, isLoading: isLoadingDeliveries } = useDeliveries({
    companyId: companyId || undefined,
    pageSize: 100
  });

  // Consulta direta e simples, igual ao que o painel do entregador precisa enxergar.
  // Evita a tela ficar zerada se algum relacionamento da consulta completa falhar.
  const { data: openStoreDeliveries, isLoading: isLoadingOpenStoreDeliveries } = useQuery({
    queryKey: ["business-open-store-deliveries", companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from("deliveries")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.warn("[Lojista] Falha ao buscar entregas abertas por company_id:", error);
        return [];
      }
      return (data || []) as DeliveryWithRelations[];
    },
    enabled: !!companyId,
    refetchInterval: 5000,
  });

  const { data: openStoreDeliveriesByName, isLoading: isLoadingOpenStoreDeliveriesByName } = useQuery({
    queryKey: ["business-open-store-deliveries-by-name", companyData?.name],
    queryFn: async () => {
      if (!companyData?.name) return [];

      const { data, error } = await supabase
        .from("deliveries")
        .select("*, companies!inner(name)")
        .eq("companies.name", companyData.name)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.warn("[Lojista] Falha ao buscar entregas abertas por nome da empresa:", error);
        return [];
      }
      return (data || []) as DeliveryWithRelations[];
    },
    enabled: !!companyData?.name,
    refetchInterval: 5000,
  });

  // Último fallback: busca tudo que o usuário autenticado consegue enxergar e filtra no cliente.
  // Isso cobre casos em que a entrega existe para o entregador, mas foi gravada com vínculo divergente.
  const { data: visibleDeliveriesFallback, isLoading: isLoadingVisibleDeliveriesFallback } = useQuery({
    queryKey: ["business-visible-deliveries-fallback", companyId, companyData?.name, companyData?.email, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("*, companies(name, email, user_id)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.warn("[Lojista] Falha no fallback geral de entregas:", error);
        return [];
      }

      const companyName = companyData?.name?.trim().toLowerCase();
      const companyEmail = companyData?.email?.trim().toLowerCase();
      return ((data || []) as DeliveryWithRelations[]).filter((delivery) => {
        const deliveryCompany = delivery.companies as any;
        return (
          (!!companyId && delivery.company_id === companyId) ||
          (!!companyName && deliveryCompany?.name?.trim().toLowerCase() === companyName) ||
          (!!companyEmail && deliveryCompany?.email?.trim().toLowerCase() === companyEmail) ||
          (!!user?.id && deliveryCompany?.user_id === user.id)
        );
      });
    },
    enabled: !!companyId || !!companyData?.name || !!companyData?.email || !!user?.id,
    refetchInterval: 5000,
  });

  const { data: deliveryStats, isLoading: isLoadingStats } = useDeliveryStats({ companyId: companyId || undefined });

  const combinedDeliveries = useMemo(() => {
    const byId = new Map<string, DeliveryWithRelations>();
    [...optimisticManualDeliveries, ...(visibleDeliveriesFallback || []), ...(openStoreDeliveriesByName || []), ...(openStoreDeliveries || []), ...(deliveriesData?.data || [])].forEach((delivery) => {
      if (delivery?.id) byId.set(delivery.id, delivery);
    });
    return Array.from(byId.values());
  }, [deliveriesData?.data, openStoreDeliveries, openStoreDeliveriesByName, optimisticManualDeliveries, visibleDeliveriesFallback]);

  // Filter deliveries to only show active ones
  const activeDeliveries = combinedDeliveries.filter(d => {
    if (CLOSED_DELIVERY_STATUSES.includes(d.status)) return false;
    if (companyId && d.company_id && d.company_id !== companyId) {
      const deliveryCompanyName = (d.companies as any)?.name?.trim().toLowerCase();
      const currentCompanyName = companyData?.name?.trim().toLowerCase();
      if (!deliveryCompanyName || deliveryCompanyName !== currentCompanyName) return false;
    }
    const linkedOrder = marketplaceOrders?.find(o => o.delivery_id === d.id || o.id === d.order_id);
    if (d.order_id && linkedOrder && CLOSED_DELIVERY_STATUSES.includes(linkedOrder.status)) return false;
    return true;
  });

  useEffect(() => {
    console.info("[Lojista] entregas carregadas", {
      companyId,
      principal: deliveriesData?.data?.length ?? 0,
      porEmpresa: openStoreDeliveries?.length ?? 0,
      porNome: openStoreDeliveriesByName?.length ?? 0,
      fallback: visibleDeliveriesFallback?.length ?? 0,
      recemCriadasNaTela: optimisticManualDeliveries.length,
      ativas: activeDeliveries.length,
    });
  }, [activeDeliveries.length, companyId, deliveriesData?.data?.length, openStoreDeliveries?.length, openStoreDeliveriesByName?.length, optimisticManualDeliveries.length, visibleDeliveriesFallback?.length]);

  // Separate Manual vs Marketplace
  const marketplaceDeliveries = activeDeliveries.filter(d => !!d.order_id || (marketplaceOrders || []).some(o => o.delivery_id === d.id));
  const manualDeliveries = activeDeliveries.filter(d => !d.order_id && !(marketplaceOrders || []).some(o => o.delivery_id === d.id));

  const marketplaceDeliveriesWithOrders: MarketplaceOrder[] = marketplaceDeliveries.map(delivery => {
    const order = (marketplaceOrders || []).find(o => o.delivery_id === delivery.id || o.id === delivery.order_id);
    return { ...order, id: order?.id || delivery.order_id || delivery.id, total: order?.total || delivery.value || 0, deliveryInfo: delivery };
  });

  // Atualização por HTTP: evita depender de WebSocket/realtime, que está instável no domínio publicado.
  useEffect(() => {
    if (!companyId) return;
    const invalidateDeliveryQueries = () => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["delivery-stats"] });
      qc.invalidateQueries({ queryKey: ["marketplace-deliveries-active"] });
      qc.invalidateQueries({ queryKey: ["business-open-store-deliveries"] });
      qc.invalidateQueries({ queryKey: ["business-open-store-deliveries-by-name"] });
      qc.invalidateQueries({ queryKey: ["business-visible-deliveries-fallback"] });
    };

    invalidateDeliveryQueries();
    const interval = window.setInterval(invalidateDeliveryQueries, 5000);
    return () => window.clearInterval(interval);
  }, [companyId, qc]);

  const stats = useMemo(() => ({
    pending: Math.max(deliveryStats?.pending ?? 0, activeDeliveries.filter(d => ["pending", "broadcasted"].includes(d.status)).length),
    inRoute: Math.max(deliveryStats?.inTransit ?? 0, activeDeliveries.filter(d => MOVING_DELIVERY_STATUSES.includes(d.status)).length),
    manualRevenue: Math.max(deliveryStats?.todayCollection ?? 0, activeDeliveries.reduce((sum, d) => sum + Number(d.value ?? 0), 0))
  }), [deliveryStats, activeDeliveries]);

  const handleCancel = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar esta entrega?")) return;
    try {
      const { error } = await supabase.from("deliveries").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
      toast.success("Entrega cancelada");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEdit = (delivery: any) => {
    setEditingDelivery(delivery);
    setShowNewDelivery(true);
  };

  const handleDeliverySaved = (delivery: DeliveryWithRelations) => {
    setOptimisticManualDeliveries((current) => {
      const withoutSaved = current.filter((item) => item.id !== delivery.id);
      return [delivery, ...withoutSaved];
    });
    qc.setQueriesData({ queryKey: ["deliveries"] }, (old: any) => {
      if (!old?.data) return old;
      const existing = old.data.filter((item: DeliveryWithRelations) => item.id !== delivery.id);
      return { ...old, data: [delivery, ...existing], count: Math.max(old.count ?? 0, existing.length + 1) };
    });
  };

  const handleComplete = async (delivery: any) => {
    if (!confirm("Finalizar esta entrega?")) return;
    try {
      await supabase.from("deliveries").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", delivery.id);
      if (delivery.order_id) {
        await supabase.from("orders").update({ status: "delivered" } as any).eq("id", delivery.order_id);
      }
      toast.success("Entrega finalizada!");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["marketplace-deliveries-active"] });
    } catch (err: any) {
      toast.error(err.message);
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
      <React.Suspense fallback={<div className="flex items-center justify-center p-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}>
        {showNewDelivery ? (
          <NewDeliveryForm 
            onClose={() => { setShowNewDelivery(false); setEditingDelivery(null); }} 
            onSaved={handleDeliverySaved}
            initialData={editingDelivery}
            companyId={companyId}
            companyData={companyData}
          />
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Hero Header */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary via-primary to-info p-8 md:p-10 text-primary-foreground shadow-2xl">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDE4YzAtOS45NC04LjA2LTE4LTE4LTE4UzAgOC4wNiAwIDE4czguMDYgMTggMTggMTggMTgtOC4wNiAxOC0xOCIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
              
              <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-warning animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-white/70">Central de Operações</span>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                    {greeting}, {companyData?.name || profile?.full_name?.split(" ")[0] || "Lojista"}!
                  </h2>
                  <p className="text-white/70 font-medium">Gerencie suas solicitações de entrega em tempo real.</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate("/business/chat")}
                    className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition-all flex items-center justify-center relative group"
                  >
                    <MessageSquare className="h-6 w-6 group-hover:scale-110 transition-transform" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-warning"></span>
                    </span>
                  </button>

                  <button
                    onClick={() => setShowNewDelivery(true)}
                    className="px-8 py-4 rounded-2xl bg-white text-primary text-lg font-black flex items-center justify-center gap-3 shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    <Plus className="h-6 w-6" />
                    Nova Entrega
                  </button>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard label="Pendentes" value={stats.pending} icon={Clock} color="warning" subtitle="Aguardando Coleta" />
              <StatCard label="Em Rota" value={stats.inRoute} icon={Truck} color="primary" subtitle="Em trânsito agora" />
              <StatCard label="Hoje (Local)" value={`R$ ${stats.manualRevenue.toFixed(2).replace('.', ',')}`} icon={Wallet} color="success" subtitle="Cobrança Manual" />
            </div>

            {/* Content Section - Marketplace Deliveries */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <div className="w-2 h-6 bg-primary rounded-full shadow-lg shadow-primary/20" />
                <h3 className="text-xl font-black text-foreground tracking-tight">Entregas do Marketplace</h3>
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-xl text-xs font-black uppercase">{marketplaceDeliveriesWithOrders.length}</span>
              </div>

              {isLoadingMarketplace ? (
                <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : marketplaceDeliveriesWithOrders.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {marketplaceDeliveriesWithOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder({ ...order, customer: { name: (order.customers as any)?.name || (order.customers as any)?.[0]?.name || order.deliveryInfo?.customer_name, address: order.delivery_address }, items: order.order_items || [] })}
                      className="bg-card border border-border/50 rounded-[2.5rem] p-6 hover:border-primary/30 hover:shadow-2xl transition-all duration-300 group cursor-pointer relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="px-3 py-1 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">Marketplace</div>
                        <DeliveryStatusBadge status={order.deliveryInfo?.status || "pending"} />
                      </div>
                      <div className="space-y-4">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Destinatário</p>
                          <p className="text-lg font-black text-foreground truncate">{(order.customers as any)?.name || (order.customers as any)?.[0]?.name || order.deliveryInfo?.customer_name || "Cliente"}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold">
                          <MapPin className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate">{order.delivery_address}</span>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-border/50">
                           <div className="flex flex-col">
                             <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Pedido</span>
                             <span className="text-sm font-black text-foreground">#{order.id?.slice(-6).toUpperCase()}</span>
                           </div>
                           <div className="text-right">
                             <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Valor</span>
                             <p className="text-lg font-black text-primary italic">R$ {order.total.toFixed(2).replace('.', ',')}</p>
                           </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleComplete(order.deliveryInfo); }} className="w-full py-3 rounded-2xl bg-green-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all">Finalizar Entrega</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={ShoppingBag} message="Nenhuma entrega do marketplace agora" />
              )}
            </div>

            {/* Content Section - Manual Deliveries */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <div className="w-2 h-6 bg-warning rounded-full shadow-lg shadow-warning/20" />
                <h3 className="text-xl font-black text-foreground tracking-tight">Entregas Manuais (Loja)</h3>
                <span className="bg-warning/10 text-warning px-3 py-1 rounded-xl text-xs font-black uppercase">{manualDeliveries.length}</span>
              </div>

              {isLoadingDeliveries || isLoadingOpenStoreDeliveries || isLoadingOpenStoreDeliveriesByName || isLoadingVisibleDeliveriesFallback ? (
                <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : manualDeliveries.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {manualDeliveries.map((delivery) => (
                    <div
                      key={delivery.id}
                      className="bg-card border border-border/50 rounded-[2.5rem] p-6 hover:border-warning/30 hover:shadow-2xl transition-all duration-300 group relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-warning/10 flex items-center justify-center shrink-0 border border-warning/10"><Truck className="h-6 w-6 text-warning" /></div>
                          <div>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Solicitação Manual</p>
                            <p className="text-base font-black text-foreground truncate max-w-[150px]">{delivery.customer_name}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <DeliveryStatusBadge status={delivery.status} />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold">
                          <MapPin className="h-4 w-4 text-warning shrink-0" />
                          <span className="truncate">{delivery.address}</span>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-border/50">
                           <div className="flex flex-col">
                             <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Início</span>
                             <span className="text-sm font-black text-foreground">{format(new Date(delivery.created_at), "HH:mm")}</span>
                           </div>
                           <div className="flex items-center gap-2">
                              <button onClick={() => handleEdit(delivery)} className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground transition-all"><Pencil className="h-4 w-4" /></button>
                              <button onClick={() => handleCancel(delivery.id)} className="p-2.5 rounded-xl hover:bg-destructive/10 text-destructive transition-all"><Trash2 className="h-4 w-4" /></button>
                           </div>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                           <div className="text-left">
                             <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">A Cobrar</span>
                             <p className="text-xl font-black text-warning italic">R$ {(delivery.value || 0).toFixed(2).replace('.', ',')}</p>
                           </div>
                           <button onClick={() => handleComplete(delivery)} className="px-6 py-3 rounded-2xl bg-warning text-warning-foreground font-black text-xs uppercase tracking-widest shadow-lg shadow-warning/20 hover:scale-105 transition-all">Concluir</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Truck} message="Sem entregas manuais em andamento" />
              )}
            </div>
          </div>
        )}

        <React.Suspense fallback={null}>
          <OrderDetailModal order={selectedOrder} isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} />
        </React.Suspense>
      </React.Suspense>
    </BusinessLayout>
  );
}

function StatCard({ label, value, icon: Icon, color, subtitle }: any) {
  const colors: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    warning: "text-warning bg-warning/10",
    success: "text-green-500 bg-green-500/10",
  };
  return (
    <div className="bg-card rounded-[2rem] p-6 shadow-sm border border-border/50 hover:border-primary/20 transition-all group">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", colors[color])}><Icon className="h-7 w-7" /></div>
      <p className="text-4xl font-black text-foreground tracking-tight">{value}</p>
      <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mt-1">{label}</p>
      <p className="text-[10px] font-bold text-muted-foreground opacity-50">{subtitle}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: any) {
  return (
    <div className="bg-muted/20 border border-dashed border-border rounded-[2.5rem] p-16 text-center animate-in fade-in duration-700">
      <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mx-auto mb-6"><Icon className="h-10 w-10 text-muted-foreground/30" /></div>
      <p className="text-xs font-black text-muted-foreground/50 uppercase tracking-[0.2em]">{message}</p>
    </div>
  );
}
