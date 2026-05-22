import React, { useState, FormEvent, useEffect } from "react";
import { Plus, ArrowLeft, Loader2, User, Phone, MapPin, DollarSign, Wallet, CheckCircle, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useCity } from "@/contexts/CityContext";
import { RegionPickerGrid } from "@/components/business/RegionPickerGrid";
import { CustomerSelector } from "@/components/business/CustomerSelector";
import { useProductsManager } from "@/services/stores-products";
import { cn } from "@/lib/utils";

interface NewDeliveryFormProps {
  onClose: () => void;
  initialData?: any;
  companyId?: string;
  companyData?: any;
  isAdmin?: boolean;
}

export default function NewDeliveryForm({ onClose, initialData, companyId: propCompanyId, companyData: propCompanyData, isAdmin }: NewDeliveryFormProps) {
  const { selectedCity } = useCity();
  const qc = useQueryClient();
  
  // Admin state
  const [selectedCompanyId, setSelectedCompanyId] = useState(propCompanyId || initialData?.company_id || "");
  const [companies, setCompanies] = useState<any[]>([]);

  // Products state
  const { data: storeProducts } = useProductsManager(isAdmin ? selectedCompanyId : propCompanyId);
  const [selectedProducts, setSelectedProducts] = useState<{ product: any; quantity: number }[]>([]);
  const [productSearch, setProductSearch] = useState("");


  useEffect(() => {
    if (isAdmin) {
      supabase.from("companies").select("id, name, address, city_id").eq("is_active", true).order("name")
        .then(({ data }) => { if (data) setCompanies(data); });
    }
  }, [isAdmin]);

  const currentCompany = isAdmin 
    ? companies.find(c => c.id === selectedCompanyId) 
    : propCompanyData;

  // Form State
  const [customerName, setCustomerName] = useState(initialData?.customer_name || "");
  const [customerPhone, setCustomerPhone] = useState(initialData?.customer_phone || "");
  const [customerCpf, setCustomerCpf] = useState(initialData?.customer_cpf || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [companyAddress, setCompanyAddress] = useState(initialData?.pickup_address || currentCompany?.address || "");
  
  const [deliveryValue, setDeliveryValue] = useState(initialData?.value?.toFixed(2).replace('.', ',') || "0,00");
  const [collectValue, setCollectValue] = useState(initialData?.estimated_value?.toFixed(2).replace('.', ',') || "0,00");
  const [isPaid, setIsPaid] = useState(() => {
    return initialData?.notes?.includes("[PAGO]") || false;
  });

  const [paymentMethod, setPaymentMethod] = useState(() => {
    if (initialData?.notes?.includes("[RECEBER: Pix]")) return "Pix";
    if (initialData?.notes?.includes("[RECEBER: Dinheiro]")) return "Dinheiro";
    if (initialData?.notes?.includes("[RECEBER: Máquina Móvel]")) return "Máquina Móvel";
    return "Pix";
  });

  const [notes, setNotes] = useState(() => {
    let rawNotes = initialData?.notes || "";
    rawNotes = rawNotes.replace("[PAGO]", "");
    rawNotes = rawNotes.replace("[RECEBER: Pix]", "");
    rawNotes = rawNotes.replace("[RECEBER: Dinheiro]", "");
    rawNotes = rawNotes.replace("[RECEBER: Máquina Móvel]", "");
    return rawNotes.trim();
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saveCustomer, setSaveCustomer] = useState(true);
  const [selectedRegionName, setSelectedRegionName] = useState<string | null>(initialData?.region_name || null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(initialData?.region_id || null);

  // Masking Helpers
  const maskPhone = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 10) return v.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
    else if (v.length > 6) return v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    else if (v.length > 2) return v.replace(/^(\d{2})(\d{0,5}).*/, "($1) $2");
    else return v.replace(/^(\d*)/, "($1");
  };

  const maskCPF = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
            .replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3")
            .replace(/(\d{3})(\d{3})/, "$1.$2");
  };

  const handleRegionSelect = React.useCallback((fee: number, id: string, name: string) => {
    setDeliveryValue(fee.toFixed(2).replace('.', ','));
    setSelectedRegionName(name);
    setSelectedRegionId(id);
    toast.success(`Região selecionada: ${name}`);
  }, []);

  const addProduct = (product: any) => {
    setSelectedProducts(prev => {
      const existing = prev.find(p => p.product.id === product.id);
      if (existing) {
        return prev.map(p => p.product.id === product.id ? { ...p, quantity: p.quantity + 1 } : p);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const existing = prev.find(p => p.product.id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(p => p.product.id === productId ? { ...p, quantity: p.quantity - 1 } : p);
      }
      return prev.filter(p => p.product.id !== productId);
    });
  };

  useEffect(() => {
    if (selectedProducts.length > 0 && !isPaid) {
      const total = selectedProducts.reduce((acc, curr) => acc + (curr.product.price || 0) * curr.quantity, 0);
      setCollectValue(total.toFixed(2).replace('.', ','));
    }
  }, [selectedProducts, isPaid]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedRegionId) {
      toast.error("Selecione uma região de entrega.");
      return;
    }

    if (!isPaid) {
      const val = parseFloat(collectValue.replace(',', '.'));
      if (isNaN(val) || val <= 0) {
        toast.error("Atenção: Você precisa preencher o valor a ser cobrado do cliente ou marcar que o pedido já foi pago!");
        return;
      }
    }

    setSubmitting(true);

    try {
      const cId = isAdmin ? selectedCompanyId : propCompanyId;
      if (!cId) throw new Error("Empresa não identificada.");
      const parsedDeliveryValue = parseFloat(deliveryValue.replace(',', '.'));
      const parsedCollectValue = isPaid ? 0 : parseFloat(collectValue.replace(',', '.'));
      
      let finalNotes = notes.trim();
      
      if (selectedProducts.length > 0) {
        const productsText = selectedProducts.map(p => {
          const formattedPrice = (p.product.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          return `${p.quantity}x ${p.product.name} (${formattedPrice})`;
        }).join("\n");
        const totalProducts = selectedProducts.reduce((acc, curr) => acc + (curr.product.price || 0) * curr.quantity, 0);
        const formattedTotal = totalProducts.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        finalNotes = `[PRODUTOS]\n${productsText}\nTotal Produtos: ${formattedTotal}\n\n${finalNotes}`.trim();
      }

      if (isPaid) {
        finalNotes = `[PAGO] ${finalNotes}`.trim();
      } else {
        finalNotes = `[RECEBER: ${paymentMethod}] ${finalNotes}`.trim();
      }

      const payload: any = {
        company_id: cId,
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
      };

      const { error } = initialData 
        ? await supabase.from("deliveries").update(payload).eq("id", initialData.id)
        : await supabase.from("deliveries").insert([payload]);

      if (error) throw error;

      if (saveCustomer && !initialData) {
        const phoneClean = customerPhone.replace(/\D/g, "");
        const { data: existing } = await supabase.from("customers").select("id").eq("phone", phoneClean).maybeSingle();
        const custData = { name: customerName, phone: phoneClean, cpf: customerCpf.replace(/\D/g, "") };
        if (existing) await supabase.from("customers").update(custData).eq("id", existing.id);
        else await supabase.from("customers").insert([custData]);
      }

      toast.success(initialData ? "Entrega atualizada!" : "Entrega solicitada!");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-4xl mx-auto p-8 bg-card border border-border rounded-[2.5rem] shadow-2xl text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mx-auto shadow-lg">
          <CheckCircle className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-3xl font-black">Solicitação Enviada!</h2>
        <p className="text-muted-foreground">O pedido já está visível para os entregadores.</p>
        <button onClick={onClose} className="w-full py-5 rounded-3xl bg-primary text-white font-black text-lg">Voltar ao Painel</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-left-4 duration-300 pb-12">
      <button onClick={onClose} className="group flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground px-2">
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> Voltar ao Início
      </button>

      <div className="bg-card border border-border rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="bg-primary/5 p-8 border-b border-border">
          <h2 className="text-3xl font-black text-foreground flex items-center gap-3">
             <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
               <Plus className="h-6 w-6 text-white" />
             </div>
             {initialData ? "Editar Entrega" : "Nova Solicitação"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {isAdmin && (
            <div className="space-y-1.5 p-6 bg-muted/50 rounded-3xl border border-dashed border-border">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Empresa Solicitante (Admin)</label>
               <select 
                 value={selectedCompanyId} 
                 onChange={e => setSelectedCompanyId(e.target.value)}
                 className="w-full px-5 py-4 rounded-2xl border border-border bg-background outline-none font-bold text-lg"
                 required
               >
                 <option value="">Selecione uma empresa...</option>
                 {companies.map(c => (
                   <option key={c.id} value={c.id}>{c.name}</option>
                 ))}
               </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="md:col-span-2 space-y-1.5">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Nome do Cliente</label>
               <CustomerSelector 
                  companyId={isAdmin ? selectedCompanyId : (propCompanyId || "")} 
                  value={customerName} 
                  onChange={(name, addr, ph, cp) => {
                    setCustomerName(name);
                    if (addr) setAddress(addr);
                    if (ph) setCustomerPhone(maskPhone(ph));
                    if (cp) setCustomerCpf(maskCPF(cp));
                  }} 
               />
             </div>
             <div className="space-y-1.5">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">CPF (Opcional)</label>
               <input value={customerCpf} onChange={e => setCustomerCpf(maskCPF(e.target.value))} placeholder="000.000.000-00" className="w-full px-5 py-4 rounded-2xl border border-border bg-background outline-none font-bold" />
             </div>
             <div className="space-y-1.5">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Telefone</label>
               <input value={customerPhone} onChange={e => setCustomerPhone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" className="w-full px-5 py-4 rounded-2xl border border-border bg-background outline-none font-bold" />
             </div>
          </div>

          <div className="space-y-4">
             <div className="space-y-1.5">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Endereço de Entrega</label>
               <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Rua, número, bairro..." className="w-full px-5 py-4 rounded-2xl border border-border bg-background outline-none font-bold text-lg" required />
             </div>
             <div className="space-y-1.5">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Região <span className="text-destructive">*</span></label>
               <RegionPickerGrid cityId={currentCompany?.city_id || selectedCity} onRegionSelect={handleRegionSelect} initialSelectedId={initialData?.region_id} />
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="space-y-1.5">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Taxa de Entrega (R$)</label>
               <input value={deliveryValue} readOnly className="w-full px-5 py-5 rounded-2xl border-2 border-primary/20 bg-primary/5 font-black text-2xl text-primary outline-none" />
             </div>
             <div className={cn("space-y-1.5", isPaid && "opacity-40 grayscale pointer-events-none")}>
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Valor a Cobrar (R$)</label>
               <input value={isPaid ? "0,00" : collectValue} onChange={e => setCollectValue(e.target.value)} className="w-full px-5 py-5 rounded-2xl border-2 border-warning/20 bg-warning/5 font-black text-2xl text-warning outline-none" />
               {!isPaid && (parseFloat(collectValue.replace(',', '.')) <= 0 || !collectValue) && (
                 <p className="text-[9px] text-warning font-bold animate-pulse ml-2 mt-1">⚠️ Preenchimento Obrigatório</p>
               )}
             </div>
             <div className="space-y-1.5">
               <label className="text-[10px] font-black uppercase tracking-widest text-transparent ml-2 select-none">Pagamento</label>
               <button type="button" onClick={() => setIsPaid(!isPaid)} className={cn("w-full h-[76px] rounded-2xl border-2 flex items-center justify-between px-6 font-black uppercase text-[10px]", isPaid ? "bg-green-500 border-green-500 text-white" : "bg-muted/30 border-border text-muted-foreground")}>
                 <span>Já foi Pago?</span>
                 {isPaid ? <CheckCircle className="h-5 w-5" /> : <Wallet className="h-5 w-5 opacity-40" />}
               </button>
             </div>
          </div>

          {/* Products Section */}
          {storeProducts && storeProducts.length > 0 && (
            <div className="space-y-4 p-6 bg-muted/10 border border-border rounded-3xl animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Produtos do Pedido (Opcional)</label>
              
              <div className="space-y-3">
                <input 
                  value={productSearch} 
                  onChange={e => setProductSearch(e.target.value)} 
                  placeholder="Buscar produto no cardápio..." 
                  className="w-full px-5 py-3 rounded-2xl border border-border bg-background outline-none font-medium text-sm" 
                />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                  {storeProducts.filter((p: any) => p.name.toLowerCase().includes(productSearch.toLowerCase())).map((product: any) => {
                    const selected = selectedProducts.find(sp => sp.product.id === product.id);
                    return (
                      <div key={product.id} className="flex items-center justify-between p-3 rounded-2xl border border-border bg-background hover:border-primary/30 transition-colors">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="font-bold text-sm truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{(product.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                        {selected ? (
                          <div className="flex items-center gap-2 bg-primary/10 rounded-lg p-1 border border-primary/20">
                            <button type="button" onClick={() => removeProduct(product.id)} className="w-6 h-6 rounded flex items-center justify-center text-primary font-bold hover:bg-primary/20">-</button>
                            <span className="text-sm font-bold text-primary min-w-[1.5rem] text-center">{selected.quantity}</span>
                            <button type="button" onClick={() => addProduct(product)} className="w-6 h-6 rounded flex items-center justify-center text-primary font-bold hover:bg-primary/20">+</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => addProduct(product)} className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
                            <Plus className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {!isPaid && (
             <div className="space-y-2 p-6 bg-muted/30 border border-border rounded-3xl animate-in fade-in slide-in-from-top-2 duration-300">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Forma de Recebimento pelo Entregador</label>
               <div className="grid grid-cols-3 gap-3">
                 {[
                   { id: "Pix", label: "Pix", icon: Wallet },
                   { id: "Dinheiro", label: "Dinheiro", icon: DollarSign },
                   { id: "Máquina Móvel", label: "Máquina Móvel", icon: Plus },
                 ].map((method) => {
                   const isSelected = paymentMethod === method.id;
                   return (
                     <button
                       key={method.id}
                       type="button"
                       onClick={() => setPaymentMethod(method.id)}
                       className={cn(
                         "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all font-black gap-2",
                         isSelected
                           ? "border-primary bg-primary/10 text-primary"
                           : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                       )}
                     >
                       <method.icon className={cn("h-5 w-5", isSelected ? "text-primary" : "text-muted-foreground")} />
                       <span className="text-xs">{method.label}</span>
                     </button>
                   );
                 })}
               </div>
             </div>
           )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Observações para o Entregador</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ponto de referência, campainha..." className="w-full px-5 py-4 rounded-2xl border border-border bg-background outline-none font-medium min-h-[100px] resize-none" />
          </div>

          <button type="submit" disabled={submitting || !selectedRegionId} className="w-full py-6 rounded-3xl bg-primary text-white text-xl font-black shadow-2xl shadow-primary/30 disabled:opacity-50 flex items-center justify-center gap-3">
            {submitting ? <Loader2 className="h-8 w-8 animate-spin" /> : (initialData ? "Salvar Alterações" : "Confirmar Solicitação")}
          </button>
        </form>
      </div>
    </div>
  );
}
