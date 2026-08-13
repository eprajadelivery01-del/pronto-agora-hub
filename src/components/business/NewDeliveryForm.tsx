import React, { useState, FormEvent, useEffect, useRef } from "react";
import { Plus, ArrowLeft, Loader2, User, Phone, MapPin, DollarSign, Wallet, CheckCircle, RotateCcw, Home, Briefcase, Heart, Handshake } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useCity } from "@/contexts/CityContext";
import { RegionPickerGrid } from "@/components/business/RegionPickerGrid";
import { CustomerSelector } from "@/components/business/CustomerSelector";
import { useProductsManager } from "@/services/stores-products";
import { cn } from "@/lib/utils";
import { optimizeStorageImage } from "@/lib/imageOptimization";

interface NewDeliveryFormProps {
  onClose: () => void;
  onSaved?: (delivery: any) => void;
  initialData?: any;
  companyId?: string;
  companyData?: any;
  isAdmin?: boolean;
}

export default function NewDeliveryForm({ onClose, onSaved, initialData, companyId: propCompanyId, companyData: propCompanyData, isAdmin }: NewDeliveryFormProps) {
  const { selectedCity } = useCity();
  const qc = useQueryClient();
  
  // Admin state
  const [selectedCompanyId, setSelectedCompanyId] = useState(propCompanyId || initialData?.company_id || "");
  const [companies, setCompanies] = useState<any[]>([]);

  // Products state
  const { data: storeProducts } = useProductsManager(isAdmin ? selectedCompanyId : propCompanyId);
  const [selectedProducts, setSelectedProducts] = useState<{ product: any; quantity: number }[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productInputMode, setProductInputMode] = useState<"catalog" | "manual">("catalog");
  const [manualProducts, setManualProducts] = useState("");


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
  const [address, setAddress] = useState(() => {
    if (!initialData?.address) return "";
    const fullStr = initialData.address;
    if (fullStr.startsWith("[")) {
      const idx = fullStr.indexOf("]");
      if (idx !== -1) {
        return fullStr.slice(idx + 1).trim();
      }
    }
    return fullStr;
  });
  const [addressType, setAddressType] = useState<string>(() => {
    if (!initialData?.address) return "Casa";
    const fullStr = initialData.address;
    if (fullStr.startsWith("[")) {
      const idx = fullStr.indexOf("]");
      if (idx !== -1) {
        const lbl = fullStr.slice(1, idx);
        if (lbl === "Família") return "Casa da Mãe";
        if (["Casa", "Trabalho", "Casa da Mãe", "Outro"].includes(lbl)) return lbl;
        return "Outro";
      }
    }
    return "Casa";
  });
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
    if (initialData?.notes?.includes("[RECEBER: Convênio]")) return "Convênio";
    return "Pix";
  });

  const [notes, setNotes] = useState(() => {
    let rawNotes = initialData?.notes || "";
    rawNotes = rawNotes.replace("[PAGO]", "");
    rawNotes = rawNotes.replace("[RECEBER: Pix]", "");
    rawNotes = rawNotes.replace("[RECEBER: Dinheiro]", "");
    rawNotes = rawNotes.replace("[RECEBER: Máquina Móvel]", "");
    rawNotes = rawNotes.replace("[RECEBER: Convênio]", "");
    return rawNotes.trim();
  });

  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
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
    if (selectedProducts.length > 0) {
      const total = selectedProducts.reduce((acc, curr) => acc + (curr.product.price || 0) * curr.quantity, 0);
      setCollectValue(total.toFixed(2).replace('.', ','));
    }
  }, [selectedProducts]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    // 0. Validar sessão + empresa
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }
    const cId = isAdmin ? selectedCompanyId : propCompanyId;
    if (!cId) {
      toast.error("Empresa não identificada. Sua conta não está vinculada a uma empresa — contate o suporte.");
      console.error("[NewDeliveryForm] companyId ausente", { isAdmin, propCompanyId, selectedCompanyId, propCompanyData });
      return;
    }

    if (!selectedRegionId) {
      toast.error("Selecione uma região de entrega.");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    if (!address.trim()) {
      toast.error("Informe o endereço de entrega.");
      return;
    }


    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      const parsedDeliveryValue = parseFloat(deliveryValue.replace(',', '.'));
      const parsedProductValue = parseFloat(collectValue.replace(',', '.'));
      const parsedCollectValue = isPaid ? 0 : parsedProductValue;

      let finalAddress = address;
      if (addressType && addressType !== "Outro") {
        finalAddress = `[${addressType}] ${address}`;
      }

      let finalNotes = notes.trim();
      if (productInputMode === 'catalog' && selectedProducts.length > 0) {
        const productsText = selectedProducts.map(p => {
          const formattedPrice = (p.product.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          return `${p.quantity}x ${p.product.name} (${formattedPrice})`;
        }).join("\n");
        const totalProducts = selectedProducts.reduce((acc, curr) => acc + (curr.product.price || 0) * curr.quantity, 0);
        const formattedTotal = totalProducts.toFixed(2).replace('.', ',');

        finalNotes = `[PRODUTOS]\n${productsText}\nTotal Produtos: R$ ${formattedTotal}\n\n${finalNotes}`.trim();
      } else {
        const formattedTotal = parsedProductValue.toFixed(2).replace('.', ',');
        finalNotes = `Total Produtos: R$ ${formattedTotal}\n\n${finalNotes}`.trim();
        
        if (productInputMode === 'manual' && manualProducts.trim()) {
          finalNotes = `[ITENS: DIGITADOS]\n${manualProducts.trim()}\n\n${finalNotes}`.trim();
        }
      }

      if (isPaid) {
        finalNotes = `[PAGO] ${finalNotes}`.trim();
      } else {
        finalNotes = `[RECEBER: ${paymentMethod}] ${finalNotes}`.trim();
      }

      const storeTitle = currentCompany?.trade_name || currentCompany?.name || "Loja Parceira";
      if (storeTitle && storeTitle !== "Loja Parceira") {
        finalNotes = `[LOJA: ${storeTitle}] ${finalNotes}`.trim();
      }

      const now = new Date().toISOString();
      const deliveryId = initialData?.id || crypto.randomUUID();
      const resolvedCityId = currentCompany?.city_id || selectedCity || initialData?.city_id || null;
      const payload: any = {
        id: deliveryId,
        company_id: cId,
        city_id: resolvedCityId,
        customer_name: customerName,
        customer_phone: customerPhone.replace(/\D/g, ""),
        customer_cpf: customerCpf.replace(/\D/g, ""),
        address: finalAddress,
        dropoff_address: finalAddress,
        pickup_address: companyAddress || "Retirada na Loja",
        price: isNaN(parsedDeliveryValue) ? 0 : parsedDeliveryValue,
        estimated_value: isNaN(parsedCollectValue) ? 0 : parsedCollectValue,
        notes: finalNotes || null,
        status: initialData ? initialData.status : "pending",
        region_id: selectedRegionId,
        updated_at: now,
      };

      if (!initialData) payload.created_at = now;

      console.log("[NewDeliveryForm] enviando payload", payload);

      const deliveryWrite = initialData
        ? await supabase.from("deliveries").update(payload).eq("id", initialData.id).select()
        : await supabase.from("deliveries").insert([payload]).select();

      if (deliveryWrite.error) {
        const error = deliveryWrite.error;
        console.error("[NewDeliveryForm] erro Supabase", error);
        if (error.code === "42501" || /row-level security/i.test(error.message)) {
          throw new Error("Sem permissão para criar entrega para esta empresa. Verifique se sua conta está vinculada à empresa correta.");
        }
        throw new Error(`${error.message}${error.details ? ` — ${error.details}` : ""}`);
      }

      const savedDelivery = (deliveryWrite.data && deliveryWrite.data[0]) || (initialData ? { ...initialData, ...payload } : payload);

      // DISPARO EXPLÍCITO DA EDGE FUNCTION SEND-PUSH PARA ENTREGADORES ONLINE
      if (!initialData || payload.status === "pending") {
        const storeName = company?.trade_name || company?.name || "É Pra Já Delivery";
        const feeVal = payload.value || 0;
        const detailsStr = `🏬 Loja: ${storeName}\n📍 Coleta: ${payload.pickup_address || 'Retirada na Loja'}\n🏁 Entrega: ${payload.delivery_address || payload.address || ''}\n💰 Ganhos: R$ ${Number(feeVal).toFixed(2).replace('.', ',')}`;

        supabase.functions.invoke("send-push", {
          body: {
            type: "INSERT",
            table: "deliveries",
            schema: "public",
            record: {
              id: savedDelivery?.id || payload.id,
              status: "pending",
              store_name: storeName,
              company_name: storeName,
              details: detailsStr,
              address: detailsStr,
              pickup_address: payload.pickup_address || "Retirada na Loja",
              delivery_address: payload.delivery_address || payload.address || "",
              delivery_fee: feeVal,
            }
          }
        }).catch(err => console.warn("[NewDeliveryForm] Erro ao disparar send-push:", err));
      }

      onSaved?.(savedDelivery);
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["delivery-stats"] });
      qc.invalidateQueries({ queryKey: ["business-open-store-deliveries"] });
      qc.invalidateQueries({ queryKey: ["business-open-store-deliveries-by-name"] });
      qc.invalidateQueries({ queryKey: ["business-visible-deliveries-fallback"] });

      if (saveCustomer && !initialData) {
        try {
          const phoneClean = customerPhone.replace(/\D/g, "");
          if (phoneClean) {
            const { data: existing } = await supabase.from("customers").select("id").eq("phone", phoneClean).maybeSingle();
            const custData = { name: customerName, phone: phoneClean, cpf: customerCpf.replace(/\D/g, "") };
            if (existing) await supabase.from("customers").update(custData).eq("id", existing.id);
            else await supabase.from("customers").insert([custData]);
          }
        } catch (customerError) {
          console.warn("[NewDeliveryForm] entrega criada, mas não foi possível salvar o cliente", customerError);
        }
      }

      toast.success(initialData ? "Entrega atualizada!" : "Entrega solicitada!");
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar entrega");
    } finally {
      isSubmittingRef.current = false;
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
                  onChange={(name, addr, ph, cp, lbl) => {
                    setCustomerName(name);
                    if (addr) setAddress(addr);
                    if (ph) setCustomerPhone(maskPhone(ph));
                    if (cp) setCustomerCpf(maskCPF(cp));
                    if (lbl) {
                      if (lbl === "Família") {
                        setAddressType("Casa da Mãe");
                      } else if (["Casa", "Trabalho", "Casa da Mãe", "Outro"].includes(lbl)) {
                        setAddressType(lbl);
                      } else {
                        setAddressType("Outro");
                      }
                    }
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
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Endereço de Entrega</label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Rua, número, bairro..." className="w-full px-5 py-4 rounded-2xl border border-border bg-background outline-none font-bold text-lg" required />
              
              <div className="flex gap-2 mt-2">
                {[
                  { id: "Casa", label: "Casa", icon: Home },
                  { id: "Trabalho", label: "Trabalho", icon: Briefcase },
                  { id: "Casa da Mãe", label: "Casa da Mãe", icon: Heart },
                  { id: "Outro", label: "Outro", icon: MapPin },
                ].map((type) => {
                  const isSelected = addressType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setAddressType(type.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border",
                        isSelected
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                      )}
                    >
                      <type.icon className="h-3 w-3" />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Região <span className="text-destructive">*</span></label>
              <RegionPickerGrid cityId={currentCompany?.city_id || selectedCity} companyId={currentCompany?.id} onRegionSelect={handleRegionSelect} initialSelectedId={initialData?.region_id} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="space-y-1.5">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Taxa de Entrega (R$)</label>
               <input value={deliveryValue} readOnly className="w-full px-5 py-5 rounded-2xl border-2 border-primary/20 bg-primary/5 font-black text-2xl text-primary outline-none" />
             </div>
             <div className="space-y-1.5">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Valor do Produto (R$)</label>
               <input value={collectValue} onChange={e => setCollectValue(e.target.value)} className="w-full px-5 py-5 rounded-2xl border-2 border-warning/20 bg-warning/5 font-black text-2xl text-warning outline-none" />
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
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                ITENS DO PEDIDO
              </label>
              
              <div className="space-y-3">
                <div className="flex gap-2 p-1 bg-muted/30 rounded-2xl border border-border">
                  <button type="button" onClick={() => setProductInputMode('catalog')} className={cn("flex-1 py-2 text-xs font-bold rounded-xl shadow-sm border transition-colors", productInputMode === 'catalog' ? "bg-white dark:bg-black text-primary border-primary/20" : "text-muted-foreground border-transparent hover:bg-white/50")}>
                    📋 DO CATÁLOGO
                  </button>
                  <button type="button" onClick={() => setProductInputMode('manual')} className={cn("flex-1 py-2 text-xs font-bold rounded-xl shadow-sm border transition-colors", productInputMode === 'manual' ? "bg-white dark:bg-black text-primary border-primary/20" : "text-muted-foreground border-transparent hover:bg-white/50")}>
                    ✏️ DIGITAR ITEM
                  </button>
                </div>

                {productInputMode === 'catalog' ? (
                  <>
                    <div className="relative">
                      <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                      <input 
                        value={productSearch} 
                        onChange={e => setProductSearch(e.target.value)} 
                        placeholder="Buscar produto do catálogo..." 
                        className="w-full pl-10 pr-5 py-3 rounded-2xl border border-border bg-background outline-none font-medium text-sm" 
                      />
                    </div>
                    
                    <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-2 custom-scrollbar">
                      {storeProducts.filter((p: any) => p.name.toLowerCase().includes(productSearch.toLowerCase())).map((product: any) => {
                        const selected = selectedProducts.find(sp => sp.product.id === product.id);
                        let imageUrl = null;
                        if (product.image_url) {
                          try {
                            const parsed = JSON.parse(product.image_url);
                            imageUrl = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : product.image_url;
                          } catch {
                            imageUrl = product.image_url;
                          }
                        }

                        return (
                          <div key={product.id} className="flex items-center justify-between p-3 rounded-2xl border border-border bg-background hover:border-primary/30 transition-colors">
                            <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                              {imageUrl ? (
                                <img src={optimizeStorageImage(imageUrl, { width: 80 })} alt={product.name} loading="lazy" decoding="async" className="w-10 h-10 rounded-xl object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                                  <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate">{product.name}</p>
                                <p className="text-[11px] text-primary font-bold">{(product.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                              </div>
                            </div>
                            {selected ? (
                              <div className="flex items-center gap-2 bg-primary/10 rounded-lg p-1 border border-primary/20">
                                <button type="button" onClick={() => removeProduct(product.id)} className="w-6 h-6 rounded flex items-center justify-center text-primary font-bold hover:bg-primary/20">-</button>
                                <span className="text-sm font-bold text-primary min-w-[1.5rem] text-center">{selected.quantity}</span>
                                <button type="button" onClick={() => addProduct(product)} className="w-6 h-6 rounded flex items-center justify-center text-primary font-bold hover:bg-primary/20">+</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => addProduct(product)} className="w-8 h-8 rounded-xl bg-muted/50 text-muted-foreground flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors">
                                <Plus className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Descreva os itens do pedido</label>
                    <textarea 
                      value={manualProducts} 
                      onChange={e => setManualProducts(e.target.value)} 
                      placeholder="Ex: 1x X-Tudo, 1x Coca-Cola 2L..." 
                      className="w-full px-5 py-4 rounded-2xl border border-border bg-background outline-none font-medium min-h-[120px] resize-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {!isPaid && (
             <div className="space-y-2 p-6 bg-muted/30 border border-border rounded-3xl animate-in fade-in slide-in-from-top-2 duration-300">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Forma de Recebimento pelo Entregador</label>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                 {[
                   { id: "Pix", label: "Pix", icon: Wallet },
                   { id: "Dinheiro", label: "Dinheiro", icon: DollarSign },
                   { id: "Máquina Móvel", label: "Máquina Móvel", icon: Plus },
                   { id: "Convênio", label: "Convênio", icon: Handshake },
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
