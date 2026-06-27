import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Plus, Truck, Clock, CheckCircle, Loader2, Package, Trash2, Pencil, MapPin, ShoppingBag, Zap, Wallet, Printer, Eye, User } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [detailDelivery, setDetailDelivery] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [optimisticManualDeliveries, setOptimisticManualDeliveries] = useState<DeliveryWithRelations[]>([]);
  const qc = useQueryClient();
  
  const getDeliveryPaymentMethod = (delivery: any) => {
    const orderPayment = delivery.orders?.[0]?.payment_method || delivery.orders?.payment_method;
    if (orderPayment) return orderPayment;
    if (delivery.payment_method) return delivery.payment_method;
    if (delivery.notes) {
      if (delivery.notes.includes("[PAGO]")) return "Já pago";
      const match = delivery.notes.match(/\[RECEBER: (.*?)\]/);
      if (match) return match[1];
    }
    return "Não informado";
  };

  const getDeliveryTotalToCollect = (delivery: any): number => {
    if (delivery.notes && delivery.notes.includes("[PAGO]")) {
       return 0; 
    }
    
    let productValue = Number(delivery.estimated_value || 0);
    if (productValue === 0 && delivery.notes) {
      const match = delivery.notes.match(/Total Produtos:\s*R\$\s*([\d,.]+)/);
      if (match) {
         productValue = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
      }
    }
    
    const deliveryFee = Number(delivery.commission ?? delivery.price ?? delivery.value ?? 0);
    return productValue + deliveryFee;
  };

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
    staleTime: 15_000,
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
    // Só roda esse scan pesado quando as consultas escopadas por empresa não trouxeram nada.
    enabled:
      (!!companyId || !!companyData?.name || !!companyData?.email || !!user?.id) &&
      (openStoreDeliveries?.length ?? 0) === 0 &&
      (openStoreDeliveriesByName?.length ?? 0) === 0,
    staleTime: 30_000,
    gcTime: 60_000,
  });

  const { data: deliveryStats, isLoading: isLoadingStats } = useDeliveryStats({ companyId: companyId || undefined });

  const combinedDeliveries = useMemo(() => {
    const byId = new Map<string, DeliveryWithRelations>();
    [...optimisticManualDeliveries, ...(visibleDeliveriesFallback || []), ...(openStoreDeliveriesByName || []), ...(openStoreDeliveries || []), ...(deliveriesData?.data || [])].forEach((delivery) => {
      if (delivery?.id) byId.set(delivery.id, delivery);
    });
    return Array.from(byId.values());
  }, [deliveriesData?.data, openStoreDeliveries, openStoreDeliveriesByName, optimisticManualDeliveries, visibleDeliveriesFallback]);

  // Resolve driver names for all deliveries that have a driver_id but no joined driver data.
  const driverIds = useMemo(() => {
    const ids = new Set<string>();
    combinedDeliveries.forEach((d) => {
      if (d.driver_id && !(d.delivery_drivers as any)?.full_name) ids.add(d.driver_id);
    });
    return Array.from(ids);
  }, [combinedDeliveries]);

  const { data: driverNameMap } = useQuery({
    queryKey: ["business-driver-names", driverIds],
    queryFn: async () => {
      const map: Record<string, string> = {};
      if (driverIds.length === 0) return map;
      const { data, error } = await supabase
        .from("delivery_drivers")
        .select("id, full_name")
        .in("id", driverIds);
      if (error) {
        console.warn("[Lojista] Falha ao resolver nomes de entregadores:", error);
        return map;
      }
      (data || []).forEach((d: any) => {
        if (d.id) map[d.id] = d.full_name;
      });
      return map;
    },
    enabled: driverIds.length > 0,
  });

  const resolveDriverName = (delivery: any): string => {
    return (
      (delivery?.delivery_drivers as any)?.full_name ||
      (delivery?.driver_id ? driverNameMap?.[delivery.driver_id] : undefined) ||
      "Atribuído"
    );
  };

  // Filter deliveries to only show active ones
  const activeDeliveries = combinedDeliveries.filter(d => {
    if (!companyId) return false;
    if (d.notes === "Cancelamento automático de entrega prematura") return false;
    if (CLOSED_DELIVERY_STATUSES.includes(d.status)) return false;
    if (d.company_id !== companyId) {
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
    return { ...order, id: order?.id || delivery.order_id || delivery.id, total: order?.total || (delivery as any).commission || delivery.value || 0, deliveryInfo: delivery };
  });

  // Atualização agora depende do cache do React Query ou webhooks reais
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
      qc.invalidateQueries({ queryKey: ["delivery-stats"] });
      qc.invalidateQueries({ queryKey: ["business-open-store-deliveries"] });
      qc.invalidateQueries({ queryKey: ["business-open-store-deliveries-by-name"] });
      qc.invalidateQueries({ queryKey: ["business-visible-deliveries-fallback"] });
      
      // Remove from optimistic state if exists
      setOptimisticManualDeliveries(current => current.filter(d => d.id !== id));
      
      // Failsafe force reload after a moment to ensure UI clears
      setTimeout(() => {
        window.location.reload();
      }, 800);
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

  const handlePrint = (delivery: any, overrideProductValue?: number) => {
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;

    let productValue = overrideProductValue !== undefined ? overrideProductValue : Number(delivery.estimated_value || 0);
    if (productValue === 0 && delivery.notes) {
      const match = delivery.notes.match(/Total Produtos:\s*R\$\s*([\d,.]+)/);
      if (match) {
         productValue = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
      }
    }

    w.document.write(`
      <html><head><title>OS #${delivery.id.slice(0, 8)}</title>
      <style>
        body { font-family: monospace; font-size: 12px; margin: 0; padding: 4mm; background: white; color: black; }
        h1 { font-size: 16px; margin-bottom: 4px; text-align: center; font-weight: bold; }
        .label { font-size: 10px; text-transform: uppercase; margin-top: 8px; font-weight: bold; border-bottom: 1px dashed #000; margin-bottom: 2px; }
        .value { font-weight: normal; margin-bottom: 8px; }
        hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
        .footer { margin-top: 16px; text-align: center; font-size: 10px; font-weight: bold; text-transform: uppercase; }
        @media print {
          @page { margin: 0; size: 80mm auto; }
          body { width: 80mm; min-width: 80mm; max-width: 80mm; }
        }
      </style></head><body>
        <h1 style="text-align: center; text-transform: uppercase;">É Pra Já Delivery</h1>
        <p style="color:#666;margin-top:0">Ordem de Serviço (Loja)</p>
        <hr/>
        <div class="label">OS</div>
        <div class="value">#${delivery.id.slice(0, 8).toUpperCase()}</div>
        <div class="label">Cliente</div>
        <div class="value">${delivery.customer_name} ${(delivery as any).customer_phone ? `(${(delivery as any).customer_phone})` : ""}</div>
        <div class="label">Endereço</div>
        <div class="value">${delivery.dropoff_address || delivery.address || "—"}</div>
        <div class="label">Empresa</div>
        <div class="value">${(delivery as any).companies?.name || "—"}</div>
        <div class="label">Status</div>
        <div class="value">${delivery.status}</div>
        <div class="label">Forma de Pagamento</div>
        <div class="value">${getDeliveryPaymentMethod(delivery)}</div>
        <hr/>
        <div class="label">Valor do Produto</div>
        <div class="value">R$ ${productValue.toFixed(2).replace('.', ',')}</div>
        <div class="label">Taxa de Entrega</div>
        <div class="value">R$ ${Number((delivery as any).commission ?? delivery.value ?? (delivery as any).price ?? 0).toFixed(2).replace('.', ',')}</div>
        <div class="label">Data/Hora da Solicitação</div>
        <div class="value">${format(new Date(delivery.created_at), "dd/MM/yyyy HH:mm")}</div>
        ${delivery.notes ? `<div class="label">Observações</div><div class="value">${delivery.notes}</div>` : ""}
        <hr/>
        <div class="footer">Impresso em ${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
      </body></html>
    `);
    w.document.close();
    w.print();
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
                        <div className="flex flex-col gap-1 mt-1 bg-muted/20 p-2 rounded-xl">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Pagamento:</span>
                            <span className="font-bold text-foreground capitalize truncate max-w-[120px]">{order.payment_method || (order.deliveryInfo as any)?.payment_method || "Não informado"}</span>
                          </div>
                          {order.deliveryInfo?.driver_id && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Entregador:</span>
                              <span className="font-bold text-primary truncate max-w-[120px]">
                                {resolveDriverName(order.deliveryInfo)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-border/50">
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
                        <div className="flex flex-col gap-1 mt-1 bg-muted/20 p-2 rounded-xl">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Pagamento:</span>
                            <span className="font-bold text-foreground capitalize truncate max-w-[120px]">{getDeliveryPaymentMethod(delivery)}</span>
                          </div>
                          {delivery.driver_id && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Entregador:</span>
                              <span className="font-bold text-warning truncate max-w-[120px]">
                                {resolveDriverName(delivery)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-border/50">
                           <div className="flex flex-col">
                             <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Início</span>
                             <span className="text-sm font-black text-foreground">{format(new Date(delivery.created_at), "HH:mm")}</span>
                           </div>
                           <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 w-full mt-2 sm:mt-0 sm:w-auto">
                              <button onClick={() => setDetailDelivery(delivery)} className="p-2.5 rounded-xl bg-info/10 hover:bg-info/20 text-info transition-all shadow-sm" title="Ver Detalhes"><Eye className="h-4 w-4" /></button>
                              <button onClick={() => handlePrint(delivery)} className="p-2.5 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground transition-all shadow-sm" title="Imprimir O.S"><Printer className="h-4 w-4" /></button>
                              <button onClick={() => handleEdit(delivery)} className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground transition-all"><Pencil className="h-4 w-4" /></button>
                              <button onClick={() => handleCancel(delivery.id)} className="p-2.5 rounded-xl hover:bg-destructive/10 text-destructive transition-all"><Trash2 className="h-4 w-4" /></button>
                           </div>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                           <div className="text-left">
                             <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">A Cobrar</span>
                             <p className="text-xl font-black text-warning italic">R$ {getDeliveryTotalToCollect(delivery).toFixed(2).replace('.', ',')}</p>
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

        {/* Dialog Detalhes de OS Manual */}
        <Dialog open={!!detailDelivery} onOpenChange={(open) => !open && setDetailDelivery(null)}>
          <DialogContent className="max-w-md p-6 rounded-[2.5rem]">
            <DialogHeader className="mb-4">
              <DialogTitle className="flex items-center gap-3 text-2xl font-black">
                <div className="w-12 h-12 rounded-2xl bg-warning/10 flex items-center justify-center border border-warning/10">
                  <Truck className="h-6 w-6 text-warning" />
                </div>
                Detalhes da OS
              </DialogTitle>
            </DialogHeader>
            
            {detailDelivery && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-muted-foreground">Status</span>
                  <DeliveryStatusBadge status={detailDelivery.status} />
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-3 bg-muted/30 p-4 rounded-2xl">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Cliente</p>
                      <p className="text-sm font-black text-foreground">{detailDelivery.customer_name || "—"}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 bg-muted/30 p-4 rounded-2xl">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Endereço de Entrega</p>
                      <p className="text-sm font-bold text-foreground">{detailDelivery.dropoff_address || detailDelivery.address || "—"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-muted/30 p-4 rounded-2xl">
                    <Clock className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Solicitado Em</p>
                      <p className="text-sm font-bold text-foreground">{format(new Date(detailDelivery.created_at), "dd/MM/yyyy 'às' HH:mm")}</p>
                    </div>
                  </div>
                  
                  {detailDelivery.notes && (
                    <div className="flex items-start gap-3 bg-warning/10 p-4 rounded-2xl">
                      <MessageSquare className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-black text-warning uppercase tracking-widest">Observações</p>
                        <p className="text-sm font-bold text-warning-foreground">{detailDelivery.notes}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-border flex flex-col gap-2">
                  <div className="flex justify-between items-center mb-4">
                     <span className="text-sm font-black text-muted-foreground uppercase tracking-widest">A Cobrar</span>
                     <span className="text-2xl font-black text-warning">R$ {getDeliveryTotalToCollect(detailDelivery).toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => { handlePrint(detailDelivery); setDetailDelivery(null); }}
                      className="flex-1 py-3 bg-muted hover:bg-muted/80 text-foreground font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm"
                    >
                      <Printer className="h-4 w-4" /> Imprimir
                    </button>
                    {!["completed", "delivered", "cancelled"].includes(detailDelivery.status) && (
                      <button 
                        onClick={() => { handleComplete(detailDelivery); setDetailDelivery(null); }}
                        className="flex-1 py-3 bg-warning hover:bg-warning/90 text-warning-foreground font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-warning/20"
                      >
                        <CheckCircle className="h-4 w-4" /> Finalizar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </React.Suspense>

      {/* ── BONASOFT Watermark ── */}
      <div className="mt-16 pb-8 flex justify-center opacity-40 select-none pointer-events-none">
        <span className="text-[10px] font-black tracking-[0.5em] text-muted-foreground uppercase">
          BONASOFT
        </span>
      </div>
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
