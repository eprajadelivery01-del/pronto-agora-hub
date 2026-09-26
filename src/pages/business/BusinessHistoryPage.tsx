import { useState, useEffect } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { ClipboardList, Search, Calendar, RefreshCw, Eye, CheckCircle, XCircle, Clock, ShoppingBag, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OrderDetailModal from "@/components/business/OrderDetailModal";
import { toast } from "sonner";

interface OrderHistory {
  id: string;
  status: string;
  total: number;
  created_at: string;
  customer_name: string;
  customer_phone?: string;
  delivery_address?: string;
  type?: 'manual' | 'marketplace';
  raw_data?: any;
}

const cleanVal = (val: string | null | undefined, placeholder: string = "Cliente Marketplace") => {
  if (!val) return null;
  const v = String(val).trim();
  if (
    v === "" || 
    v.toLowerCase() === placeholder.toLowerCase() || 
    v.toLowerCase() === "consumidor" || 
    v.toLowerCase() === "cliente" ||
    v.toLowerCase() === "null" || 
    v.toLowerCase() === "undefined" || 
    v === "Não informado"
  ) return null;
  return v;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  accepted: "Aceito",
  preparing: "Preparando",
  ready: "Pronto",
  in_route: "Em Rota",
  completed: "Entregue",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export default function BusinessHistoryPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState<OrderHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("marketplace");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      let { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

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
    };
    init();
  }, [user?.id]);

  useEffect(() => {
    if (!companyId) return;
    const fetchHistory = async () => {
      setLoading(true);
      console.log("[HistoryPage] Buscando histórico para company:", companyId);
      
      try {
        // BUSCA PARALELA: Marketplace e Entregas Manuais ao mesmo tempo com campos completos de cliente
        const [ordersRes, deliveriesRes] = await Promise.all([
          supabase.from("orders")
            .select(`
              id, status, total, created_at, customer_id, user_id, delivery_id,
              customer_name, customer_phone, delivery_address, notes,
              customers (id, name, phone)
            `)
            .eq("company_id", companyId)
            .order("created_at", { ascending: false }),
          supabase.from("deliveries")
            .select(`id, order_id, status, value, price, commission, created_at, customer_name, customer_phone, address`)
            .eq("company_id", companyId)
            .order("created_at", { ascending: false })
        ]);

        let orders = ordersRes.data;

        // Fallback resiliente caso a relação aninhada com customers apresente erro
        if (ordersRes.error) {
          console.warn("[HistoryPage] Tentativa de query completa falhou, tentando simplificada:", ordersRes.error.message);
          const { data: simpleOrders, error: simpleErr } = await supabase
            .from("orders")
            .select(`
              id, status, total, created_at, customer_id, user_id, delivery_id,
              customer_name, customer_phone, delivery_address, notes
            `)
            .eq("company_id", companyId)
            .order("created_at", { ascending: false });

          if (simpleErr) {
            console.error("[HistoryPage] Erro fatal orders:", simpleErr);
          } else {
            orders = simpleOrders;
          }
        }

        const deliveries = deliveriesRes.data || [];

        // Mapeamentos de entregas (por delivery_id e por order_id)
        const deliveryMap = new Map<string, any>();
        const deliveryByOrderMap = new Map<string, any>();
        deliveries.forEach((d: any) => {
          if (d.id) deliveryMap.set(d.id, d);
          if (d.order_id) deliveryByOrderMap.set(d.order_id, d);
        });

        // Extrair IDs para enriquecer dados dos clientes via profiles e customers
        const customerIds = orders ? [...new Set(orders.map((o: any) => o.customer_id))].filter(Boolean) : [];
        const userIds = orders ? [...new Set(orders.map((o: any) => o.user_id))].filter(Boolean) : [];
        const allUserOrCustIds = [...new Set([...customerIds, ...userIds])];

        const [profilesRes, customersRes] = await Promise.all([
          allUserOrCustIds.length > 0
            ? supabase.from("profiles").select("id, full_name, phone, user_id").or(`id.in.(${allUserOrCustIds.join(',')}),user_id.in.(${allUserOrCustIds.join(',')})`)
            : Promise.resolve({ data: [] }),
          customerIds.length > 0
            ? supabase.from("customers").select("id, name, phone, user_id").in("id", customerIds)
            : Promise.resolve({ data: [] })
        ]);

        const profileMap = new Map<string, any>();
        if (profilesRes.data) {
          profilesRes.data.forEach((p: any) => {
            if (p.id) profileMap.set(p.id, p);
            if (p.user_id) profileMap.set(p.user_id, p);
          });
        }

        const customerTableMap = new Map<string, any>();
        if (customersRes.data) {
          customersRes.data.forEach((c: any) => {
            if (c.id) customerTableMap.set(c.id, c);
            if (c.user_id) customerTableMap.set(c.user_id, c);
          });
        }

        const unifiedHistory: OrderHistory[] = [];

        if (orders) {
          orders.forEach((o: any) => {
            const profile = (o.user_id && profileMap.get(o.user_id)) || (o.customer_id && profileMap.get(o.customer_id));
            const custRecord = (o.customer_id && customerTableMap.get(o.customer_id)) || (o.user_id && customerTableMap.get(o.user_id));
            const delivery = (o.delivery_id && deliveryMap.get(o.delivery_id)) || deliveryByOrderMap.get(o.id);

            const resolvedName = 
              cleanVal(o.customer_name) ||
              cleanVal(o.customers?.name) ||
              cleanVal(custRecord?.name) ||
              cleanVal(profile?.full_name) ||
              cleanVal(delivery?.customer_name) ||
              "Cliente Marketplace";

            const resolvedPhone = 
              cleanVal(o.customer_phone, "Não informado") ||
              cleanVal(o.customers?.phone, "Não informado") ||
              cleanVal(custRecord?.phone, "Não informado") ||
              cleanVal(profile?.phone, "Não informado") ||
              cleanVal(delivery?.customer_phone, "Não informado") ||
              "Não informado";

            unifiedHistory.push({
              id: o.id,
              status: o.status,
              total: o.total || 0,
              created_at: o.created_at,
              customer_name: resolvedName,
              customer_phone: resolvedPhone,
              delivery_address: o.delivery_address || delivery?.address,
              type: 'marketplace',
              raw_data: {
                ...o,
                customer_name: resolvedName,
                customer_phone: resolvedPhone
              }
            });
          });
        }

        if (deliveries) {
          deliveries.forEach((d: any) => {
            unifiedHistory.push({
              id: d.id,
              status: d.status,
              total: Number(d.commission) || Number(d.price) || Number(d.value) || 0,
              created_at: d.created_at,
              customer_name: d.customer_name || "Cliente Manual",
              customer_phone: d.customer_phone || "Não informado",
              delivery_address: d.address,
              type: 'manual',
              raw_data: d
            });
          });
        }

        // Sort by date descending
        unifiedHistory.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        console.log("[HistoryPage] Total carregado:", unifiedHistory.length);
        setHistory(unifiedHistory);
      } catch (err) {
        console.error("[HistoryPage] Erro fatal:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [companyId]);
  
  const handleViewDetails = async (item: OrderHistory) => {
    try {
      setFetchingDetails(true);
      console.log("[HistoryPage] Buscando detalhes para:", item.id, "tipo:", item.type);
      
      if (item.type === 'marketplace') {
        const { data, error } = await supabase
          .from("orders")
          .select(`
            id, status, total, created_at, notes, delivery_address, company_id,
            customer_id, user_id, delivery_id, customer_name, customer_phone,
            customers (id, name, phone),
            order_items (
              id, quantity, price, unit_price, product_name, notes, options,
              products (id, name, image_url, description)
            )
          `)
          .eq("id", item.id)
          .single();
          
        if (error) throw error;

        const resolvedCustomer = {
          id: data.customer_id,
          name: cleanVal(item.customer_name) || cleanVal(data.customer_name) || cleanVal(data.customers?.name) || "Cliente Marketplace",
          phone: cleanVal(item.customer_phone, "Não informado") || cleanVal(data.customer_phone, "Não informado") || cleanVal(data.customers?.phone, "Não informado") || "Não informado",
          address: data.delivery_address || item.delivery_address || "Endereço não informado"
        };

        setSelectedOrder({
          ...data,
          customer: resolvedCustomer,
          customer_name: resolvedCustomer.name,
          customer_phone: resolvedCustomer.phone,
        });
      } else {
        const { data, error } = await supabase
          .from("deliveries")
          .select("*")
          .eq("id", item.id)
          .single();
          
        if (error) throw error;
        
        // Map delivery to modal structure
        const mappedDelivery = {
          ...data,
          total: data.value,
          customer: {
            name: data.customer_name || "Cliente Manual",
            phone: data.customer_phone || "Não informado",
            address: data.address
          }
        };
        setSelectedOrder(mappedDelivery);
      }
      
      setIsModalOpen(true);
    } catch (err: any) {
      console.error("[HistoryPage] Erro ao buscar detalhes:", err);
      toast.error("Não foi possível carregar os detalhes do pedido.");
    } finally {
      setFetchingDetails(false);
    }
  };

  const filteredHistory = history.filter(o => {
    const matchesSearch = o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          o.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === "marketplace" ? o.type === 'marketplace' : o.type === 'manual';
    return matchesSearch && matchesTab;
  });

  if (loading) return (
    <BusinessLayout title="Histórico">
       <div className="flex items-center justify-center py-24"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>
    </BusinessLayout>
  );

  return (
    <BusinessLayout title="Histórico de Pedidos">
      <div className="space-y-6 animate-in fade-in duration-500">
        <Tabs defaultValue="marketplace" className="w-full" onValueChange={setActiveTab}>
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
            <div>
              <h2 className="text-2xl font-black text-foreground">
                {activeTab === "marketplace" ? "Relatório de Vendas" : "Histórico de Entregas"}
              </h2>
              <p className="text-muted-foreground text-sm font-medium">
                {activeTab === "marketplace" 
                  ? "Veja todos os pedidos realizados no marketplace." 
                  : "Veja todas as entregas manuais solicitadas."}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <TabsList className="bg-muted/50 p-1 h-11 border border-border/50 rounded-xl">
                <TabsTrigger value="marketplace" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Marketplace
                </TabsTrigger>
                <TabsTrigger value="entregas" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
                  <Truck className="h-4 w-4" />
                  Entregas
                </TabsTrigger>
              </TabsList>
              
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text"
                  placeholder="Buscar por ID ou cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-0">
            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-card">
              <div className="overflow-x-auto custom-scrollbar pb-2">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground">ID</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Cliente</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Data</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Status</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Total</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground font-medium">
                          Nenhum{activeTab === "marketplace" ? " pedido" : "a entrega"} encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map((order) => (
                        <tr key={order.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="px-6 py-4">
                            <span className="font-mono text-sm font-bold text-foreground">#{order.id.slice(-6).toUpperCase()}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-semibold text-foreground">{order.customer_name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-foreground">{new Date(order.created_at).toLocaleDateString()}</span>
                              <span className="text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                               {order.status === 'completed' || order.status === 'delivered' ? <CheckCircle className="h-3 w-3 text-success" /> : 
                                order.status === 'cancelled' ? <XCircle className="h-3 w-3 text-destructive" /> : 
                                <Clock className="h-3 w-3 text-warning" />}
                                 <span className={cn("text-xs font-bold", 
                                  order.status === 'completed' || order.status === 'delivered' ? "text-success" : 
                                  order.status === 'cancelled' ? "text-destructive" : "text-warning")}>
                                  {STATUS_LABELS[order.status] || (order.status === 'delivered' ? 'Entregue' : order.status)}
                                 </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm font-black text-foreground">
                            R$ {order.total.toFixed(2).replace(".", ",")}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button 
                              onClick={() => handleViewDetails(order)}
                              disabled={fetchingDetails}
                              className="p-2 rounded-xl bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-all disabled:opacity-50"
                            >
                              <Eye className={cn("h-4 w-4", fetchingDetails && "animate-pulse")} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <OrderDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        order={selectedOrder}
      />
    </BusinessLayout>
  );
}
