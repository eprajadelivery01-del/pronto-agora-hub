import React, { useState, useEffect, FormEvent } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Truck, Clock, CheckCircle, Loader2, ArrowLeft, MapPin, Package, Trash2, Pencil, Phone, ShoppingBag, Bell, DollarSign, ArrowRight, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CustomerSelector } from "@/components/business/CustomerSelector";
import { useCity } from "@/contexts/CityContext";
import { useDeliveries } from "@/services/deliveries";
import { format } from "date-fns";
import { DeliveryStatusBadge } from "@/components/admin/DeliveryStatusBadge";
import type { DeliveryStatus } from "@/types/models";

export default function BusinessHomePage() {
  const { profile } = useAuth();
  const { selectedCity } = useCity();
  const [showNewDelivery, setShowNewDelivery] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<any>(null);
  const qc = useQueryClient();
  
  const { data: companyData } = useQuery({
    queryKey: ["company-info", profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id").eq("user_id", profile?.id).maybeSingle();
      return data;
    },
    enabled: !!profile?.id
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
          id, status, total, created_at,
          customers (name, phone),
          order_items (id, quantity, products (name))
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
  
  // Realtime subscription
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

  const stats = {
    pending: deliveries.filter(d => ["pending", "broadcasted"].includes(d.status)).length,
    inRoute: deliveries.filter(d => ["accepted", "collecting", "in_route", "in_transit"].includes(d.status)).length,
    completed: deliveries.filter(d => d.status === "completed" || d.status === "delivered").length,
    marketplacePending: marketplaceOrders.filter(o => o.status === "pending").length,
    marketplaceRevenue: marketplaceOrders.reduce((acc, o) => acc + (o.total || 0), 0)
  };

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

  const handleEdit = (delivery: any) => {
    setEditingDelivery(delivery);
    setShowNewDelivery(true);
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
        />
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-foreground tracking-tight">
                Olá, {profile?.full_name?.split(" ")[0] || "Lojista"} 👋
              </h2>
              <p className="text-muted-foreground font-medium">Gerencie suas solicitações de entrega em tempo real.</p>
            </div>

            <button
              onClick={() => setShowNewDelivery(true)}
              className="px-8 py-4 rounded-2xl modal-gradient text-white text-lg font-black flex items-center justify-center gap-3 shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <Plus className="h-6 w-6" />
              Nova Entrega
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard label="Manual: Pendentes" value={String(stats.pending)} icon={Clock} color="warning" />
            <StatCard label="Manual: Em trânsito" value={String(stats.inRoute)} icon={Truck} color="primary" />
            <StatCard label="Marketplace: Novos" value={String(stats.marketplacePending)} icon={Bell} color="warning" />
            <StatCard label="Financeiro: Aberto" value={`R$ ${stats.marketplaceRevenue.toFixed(2)}`} icon={DollarSign} color="success" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Manual Deliveries Column */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/50 px-2 flex items-center gap-2">
                <Truck className="h-3 w-3" /> Entregas Logística
              </h3>
              
              {isLoadingDeliveries ? (
                <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : deliveries.length > 0 ? (
                <div className="space-y-4">
                  {deliveries.map((delivery) => (
                    <div key={delivery.id} className="bg-card border border-border/50 rounded-[2rem] p-5 shadow-sm hover:border-primary/20 transition-all group overflow-hidden">
                       <div className="flex items-center justify-between mb-3">
                          <DeliveryStatusBadge status={delivery.status as DeliveryStatus} />
                          <span className="text-[10px] font-black text-muted-foreground/40 italic">#{delivery.id.slice(0, 8)}</span>
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
                <ShoppingBag className="h-3 w-3" /> Pedidos Marketplace (App)
              </h3>
              
              {isLoadingOrders ? (
                <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : marketplaceOrders.length > 0 ? (
                <div className="space-y-4">
                  {marketplaceOrders.map((order) => (
                    <div key={order.id} className="bg-card border border-border/40 rounded-[2rem] p-5 shadow-sm hover:border-primary/20 transition-all group relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-3">
                          <div className={cn(
                            "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest",
                            order.status === 'pending' ? "bg-warning/20 text-warning" : "bg-primary/20 text-primary"
                          )}>
                            {order.status === 'pending' ? 'Novo' : order.status}
                          </div>
                       </div>
                       <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                             <ShoppingBag className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                             <p className="text-sm font-bold text-foreground truncate">{order.customers?.name || "Cliente Marketplace"}</p>
                             <p className="text-[10px] text-muted-foreground font-bold">R$ {order.total?.toFixed(2)} • {order.order_items?.length} itens</p>
                          </div>
                       </div>
                       <Link 
                        to="/business/orders" 
                        className="w-full py-2 rounded-xl bg-muted/50 hover:bg-primary hover:text-white transition-all text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 group"
                       >
                         Gerenciar Pedido <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                       </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-muted/20 border border-dashed border-border rounded-[2rem] p-8 text-center">
                  <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest">Sem pedidos do app</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </BusinessLayout>
  );
}

import { cn } from "@/lib/utils";

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

function NewDeliveryForm({ onClose, initialData }: { onClose: () => void, initialData?: any }) {
  const { selectedCity } = useCity();
  const qc = useQueryClient();
  const [customerName, setCustomerName] = useState(initialData?.customer_name || "");
  const [customerPhone, setCustomerPhone] = useState(initialData?.customer_phone || "");
  const [customerCpf, setCustomerCpf] = useState(initialData?.customer_cpf || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [value, setValue] = useState(initialData?.value?.toString() || "");
  const [difficulty, setDifficulty] = useState(initialData?.difficulty || "Padrão");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [submitting, setSubmitting] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(initialData?.company_id || null);
  const [companyAddress, setCompanyAddress] = useState(initialData?.pickup_address || "");

  const fetchCompanyInfo = async () => {
    if (initialData?.company_id) return { id: initialData.company_id, address: initialData.pickup_address };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data: company } = await supabase
      .from("companies")
      .select("id, address")
      .eq("user_id", user.id)
      .maybeSingle();
      
    if (company) {
      setCompanyAddress(company.address || "");
    }
    return company || null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const cId = companyId || (await fetchCompanyInfo())?.id;
      if (!cId) throw new Error("Empresa não encontrada.");

      // For new deliveries, we handle customer profile synchronization
      if (!initialData) {
        let existingCust = null;
        
        // 1. Search by exactly matching CPF and name in local customers
        if (customerCpf) {
          const { data } = await supabase
            .from("customers")
            .select("id, name, phone, cpf")
            .eq("cpf", customerCpf.replace(/\D/g, ""))
            .maybeSingle();
          existingCust = data;
        }

        // 2. Search by Name if not found yet
        if (!existingCust && customerName) {
          const { data } = await supabase
            .from("customers")
            .select("id, name, phone, cpf")
            .ilike("name", customerName.trim())
            .maybeSingle();
          existingCust = data;
        }

        // 3. Search in global PROFILES as a fallback
        if (!existingCust && (customerCpf || customerName)) {
           const { data: profileCust } = await supabase
            .from("profiles")
            .select("id, full_name, phone")
            .ilike("full_name", customerName.trim())
            .maybeSingle();
           
           if (profileCust) {
              // Convert profile to customer on the fly
              const { data: newCust } = await supabase
                .from("customers")
                .insert([{ 
                  name: customerName,
                  cpf: customerCpf ? customerCpf.replace(/\D/g, "") : null,
                  phone: customerPhone || profileCust.phone
                }])
                .select("id")
                .single();
              existingCust = newCust;
           }
        }

        let finalCustomerId = existingCust?.id;

        if (!finalCustomerId) {
          // Total New Customer logic
          const { data: newCust, error: custError } = await supabase
            .from("customers")
            .insert([{ 
              name: customerName,
              cpf: customerCpf ? customerCpf.replace(/\D/g, "") : null,
              phone: customerPhone || null
            }])
            .select("id")
            .single();
          
          if (!custError && newCust) {
            finalCustomerId = newCust.id;
            // Create initial address record
            await supabase.from("addresses").insert([{
              customer_id: newCust.id,
              street: address.split(",")[0] || address,
              city: selectedCity || "Diamantino", 
              state: "MT",
              is_default: true
            }]);
          }
        } else {
          // Update existing customer info if missing
          const updates: any = {};
          if (customerCpf && !existingCust.cpf) updates.cpf = customerCpf.replace(/\D/g, "");
          if (customerPhone && !existingCust.phone) updates.phone = customerPhone;
          
          if (Object.keys(updates).length > 0) {
            await supabase.from("customers").update(updates).eq("id", finalCustomerId);
          }
        }
      }

      const payload = {
        company_id: cId,
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
        commission: initialData ? initialData.commission : 0
      };

      const query = initialData 
        ? supabase.from("deliveries").update(payload).eq("id", initialData.id)
        : supabase.from("deliveries").insert([payload]);

      const { error } = await query;

      if (error) throw error;

      toast.success(initialData ? "Entrega atualizada com sucesso!" : "Entrega solicitada com sucesso!");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar entrega");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      fetchCompanyInfo().then(data => {
        if (data) setCompanyId(data.id);
      });
    }
  }, [initialData]);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-left-4 duration-300">
      <button onClick={onClose} className="group flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors px-2">
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> Voltar ao Início
      </button>

      <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        
        <h2 className="text-2xl font-black text-foreground mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
             {initialData ? <Pencil className="h-6 w-6 text-primary-foreground" /> : <Plus className="h-6 w-6 text-primary-foreground" />}
          </div>
          {initialData ? "Editar Solicitação de Entrega" : "Nova Solicitação de Entrega"}
        </h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          <div className="md:col-span-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">Destinatário</label>
            {companyId && (
              <CustomerSelector 
                companyId={companyId} 
                value={customerName}
                onChange={(name, addr, phone, cpf) => {
                  setCustomerName(name);
                  if (addr) setAddress(addr);
                  if (phone) setCustomerPhone(phone);
                  if (cpf) setCustomerCpf(cpf);
                }}
              />
            )}
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">CPF do Destinatário (Opcional)</label>
            <div className="relative">
              <Plus className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                value={customerCpf}
                onChange={(e) => setCustomerCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-base"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">Telefone do Destinatário</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-base"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">Endereço de Entrega</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, bairro e complemento"
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-base"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">Valor do Pedido (R$)</label>
            <input
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00"
              className="w-full px-4 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary transition-all text-base"
              required
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">Dificuldade/Tipo (Opcional)</label>
            <select 
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full px-4 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary transition-all text-base"
            >
               <option value="Padrão">Padrão</option>
               <option value="Frágil">Frágil</option>
               <option value="Grande Porte">Grande Porte</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">Observações do Admin/Entregador</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ponto de referência, campainha, andar..."
              rows={3}
              className="w-full px-4 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary resize-none transition-all text-base"
            />
          </div>

          <div className="md:col-span-2 pt-4">
            <button
              type="submit"
              disabled={submitting || !customerName || !address}
              className="w-full py-5 rounded-2xl gradient-primary text-primary-foreground text-lg font-black shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 transition-all"
            >
              {submitting && <Loader2 className="h-6 w-6 animate-spin" />}
              {submitting ? "Publicando..." : "Confirmar Solicitação"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
