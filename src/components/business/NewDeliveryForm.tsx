import React, { useState, FormEvent } from "react";
import { Plus, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useCity } from "@/contexts/CityContext";
import { RegionPickerMap } from "@/components/business/RegionPickerMap";

interface NewDeliveryFormProps {
  onClose: () => void;
  initialData?: any;
  companyId?: string;
  companyData?: any;
}

export function NewDeliveryForm({ onClose, initialData, companyId, companyData }: NewDeliveryFormProps) {
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
  const [companyAddress, setCompanyAddress] = useState(initialData?.pickup_address || companyData?.address || "");

  const handleRegionSelect = (fee: number, id: string) => {
    setValue(fee.toString());
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
        status: initialData ? initialData.status : "pending"
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
