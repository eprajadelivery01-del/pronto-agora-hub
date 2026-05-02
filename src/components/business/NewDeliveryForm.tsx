import React, { useState, FormEvent, useEffect } from "react";
import { Plus, ArrowLeft, Loader2, User, Phone, MapPin, DollarSign, Wallet, CheckCircle, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useCity } from "@/contexts/CityContext";
import { RegionPickerGrid } from "@/components/business/RegionPickerGrid";
import { cn } from "@/lib/utils";

interface NewDeliveryFormProps {
  onClose: () => void;
  initialData?: any;
  companyId?: string;
  companyData?: any;
}

export default function NewDeliveryForm({ onClose, initialData, companyId, companyData }: NewDeliveryFormProps) {
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
  const [submitted, setSubmitted] = useState(false);
  const [saveCustomer, setSaveCustomer] = useState(true);
  const [suggestedCustomer, setSuggestedCustomer] = useState<any>(null);
  const [selectedRegionName, setSelectedRegionName] = useState<string | null>(initialData?.region_name || null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(initialData?.region_id || null);

  // Smart Search: Find customer by phone as the user types
  useEffect(() => {
    const searchCustomer = async () => {
      if (customerPhone.replace(/\D/g, "").length < 8 || !companyId || initialData) return;
      
      const phoneClean = customerPhone.replace(/\D/g, "");

      const { data: globalCust } = await supabase
        .from("customers")
        .select("name, phone, cpf")
        .ilike("phone", `%${phoneClean}%`)
        .limit(1)
        .maybeSingle();

      if (globalCust) {
        setSuggestedCustomer({
          customer_name: globalCust.name,
          customer_phone: globalCust.phone,
          customer_cpf: globalCust.cpf,
          source: "global"
        });
        return;
      }

      const { data: prevDeliv } = await supabase
        .from("deliveries")
        .select("customer_name, customer_phone, customer_cpf, address")
        .eq("company_id", companyId)
        .ilike("customer_phone", `%${phoneClean}%`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (prevDeliv && prevDeliv.length > 0) {
        setSuggestedCustomer({ ...prevDeliv[0], source: "history" });
      } else {
        setSuggestedCustomer(null);
      }
    };

    const timer = setTimeout(searchCustomer, 500);
    return () => clearTimeout(timer);
  }, [customerPhone, companyId, initialData]);

  // Masking Helpers
  const maskPhone = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 10) {
      return v.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
    } else if (v.length > 6) {
      return v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    } else if (v.length > 2) {
      return v.replace(/^(\d{2})(\d{0,5}).*/, "($1) $2");
    } else {
      return v.replace(/^(\d*)/, "($1");
    }
  };

  const maskCPF = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
            .replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3")
            .replace(/(\d{3})(\d{3})/, "$1.$2");
  };

  const clearForm = () => {
    if (confirm("Limpar todos os dados do formulário?")) {
      setCustomerName("");
      setCustomerPhone("");
      setCustomerCpf("");
      setAddress("");
      setDeliveryValue("0,00");
      setCollectValue("0,00");
      setNotes("");
      setIsPaid(false);
      setSuggestedCustomer(null);
      setSelectedRegionName(null);
      setSelectedRegionId(null);
      toast.info("Formulário limpo");
    }
  };

  const applySuggestion = () => {
    if (suggestedCustomer) {
      setCustomerName(suggestedCustomer.customer_name);
      setCustomerCpf(suggestedCustomer.customer_cpf || "");
      setAddress(suggestedCustomer.address);
      setSuggestedCustomer(null);
      toast.info("Dados do cliente preenchidos!");
    }
  };

  const handleCurrencyChange = (val: string, setter: (v: string) => void) => {
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

  const handleRegionSelect = React.useCallback((fee: number, id: string, name: string) => {
    setDeliveryValue(fee.toFixed(2).replace('.', ','));
    setSelectedRegionName(name);
    setSelectedRegionId(id);
    toast.success(`Região selecionada! Taxa: R$ ${fee.toFixed(2).replace('.', ',')}`);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validate region selection
    if (!selectedRegionId) {
      toast.error("Selecione uma região de entrega antes de enviar.");
      return;
    }

    setSubmitting(true);

    try {
      if (!companyId) throw new Error("Empresa não encontrada.");

      const parsedDeliveryValue = parseFloat(deliveryValue.replace(',', '.'));
      const parsedCollectValue = isPaid ? 0 : parseFloat(collectValue.replace(',', '.'));
      
      const finalNotes = isPaid ? `[PAGO] ${notes}`.trim() : notes.trim();

      const payload: Record<string, any> = {
        company_id: companyId,
        customer_name: customerName,
        customer_phone: customerPhone.replace(/\D/g, ""),
        customer_cpf: customerCpf.replace(/\D/g, ""),
        address: address, 
        dropoff_address: address,
        pickup_address: companyAddress || "Retirada na Loja",
        value: isNaN(parsedDeliveryValue) ? 0 : parsedDeliveryValue, 
        estimated_value: isNaN(parsedCollectValue) ? 0 : parsedCollectValue,
        notes: finalNotes || null,
        status: initialData ? initialData.status : "pending",
        region_id: selectedRegionId,
        region_name: selectedRegionName,
      };

      const query = initialData 
        ? supabase.from("deliveries").update(payload).eq("id", initialData.id)
        : supabase.from("deliveries").insert([payload as any]);

      const { error } = await query;
      if (error) throw error;

      // Logic to save/update customer official record
      if (saveCustomer && !initialData) {
        const { data: existingCust } = await supabase.from("customers")
          .select("id")
          .eq("phone", customerPhone.replace(/\D/g, ""))
          .maybeSingle();

        const custPayload = {
          name: customerName,
          phone: customerPhone.replace(/\D/g, ""),
          cpf: customerCpf.replace(/\D/g, "") || null,
          updated_at: new Date().toISOString()
        };

        if (existingCust) {
          await supabase.from("customers").update(custPayload).eq("id", existingCust.id);
        } else {
          await supabase.from("customers").insert([custPayload]);
        }
      }

      toast.success(initialData ? "Entrega atualizada!" : "Entrega solicitada!");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar entrega");
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmation screen after successful submit
  if (submitted) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-left-4 duration-300 pb-12">
        <div className="bg-card border border-border rounded-[2.5rem] shadow-2xl overflow-hidden">
          <div className="bg-success/10 p-8 border-b border-border flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-success flex items-center justify-center shadow-lg shadow-success/20">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-black text-foreground">Solicitação Enviada!</h2>
            <p className="text-muted-foreground font-medium text-center">Seu pedido de entrega foi encaminhado para o painel administrativo.</p>
          </div>
          <div className="p-8 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Resumo do Pedido</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 bg-muted/30 rounded-2xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Cliente</p>
                <p className="font-bold text-foreground">{customerName}</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-2xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Endereço</p>
                <p className="font-bold text-foreground truncate">{address}</p>
              </div>
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Região</p>
                <span className="inline-block bg-primary/10 text-primary text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border border-primary/20">
                  {selectedRegionName}
                </span>
              </div>
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Taxa de Entrega</p>
                <p className="text-xl font-black text-primary">R$ {deliveryValue}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full py-5 rounded-3xl bg-primary text-white text-lg font-black shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 active:scale-[0.98] transition-all mt-4"
            >
              Voltar ao Painel
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <div className="flex items-center justify-between mt-2">
            <p className="text-muted-foreground font-medium">Preencha os dados abaixo para solicitar um entregador.</p>
            {!initialData && (
              <button 
                type="button" 
                onClick={clearForm}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-destructive transition-colors"
              >
                <RotateCcw className="h-3 w-3" /> Limpar Tudo
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* Sessão: Cliente */}
          <div className="space-y-4">
             <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                <User className="h-3 w-3" /> Dados do Destinatário
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <div className="space-y-1.5 md:col-span-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">CPF (Opcional)</label>
                  <input
                      value={customerCpf}
                      onChange={(e) => setCustomerCpf(maskCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      className="w-full px-5 py-4 rounded-2xl border border-border bg-background focus:border-primary outline-none transition-all font-bold"
                    />
                </div>
                <div className="space-y-1.5 relative">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Telefone</label>
                    <input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(maskPhone(e.target.value))}
                        placeholder="(00) 00000-0000"
                        className="w-full px-5 py-4 rounded-2xl border border-border bg-background focus:border-primary outline-none transition-all font-bold"
                    />
                    {suggestedCustomer && (
                      <div 
                        onClick={applySuggestion}
                        className="absolute left-0 right-0 top-full mt-2 p-4 bg-primary/10 border border-primary/20 rounded-2xl shadow-xl z-50 cursor-pointer hover:bg-primary/20 transition-all animate-in slide-in-from-top-2"
                      >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center">
                               <User className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className="text-[10px] font-black uppercase text-primary tracking-widest leading-none mb-1">
                                 {suggestedCustomer.source === 'global' ? 'Cliente NexusPro' : 'Histórico Recente'}
                               </p>
                               <p className="text-sm font-bold text-foreground truncate">{suggestedCustomer.customer_name}</p>
                               <p className="text-[10px] text-muted-foreground font-medium truncate">
                                 {suggestedCustomer.address || suggestedCustomer.customer_cpf || suggestedCustomer.customer_phone}
                               </p>
                            </div>
                            <div className="bg-primary text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase">Preencher</div>
                         </div>
                      </div>
                    )}
                </div>
             </div>
           </div>

          {/* Sessão: Endereço & Região */}
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
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">
                     Região de Entrega <span className="text-destructive">*</span>
                   </label>
                   <RegionPickerGrid 
                     cityId={companyData?.city_id || selectedCity} 
                     onRegionSelect={handleRegionSelect}
                     disabled={false}
                   />
                   {!selectedRegionId && (
                     <p className="text-[9px] text-destructive font-bold ml-2">Selecione uma região acima para definir a taxa.</p>
                   )}
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
                       readOnly
                       placeholder="0,00"
                       className="w-full pl-12 pr-24 py-5 rounded-2xl border-2 border-primary/20 bg-primary/5 font-black text-2xl text-primary outline-none cursor-default transition-all"
                       required
                     />
                     {selectedRegionName && (
                       <span className="absolute right-4 top-1/2 -translate-y-1/2 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border border-primary/20">
                         {selectedRegionName}
                       </span>
                     )}
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
             
              <div className="flex items-center gap-2 pt-2 p-3 bg-primary/5 rounded-2xl border border-dashed border-primary/20 hover:border-primary/40 transition-all select-none cursor-pointer" onClick={() => setSaveCustomer(!saveCustomer)}>
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                    saveCustomer ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground"
                  )}
                >
                  <CheckCircle className={cn("h-5 w-5", !saveCustomer && "opacity-20")} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-foreground">Salvar nos Meus Clientes</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Lembrar dados para a próxima compra deste cliente.</p>
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
              disabled={submitting || !selectedRegionId}
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
