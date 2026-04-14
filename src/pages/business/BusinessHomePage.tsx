import React, { useState, useEffect, FormEvent, useCallback } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Truck, Clock, CheckCircle, Loader2, ArrowLeft, MapPin, Package, Trash2, Pencil, Phone, ShoppingBag, Bell, DollarSign, ArrowRight, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { CustomerSelector } from "@/components/business/CustomerSelector";
import { useCity } from "@/contexts/CityContext";
import { useDeliveries } from "@/services/deliveries";
import { format } from "date-fns";
import { DeliveryStatusBadge } from "@/components/admin/DeliveryStatusBadge";
import type { DeliveryStatus } from "@/types/models";
import { LiveDeliveryMap } from "@/components/business/LiveDeliveryMap";
import { OrderDetailModal } from "@/components/business/OrderDetailModal";
import { cn } from "@/lib/utils";

export default function BusinessHomePage() {
  const { profile, user } = useAuth();
  const { selectedCity } = useCity();
  const [showNewDelivery, setShowNewDelivery] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isRinging, setIsRinging] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const qc = useQueryClient();
  
  // Audio for notifications (Looping until accepted)
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audioRef.current.loop = true;
    }
    
    // Check for pending orders to start/stop ringing
    const hasPending = marketplaceOrders.some(o => o.status === "pending");
    if (hasPending && !isRinging) {
      audioRef.current.play().catch(e => console.warn("Audio blocked by browser, needs user interaction"));
      setIsRinging(true);
    } else if (!hasPending && isRinging) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsRinging(false);
    }
  }, [marketplaceOrders, isRinging]);

  const handleMute = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsRinging(false);
    }
  };

  const { data: companyData } = useQuery({
    queryKey: ["company-info", profile?.id || user?.id],
    queryFn: async () => {
      const currentId = profile?.id || user?.id;
      if (!currentId) return null;
      
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("user_id", currentId)
        .maybeSingle();
        
      return data;
    },
    enabled: !!(profile?.id || user?.id)
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
      const { data } = await supabase
        .from("orders")
        .select(`
          *,
          customers (*),
          order_items (*, products (*))
        `)
        .eq("company_id", companyId)
        .in("status", ["pending", "accepted", "preparing", "ready"])
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!companyId
  });

  const deliveries = deliveriesData?.data || [];
  const marketplaceOrders = ordersData || [];
  
  // Realtime for deliveries
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel("business-home-deliveries")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries", filter: `company_id=eq.${companyId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["deliveries"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, qc]);

  // Realtime for orders
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel("business-home-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `company_id=eq.${companyId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["marketplace-orders"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, qc]);

  const stats = {
    pending: deliveries.filter(d => ["pending", "broadcasted"].includes(d.status)).length,
    inRoute: deliveries.filter(d => ["accepted", "collecting", "in_route", "in_transit"].includes(d.status)).length,
    completed: deliveries.filter(d => d.status === "completed" || d.status === "delivered").length,
    marketplacePending: marketplaceOrders.filter(o => o.status === "pending").length,
    marketplaceRevenue: marketplaceOrders.reduce((acc, o) => acc + (o.total || 0), 0)
  };

  const handleAdvanceOrder = async (orderId: string, nextStatus: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: nextStatus })
        .eq("id", orderId);
        
      if (error) throw error;
      
      // Stop ringing if no more pending orders
      const remainingPending = marketplaceOrders.filter(o => o.id !== orderId && o.status === "pending");
      if (remainingPending.length === 0 && audioRef.current) {
         audioRef.current.pause();
         setIsRinging(false);
      }

      toast.success("Status do pedido atualizado!");
      
      // Auto-Print logic if accepted
      if (nextStatus === "preparing" || nextStatus === "accepted") {
        setTimeout(() => {
           window.print();
        }, 500);
      }

      qc.invalidateQueries({ queryKey: ["marketplace-orders"] });
      setSelectedOrder(null);
    } catch (err: any) {
      toast.error("Erro ao atualizar status: " + err.message);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar esta entrega?")) return;
    
    try {
      const { error } = await supabase
        .from("deliveries")
        .update({ status: "cancelled" })
        .eq("id", id);
        
      if (error) throw error;
      toast.success("Entrega cancelada com sucesso");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
    } catch (error: any) {
      toast.error("Erro ao cancelar: " + error.message);
    }
  };

  return (
    <BusinessLayout title="Painel de Entregas">
      {showNewDelivery ? (
        <NewDeliveryForm 
          onClose={() => {
            setShowNewDelivery(false);
            setEditingDelivery(null);
          }} 
          initialData={editingDelivery}
          companyId={companyId}
        />
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-3xl font-black text-foreground tracking-tight">
                  Olá, {profile?.full_name?.split(" ")[0] || "Lojista"} 👋
                </h2>
                <p className="text-muted-foreground font-medium">Gerencie suas solicitações de entrega em tempo real.</p>
              </div>
              {isRinging && (
                <button 
                  onClick={handleMute}
                  className="h-12 px-4 rounded-2xl bg-warning/20 text-warning font-black text-[10px] uppercase tracking-widest flex items-center gap-2 animate-pulse hover:bg-warning hover:text-white transition-all shadow-lg"
                >
                  <Bell className="h-4 w-4" /> Silenciar Alerta
                </button>
              )}
            </div>

            <button
              onClick={() => setShowNewDelivery(true)}
              className="px-8 py-4 rounded-2xl modal-gradient text-white text-lg font-black flex items-center justify-center gap-3 shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <Plus className="h-6 w-6" />
              Nova Entrega
            </button>
          </div>

          {/* Real-time Tracking Map */}
          <LiveDeliveryMap companyId={companyId} />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard label="Manual: Pendentes" value={String(stats.pending)} icon={Clock} color="warning" />
            <StatCard label="Manual: Em trânsito" value={String(stats.inRoute)} icon={Truck} color="primary" />
            <StatCard label="Marketplace: Novos" value={String(stats.marketplacePending)} icon={Bell} color="warning" />
            <StatCard label="Financeiro: Aberto" value={`R$ ${stats.marketplaceRevenue.toFixed(2).replace('.', ',')}`} icon={DollarSign} color="success" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Manual Deliveries Column */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/50 px-2 flex items-center gap-2">
                <Truck className="h-3 w-3" /> Entregas Manual
              </h3>
              
              {isLoadingDeliveries ? (
                <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : deliveries.length > 0 ? (
                <div className="space-y-4">
                  {deliveries.slice(0, 5).map((delivery) => (
                    <div key={delivery.id} className="bg-card border border-border/50 rounded-[2rem] p-5 shadow-sm hover:border-primary/20 transition-all group overflow-hidden">
                       <div className="flex items-center justify-between mb-3">
                          <DeliveryStatusBadge status={delivery.status as DeliveryStatus} />
                           <div className="flex gap-1">
                              <button onClick={() => handleCancel(delivery.id)} className="p-2 rounded-lg bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="h-3 w-3" />
                              </button>
                           </div>
                       </div>
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                             <User className="h-5 w-5 text-muted-foreground/50" />
                          </div>
                          <div className="min-w-0">
                             <p className="text-sm font-bold text-foreground truncate">{delivery.customer_name}</p>
                             <p className="text-[10px] text-muted-foreground truncate">{delivery.address}</p>
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-muted/20 border border-dashed border-border rounded-[2rem] p-8 text-center">
                  <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest">Sem entregas manuais</p>
                </div>
              )}
            </div>

            {/* Marketplace Orders Column */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/50 px-2 flex items-center gap-2">
                <ShoppingBag className="h-3 w-3" /> Marketplace (App)
              </h3>
              
              {isLoadingOrders ? (
                <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : marketplaceOrders.length > 0 ? (
                <div className="space-y-4">
                  {marketplaceOrders.map((order) => (
                    <div 
                      key={order.id} 
                      onClick={() => setSelectedOrder(order)}
                      className="bg-card border border-border/50 rounded-[2rem] p-5 shadow-sm hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all group overflow-hidden cursor-pointer"
                    >
                       <div className="flex items-center justify-between mb-3">
                          <div className={cn(
                            "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                            order.status === 'pending' ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
                          )}>
                            {order.status === 'pending' ? 'AGUARDANDO' : order.status.toUpperCase()}
                          </div>
                          <p className="text-[11px] font-black text-foreground">R$ {order.total?.toFixed(2).replace('.', ',')}</p>
                       </div>
                       
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-secondary flex flex-col items-center justify-center shrink-0">
                             <span className="text-[8px] font-black leading-none text-muted-foreground">{format(new Date(order.created_at), 'HH:mm')}</span>
                             <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                             <p className="text-sm font-black text-foreground truncate uppercase">{order.customers?.name || "Cliente Marketplace"}</p>
                             <div className="flex items-center gap-1.5 mt-0.5">
                                <ShoppingBag className="h-3 w-3 text-primary" />
                                <p className="text-[10px] text-muted-foreground font-bold truncate">
                                   {order.order_items?.length || 0} itens no pedido
                                </p>
                             </div>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all">
                             <ArrowRight className="h-4 w-4" />
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-muted/20 border border-dashed border-border rounded-[2rem] p-8 text-center">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest">Aguardando novos pedidos...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      <OrderDetailModal 
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onAdvance={handleAdvanceOrder}
      />
    </BusinessLayout>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  const colors: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    warning: "text-warning bg-warning/10",
    success: "text-success bg-success/10",
  };
  
  return (
    <div className="bg-card rounded-3xl p-6 shadow-card border border-border/50 hover:border-primary/20 transition-all group">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", colors[color])}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-4xl font-black text-foreground tracking-tight">{value}</p>
      <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}

import { RegionPickerMap } from "@/components/business/RegionPickerMap";

function NewDeliveryForm({ onClose, initialData, companyId }: { onClose: () => void, initialData?: any, companyId?: string }) {
  const { selectedCity } = useCity();
  const qc = useQueryClient();
  const [customerName, setCustomerName] = useState(initialData?.customer_name || "");
  const [customerPhone, setCustomerPhone] = useState(initialData?.customer_phone || "");
  const [customerCpf, setCustomerCpf] = useState(initialData?.customer_cpf || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [value, setValue] = useState(initialData?.value?.toString() || "");
  const [difficulty, setDifficulty] = useState(initialData?.difficulty || "Padrão");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [regionId, setRegionId] = useState(initialData?.region_id || "");
  const [submitting, setSubmitting] = useState(false);
  const [companyAddress, setCompanyAddress] = useState(initialData?.pickup_address || "");

  const handleRegionSelect = (fee: number, id: string) => {
    setValue(fee.toString());
    setRegionId(id);
    toast.success(`Região selecionada! Taxa: R$ ${fee.toFixed(2)}`);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (!companyId) throw new Error("Empresa não encontrada.");

      const payload = {
        company_id: companyId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_cpf: customerCpf,
        address: address, 
        dropoff_address: address,
        pickup_address: companyAddress || "Retirada na Loja",
        value: value ? parseFloat(value) : 0, 
        difficulty: difficulty,
        notes: notes || null,
        status: initialData ? initialData.status : "pending",
        region_id: regionId || null
      };

      const query = initialData 
        ? supabase.from("deliveries").update(payload).eq("id", initialData.id)
        : supabase.from("deliveries").insert([payload]);

      const { error } = await query;
      if (error) throw error;

      toast.success(initialData ? "Entrega atualizada!" : "Entrega solicitada!");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar entrega");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-left-4 duration-300">
      <button onClick={onClose} className="group flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors px-2">
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> Voltar ao Início
      </button>

      <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
        <h2 className="text-2xl font-black text-foreground mb-8 flex items-center gap-3">
           <Plus className="h-6 w-6 text-primary" />
           {initialData ? "Editar Entrega" : "Nova Solicitação"}
        </h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          <div className="md:col-span-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">Destinatário</label>
            <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nome do cliente"
                className="w-full px-4 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary transition-all"
                required
              />
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground block">Mapa de Regiões de Entrega</label>
            <RegionPickerMap 
               cityId={companyData?.city_id || selectedCity} 
               onRegionSelect={handleRegionSelect} 
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">Telefone</label>
            <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full px-4 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">Valor da Entrega (R$)</label>
            <input
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00"
              className="w-full px-4 py-4 rounded-2xl border-primary bg-primary/5 font-black text-primary outline-none focus:ring-4 focus:ring-primary/10 transition-all"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">Endereço de Entrega</label>
            <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, bairro..."
                className="w-full px-4 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary transition-all"
                required
              />
          </div>

          <div className="md:col-span-2 pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-5 rounded-2xl bg-primary text-white text-lg font-black shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95 transition-all outline-none focus:ring-4 focus:ring-primary/20"
            >
              {submitting && <Loader2 className="h-6 w-6 animate-spin" />}
              {submitting ? "Processando..." : "Confirmar Solicitação"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
