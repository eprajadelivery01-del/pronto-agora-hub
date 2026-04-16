import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Truck, Clock, Loader2, MapPin, Trash2, Wallet, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useCity } from "@/contexts/CityContext";
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
  const { selectedCity } = useCity();
  const [showNewDelivery, setShowNewDelivery] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
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

  const { data: deliveryStats, isLoading: isLoadingStats } = useDeliveryStats({ companyId });

  const deliveries = (deliveriesData?.data || []).filter(d => !["completed", "delivered", "cancelled"].includes(d.status));

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel("business-home-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries", filter: `company_id=eq.${companyId}` }, () => {
        qc.invalidateQueries({ queryKey: ["deliveries"] });
        qc.invalidateQueries({ queryKey: ["delivery-stats"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, qc]);


  const stats = {
    pending: deliveryStats?.pending ?? 0,
    inRoute: deliveryStats?.inTransit ?? 0,
    manualRevenue: deliveryStats?.todayCollection ?? 0
  };

  const handleAdvanceOrder = async (orderId: string, nextStatus: string) => {
    try {
      console.log("[Home] Atualizando status via RPC v4 resiliente...");
      const { data, error } = await supabase.rpc('update_order_status_v4', {
        p_order_id: orderId,
        p_new_status: nextStatus
      });

      if (error) throw error;
      if (data && data.success === false) throw new Error(data.message || data.error);

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
                  <Skeleton className="h-32 rounded-2xl" />
                  <Skeleton className="h-32 rounded-2xl" />
                  <Skeleton className="h-32 rounded-2xl" />
                </>
              ) : (
                <>
                  <StatCard label="Pendentes" value={stats.pending} icon={Clock} color="warning" subtitle="Entregas manuais" />
                  <StatCard label="Em Rota" value={stats.inRoute} icon={Truck} color="primary" subtitle="Em trânsito agora" />
                  <StatCard label="Hoje (Manual)" value={`R$ ${stats.manualRevenue.toFixed(2).replace('.', ',')}`} icon={Wallet} color="warning" subtitle="Cobrança Local" />
                </>
              )}
            </div>

            {/* Content Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-info" />
                  Entregas Manuais em Andamento
                </h3>
              </div>

              {isLoadingDeliveries ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 rounded-xl" />
                </div>
              ) : deliveries.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {deliveries.map((delivery, i) => (
                    <div
                      key={delivery.id}
                      className="bg-card border border-border/50 rounded-xl p-4 hover:border-primary/30 hover:shadow-card-hover transition-all duration-200 group flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                          <Truck className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{delivery.customer_name}</p>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {delivery.address}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCancel(delivery.id)}
                        className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all font-black text-xs"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-card/50 border border-dashed border-border rounded-xl p-12 text-center">
                  <Truck className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-black text-muted-foreground/60 uppercase tracking-widest">Nenhuma entrega manual</p>
                  <p className="text-xs text-muted-foreground/40 mt-1">Sincronizado com o centro de logística</p>
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
