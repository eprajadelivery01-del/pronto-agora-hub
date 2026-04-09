import { useState, useEffect, useRef, useCallback } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus, Truck, Clock, CheckCircle, MapPin, DollarSign, Loader2,
  ArrowLeft, Search, User, Phone, CreditCard, FileText, Send,
  X, ChevronRight, Circle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type Delivery = {
  id: string;
  customer_name: string;
  dropoff_address: string;
  status: string;
  price: number;
  created_at: string;
};

type Customer = {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
};

export default function BusinessOrdersPage() {
  const { user } = useAuth();
  const [showNewDelivery, setShowNewDelivery] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(true);

  // Counters
  const pending = deliveries.filter((d) => d.status === "pending" || d.status === "broadcasted").length;
  const inRoute = deliveries.filter((d) => d.status === "accepted" || d.status === "collecting" || d.status === "in_transit").length;
  const done = deliveries.filter((d) => d.status === "delivered").length;

  // Fetch company
  useEffect(() => {
    if (!user) return;
    supabase
      .from("companies")
      .select("id")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => { if (data) setCompanyId(data.id); });
  }, [user]);

  // Real-time deliveries
  useEffect(() => {
    if (!companyId) return;
    setLoadingDeliveries(true);

    supabase
      .from("deliveries")
      .select("id, customer_name, dropoff_address, status, price, created_at")
      .eq("company_id", companyId)
      .not("status", "in", '("delivered","cancelled")')
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setDeliveries(data ?? []);
        setLoadingDeliveries(false);
      });

    const channel = supabase
      .channel(`deliveries-business-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries", filter: `company_id=eq.${companyId}` },
        () => {
          supabase
            .from("deliveries")
            .select("id, customer_name, dropoff_address, status, price, created_at")
            .eq("company_id", companyId)
            .not("status", "in", '("delivered","cancelled")')
            .order("created_at", { ascending: false })
            .then(({ data }) => setDeliveries(data ?? []));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyId]);

  const statusLabel: Record<string, { label: string; color: string }> = {
    pending: { label: "Aguardando", color: "text-yellow-500" },
    broadcasted: { label: "Buscando entregador", color: "text-blue-400" },
    accepted: { label: "Entregador a caminho", color: "text-primary" },
    collecting: { label: "Coletando", color: "text-primary" },
    in_route: { label: "Em rota", color: "text-primary" },
    completed: { label: "Concluído", color: "text-green-500" },
    cancelled: { label: "Cancelado", color: "text-red-400" },
  };

  return (
    <BusinessLayout title="Pedidos">
      {showNewDelivery ? (
        <NewDeliveryForm
          onClose={() => setShowNewDelivery(false)}
          companyId={companyId}
        />
      ) : (
        <div className="space-y-6 max-w-2xl mx-auto">
          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "Pendentes", value: pending, icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10" },
              { label: "Em Rota", value: inRoute, icon: Truck, color: "text-primary", bg: "bg-primary/10" },
              { label: "Concluídos", value: done, icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
            ].map((stat) => (
              <div key={stat.label} className="bg-card rounded-2xl p-4 shadow-card text-center">
                <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mx-auto mb-2`}>
                  <stat.icon className={`h-4.5 w-4.5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* New delivery button */}
          <button
            onClick={() => setShowNewDelivery(true)}
            className="w-full py-4 rounded-2xl gradient-primary text-primary-foreground text-base font-bold flex items-center justify-center gap-3 shadow-glow hover:opacity-90 transition-opacity"
          >
            <Plus className="h-5 w-5" />
            Novo Pedido / Entrega
          </button>

          {/* Active deliveries */}
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Em Andamento ({deliveries.length})
            </h3>
            {loadingDeliveries ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse bg-card rounded-2xl h-20" />
                ))}
              </div>
            ) : deliveries.length === 0 ? (
              <div className="bg-card rounded-2xl p-8 shadow-card text-center">
                <Truck className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum pedido no momento</p>
                <p className="text-xs text-muted-foreground mt-1">Pedidos aparecerão aqui em tempo real</p>
              </div>
            ) : (
              <div className="space-y-2">
                {deliveries.map((d) => {
                  const st = statusLabel[d.status] ?? { label: d.status, color: "text-muted-foreground" };
                  return (
                    <div key={d.id} className="bg-card rounded-2xl p-4 shadow-card flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Truck className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{d.customer_name}</p>
                          <span className="text-sm font-bold text-primary shrink-0">
                            R$ {Number(d.price || 0).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" /> {d.dropoff_address}
                        </p>
                        <span className={`text-[10px] font-semibold ${st.color} mt-1 block`}>
                          ● {st.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </BusinessLayout>
  );
}

// ─── New Delivery / Order Form ────────────────────────────────────────────────

function NewDeliveryForm({
  onClose,
  companyId,
}: {
  onClose: () => void;
  companyId: string | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Customer state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  // New customer fields
  const [custName, setCustName] = useState("");
  const [custCpf, setCustCpf] = useState("");
  const [custPhone, setCustPhone] = useState("");

  // Delivery fields
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  // Region detection
  const [regionInfo, setRegionInfo] = useState<{ name: string; price: number; color: string } | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Customer search with debounce
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      const q = searchQuery.trim();
      const isCpf = /^\d/.test(q);
      const isPhone = /^\+?[\d\s()-]{6,}/.test(q);

      let query = supabase.from("profiles").select("id, full_name, phone");
      if (isPhone) {
        query = query.ilike("phone", `%${q}%`);
      } else {
        query = query.ilike("full_name", `%${q}%`);
      }
      const { data } = await query.limit(8);
      const mappedResults: Customer[] = (data || []).map(p => ({
        id: p.id,
        name: p.full_name || "Sem nome",
        cpf: null,
        phone: p.phone
      }));
      setSearchResults(mappedResults);
      setSearching(false);
    }, 300);
  }, [searchQuery]);

  // Geocode address
  const lookupAddress = async () => {
    if (address.length < 5) return;
    setGeocoding(true);
    setRegionInfo(null);
    setCoords(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
      );
      const results = await res.json();
      if (results.length === 0) {
        toast({ title: "Endereço não encontrado", variant: "destructive" });
        setGeocoding(false);
        return;
      }
      const lat = parseFloat(results[0].lat);
      const lng = parseFloat(results[0].lon);
      setCoords({ lat, lng });

      const { data: regionId } = await supabase.rpc("find_region_for_point", { _lat: lat, _lng: lng });
      if (regionId) {
        const { data: region } = await supabase
          .from("regions")
          .select("name, price, color")
          .eq("id", regionId)
          .single();
        if (region) setRegionInfo({ name: region.name, price: Number(region.price), color: region.color });
      } else {
        toast({ title: "Endereço fora das regiões cadastradas", description: "Preço será R$ 0,00" });
      }
    } catch {
      toast({ title: "Erro ao buscar endereço", variant: "destructive" });
    }
    setGeocoding(false);
  };

  // Save new customer
  const saveNewCustomer = async (): Promise<Customer | null> => {
    // Como não existe tabela 'customers', vamos apenas retornar um objeto virtual para o pedido
    if (!custName.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return null;
    }
    return { id: "temp", name: custName.trim(), cpf: null, phone: custPhone.trim() || null };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      toast({ title: "Empresa não encontrada", variant: "destructive" });
      return;
    }

    let customer = selectedCustomer;

    // If creating new customer, save first
    if (!customer && showNewCustomer) {
      setSubmitting(true);
      customer = await saveNewCustomer();
      if (!customer) { setSubmitting(false); return; }
      setSelectedCustomer(customer);
    }

    if (!customer) {
      toast({ title: "Selecione ou cadastre um cliente", variant: "destructive" });
      return;
    }

    if (!address.trim()) {
      toast({ title: "Endereço é obrigatório", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("deliveries").insert({
      company_id: companyId,
      customer_name: customer.name,
      dropoff_address: address.trim(),
      price: regionInfo?.price ?? 0,
      pickup_latitude: coords?.lat ?? null,
      pickup_longitude: coords?.lng ?? null,
      notes: notes.trim() || null,
    });

    if (error) {
      toast({ title: "Erro ao criar pedido", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Pedido criado!", description: "Aguardando entregador" });
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      onClose();
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <button
        onClick={onClose}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar aos pedidos
      </button>

      <h2 className="text-lg font-display font-bold text-foreground">Novo Pedido</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── CUSTOMER SECTION ── */}
        <div className="bg-card rounded-2xl p-4 shadow-card space-y-4">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Cliente
          </p>

          {selectedCustomer ? (
            // Selected customer card
            <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
              <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center font-bold text-primary text-sm">
                {selectedCustomer.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{selectedCustomer.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedCustomer.cpf && `CPF: ${selectedCustomer.cpf}`}
                  {selectedCustomer.cpf && selectedCustomer.phone && " · "}
                  {selectedCustomer.phone}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedCustomer(null); setSearchQuery(""); }}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          ) : showNewCustomer ? (
            // New customer form
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cadastrar novo cliente</p>
                <button
                  type="button"
                  onClick={() => setShowNewCustomer(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>
              <div className="grid gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome completo *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      placeholder="Nome do cliente"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">CPF</label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        value={custCpf}
                        onChange={(e) => setCustCpf(e.target.value)}
                        placeholder="000.000.000-00"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="tel"
                        value={custPhone}
                        onChange={(e) => setCustPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Search
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome, CPF ou telefone..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              {/* Results */}
              {searchResults.length > 0 && (
                <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                  {searchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelectedCustomer(c); setSearchQuery(""); setSearchResults([]); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted text-left transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                        {c.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.cpf && `CPF: ${c.cpf}`}
                          {c.cpf && c.phone && " · "}
                          {c.phone}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowNewCustomer(true)}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> Novo cliente
              </button>
            </div>
          )}
        </div>

        {/* ── DELIVERY ADDRESS ── */}
        <div className="bg-card rounded-2xl p-4 shadow-card space-y-4">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Endereço de entrega
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={address}
              onChange={(e) => { setAddress(e.target.value); setRegionInfo(null); setCoords(null); }}
              placeholder="Rua, número, bairro, cidade..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
              required
            />
            <button
              type="button"
              onClick={lookupAddress}
              disabled={geocoding || address.length < 5}
              className="px-3 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 shrink-0 transition-colors"
            >
              {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          </div>

          {/* Region result */}
          {regionInfo && (
            <div
              className="rounded-xl border-2 p-3 flex items-center justify-between"
              style={{ borderColor: regionInfo.color }}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: regionInfo.color }} />
                <span className="text-sm font-semibold text-foreground">{regionInfo.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span className="text-base font-bold text-green-500">
                  R$ {regionInfo.price.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {coords && !regionInfo && !geocoding && (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 text-xs text-yellow-600 dark:text-yellow-400">
              ⚠️ Endereço localizado mas fora das regiões cadastradas. O preço será R$ 0,00.
            </div>
          )}
        </div>

        {/* ── NOTES ── */}
        <div className="bg-card rounded-2xl p-4 shadow-card space-y-3">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Observações
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Referências, instruções de entrega, portão, apartamento..."
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary resize-none"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || (!selectedCustomer && !showNewCustomer) || !address.trim()}
          className="w-full py-3.5 rounded-2xl gradient-primary text-primary-foreground text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-glow hover:opacity-90 transition-opacity"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {submitting
            ? "Criando pedido..."
            : `Criar Pedido${regionInfo ? ` • R$ ${regionInfo.price.toFixed(2)}` : ""}`}
        </button>
      </form>
    </div>
  );
}
