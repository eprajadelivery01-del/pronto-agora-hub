// @ts-nocheck
import { useState, useEffect } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Users, Search, RefreshCw, User, Phone, ShoppingBag, Plus, X, Loader2, MapPin, Calendar, CreditCard, ChevronRight, Home, Briefcase, Heart, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface CustomerRecord {
  id: string;
  name: string;
  phone?: string;
  cpf?: string;
  total_orders: number;
  last_order_at?: string;
  addresses: string[];
  phones: string[];
}

export default function BusinessCustomersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Modal de novo cliente
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", cpf: "" });

  useEffect(() => {
    const init = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        let { data: company } = await supabase.from("companies").select("id").eq("user_id", user.id).maybeSingle();
        
        // Fallback para administradores
        if (!company) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle();

          if (profile?.role === "admin") {
            const { data: fallbackCompany } = await supabase
              .from("companies")
              .select("id")
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle();
            company = fallbackCompany;
          }
        }

        if (company) setCompanyId(company.id);
        else setLoading(false);
      } catch (err) {
        console.error("Erro ao identificar empresa:", err);
        toast.error("Erro ao carregar empresa do lojista");
        setLoading(false);
      }
    };
    init();
  }, [user]);

  const fetchCustomers = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    const customerMap = new Map<string, CustomerRecord>();

    const upsertCustomer = (source: any) => {
      const name = (source.name || source.customer_name || "").trim();
      const phone = source.phone || source.customer_phone || null;
      const cpf = source.cpf || source.customer_cpf || null;
      if (!name && !phone) return;

      const stableKey = source.customer_id || source.id || phone || name.toLowerCase();
      const id = String(stableKey);
      const existing = customerMap.get(id);
      const record = existing || {
        id,
        name: name || "Cliente",
        phone,
        cpf,
        total_orders: 0,
        last_order_at: null,
        addresses: [],
        phones: phone ? [phone] : []
      };

      record.total_orders += 1;
      if (name && record.name === "Cliente") record.name = name;
      if (phone && !record.phones.includes(phone)) record.phones.push(phone);
      if (!record.phone && phone) record.phone = phone;
      if (!record.cpf && cpf) record.cpf = cpf;
      if (source.address && !record.addresses.includes(source.address)) record.addresses.push(source.address);
      if (source.created_at && (!record.last_order_at || new Date(source.created_at) > new Date(record.last_order_at))) {
        record.last_order_at = source.created_at;
      }

      customerMap.set(id, record);
    };

    try {
      // A tabela customers NÃO possui company_id. A relação correta do lojista é via orders/deliveries.company_id.
      const [{ data: orderData, error: orderError }, { data: deliveryData, error: deliveryError }] = await Promise.all([
        supabase
          .from("orders")
          .select(`
            id,
            customer_id,
            created_at,
            delivery_address,
            customers (id, name, phone, cpf)
          `)
          .eq("company_id", companyId),
        supabase
          .from("deliveries")
          .select("id, order_id, customer_name, customer_phone, customer_cpf, address, created_at")
          .eq("company_id", companyId)
      ]);

      if (orderError) throw orderError;
      if (deliveryError) throw deliveryError;

      (orderData || []).forEach((o: any) => {
        const c = Array.isArray(o.customers) ? o.customers[0] : o.customers;
        upsertCustomer({
          id: c?.id || o.customer_id || o.id,
          customer_id: o.customer_id,
          name: c?.name,
          phone: c?.phone,
          cpf: c?.cpf,
          address: o.delivery_address,
          created_at: o.created_at
        });
      });

      (deliveryData || []).filter((d: any) => !d.order_id).forEach((d: any) => {
        upsertCustomer({
          id: d.customer_phone || `${d.customer_name || "cliente"}-${d.id}`,
          name: d.customer_name,
          phone: d.customer_phone,
          cpf: d.customer_cpf,
          address: d.address,
          created_at: d.created_at
        });
      });

      setCustomers(Array.from(customerMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err: any) {
      console.error("Erro ao carregar clientes:", err);
      toast.error(err?.message || "Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) fetchCustomers();
  }, [companyId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    if (!companyId) {
      toast.error("Erro: Empresa não identificada.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          cpf: form.cpf.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Cliente cadastrado com sucesso!");
      setCustomers(prev => [{
        id: data?.id || crypto.randomUUID(),
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        cpf: form.cpf.trim() || null,
        total_orders: 0,
        last_order_at: null,
        addresses: [],
        phones: form.phone.trim() ? [form.phone.trim()] : []
      }, ...prev]);
      setForm({ name: "", phone: "", cpf: "" });
      setShowNewModal(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao cadastrar cliente");
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  if (loading) return (
    <BusinessLayout title="Clientes">
      <div className="flex items-center justify-center py-24"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>
    </BusinessLayout>
  );

  return (
    <BusinessLayout title="Lista de Clientes">
      <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div>
            <h2 className="text-2xl font-black text-foreground">Sua Freguesia</h2>
            <p className="text-muted-foreground text-sm font-medium">Clientes que já realizaram pedidos no seu estabelecimento.</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome ou fone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-card text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
              />
            </div>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all shadow-card whitespace-nowrap"
            >
              <Plus className="h-4 w-4" /> Novo Cliente
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.length === 0 ? (
            <div className="col-span-full py-24 text-center bg-card border border-dashed border-border rounded-[2.5rem]">
              <Users className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-foreground">Nenhum cliente encontrado</h3>
              <p className="text-muted-foreground mb-6">Cadastre seu primeiro cliente ou aguarde novos pedidos.</p>
              <button
                onClick={() => setShowNewModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all"
              >
                <Plus className="h-4 w-4" /> Cadastrar Cliente
              </button>
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <div key={customer.id} className="bg-card border border-border rounded-3xl p-6 shadow-card hover:border-primary/20 transition-all group flex flex-col h-full">
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-foreground group-hover:text-primary transition-colors truncate">{customer.name}</h3>
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" /> {customer.phone || "Sem telefone"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 flex-1 mb-6">
                  {customer.addresses.length > 0 && (
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <p className="line-clamp-2 leading-relaxed">{customer.addresses[0]}</p>
                    </div>
                  )}
                  {customer.addresses.length > 1 && (
                    <p className="text-[10px] font-bold text-primary ml-5">+ {customer.addresses.length - 1} endereços conhecidos</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-auto">
                  <div className="bg-muted/30 rounded-2xl p-3 text-center">
                    <p className="text-xl font-black text-foreground">{customer.total_orders}</p>
                    <p className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Pedidos</p>
                  </div>
                  <div className="bg-muted/30 rounded-2xl p-3 text-center">
                    <p className="text-xs font-black text-foreground">
                      {customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString() : "---"}
                    </p>
                    <p className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Último</p>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedCustomer(customer)}
                  className="w-full mt-4 py-3 rounded-2xl bg-foreground text-background hover:bg-foreground/90 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="h-3.5 w-3.5" /> Ver Detalhes
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Novo Cliente */}
      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => !saving && setShowNewModal(false)}
        >
          <div
            className="bg-card rounded-3xl shadow-2xl border border-border w-full max-w-md p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-foreground">Novo Cliente</h3>
                <p className="text-xs text-muted-foreground font-medium mt-1">Cadastre um cliente manualmente.</p>
              </div>
              <button
                onClick={() => !saving && setShowNewModal(false)}
                className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                disabled={saving}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Maria Silva"
                  className="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  required
                  maxLength={100}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Telefone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  maxLength={20}
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">CPF</label>
                <input
                  type="text"
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  maxLength={14}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl border border-border hover:bg-muted text-sm font-bold text-muted-foreground transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.name.trim()}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : "Cadastrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detalhes do Cliente */}
      {selectedCustomer && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setSelectedCustomer(null)}
        >
          <div 
            className="w-full max-w-lg h-full bg-background shadow-2xl border-l border-border animate-in slide-in-from-right duration-300 overflow-y-auto custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-8 pb-24">
              <div className="flex items-center justify-between mb-8">
                <button 
                  onClick={() => setSelectedCustomer(null)}
                  className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                >
                  <ChevronRight className="h-5 w-5 rotate-180" />
                </button>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Ficha do Cliente</span>
              </div>

              <div className="flex items-center gap-6 mb-12">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
                  <User className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-foreground tracking-tighter">{selectedCustomer.name}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-success/10 text-success uppercase tracking-wider">Ativo</span>
                    <span className="text-xs font-medium text-muted-foreground">{selectedCustomer.total_orders} pedidos realizados</span>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                {/* Contatos */}
                <section>
                  <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">Informações de Contato</h4>
                  <div className="space-y-3">
                    {selectedCustomer.phones.map((p, i) => (
                      <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border">
                        <Phone className="h-4 w-4 text-primary" />
                        <span className="text-sm font-bold text-foreground">{p}</span>
                      </div>
                    ))}
                    {selectedCustomer.cpf && (
                      <div className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span className="text-sm font-bold text-foreground">CPF: {selectedCustomer.cpf}</span>
                      </div>
                    )}
                  </div>
                </section>

                {/* Endereços */}
                <section>
                  <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">Endereços de Entrega ({selectedCustomer.addresses.length})</h4>
                  <div className="space-y-3">
                    {selectedCustomer.addresses.map((addr, i) => (
                      <div key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border">
                        <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-sm font-medium text-muted-foreground leading-relaxed">{addr}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Histórico rápido */}
                <section>
                  <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">Última Atividade</h4>
                  <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-bold text-foreground">Último Pedido</p>
                        <p className="text-xs text-muted-foreground">Realizado em {new Date(selectedCustomer.last_order_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="mt-12 pt-8 border-t border-border">
                <button 
                  onClick={() => toast.info("Relatório detalhado do cliente em desenvolvimento.")}
                  className="w-full py-4 rounded-2xl bg-foreground text-background font-black text-xs uppercase tracking-widest hover:bg-foreground/90 transition-all shadow-xl"
                >
                  Gerar Relatório Completo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </BusinessLayout>
  );
}
