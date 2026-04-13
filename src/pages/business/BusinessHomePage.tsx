import React, { useState, useEffect, FormEvent } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Truck, Clock, CheckCircle, Loader2, ArrowLeft, MapPin, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CustomerSelector } from "@/components/business/CustomerSelector";
import { useCity } from "@/contexts/CityContext";

export default function BusinessHomePage() {
  const { profile } = useAuth();
  const { selectedCity } = useCity();
  const [showNewDelivery, setShowNewDelivery] = useState(false);

  return (
    <BusinessLayout title="Painel de Entregas">
      {showNewDelivery ? (
        <NewDeliveryForm onClose={() => setShowNewDelivery(false)} />
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <StatCard label="Pendentes" value="0" icon={Clock} color="warning" />
            <StatCard label="Em trânsito" value="0" icon={Truck} color="primary" />
            <StatCard label="Entregues" value="0" icon={CheckCircle} color="success" />
          </div>

          <div className="bg-card border border-border rounded-[2.5rem] p-12 text-center shadow-card border-dashed">
            <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mx-auto mb-6">
               <Package className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Sem atividade recente</h3>
            <p className="text-muted-foreground max-w-xs mx-auto">Suas novas solicitações de entrega aparecerão aqui.</p>
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

function NewDeliveryForm({ onClose }: { onClose: () => void }) {
  const { selectedCity } = useCity();
  const qc = useQueryClient();
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const fetchCompanyId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    return company?.id || null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const cId = companyId || await fetchCompanyId();
      if (!cId) throw new Error("Empresa não encontrada.");

      // Check if customer exists in 'customers' table by name
      const { data: existingCust } = await supabase
        .from("customers")
        .select("id")
        .ilike("name", customerName)
        .maybeSingle();

      let finalCustomerId = existingCust?.id;

      if (!finalCustomerId) {
        // Create new anonymous customer
        const { data: newCust, error: custError } = await supabase
          .from("customers")
          .insert([{ name: customerName }])
          .select("id")
          .single();
        
        if (custError) console.error("Error creating customer profile:", custError);
        if (newCust) {
          finalCustomerId = newCust.id;
          // Also create initial address for them
          await supabase.from("addresses").insert([{
            customer_id: newCust.id,
            street: address.split(",")[0] || address,
            city: selectedCity || "Diamantino", 
            state: "MT",
            is_default: true
          }]);
        }
      }

      const { error } = await supabase.from("deliveries").insert([{
        company_id: cId,
        customer_name: customerName,
        address: address, 
        value: value ? parseFloat(value) : 0, 
        notes: notes || null,
        status: "pending",
        commission: 0
      }]);

      if (error) throw error;

      toast.success("Entrega solicitada com sucesso!");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar entrega");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchCompanyId().then(setCompanyId);
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-left-4 duration-300">
      <button onClick={onClose} className="group flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors px-2">
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> Voltar ao Início
      </button>

      <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        
        <h2 className="text-2xl font-black text-foreground mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
             <Plus className="h-6 w-6 text-primary-foreground" />
          </div>
          Nova Solicitação de Entrega
        </h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          <div className="md:col-span-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">Destinatário</label>
            {companyId && (
              <CustomerSelector 
                companyId={companyId} 
                value={customerName}
                onChange={(name, addr) => {
                  setCustomerName(name);
                  if (addr) setAddress(addr);
                }}
              />
            )}
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
            <select className="w-full px-4 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary transition-all text-base">
               <option>Padrão</option>
               <option>Frágil</option>
               <option>Grande Porte</option>
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

