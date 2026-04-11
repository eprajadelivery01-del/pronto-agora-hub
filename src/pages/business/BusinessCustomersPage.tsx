// @ts-nocheck
import { useState, useEffect } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Users, Search, RefreshCw, User, Phone, MapPin, Calendar, ShoppingBag } from "lucide-react";

interface CustomerRecord {
  id: string;
  name: string;
  phone?: string;
  total_orders: number;
  last_order_at?: string;
}

export default function BusinessCustomersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      const { data: company } = await supabase.from("companies").select("id").eq("user_id", user.id).maybeSingle();
      if (company) setCompanyId(company.id);
    };
    init();
  }, [user]);

  useEffect(() => {
    if (!companyId) return;
    const fetchCustomers = async () => {
      setLoading(true);
      // Fetching customers who have at least one order with this company
      const { data } = await supabase
        .from("orders")
        .select(`
          customers (id, name, phone),
          created_at
        `)
        .eq("company_id", companyId);

      if (data) {
        const customerMap = new Map<string, CustomerRecord>();
        data.forEach((o: any) => {
          if (!o.customers) return;
          const c = o.customers;
          if (!customerMap.has(c.id)) {
            customerMap.set(c.id, {
              id: c.id,
              name: c.name,
              phone: c.phone,
              total_orders: 0,
              last_order_at: o.created_at
            });
          }
          const record = customerMap.get(c.id)!;
          record.total_orders += 1;
          if (new Date(o.created_at) > new Date(record.last_order_at!)) {
            record.last_order_at = o.created_at;
          }
        });
        setCustomers(Array.from(customerMap.values()));
      }
      setLoading(false);
    };
    fetchCustomers();
  }, [companyId]);

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
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Buscar por nome ou fone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-card text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.length === 0 ? (
            <div className="col-span-full py-24 text-center bg-card border border-dashed border-border rounded-[2.5rem]">
              <Users className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-foreground">Nenhum cliente encontrado</h3>
              <p className="text-muted-foreground">Sua lista de clientes automáticos aparecerá aqui.</p>
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <div key={customer.id} className="bg-card border border-border rounded-3xl p-6 shadow-card hover:border-primary/20 transition-all group">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{customer.name}</h3>
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" /> {customer.phone || "Sem telefone"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
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

                <button className="w-full mt-4 py-3 rounded-2xl border border-border hover:bg-muted text-xs font-black uppercase tracking-wider text-muted-foreground hover:text-foreground transition-all flex items-center justify-center gap-2">
                  <ShoppingBag className="h-3.5 w-3.5" /> Ver Histórico
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </BusinessLayout>
  );
}
