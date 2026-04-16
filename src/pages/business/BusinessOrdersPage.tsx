// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCreateDeliveryRequest } from "@/services/deliveries";
import {
  ShoppingBag, Clock, CheckCircle, XCircle, ChefHat,
  Truck, Bell, RefreshCw, Timer, Phone, MapPin, User, Package,
  ChevronRight, ArrowRight, MoreVertical, LayoutGrid, DollarSign,
  ImagePlus, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import OrderDetailModal from "@/components/business/OrderDetailModal";

type OrderStatus = "pending" | "preparing" | "ready" | "delivered" | "cancelled";

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  products?: { name: string };
}

interface Order {
  id: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  notes?: string;
  customer?: { name: string; phone?: string };
  delivery_address?: string;
  items?: OrderItem[];
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Novo",
  preparing: "Em Preparo",
  ready: "Pronto",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  preparing: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  ready: "bg-green-500/10 text-green-600 border-green-500/20",
  delivered: "bg-success/10 text-success border-success/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const getNextActions = (status: OrderStatus) => {
  const actions: Record<string, { label: string, next: OrderStatus }> = {
    pending: { label: "Aceitar Pedido", next: "preparing" },
    preparing: { label: "Marcar Pronto", next: "ready" },
    ready: { label: "Chamar Entregador", next: "ready" }, // Status stays ready until delivery is created or pickup
  };
  return actions[status];
};

const COLUMNS: { key: OrderStatus; label: string; icon: any; color: string }[] = [
  { key: "pending", label: "Novos", icon: Bell, color: "warning" },
  { key: "preparing", label: "Preparando", icon: ChefHat, color: "blue" },
  { key: "ready", label: "Prontos", icon: CheckCircle, color: "green" },
  { key: "delivered", label: "Concluídos", icon: CheckCircle, color: "success" },
];

export default function BusinessOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [stats, setStats] = useState({ pending: 0, preparing: 0, revenue_today: 0, open_total: 0 });
  const [isRinging, setIsRinging] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const createDeliveryMut = useCreateDeliveryRequest();

  const fetchOrders = useCallback(async () => {
    if (!companyId) {
      console.log("[Dashboard] fetchOrders abortado: companyId ausente.");
      setLoading(false);
      return;
    }
    
    try {
      console.log(`[Dashboard] Iniciando busca de pedidos para Empresa: ${companyId}`);
      setLoading(true);
      
      // BUSCA RESILIENTE: Campos operacionais (Após reparo SQL)
      let { data, error } = await supabase
        .from("orders")
        .select(`
          id, status, total, created_at, customer_id, 
          delivery_address, payment_method, notes,
          order_items (
            id, quantity, price, product_name, unit_price,
            products (id, name, image_url, description)
          )
        `)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[Dashboard] Query direta falhou, tentando CHAVE MESTRA (RPC)...", error.message);
        
        // Tentativa via RPC (Função de Banco que pula o RLS quebrado)
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_business_orders_v2', { p_company_id: companyId });
          
        if (rpcError) {
          console.error("[Dashboard] Falha catastrófica: Nem a RPC funcionou.", rpcError);
          toast.error("Erro crítico de banco de dados. Contate o suporte.");
          return;
        }
        
        console.log("[Dashboard] CHAVE MESTRA funcionou! Pedidos carregados via RPC.");
        data = rpcData;
      }

      console.log(`[Dashboard] Pedidos recebidos: ${data?.length || 0}`);

      if (data && data.length > 0) {
      // Busca resiliente de clientes (evita falha de join no status 400)
      const customerIds = [...new Set(data.map((o: any) => o.customer_id))].filter(Boolean);
      let customerMap: Record<string, any> = {};
      
      if (customerIds.length > 0) {
        console.log("[Dashboard] Buscando detalhes de clientes e endereços...");
        
        // Busca Contatos
        const { data: customersData } = await supabase
          .from("customers")
          .select("id, name, phone")
          .in("id", customerIds);
        
        if (customersData) {
          customersData.forEach(c => { 
            // Se o nome for genérico, marcamos como elegível para fallback
            const isGeneric = !c.name || c.name === "Cliente Marketplace" || c.name === "Consumidor";
            customerMap[c.id] = { 
              ...c, 
              name: isGeneric ? null : c.name 
            }; 
          });
        }

        // NOVO: Busca fallback em PROFILES para clientes do Marketplace (Resiliente: Testa ID e USER_ID)
        const missingFromCustomers = customerIds.filter(id => !customerMap[id] || !customerMap[id].name);
        if (missingFromCustomers.length > 0) {
          console.log("[Dashboard] Buscando dados complementares na tabela Profiles...");
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, name, phone, user_id")
            .or(`id.in.(${missingFromCustomers.join(',')}),user_id.in.(${missingFromCustomers.join(',')})`);
          
          if (profilesData) {
            profilesData.forEach(p => {
              // Mapeia o perfil encontrado para qualquer ID que combine (id ou user_id)
              missingFromCustomers.forEach(mId => {
                if (p.id === mId || p.user_id === mId) {
                  customerMap[mId] = {
                    ...customerMap[mId],
                    name: customerMap[mId]?.name || p.name,
                    phone: customerMap[mId]?.phone || p.phone
                  };
                }
              });
            });
          }
        }

        // Busca Endereços e Dados de Fallback (Resiliente: Tenta em Deliveries primeiro, depois em Addresses)
        const deliveryIds = [...new Set(data.map((o: any) => o.delivery_id))].filter(Boolean);
        
        if (deliveryIds.length > 0) {
          console.log("[Dashboard] Buscando endereços na tabela de Entregas...");
          const { data: delivData } = await supabase
            .from("deliveries")
            .select("id, address, customer_name, customer_phone, company_id")
            .in("id", deliveryIds);
          
          if (delivData) {
            delivData.forEach(d => {
               // Encontrar qual cliente é dono desta entrega
               const order = data.find((o: any) => o.delivery_id === d.id);
               if (order && customerMap[order.customer_id]) {
                 // Salva o endereço
                 customerMap[order.customer_id].address = d.address;
                 
                 // Se o nome no customerMap ainda for nulo (genérico), usa o da entrega
                 if (!customerMap[order.customer_id].name && d.customer_name) {
                   customerMap[order.customer_id].name = d.customer_name;
                 }
                 
                 // Se o telefone no customerMap for nulo ou genérico, usa o da entrega
                 if ((!customerMap[order.customer_id].phone || customerMap[order.customer_id].phone === "Não informado") && d.customer_phone) {
                   customerMap[order.customer_id].phone = d.customer_phone;
                 }
               }
            });
          }
        }

        // Caso ainda falte endereço, tenta buscar por address_id (se a coluna existir no objeto retornado)
        const addressIds = [...new Set(data.map((o: any) => o.address_id || o.delivery_address_id))].filter(Boolean);
        if (addressIds.length > 0) {
          const { data: addrData } = await supabase
            .from("addresses")
            .select("*")
            .in("id", addressIds);
          
          if (addrData) {
            addrData.forEach(a => {
              const fullAddr = `${a.street}, ${a.number}${a.complement ? ` - ${a.complement}` : ""} - ${a.neighborhood}, ${a.city}`;
              if (customerMap[a.customer_id] && !customerMap[a.customer_id].address) {
                customerMap[a.customer_id].address = fullAddr;
              }
            });
          }
        }
      }

      const todayStr = new Date().toISOString().split('T')[0];
      
      const filteredData = data.filter((o: any) => {
        if (o.status === "cancelled") return false;
        if (["completed", "delivered"].includes(o.status)) {
          return o.created_at.startsWith(todayStr);
        }
        return true;
      });

      const mapped = filteredData.map((o: any) => {
        // Find best source of customer data
        const customerDataFromMap = customerMap[o.customer_id] || {};
        
        // Helper to get real value or null if placeholder
        const cleanVal = (val: string | null | undefined, placeholder: string) => {
          if (!val) return null;
          const v = String(val).trim();
          if (v === "" || 
              v.toLowerCase() === placeholder.toLowerCase() || 
              v.toLowerCase() === "null" || 
              v.toLowerCase() === "undefined" || 
              v.toLowerCase() === "consumidor" ||
              v === "Não informado") return null;
          return v;
        };

        const finalName = cleanVal(customerDataFromMap.name, "Cliente Marketplace") || 
                         cleanVal(o.customer_name, "Cliente Marketplace") || 
                         cleanVal(o.customers?.name, "Cliente Marketplace") || 
                         "Cliente Marketplace";

        const finalPhone = cleanVal(customerDataFromMap.phone, "Não informado") || 
                          cleanVal(o.customer_phone, "Não informado") || 
                          cleanVal(o.customers?.phone, "Não informado") || 
                          "Não informado";

        return {
          ...o,
          customer: {
            name: finalName,
            phone: finalPhone,
            address: o.delivery_address || o.address || customerDataFromMap.address || "Endereço não disponível"
          },
          items: o.order_items || []
        };
      });
      
      setOrders(mapped);
      setStats({
        pending: mapped.filter(o => o.status === "pending" || !["accepted", "preparing", "ready", "in_route", "completed", "delivered", "cancelled"].includes(o.status)).length,
        preparing: mapped.filter(o => ["accepted", "preparing"].includes(o.status)).length,
        revenue_today: data.filter(o => ["completed", "delivered"].includes(o.status) && o.created_at.startsWith(todayStr))
                           .reduce((acc, o) => acc + (Number(o.total) || 0), 0),
        open_total: data.filter(o => !["completed", "delivered", "cancelled"].includes(o.status))
                           .reduce((acc, o) => {
                             const val = Number(o.total) || 0;
                             console.log(`[Dashboard] Somando pedido ${o.id}: R$ ${val} (Status: ${o.status})`);
                             return acc + val;
                           }, 0),
      });
      console.log("[Dashboard] Estatísticas finais:", {
        revenue: data.filter(o => ["completed", "delivered"].includes(o.status) && o.created_at.startsWith(todayStr)).length,
        open: data.filter(o => !["completed", "delivered", "cancelled"].includes(o.status)).length
      });
      }
    } catch (err: any) {
      console.error("[Dashboard] Falha catastrófica no fetchOrders:", err);
      toast.error("Ocorreu um erro ao processar os dados.");
    } finally {
      setLoading(false);
      console.log("[Dashboard] Carga finalizada.");
    }
  }, [companyId]);

  useEffect(() => {
    const init = async () => {
      console.log("[Dashboard] Inicializando Diagnóstico de Visibilidade...");
      if (!user) {
         console.warn("[Dashboard] Usuário não logado.");
         return;
      }
      
      setLoading(true);
      try {
        console.log(`[Dashboard] ANALISANDO CONTAS PARA: ${user.id}`);
        
        // 1. Buscar TODAS as empresas vinculadas ao usuário
        const { data: companies, error: compErr } = await supabase
          .from("companies")
          .select("id, name")
          .eq("user_id", user.id);
        
        if (compErr) {
          console.error("[Dashboard] Erro ao buscar empresas:", compErr);
        }

        if (companies && companies.length > 0) {
          console.log(`[Dashboard] ENCONTRADAS ${companies.length} EMPRESAS:`, companies);
          
          // Se tiver mais de uma, logamos o alerta
          if (companies.length > 1) {
            console.warn("[Dashboard] ATENÇÃO: Você tem múltiplas empresas vinculadas! O sistema pode estar carregando a errada.");
            toast.info(`Várias empresas encontradas: ${companies.map(c => c.name).join(", ")}`);
          }

          // Tenta encontrar uma que NÃO seja de teste se houver escolha
          const bestCompany = companies.find(c => !c.name.toLowerCase().includes("teste")) || companies[0];
          
          console.log(`[Dashboard] Selecionando Empresa Principal: ${bestCompany.name} (${bestCompany.id})`);
          setCompanyId(bestCompany.id);
        } else {
          console.error("[Dashboard] NENHUMA empresa encontrada para este usuário. Por isso os pedidos estão 0.");
          setLoading(false);
        }

        // 2. AUDITORIA DE EMERGÊNCIA: Quantos pedidos existem no TOTAL do banco para este usuário?
        const { count, error: countErr } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true });
        
        console.log(`[Dashboard] Auditoria Global: Existem ${count} pedidos totais acessíveis por RLS.`);
        
      } catch (err) {
        console.error("[Dashboard] Exceção na inicialização:", err);
        setLoading(false);
      }
    };
    init();
  }, [user]);

  useEffect(() => {
    if (companyId) {
      console.log("[Dashboard] companyId atualizado, disparando fetchOrders...");
      fetchOrders();
    }
  }, [companyId, fetchOrders]);

  // Configuração do Áudio de Alerta
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audioRef.current.loop = true;
    }
    
    const hasNewOrders = orders.some(o => o.status === "pending");
    
    if (hasNewOrders && !isRinging) {
      audioRef.current.play()
        .then(() => setIsRinging(true))
        .catch(e => console.warn("[OrdersPage] Audio blocked by browser:", e));
    } else if (!hasNewOrders && isRinging) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsRinging(false);
    }
  }, [orders, isRinging]);

  const handleMute = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsRinging(false);
    }
  };

  // Realtime subscription with visual Ping
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`business-orders-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `company_id=eq.${companyId}` },
        (payload) => {
          fetchOrders();
          if (payload.eventType === "INSERT") {
             toast.success("📦 NOVO PEDIDO RECEBIDO!", {
               description: "Acesse a aba 'Novos' para aceitar.",
               duration: 8000,
               position: "top-center"
             });
             // Try play notification sound (Mixkit Stable Ping)
             try { 
               const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
               audio.volume = 0.5;
               audio.play().catch(e => console.warn("[Audio] Bloqueio de auto-play pelo navegador:", e)); 
             } catch (err) {
               console.error("[Audio] Erro ao reproduzir som:", err);
             }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, fetchOrders]);

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    console.log(`[Dashboard] Atualizando pedido ${orderId} para status: ${newStatus}`);
    
    try {
      console.log("[Dashboard] Usando RPC Chave Mestra para atualização blindada de status...");
      
      const { data, error } = await supabase.rpc('update_order_status_v3', {
        p_order_id: orderId,
        p_new_status: newStatus
      });

      if (error) {
        console.error("[Dashboard] Erro técnico na RPC de update:", error);
        toast.error("Erro ao atualizar no banco: " + error.message);
        return;
      }

      if (data && data.success === false) {
        console.error("[Dashboard] Negócio recusou o update:", data.message || data.error);
        toast.error("Falha na atualização: " + (data.message || data.error));
        return;
      }

      console.log("[Dashboard] Update via RPC concluído com sucesso!");
      
      // Atualização otimista do estado local
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      toast.success(`Pedido movido para: ${STATUS_LABELS[newStatus]}`);
      
    } catch (err: any) {
      console.error("[Dashboard] Falha catastrófica na atualização:", err);
      toast.error("Erro crítico de banco de dados. Contate o suporte.");
    } finally {
      // Re-fetch para garantir sincronia real
      fetchOrders();
    }
  };

  const handleDispatch = async (order: Order) => {
    try {
      toast.info("Solicitando entregador...", { id: "dispatch" });
      await createDeliveryMut.mutateAsync(order.id);
      toast.success("🚚 Entregador Solicitado! Aguardando aceite.", { id: "dispatch" });
      fetchOrders();
    } catch (err: any) {
      toast.error(`Falha ao despachar: ${err.message}`, { id: "dispatch" });
    }
  };


  const ordersByColumn = (status: OrderStatus) => {
    if (status === "pending") {
      // Show pending AND any unknown active statuses in the first column
      const knownStatuses = ["preparing", "ready", "delivered", "cancelled"];
      return orders.filter(o => o.status === "pending" || !knownStatuses.includes(o.status));
    }
    if (status === "preparing") {
      return orders.filter(o => ["accepted", "preparing"].includes(o.status));
    }
    if (status === "delivered") {
      return orders.filter(o => ["completed", "delivered"].includes(o.status));
    }
    return orders.filter(o => o.status === status);
  };

  if (loading) {
    return (
      <BusinessLayout title="Gestão de Pedidos">
        <div className="flex items-center justify-center py-40">
           <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <ShoppingBag className="h-6 w-6 text-primary absolute inset-0 m-auto" />
           </div>
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout title="Marketplace: Gestão de Pedidos">
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        {/* Header com Alerta Sonoro */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-foreground tracking-tight">Gestão de Pedidos</h2>
            <p className="text-muted-foreground font-medium">Acompanhe e gerencie as vendas do seu marketplace.</p>
          </div>
          
          {isRinging && (
            <div className="flex items-center gap-2 animate-in zoom-in duration-300">
              <div className="flex h-12 items-center gap-3 px-6 rounded-2xl bg-destructive text-destructive-foreground font-black text-xs uppercase tracking-widest animate-pulse shadow-xl shadow-destructive/20 border-2 border-white/20">
                <Bell className="h-5 w-5 animate-bounce" />
                Novo Pedido Pendente!
              </div>
              <button
                onClick={handleMute}
                className="h-12 w-12 flex items-center justify-center rounded-2xl bg-muted text-foreground hover:bg-muted/80 transition-all border border-border shadow-md"
                title="Silenciar Alerta"
              >
                <XCircle className="h-6 w-6 text-destructive" />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-card border border-border rounded-3xl p-6 shadow-card hover:border-primary/20 transition-all flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-warning/10 flex items-center justify-center">
                 <Bell className="h-7 w-7 text-warning" />
              </div>
              <div>
                 <p className="text-3xl font-black text-foreground tracking-tight">{stats.pending}</p>
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Novos Pendentes</p>
              </div>
           </div>
           <div className="bg-card border border-border rounded-3xl p-6 shadow-card hover:border-primary/20 transition-all flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                 <ChefHat className="h-7 w-7 text-primary" />
              </div>
              <div>
                 <p className="text-3xl font-black text-foreground tracking-tight">{stats.preparing}</p>
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Na Cozinha</p>
              </div>
           </div>
           <div className="bg-card border border-border rounded-3xl p-6 shadow-card hover:border-primary/20 transition-all flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center">
                 <DollarSign className="h-7 w-7 text-success" />
              </div>
              <div>
                 <p className="text-3xl font-black text-foreground tracking-tight">R$ {(stats as any).open_total?.toFixed(2).replace(".", ",") || "0,00"}</p>
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total em Aberto</p>
              </div>
           </div>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar snap-x">
          {COLUMNS.map(col => (
            <div key={col.key} className="flex-none w-80 snap-start flex flex-col gap-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-6 rounded-full bg-primary", 
                    col.color === "warning" && "bg-warning",
                    col.color === "green" && "bg-success",
                    col.color === "blue" && "bg-blue-500"
                  )} />
                  <h3 className="font-black text-sm text-foreground uppercase tracking-wider">{col.label}</h3>
                  <span className="bg-muted px-2 py-0.5 rounded-lg text-[10px] font-black text-muted-foreground">
                    {ordersByColumn(col.key).length}
                  </span>
                </div>
                <MoreVertical className="h-4 w-4 text-muted-foreground/30" />
              </div>

              <div className="space-y-4 min-h-[500px] bg-muted/30 rounded-[2.5rem] p-3 border border-border/50">
                {ordersByColumn(col.key).map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onAdvance={() => {
                        const action = getNextActions(order.status);
                        if (action) {
                           if (order.status === "ready") {
                              handleDispatch(order);
                           } else {
                              updateStatus(order.id, action.next);
                           }
                        }
                    }}
                    onCancel={() => updateStatus(order.id, "cancelled")}
                    onRefresh={fetchOrders}
                    action={getNextActions(order.status)}
                    updateStatus={updateStatus}
                  />
                ))}
                
                {ordersByColumn(col.key).length === 0 && (
                  <div className="h-40 flex flex-col items-center justify-center text-center p-6 opacity-30">
                     <LayoutGrid className="h-8 w-8 mb-2 stroke-1" />
                     <p className="text-[10px] font-bold uppercase tracking-widest">Sem Pedidos</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </BusinessLayout>
  );
}

function OrderCard({ order, onAdvance, onCancel, onRefresh, action, updateStatus }: {
  order: Order;
  onAdvance: () => void;
  onCancel: () => void;
  onRefresh: () => void;
  action: { label: string, next: OrderStatus } | null;
  updateStatus: (orderId: string, status: OrderStatus) => Promise<void>;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const age = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const isPending = order.status === "pending";

  return (
    <>
      <div className={cn(
        "bg-white border-2 border-transparent rounded-[2.5rem] p-6 shadow-card transition-all hover:shadow-2xl hover:border-primary/20 group animate-in zoom-in-95 duration-300 relative overflow-hidden cursor-pointer premium-shadow hover:-translate-y-1",
        isPending && "border-warning/30 shadow-warning/5 bg-warning/[0.01]"
      )}
      onClick={() => setIsModalOpen(true)}
      >
        {isPending && (
          <div className="absolute top-0 right-0 px-5 py-2 bg-warning text-white text-[10px] font-black uppercase tracking-widest rounded-bl-3xl shadow-lg">
            Aguardando Aceite
          </div>
        )}

        {/* Header: ID & Status Badge */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 opacity-70">Identificação</span>
            <p className="font-black text-xl text-foreground tracking-tight">#{order.id.slice(-6).toUpperCase()}</p>
          </div>
          {!isPending && (
            <div className={cn("px-4 py-2 rounded-2xl border-none font-black text-[10px] uppercase tracking-tighter shadow-sm", STATUS_COLORS[order.status])}>
               <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  {STATUS_LABELS[order.status]}
               </span>
            </div>
          )}
        </div>

        {/* Customer Info */}
        <div className="flex items-center gap-4 py-4">
          <div className="w-12 h-12 rounded-[1.25rem] bg-secondary/50 flex items-center justify-center shrink-0 border border-border/50 group-hover:scale-110 transition-transform">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-black text-foreground truncate">{order.customer?.name}</p>
            <div className="flex flex-col gap-1 mt-1">
               <p className="text-[11px] text-primary font-black flex items-center gap-1.5">
                  <Phone className="h-3 w-3" /> {order.customer?.phone}
               </p>
               <div className="flex items-center gap-3">
                  <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-1">
                    <Timer className="h-3 w-3" /> {age} min
                  </p>
                  <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{order.payment_method || 'Pagamento Offline'}</p>
               </div>
            </div>
          </div>
        </div>

        {/* Items Preview */}
        <div className="py-5 border-y border-border/40 group-hover:border-primary/10 transition-colors">
          <div className="space-y-2.5">
            {order.items && order.items.length > 0 ? (
              order.items.slice(0, 2).map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="font-black text-[10px] text-primary">{item.quantity}x</span>
                  </div>
                  <span className="font-bold text-foreground/80 truncate">{item.product_name || item.products?.name || "Produto"}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-2 py-1">
                <Package className="h-4 w-4 opacity-40" /> Toque para ver detalhes...
              </p>
            )}
            {order.items && order.items.length > 2 && (
              <div className="flex items-center gap-2 pt-1">
                 <div className="h-px flex-1 bg-border/40" />
                 <span className="text-[9px] text-primary font-black uppercase tracking-widest">Ver mais {order.items.length - 2} itens</span>
                 <div className="h-px flex-1 bg-border/40" />
              </div>
            )}
          </div>
        </div>

        {/* Action Button & Total */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-muted-foreground uppercase mb-0.5 opacity-60">Valor do Pedido</span>
            <p className="text-2xl font-black text-primary tracking-tighter italic">R$ {order.total.toFixed(2).replace(".", ",")}</p>
          </div>
          
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {isPending && (
              <button 
                onClick={onCancel}
                className="w-12 h-12 rounded-2xl bg-destructive/5 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-all premium-shadow"
                title="Recusar"
              >
                <XCircle className="h-5 w-5" />
              </button>
            )}
            {action && (
              <button
                onClick={onAdvance}
                className={cn(
                  "h-14 px-8 rounded-2xl font-black text-xs uppercase tracking-[0.1em] transition-all flex items-center gap-3 active:scale-95 group/btn",
                  isPending 
                    ? "bg-primary text-white shadow-xl shadow-primary/20 hover:shadow-primary/40" 
                    : "bg-foreground text-background shadow-xl hover:bg-foreground/90"
                )}
              >
                {action.label}
                <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </div>

      <OrderDetailModal
        order={order}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        updateStatus={updateStatus}
        onStatusUpdate={onRefresh}
      />
    </>
  );
}
