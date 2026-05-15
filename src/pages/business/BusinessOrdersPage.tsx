// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useCreateDeliveryRequest } from "@/services/deliveries";
import { calculateDeliveryFee } from "@/utils/freight";
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

type OrderStatus = "pending" | "preparing" | "ready" | "in_route" | "delivered" | "cancelled";

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
  delivery_id?: string;
  customer_id?: string;
  items?: OrderItem[];
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Novo",
  preparing: "Em Preparo",
  ready: "Pronto",
  in_route: "Em Rota",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  preparing: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  ready: "bg-green-500/10 text-green-600 border-green-500/20",
  in_route: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  delivered: "bg-success/10 text-success border-success/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const getNextActions = (status: OrderStatus) => {
  const actions: Record<string, { label: string, next: OrderStatus }> = {
    pending: { label: "Aceitar Pedido", next: "preparing" },
    preparing: { label: "Marcar Pronto", next: "ready" },
    ready: { label: "Chamar Entregador", next: "ready" },
    in_route: { label: "Finalizar", next: "delivered" },
  };
  return actions[status];
};

const COLUMNS: { key: OrderStatus; label: string; icon: any; color: string }[] = [
  { key: "pending", label: "Novos", icon: Bell, color: "warning" },
  { key: "preparing", label: "Na Cozinha", icon: ChefHat, color: "blue" },
  { key: "ready", label: "Prontos", icon: CheckCircle, color: "green" },
  { key: "in_route", label: "Em Rota", icon: Truck, color: "purple" },
  { key: "delivered", label: "Concluídos", icon: CheckCircle, color: "success" },
];

export default function BusinessOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [stats, setStats] = useState({ 
    pending: 0, 
    preparing: 0, 
    ready: 0, 
    in_route: 0, 
    revenue_today: 0, 
    open_total: 0,
    in_route_total: 0
  });
  const [isRinging, setIsRinging] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const createDeliveryMut = useCreateDeliveryRequest();
  
  // Estados para o Modal de Despacho
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<Order | null>(null);
  const [deliveryFee, setDeliveryFee] = useState<string>("0,00");
  const [loadingFee, setLoadingFee] = useState(false);
  const [detectedRegion, setDetectedRegion] = useState<string | null>(null);

  // Formata um número para o padrão monetário brasileiro: 10 → "10,00" / 1234.5 → "1.234,50"
  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Máscara monetária: remove não-dígitos, divide por 100 e reformata
  const applyMoneyMask = (raw: string): string => {
    const digitsOnly = raw.replace(/\D/g, '');
    if (!digitsOnly) return '0,00';
    const numeric = parseInt(digitsOnly, 10) / 100;
    return formatCurrency(numeric);
  };

  // Converte o valor mascarado de volta para número ("1.234,56" → 1234.56)
  const parseCurrency = (masked: string): number => {
    return parseFloat(masked.replace(/\./g, '').replace(',', '.')) || 0;
  };

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
          id, status, total, created_at, customer_id, delivery_id,
          delivery_address, payment_method, notes,
          order_items (
            id, quantity, price, notes, observation,
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
        // 1. Extração IMEDIATA de todos os IDs necessários para busca paralela
        const customerIds = [...new Set(data.map((o: any) => o.customer_id))].filter(Boolean);
        const deliveryIds = [...new Set(data.map((o: any) => o.delivery_id))].filter(Boolean);
        const addressIds = [...new Set(data.map((o: any) => o.address_id || o.delivery_address_id))].filter(Boolean);
        
        // Mapeamento preparado antecipadamente
        let customerMap: Record<string, any> = {};
        customerIds.forEach(id => { customerMap[id] = { id }; });

        console.log(`[Dashboard] Iniciando buscas paralelas para ${data.length} pedidos...`);

        // 2. BUSCA PARALELA (Elimina o efeito cascata/waterfall)
        const [customersRes, deliveriesRes, addressesRes] = await Promise.all([
          customerIds.length > 0 ? supabase.from("customers").select("id, name, phone").in("id", customerIds) : Promise.resolve({ data: [] }),
          deliveryIds.length > 0 ? supabase.from("deliveries").select("id, address, customer_name, customer_phone").in("id", deliveryIds) : Promise.resolve({ data: [] }),
          addressIds.length > 0 ? supabase.from("addresses").select("*").in("id", addressIds) : Promise.resolve({ data: [] })
        ]);

        // 3. Processamento de Clientes (Base Principal)
        if (customersRes.data) {
          customersRes.data.forEach(c => {
            const isGeneric = !c.name || c.name === "Cliente Marketplace" || c.name === "Consumidor";
            customerMap[c.id] = { ...customerMap[c.id], ...c, name: isGeneric ? null : c.name };
          });
        }

        // 4. Processamento de Entregas (Fallback de Endereço e Nome)
        if (deliveriesRes.data) {
          deliveriesRes.data.forEach(d => {
            const order = data.find((o: any) => o.delivery_id === d.id);
            if (order && customerMap[order.customer_id]) {
              customerMap[order.customer_id].address = d.address;
              if (!customerMap[order.customer_id].name && d.customer_name) {
                customerMap[order.customer_id].name = d.customer_name;
              }
              if ((!customerMap[order.customer_id].phone || customerMap[order.customer_id].phone === "Não informado") && d.customer_phone) {
                customerMap[order.customer_id].phone = d.customer_phone;
              }
            }
          });
        }

        // 5. Processamento de Endereços Opcionais
        if (addressesRes.data) {
          addressesRes.data.forEach(a => {
            if (customerMap[a.customer_id] && !customerMap[a.customer_id].address) {
              customerMap[a.customer_id].address = `${a.street}, ${a.number}${a.complement ? ` - ${a.complement}` : ""} - ${a.neighborhood}, ${a.city}`;
            }
          });
        }

        // 6. Busca de Fallback em PROFILES (Apenas para quem ainda está sem nome)
        const missingFromCustomers = customerIds.filter(id => !customerMap[id] || !customerMap[id].name);
        if (missingFromCustomers.length > 0) {
          console.log("[Dashboard] Buscando fallback em Profiles para IDs pendentes...");
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, name, phone, user_id")
            .or(`id.in.(${missingFromCustomers.join(',')}),user_id.in.(${missingFromCustomers.join(',')})`);
          
          if (profilesData) {
            profilesData.forEach(p => {
              missingFromCustomers.forEach(mId => {
                if (p.id === mId || p.user_id === mId) {
                  customerMap[mId].name = customerMap[mId].name || p.name;
                  customerMap[mId].phone = (customerMap[mId].phone && customerMap[mId].phone !== "Não informado") ? customerMap[mId].phone : p.phone;
                }
              });
            });
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
          const customerDataFromMap = customerMap[o.customer_id] || {};
          
          const cleanVal = (val: string | null | undefined, placeholder: string) => {
            if (!val) return null;
            const v = String(val).trim();
            if (v === "" || v.toLowerCase() === placeholder.toLowerCase() || v.toLowerCase() === "null" || v.toLowerCase() === "undefined" || v.toLowerCase() === "consumidor" || v === "Não informado") return null;
            return v;
          };

          const finalName = cleanVal(customerDataFromMap.name, "Cliente Marketplace") || cleanVal(o.customer_name, "Cliente Marketplace") || cleanVal(o.customers?.name, "Cliente Marketplace") || "Cliente Marketplace";
          const finalPhone = cleanVal(customerDataFromMap.phone, "Não informado") || cleanVal(o.customer_phone, "Não informado") || cleanVal(o.customers?.phone, "Não informado") || "Não informado";

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
        
        const openOrders = mapped.filter(o => ["pending", "accepted", "preparing", "ready"].includes(o.status));
        const inRouteOrders = mapped.filter(o => o.status === "in_route");
        // Receita de hoje: pedidos concluídos/entregues cuja atualização final (ou criação) foi hoje
        const deliveredToday = data.filter(o => 
          ["completed", "delivered"].includes(o.status) && 
          (o.created_at.startsWith(todayStr) || (o.updated_at && o.updated_at.startsWith(todayStr)))
        );

        setStats({
          pending: mapped.filter(o => o.status === "pending" || !["accepted", "preparing", "ready", "in_route", "completed", "delivered", "cancelled"].includes(o.status)).length,
          preparing: mapped.filter(o => ["accepted", "preparing"].includes(o.status)).length,
          ready: mapped.filter(o => o.status === "ready").length,
          in_route: inRouteOrders.length,
          revenue_today: deliveredToday.reduce((acc, o) => acc + (Number(o.total) || 0), 0),
          open_total: openOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0),
          in_route_total: inRouteOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0),
        });

        console.log("[Dashboard] --- DIAGNÓSTICO DE PEDIDOS ---");
        console.log(`[Dashboard] Hoje: ${todayStr} | Total Recebidos: ${data.length}`);
        console.log(`[Dashboard] Abertos: ${openOrders.length} | Em Rota: ${inRouteOrders.length} | Entregues Hoje: ${deliveredToday.length}`);
        if (openOrders.length > 0) {
          console.table(openOrders.map(o => ({ 
            ID: o.id.slice(-6).toUpperCase(), 
            Status: o.status, 
            Valor: formatCurrency(Number(o.total || 0)),
            Cliente: o.customer?.name 
          })));
        }
      } else {
        setOrders([]);
        setStats({ pending: 0, preparing: 0, ready: 0, in_route: 0, revenue_today: 0, open_total: 0, in_route_total: 0 });
      }
      console.log("[Dashboard] Estatísticas finais carregadas.");
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
      if (!user?.id || companyId) return;
      
      try {
        console.log("[Dashboard] Buscando empresa vinculada...");
        const { data: companies } = await supabase
          .from("companies")
          .select("id, name")
          .eq("user_id", user.id);
        
        if (companies && companies.length > 0) {
          const bestCompany = companies.find(c => !c.name.toLowerCase().includes("teste")) || companies[0];
          setCompanyId(bestCompany.id);
        }
      } catch (err) {
        console.error("[Dashboard] Erro na inicialização:", err);
      }
    };
    init();
  }, [user?.id, companyId]);

  useEffect(() => {
    if (companyId) {
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

    // Atualização otimista
    const previous = orders;
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) {
        console.error("[Dashboard] Erro no UPDATE de orders:", error);
        toast.error("Falha na atualização: " + error.message);
        setOrders(previous); // rollback
        return;
      }

      console.log("[Dashboard] Update concluído com sucesso!");
      toast.success(`Pedido movido para: ${STATUS_LABELS[newStatus]}`);
    } catch (err: any) {
      console.error("[Dashboard] Falha catastrófica na atualização:", err);
      toast.error("Erro crítico: " + (err?.message || "desconhecido"));
      setOrders(previous);
    }
  };

  const handleDispatch = async (order: Order) => {
    // 🛡️ VERIFICAÇÃO INTELIGENTE DE DUPLICIDADE (Resiliente)
    if (order.delivery_id) {
      console.log(`[Dashboard] Verificando integridade da entrega vinculada: ${order.delivery_id}`);
      
      const { data: delivery, error } = await supabase
        .from('deliveries')
        .select('status')
        .eq('id', order.delivery_id)
        .maybeSingle();

      // Se a entrega não existe (órfã) ou já foi cancelada, limpamos o vínculo e permitimos novo despacho
      if (!delivery || delivery.status === 'cancelled') {
        console.warn("[Dashboard] Vínculo de entrega inválido ou cancelado detectado. Liberando pedido para novo despacho.");
        
        // Limpamos no banco de dados para evitar recorrência
        await supabase
          .from('orders')
          .update({ delivery_id: null } as any)
          .eq('id', order.id);
          
        // Atualizamos localmente para permitir a abertura do modal sem refresh
        order.delivery_id = null;
      } else {
        // Se já existe entrega ativa, apenas garantimos que o status do pedido seja atualizado para sair do Kanban
        console.log("[Dashboard] Entrega ativa detectada. Atualizando status do pedido para 'in_route'.");
        await updateStatus(order.id, "in_route");
        toast.info("Este pedido já possui uma entrega ativa. Movendo para o painel de entregas...");
        return;
      }
    }

    setSelectedOrderForDispatch(order);
    setDeliveryFee("0,00");
    setDetectedRegion(null);
    setIsDispatchModalOpen(true);

    // Tenta calcular frete automático com base no endereço do pedido
    if (order.delivery_address) {
      setLoadingFee(true);
      try {
        // Buscar coordenadas do pedido pela tabela deliveries ou orders
        const { data: deliveryData } = await supabase
          .from('deliveries')
          .select('delivery_latitude, delivery_longitude')
          .eq('order_id', order.id)
          .maybeSingle();

        const lat = deliveryData?.delivery_latitude;
        const lng = deliveryData?.delivery_longitude;

        if (lat && lng) {
          const result = await calculateDeliveryFee(lat, lng, supabase);
          if (result.fee !== null && !result.isOutOfRange) {
            setDeliveryFee(formatCurrency(result.fee));
            setDetectedRegion(result.regionName);
            toast.info(`📍 Frete calculado: R$ ${formatCurrency(result.fee)} (${result.regionName})`);
          } else if (result.isOutOfRange) {
            setDetectedRegion('Fora da área de cobertura');
          }
        }
      } catch (err: any) {
        console.warn('[Dashboard] Não foi possível calcular frete automático:', err?.message);
      } finally {
        setLoadingFee(false);
      }
    }
  };

  const confirmDispatch = async () => {
    if (!selectedOrderForDispatch) return;
    
    const fee = parseCurrency(deliveryFee);
    if (isNaN(fee) || fee < 0) {
      toast.error("Por favor, insira um valor válido para a entrega.");
      return;
    }

    try {
      setIsDispatchModalOpen(false);
      toast.info("Solicitando entregador...", { id: "dispatch" });
      
      await createDeliveryMut.mutateAsync({ 
        orderId: selectedOrderForDispatch.id, 
        customValue: fee 
      });
      
      toast.success("🚚 Entregador Solicitado! Aguardando aceite.", { id: "dispatch" });
      fetchOrders();
    } catch (err: any) {
      console.error("[Dashboard] Erro ao despachar:", err);
      toast.error(`Falha ao despachar: ${err.message}`, { id: "dispatch" });
    }
  };


  const ordersByColumn = (status: OrderStatus) => {
    if (status === "pending") {
      // Show pending AND any unknown active statuses in the first column
      const knownStatuses = ["preparing", "ready", "in_route", "delivered", "cancelled"];
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
           <div className="bg-card border border-border rounded-2xl p-5 shadow-card hover:border-primary/20 transition-all flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                 <Bell className="h-6 w-6 text-warning" />
              </div>
              <div>
                 <p className="text-2xl font-black text-foreground tracking-tight">{stats.pending}</p>
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Novos</p>
              </div>
           </div>
           <div className="bg-card border border-border rounded-2xl p-5 shadow-card hover:border-primary/20 transition-all flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                 <ChefHat className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                 <p className="text-2xl font-black text-foreground tracking-tight">{stats.preparing}</p>
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Na Cozinha</p>
              </div>
           </div>
           <div className="bg-card border border-border rounded-2xl p-5 shadow-card hover:border-primary/20 transition-all flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                 <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                 <p className="text-2xl font-black text-foreground tracking-tight">{stats.ready}</p>
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Prontos</p>
              </div>
           </div>
           <div className="bg-card border border-border rounded-2xl p-5 shadow-card border-primary/20 bg-primary/[0.02] transition-all flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                 <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                 <p className="text-2xl font-black text-foreground tracking-tight">R$ {stats.open_total?.toFixed(2).replace(".", ",")}</p>
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Aberto</p>
              </div>
           </div>
        </div>

        {/* Kanban Board */}
        {/* Kanban Board */}
        <div className="flex gap-1 overflow-x-auto pb-6 custom-scrollbar snap-x">
          {COLUMNS.map(col => (
            <div key={col.key} className="flex-none w-60 snap-start flex flex-col gap-2">
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

              <div className="space-y-2 h-[65vh] overflow-y-auto custom-scrollbar bg-muted/20 rounded-[1.5rem] p-1.5 border border-border/40">
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

      {/* MODAL DE DESPACHO (CHAMAR ENTREGADOR) */}
      <Dialog open={isDispatchModalOpen} onOpenChange={setIsDispatchModalOpen}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-0">
          <div className="bg-primary/5 p-8 pb-4">
            <div className="w-16 h-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center mb-6">
              <Truck className="h-8 w-8 text-primary" />
            </div>
            <DialogHeader className="text-left p-0">
              <DialogTitle className="text-2xl font-black tracking-tight text-foreground">Chamar Entregador</DialogTitle>
              <DialogDescription className="text-muted-foreground font-bold text-sm leading-relaxed mt-2">
                Informe o valor que será pago ao entregador por esta entrega. Este valor será visível para os motoboys da região.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-8 pt-6 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Valor da Entrega (R$)</label>
              {detectedRegion && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/5 border border-primary/10">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs font-bold text-primary">{detectedRegion}</span>
                  {loadingFee && <span className="text-xs text-muted-foreground ml-auto">Calculando...</span>}
                </div>
              )}
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center">
                   <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(applyMoneyMask(e.target.value))}
                  placeholder="0,00"
                  className="w-full h-16 pl-16 pr-6 rounded-[1.25rem] bg-secondary/30 border-2 border-transparent focus:border-primary/20 focus:bg-white transition-all text-2xl font-black tracking-tighter outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsDispatchModalOpen(false)}
                className="flex-1 h-14 rounded-2xl bg-secondary text-foreground font-black text-xs uppercase tracking-widest hover:bg-secondary/80 transition-all border border-border"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDispatch}
                disabled={createDeliveryMut.isPending}
                className="flex-[2] h-14 rounded-2xl bg-foreground text-background font-black text-xs uppercase tracking-widest hover:bg-foreground/90 transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {createDeliveryMut.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Confirmar Solicitação
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
        "bg-white border border-border/60 rounded-[1.5rem] p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30 group animate-in zoom-in-95 duration-300 relative overflow-hidden cursor-pointer",
        isPending && "border-warning/40 bg-warning/[0.02]"
      )}
      onClick={() => setIsModalOpen(true)}
      >
        {isPending && (
          <div className="absolute top-0 right-0 px-3 py-1 bg-warning text-white text-[8px] font-black uppercase tracking-widest rounded-bl-xl">
            Novo
          </div>
        )}

        {/* Header Compacto */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight opacity-60">ID Pedido</span>
            <p className="font-black text-lg text-foreground tracking-tight leading-none">#{order.id?.slice(-6).toUpperCase() || "..."}</p>
          </div>
          {!isPending && (
            <div className={cn("px-2 py-1 rounded-lg border-none font-black text-[9px] uppercase tracking-tighter", STATUS_COLORS[order.status])}>
               {STATUS_LABELS[order.status]}
            </div>
          )}
        </div>

        {/* Customer Info Compacto */}
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border/40">
          <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-foreground truncate leading-tight">{order.customer?.name}</p>
            <p className="text-[10px] text-primary font-bold flex items-center gap-1 mt-0.5">
               <Phone className="h-2.5 w-2.5" /> {order.customer?.phone}
            </p>
          </div>
        </div>

        {/* Info Row */}
        <div className="flex items-center gap-4 mb-3">
            <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-1">
              <Timer className="h-3 w-3" /> {age} min
            </p>
            <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate max-w-[100px]">{order.payment_method || 'Offline'}</p>
        </div>

        {/* Items List - Tight */}
        <div className="space-y-1.5 mb-4">
          {order.items && order.items.length > 0 ? (
            order.items.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className="font-black text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-md leading-none">{item.quantity}x</span>
                <span className="font-bold text-foreground/80 truncate leading-none">{item.product_name || item.products?.name}</span>
              </div>
            ))
          ) : (
            <p className="text-[10px] text-muted-foreground italic">Toque para detalhes...</p>
          )}
          {order.items && order.items.length > 3 && (
            <p className="text-[9px] text-primary font-black uppercase tracking-widest pl-1 mt-1">+ {order.items.length - 3} itens</p>
          )}
        </div>

        {/* Action & Price Footer */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-muted-foreground uppercase opacity-60">Total</span>
            <p className="text-lg font-black text-primary tracking-tighter italic leading-none">R$ {order.total.toFixed(2).replace(".", ",")}</p>
          </div>
          
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {isPending && (
              <button 
                onClick={onCancel}
                className="w-10 h-10 rounded-xl bg-destructive/5 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-all"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
            {action && (
              <button
                onClick={onAdvance}
                className={cn(
                  "flex-1 h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                  isPending 
                    ? "bg-primary text-white shadow-md shadow-primary/20" 
                    : "bg-foreground text-background"
                )}
              >
                {action.label}
                <ArrowRight className="h-3 w-3" />
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
