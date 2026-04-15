import React, { useState, FormEvent, useEffect } from "react";
import { Plus, ArrowLeft, Loader2, User, Phone, MapPin, DollarSign, Wallet, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useCity } from "@/contexts/CityContext";
import { RegionPickerMap } from "@/components/business/RegionPickerMap";
import { cn } from "@/lib/utils";

interface NewDeliveryFormProps {
  onClose: () => void;
  initialData?: any;
  companyId?: string;
  companyData?: any;
}

export function NewDeliveryForm({ onClose, initialData, companyId, companyData }: NewDeliveryFormProps) {
  const { selectedCity } = useCity();
  const qc = useQueryClient();
  
  // Form State
  const [customerName, setCustomerName] = useState(initialData?.customer_name || "");
  const [customerPhone, setCustomerPhone] = useState(initialData?.customer_phone || "");
  const [customerCpf, setCustomerCpf] = useState(initialData?.customer_cpf || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [companyAddress, setCompanyAddress] = useState(initialData?.pickup_address || companyData?.address || "");
  
  // Numeric values as strings for better input handling (Brazilian style)
  const [deliveryValue, setDeliveryValue] = useState(initialData?.value?.toFixed(2).replace('.', ',') || "0,00");
  const [collectValue, setCollectValue] = useState(initialData?.estimated_value?.toFixed(2).replace('.', ',') || "0,00");
  const [isPaid, setIsPaid] = useState(initialData?.notes?.includes("[PAGO]") || false);
  
  const [notes, setNotes] = useState(initialData?.notes?.replace("[PAGO]", "").trim() || "");
  const [submitting, setSubmitting] = useState(false);

  // Helper to format currency on blur/change
  const handleCurrencyChange = (val: string, setter: (v: string) => void) => {
    // Basic cleaning: allow only numbers and one comma (or dot which we convert)
    let clean = val.replace('.', ',').replace(/[^\d,]/g, "");
    if ((clean.match(/,/g) || []).length > 1) return;
    setter(clean);
  };

  const handleBlur = (val: string, setter: (v: string) => void) => {
    if (!val) return;
    let clean = val.replace('.', ',');
    if (!clean.includes(',')) {
      setter(clean + ",00");
    } else {
      const parts = clean.split(',');
      if (parts[1].length === 0) setter(clean + "00");
      else if (parts[1].length === 1) setter(clean + "0");
      else if (parts[1].length > 2) setter(parts[0] + "," + parts[1].substring(0, 2));
    }
  };

  const handleRegionSelect = React.useCallback((fee: number, id: string) => {
    setDeliveryValue(fee.toFixed(2).replace('.', ','));
    toast.success(`Região selecionada! Taxa: R$ ${fee.toFixed(2).replace('.', ',')}`);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (!companyId) throw new Error("Empresa não encontrada.");

      const parsedDeliveryValue = parseFloat(deliveryValue.replace(',', '.'));
      const parsedCollectValue = isPaid ? 0 : parseFloat(collectValue.replace(',', '.'));
      
      const finalNotes = isPaid ? `[PAGO] ${notes}`.trim() : notes.trim();

      const payload = {
        company_id: companyId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_cpf: customerCpf,
        address: address, 
        dropoff_address: address,
        pickup_address: companyAddress || "Retirada na Loja",
        value: isNaN(parsedDeliveryValue) ? 0 : parsedDeliveryValue, 
        estimated_value: isNaN(parsedCollectValue) ? 0 : parsedCollectValue,
        notes: finalNotes || null,
        status: initialData ? initialData.status : "pending"
      };

      const query = initialData 
        ? supabase.from("deliveries").update(payload).eq("id", initialData.id)
        : supabase.from("deliveries").insert([payload as any]);

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
    <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-left-4 duration-300 pb-12">
      <button onClick={onClose} className="group flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors px-2">
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> Voltar ao Início
      </button>

      <div className="bg-card border border-border rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="bg-primary/5 p-8 border-b border-border">
          <h2 className="text-3xl font-black text-foreground flex items-center gap-3">
             <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
               <Plus className="h-6 w-6 text-white" />
             </div>
             {initialData ? "Editar Entrega" : "Nova Solicitação"}
          </h2>
          <p className="text-muted-foreground font-medium mt-2">Preencha os dados abaixo para solicitar um entregador.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* Sessão: Cliente */}
          <div className="space-y-4">
             <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                <User className="h-3 w-3" /> Dados do Destinatário
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Nome Completo</label>
                  <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex: João Silva"
                      className="w-full px-5 py-4 rounded-2xl border border-border bg-background focus:border-primary outline-none transition-all font-bold"
                      required
                    />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Telefone de Contato</label>
                  <input
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="w-full px-5 py-4 rounded-2xl border border-border bg-background focus:border-primary outline-none transition-all font-bold"
                  />
                </div>
             </div>
          </div>

          {/* Sessão: Endereço & Mapa */}
          <div className="space-y-4">
             <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                <MapPin className="h-3 w-3" /> Local de Entrega
             </h3>
             <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Endereço Completo</label>
                  <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Rua, número, bairro..."
                      className="w-full px-5 py-4 rounded-2xl border border-border bg-background focus:border-primary outline-none transition-all font-bold text-lg"
                      required
                    />
                </div>
                <div className="rounded-[2rem] overflow-hidden border border-border shadow-inner">
                  <RegionPickerMap 
                    cityId={companyData?.city_id || selectedCity} 
                    onRegionSelect={handleRegionSelect} 
                  />
                </div>
             </div>
          </div>

          {/* Sessão: Pagamento & Valores */}
          <div className="space-y-4">
             <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                <DollarSign className="h-3 w-3" /> Valores e Pagamento
             </h3>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Taxa de Entrega */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Taxa de Entrega (R$)</label>
                  <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-primary/50 text-sm">R$</div>
                    <input
                      value={deliveryValue}
                      onChange={(e) => handleCurrencyChange(e.target.value, setDeliveryValue)}
                      onBlur={(e) => handleBlur(e.target.value, setDeliveryValue)}
                      placeholder="0,00"
                      className="w-full pl-12 pr-5 py-5 rounded-2xl border-2 border-primary/20 bg-primary/5 font-black text-2xl text-primary outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Valor a Receber */}
                <div className={cn("space-y-1.5 transition-opacity", isPaid && "opacity-40 grayscale pointer-events-none")}>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Receber do Cliente (R$)</label>
                  <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-warning/50 text-sm">R$</div>
                    <input
                      value={isPaid ? "0,00" : collectValue}
                      onChange={(e) => handleCurrencyChange(e.target.value, setCollectValue)}
                      onBlur={(e) => handleBlur(e.target.value, setCollectValue)}
                      placeholder="0,00"
                      className="w-full pl-12 pr-5 py-5 rounded-2xl border-2 border-warning/20 bg-warning/5 font-black text-2xl text-warning outline-none focus:border-warning focus:ring-4 focus:ring-warning/10 transition-all"
                      disabled={isPaid}
                    />
                  </div>
                </div>

                {/* Opção de Pago */}
                <div className="flex flex-col justify-end">
                   <button
                    type="button"
                    onClick={() => setIsPaid(!isPaid)}
                    className={cn(
                      "flex items-center justify-between w-full h-[68px] px-6 rounded-2xl border-2 transition-all font-black uppercase tracking-widest text-[10px]",
                      isPaid 
                        ? "bg-success border-success text-white shadow-lg shadow-success/20 scale-105" 
                        : "bg-muted/30 border-border text-muted-foreground hover:border-success/50"
                    )}
                   >
                     <span>Pedido já Pago?</span>
                     {isPaid ? <CheckCircle className="h-5 w-5" /> : <Wallet className="h-5 w-5 opacity-40" />}
                   </button>
                </div>
             </div>
             
             <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Observações para o Entregador</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Tocar campainha, casa branca de portão azul..."
                  className="w-full px-5 py-4 rounded-2xl border border-border bg-background focus:border-primary outline-none transition-all font-medium min-h-[100px] resize-none"
                />
             </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-6 rounded-3xl bg-primary text-white text-xl font-black shadow-2xl shadow-primary/30 disabled:opacity-50 flex items-center justify-center gap-3 active:scale-[0.98] transition-all outline-none focus:ring-8 focus:ring-primary/10"
            >
              {submitting && <Loader2 className="h-8 w-8 animate-spin" />}
              {submitting ? "Processando..." : (initialData ? "Salvar Alterações" : "Confirmar Solicitação")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

