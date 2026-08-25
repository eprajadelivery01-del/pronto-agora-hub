// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { supabase, isJwtExpiredError, withSessionRetry } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useCreateDeliveryRequest } from "@/services/deliveries";
import { calculateDeliveryFee } from "@/utils/freight";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { useAudioAlert, sendNativeDeviceNotification, requestNotificationPermission } from "@/hooks/useAudioAlert";
import { useCustomerPhone, formatPhoneNumber, cleanPhoneNumber } from "@/hooks/useCustomerPhone";

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

const ALLOWED_MANUAL_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "preparing",
  preparing: "ready",
  in_route: "delivered",
};

const getNextActions = (status: OrderStatus) => {
  const actions: Record<string, { label: string, next: OrderStatus }> = {
    pending: { label: "Aceitar Pedido", next: "preparing" },
    preparing: { label: "Marcar Pronto", next: "ready" },
    in_route: { label: "Finalizar", next: "delivered" },
  };
  return actions[status];
};

const COLUMNS: { key: OrderStatus; label: string; icon: any; color: string }[] = [
  { key: "pending", label: "Novos", icon: Bell, color: "warning" },
  { key: "preparing", label: "Em Preparo", icon: Package, color: "blue" },
  { key: "ready", label: "Prontos", icon: CheckCircle, color: "green" },
  { key: "in_route", label: "Em Rota", icon: Truck, color: "purple" },
];

export default function BusinessOrdersPage() {
  const { companyId, company, isLoading: companyLoading } = useCurrentCompany();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({ 
    pending: 0, 
    preparing: 0, 
    ready: 0, 
    in_route: 0, 
    revenue_today: 0, 
    open_total: 0,
    in_route_total: 0
  });
  const { playAlert, startLoop, stopLoop } = useAudioAlert();
  const createDeliveryMut = useCreateDeliveryRequest();
  
  // Controle Transacional Rigoroso
  const processingOrderIdsRef = useRef<Set<string>>(new Set());
  const [processingOrderIds, setProcessingOrderIds] = useState<Set<string>>(new Set());

  const acquireLock = (id: string) => {
    if (processingOrderIdsRef.current.has(id)) return false;
    processingOrderIdsRef.current.add(id);
    setProcessingOrderIds(new Set(processingOrderIdsRef.current));
    return true;
  };

  const releaseLock = (id: string) => {
    processingOrderIdsRef.current.delete(id);
    setProcessingOrderIds(new Set(processingOrderIdsRef.current));
  };

  // Prevenir Race Conditions no fetch
  const fetchIdRef = useRef(0);

  const fetchOrders = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    
    const currentFetchId = ++fetchIdRef.current;

    try {
      // setLoading(true); removido para evitar travamento da UI via Realtime

      const ORDERS_SELECT = `
          id, status, total, delivery_fee, created_at, customer_id, delivery_id,
          delivery_address, payment_method, notes, region_id,
          regions ( id, delivery_fee, price ),
          order_items (
            id, quantity, price, notes,
            products (id, name, image_url, description)
          )
        `;

      const runOrdersQuery = () =>
        supabase
          .from("orders")
          .select(ORDERS_SELECT)
          .eq("company_id", companyId)
          .neq("status", "cancelled")
          .order("created_at", { ascending: false });

      // BUSCA RESILIENTE: Campos operacionais (Após reparo SQL)
      let { data, error } = await withSessionRetry(runOrdersQuery);

      // Expiração de sessão não é falha de banco e nunca deve acionar a RPC.
      if (error && isJwtExpiredError(error)) {
        toast.error("Sua sessão expirou. Faça login novamente.");
        window.location.replace("/login");
        return;
      }

      if (error) {
        console.warn("[Painel] Query direta falhou, tentando CHAVE MESTRA (RPC)...", error.message);
        
        // Tentativa via RPC (Função de Banco que pula o RLS quebrado)
        let { data: rpcData, error: rpcError } = await withSessionRetry(() => supabase
          .rpc('get_business_orders_v2', { p_company_id: companyId }));

        if (rpcError && isJwtExpiredError(rpcError)) {
          toast.error("Sua sessão expirou. Faça login novamente.");
          window.location.replace("/login");
          return;
        }

        if (rpcError) {
          console.error("[Painel] Falha catastrófica: Nem a RPC funcionou.", rpcError);
          toast.error("Erro crítico de banco de dados. Contate o suporte.");
          return;
        }
        
        data = rpcData;
      }



      if (data && data.length > 0) {
        // 1. Extração IMEDIATA de todos os IDs necessários para busca paralela (customer_id e user_id)
        const customerIds = [...new Set(data.map((o: any) => o.customer_id))].filter(Boolean);
        const userIds = [...new Set(data.map((o: any) => o.user_id))].filter(Boolean);
        const orderIds = [...new Set(data.map((o: any) => o.id))].filter(Boolean);
        const deliveryIds = [...new Set(data.map((o: any) => o.delivery_id))].filter(Boolean);
        const addressIds = [...new Set(data.map((o: any) => o.address_id || o.delivery_address_id))].filter(Boolean);
        
        // Mapeamento preparado antecipadamente
        let customerMap: Record<string, any> = {};
        customerIds.forEach(id => { customerMap[id] = { id }; });
        userIds.forEach(id => { if (!customerMap[id]) customerMap[id] = { id }; });

        const allUserOrCustIds = [...new Set([...customerIds, ...userIds])];

        // 2. BUSCA PARALELA (Busca entregas por delivery_id E TAMBÉM por order_id para resiliência total)
        const deliveriesQuery = orderIds.length > 0
          ? supabase.from("deliveries").select("id, order_id, address, customer_name, customer_phone, status").or(`id.in.(${[...deliveryIds, '00000000-0000-0000-0000-000000000000'].join(',')}),order_id.in.(${orderIds.join(',')})`)
          : Promise.resolve({ data: [] });

        const [customersRes, deliveriesRes, addressesRes, profilesRes] = await Promise.all([
          customerIds.length > 0 ? supabase.from("customers").select("id, name, phone, user_id").in("id", customerIds) : Promise.resolve({ data: [] }),
          deliveriesQuery,
          addressIds.length > 0 ? supabase.from("addresses").select("*").in("id", addressIds) : Promise.resolve({ data: [] }),
          allUserOrCustIds.length > 0 ? supabase.from("profiles").select("id, full_name, phone, user_id").or(`id.in.(${allUserOrCustIds.join(',')}),user_id.in.(${allUserOrCustIds.join(',')})`) : Promise.resolve({ data: [] })
        ]);

        let profileMap: Record<string, any> = {};
        if (profilesRes.data) {
          profilesRes.data.forEach((p: any) => {
            if (p.id) profileMap[p.id] = p;
            if (p.user_id) profileMap[p.user_id] = p;
          });
        }

        // 3. Processamento de Clientes (Base Principal)
        if (customersRes.data) {
          customersRes.data.forEach(c => {
            const isGeneric = !c.name || c.name === "Cliente Marketplace" || c.name === "Consumidor";
            customerMap[c.id] = { ...customerMap[c.id], ...c, name: isGeneric ? null : c.name };
            if (c.user_id && !customerMap[c.user_id]) {
              customerMap[c.user_id] = customerMap[c.id];
            }
          });
        }

        // 4. Processamento de Entregas (Fallback de Endereço, Nome e Mapeamento de Status por ID e por Order ID)
        let deliveryStatusMap: Record<string, string> = {};
        if (deliveriesRes.data) {
          deliveriesRes.data.forEach(d => {
            if (d.id) deliveryStatusMap[d.id] = d.status;
            if (d.order_id && d.status !== 'cancelled') deliveryStatusMap[d.order_id] = d.status;
            
            const order = data.find((o: any) => o.delivery_id === d.id || o.id === d.order_id);
            if (order) {
              const targetKey = order.customer_id || order.user_id;
              if (targetKey && customerMap[targetKey]) {
                customerMap[targetKey].address = d.address;
                if (!customerMap[targetKey].name && d.customer_name) {
                  customerMap[targetKey].name = d.customer_name;
                }
                const delPhone = cleanPhoneNumber(d.customer_phone);
                if ((!customerMap[targetKey].phone || customerMap[targetKey].phone === "Não informado") && delPhone) {
                  customerMap[targetKey].phone = delPhone;
                }
              }
            }
          });
        }

        // 5. Processamento de Endereços Opcionais
        if (addressesRes.data) {
          addressesRes.data.forEach(a => {
            const targetKey = a.customer_id || a.user_id;
            if (targetKey && customerMap[targetKey] && !customerMap[targetKey].address) {
              customerMap[targetKey].address = `${a.street}, ${a.number}${a.complement ? ` - ${a.complement}` : ""} - ${a.neighborhood}, ${a.city}`;
            }
          });
        }

        // 6. Integração Total de PROFILES (Fallback robusto por user_id e customer_id)
        data.forEach((o: any) => {
          const cId = o.customer_id;
          const uId = o.user_id;
          const targetObj = customerMap[cId] || customerMap[uId] || {};
          const prof = profileMap[uId] || profileMap[cId];

          if (prof) {
            if (!targetObj.name || targetObj.name === "Cliente Marketplace") {
              targetObj.name = prof.full_name || targetObj.name;
            }
            const profPhone = cleanPhoneNumber(prof.phone);
            if ((!targetObj.phone || targetObj.phone === "Não informado") && profPhone) {
              targetObj.phone = profPhone;
            }
          }

          const directOrderPhone = cleanPhoneNumber(o.customer_phone);
          if ((!targetObj.phone || targetObj.phone === "Não informado") && directOrderPhone) {
            targetObj.phone = directOrderPhone;
          }

          if (cId) customerMap[cId] = targetObj;
          if (uId) customerMap[uId] = targetObj;
        });

        const isToday = (dateString: string | null) => {
          if (!dateString) return false;
          const d = new Date(dateString);
          const today = new Date();
          return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        };
        
        // 1. First map all data to compute real statuses (including resilience checks)
        const mappedRaw = data.map((o: any) => {
          const customerDataFromMap = customerMap[o.customer_id] || customerMap[o.user_id] || {};
          const prof = profileMap[o.user_id] || profileMap[o.customer_id];
          
          const cleanVal = (val: string | null | undefined, placeholder: string) => {
            if (!val) return null;
            const v = String(val).trim();
            if (v === "" || v.toLowerCase() === placeholder.toLowerCase() || v.toLowerCase() === "null" || v.toLowerCase() === "undefined" || v.toLowerCase() === "consumidor" || v === "Não informado") return null;
            return v;
          };

          const finalName = cleanVal(customerDataFromMap.name, "Cliente Marketplace") || cleanVal(prof?.full_name, "Cliente Marketplace") || cleanVal(o.customer_name, "Cliente Marketplace") || cleanVal(o.customers?.name, "Cliente Marketplace") || "Cliente Marketplace";
          const finalPhone = cleanVal(customerDataFromMap.phone, "Não informado") || cleanVal(o.customer_phone, "Não informado") || cleanVal(prof?.phone, "Não informado") || cleanVal(o.customers?.phone, "Não informado") || "Não informado";

          const deliveryStatus = (o.delivery_id ? deliveryStatusMap[o.delivery_id] : null) || deliveryStatusMap[o.id] || null;
          let computedStatus = o.status;

          // 🔥 RESILIÊNCIA E CORREÇÃO DAS ABAS (Prontos vs Em Rota):
          // - Se o pedido no banco for "cancelled", MANTÉM "cancelled" e remove do Kanban do Lojista.
          // - Se a entrega já foi concluída, o pedido é "delivered".
          // - Se a entrega está em trânsito/rua ("in_route", "in_transit"), o pedido é "in_route".
          // - Se a entrega foi criada/aceita/em coleta ("pending", "draft", "broadcasted", "accepted", "collecting"), o pedido é "ready" (Pronto aguardando coleta).
          if (o.status === "cancelled") {
            computedStatus = "cancelled";
          } else if (deliveryStatus === "completed" || deliveryStatus === "delivered") {
            computedStatus = "delivered";
          } else if (deliveryStatus === "in_route" || deliveryStatus === "in_transit") {
            computedStatus = "in_route";
          } else if (deliveryStatus && ["pending", "draft", "broadcasted", "accepted", "collecting"].includes(deliveryStatus)) {
            computedStatus = "ready";
          }

          return {
            ...o,
            status: computedStatus,
            customer: {
              name: finalName,
              phone: finalPhone,
              address: o.delivery_address || o.address || customerDataFromMap.address || "Endereço não disponível"
            },
            items: o.order_items || []
          };
        });

        // 2. Now filter based on the COMPUTED status
        const mapped = mappedRaw.filter((o: any) => {
          if (o.status === "cancelled") return false;
          if (["completed", "delivered"].includes(o.status)) return false;
          return true;
        });
        
        // Se este fetch não é o mais recente, ignorar! (Previne regressão de status por respostas lentas)
        if (currentFetchId !== fetchIdRef.current) return;

        setOrders(mapped);
        
        const openOrders = mapped.filter(o => ["pending", "accepted", "preparing", "ready"].includes(o.status));
        const inRouteOrders = mapped.filter(o => o.status === "in_route");
        // Receita de hoje: pedidos concluídos/entregues cuja atualização final (ou criação) foi hoje
        const deliveredToday = data.filter(o => 
          ["completed", "delivered"].includes(o.status) && 
          (isToday(o.created_at) || isToday(o.updated_at))
        );

        const computeOrderTotal = (o: any) => {
          const itemsSum = (o.items || o.order_items || []).reduce((acc: number, curr: any) => acc + ((curr.price || curr.unit_price || 0) * curr.quantity), 0);
          return itemsSum + (Number(o.delivery_fee) || 0);
        };

        setStats({
          pending: mapped.filter(o => o.status === "pending" || !["accepted", "preparing", "ready", "in_route", "completed", "delivered", "cancelled"].includes(o.status)).length,
          preparing: mapped.filter(o => ["accepted", "preparing"].includes(o.status)).length,
          ready: mapped.filter(o => o.status === "ready").length,
          in_route: inRouteOrders.length,
          revenue_today: deliveredToday.reduce((acc, o) => acc + computeOrderTotal(o), 0),
          open_total: openOrders.reduce((acc, o) => acc + computeOrderTotal(o), 0),
          in_route_total: inRouteOrders.reduce((acc, o) => acc + computeOrderTotal(o), 0),
        });

        // Remover log com dados sensíveis do console.
      } else {
        if (currentFetchId !== fetchIdRef.current) return;
        setOrders([]);
        setStats({ pending: 0, preparing: 0, ready: 0, in_route: 0, revenue_today: 0, open_total: 0, in_route_total: 0 });
      }
    } catch (err: any) {
      if (currentFetchId !== fetchIdRef.current) return;
      console.error("[Painel] Falha catastrófica no fetchOrders:", err);
      toast.error("Ocorreu um erro ao processar os dados.");
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      fetchOrders();

      // 1. Ouve os disparos de alerta/som para atualizar a tela no exato instante da notificação
      const handleAlertRefresh = () => {
        fetchOrders();
      };
      window.addEventListener('epraja-order-alert-triggered', handleAlertRefresh);

      // 2. Atualiza ao voltar o foco para a aba
      window.addEventListener('focus', handleAlertRefresh);

      // 3. Polling de resiliência a cada 8s para garantir sincronia do Kanban sem refresh manual
      const interval = setInterval(() => {
        fetchOrders();
      }, 8000);

      return () => {
        window.removeEventListener('epraja-order-alert-triggered', handleAlertRefresh);
        window.removeEventListener('focus', handleAlertRefresh);
        clearInterval(interval);
      };
    } else if (!companyLoading) {
      // Sem empresa vinculada — encerra o skeleton imediatamente
      setLoading(false);
    }
  }, [companyId, companyLoading, fetchOrders]);

  const handleMute = () => {
    stopLoop();
  };

  // Realtime subscription com resiliência total para orders e deliveries
  useEffect(() => {
    if (!companyId) return;
    const channelName = `business-orders-${companyId}-${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `company_id=eq.${companyId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            playAlert();
            startLoop();
            sendNativeDeviceNotification("📦 NOVO PEDIDO RECEBIDO! 🛎️", {
              body: `Novo pedido no marketplace! Acesse o painel para aceitar.`,
              tag: `order-${payload.new?.id || Date.now()}`,
            });
            toast.success("📦 NOVO PEDIDO RECEBIDO!", {
              description: "Novo pedido recebido no marketplace. Acesse para aceitar.",
              duration: 10000
            });
          }
          fetchOrders();
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" },
        () => {
          fetchOrders();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, fetchOrders]);

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    if (!acquireLock(orderId)) return false;
    
    const currentOrder = orders.find(o => o.id === orderId);

    if (!currentOrder) {
      toast.warning("Pedido não encontrado. A lista será sincronizada.");
      fetchOrders();
      releaseLock(orderId);
      return false;
    }

    const expectedStatus = currentOrder.status;
    const allowedNextStatus = ALLOWED_MANUAL_TRANSITIONS[expectedStatus];

    // CAMADA 1: Whitelist (Impede Pulo Lógico)
    if (newStatus !== "cancelled" && (!allowedNextStatus || allowedNextStatus !== newStatus)) {
      console.error("[KANBAN] Transição bloqueada:", {
        orderId,
        expectedStatus,
        attemptedStatus: newStatus,
      });

      toast.error(`Transição de pedido não permitida: ${STATUS_LABELS[expectedStatus] || expectedStatus} → ${STATUS_LABELS[newStatus] || newStatus}`);
      fetchOrders();
      return false;
    }

    try {
      // CAMADA 2: Compare-and-Set (Impede Race Condition)
      const { data, error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId)
        .eq("status", expectedStatus)
        .select("id, status, customer_id, user_id")
        .maybeSingle();

      if (error || !data) {
        toast.warning("O status deste pedido foi atualizado em outra sessão. A lista foi sincronizada.");
        fetchOrders();
        return false;
      }

      const targetCustomerId = data?.customer_id || currentOrder?.customer_id || (currentOrder as any)?.user_id;
      const targetUserId = data?.user_id || (currentOrder as any)?.user_id || data?.customer_id || currentOrder?.customer_id;

      console.log(`[notify-customer] ENVIANDO PUSH PARA O PEDIDO #${orderId.slice(0, 6).toUpperCase()} | customer_id: ${targetCustomerId} | status: ${newStatus}`);

      // Dispara notificação de status diretamente para o celular do cliente (send-push e notify-customer)
      const statusTitleMap: Record<string, string> = {
        confirmed: '✅ Pedido confirmado!',
        preparing: '👨‍🍳 Preparando seu pedido',
        ready: '📦 Pedido pronto!',
        accepted: '🛵 Entregador a caminho!',
        delivering: '🛵 Saiu para entrega!',
        in_route: '🛵 Saiu para entrega!',
        delivered: '🎉 Pedido entregue!',
        cancelled: '❌ Pedido cancelado'
      };
      const notifTitle = statusTitleMap[newStatus] || `Atualização no Pedido`;
      const notifBody = `Seu pedido #${orderId.slice(0, 8).toUpperCase()} foi atualizado: ${STATUS_LABELS[newStatus] || newStatus}`;

      // Notificação de status gerenciada automaticamente pelo banco via Trigger tr_order_update_push_notification.
      // Desativamos a chamada manual frontend para evitar duplicidade na central de notificações.
      /*
      Promise.allSettled([
        supabase.functions.invoke('send-push', {
          body: {
            orderId: orderId,
            status: newStatus,
            title: notifTitle,
            body: notifBody,
            customerId: targetCustomerId,
            userId: targetUserId
          }
        }),
        supabase.functions.invoke('notify-customer', {
          body: {
            orderId: orderId,
            order_id: orderId,
            status: newStatus,
            deliveryStatus: newStatus,
            customer_id: targetCustomerId,
            user_id: targetUserId,
            record: {
              id: orderId,
              status: newStatus,
              customer_id: targetCustomerId,
              user_id: targetUserId
            },
            old_record: { status: expectedStatus }
          }
        })
      ]).then(results => {
        console.log(`[push-notification] Notificações disparadas para o pedido #${orderId.slice(0, 6).toUpperCase()}:`, results);
      }).catch(e => console.warn(`[push-notification] Erro ao notificar cliente:`, e));
      */

      toast.success(`Pedido movido para: ${STATUS_LABELS[newStatus]}`);
      fetchOrders();
      return true;
    } catch (err: any) {
      toast.error("Erro crítico: " + (err?.message || "desconhecido"));
      return false;
    } finally {
      releaseLock(orderId);
    }
  };

  const handleDispatch = async (order: Order) => {
    if (!acquireLock(order.id)) return;
    
    // 🛡️ VERIFICAÇÃO INTELIGENTE DE DUPLICIDADE (Resiliente)
    if (order.delivery_id) {
      
      const { data: delivery, error } = await supabase
        .from('deliveries')
        .select('status')
        .eq('id', order.delivery_id)
        .maybeSingle();

      // Se a entrega não existe (órfã) ou já foi cancelada, limpamos o vínculo e permitimos novo despacho
      if (!delivery || delivery.status === 'cancelled') {
        
        // Limpamos no banco de dados para evitar recorrência
        await supabase
          .from('orders')
          .update({ delivery_id: null } as any)
          .eq('id', order.id);
          
        // Atualizamos localmente para permitir a abertura do modal sem refresh
        order.delivery_id = null;
      } else if (delivery.status === 'pending' || delivery.status === 'broadcasted') {
        toast.success("Buscando entregador parceiro na região...");
        fetchOrders();
        return;
      } else {
        toast.info("A entrega já está em andamento com um entregador.");
        fetchOrders();
        return;
      }
    }

    // Puxa o valor da TAXA BASE DA REGIÃO (Admin Fee) para pagar o motoboy, preservando o lucro do lojista
    // NOVA REGRA: Se houver admin_delivery_fee fixo para esta loja, usa ele! Caso contrário usa a matriz/região.
    let preCalculatedFee = company?.admin_delivery_fee ?? (order as any).regions?.delivery_fee ?? (order as any).regions?.price;
    
    // Fallback: caso a região não venha vinculada, tenta achar pelo valor da entrega original
    if (preCalculatedFee === undefined || preCalculatedFee === null) {
      preCalculatedFee = (order as any).delivery_fee;
      
      if (preCalculatedFee === undefined || preCalculatedFee === null) {
        if (order.total && order.items && order.items.length > 0) {
          const itemsTotal = order.items.reduce((sum: number, item: any) => sum + (Number(item.price) * Number(item.quantity)), 0);
          const diff = Number(order.total) - itemsTotal;
          preCalculatedFee = diff > 0 ? diff : 0;
        } else {
          preCalculatedFee = 0;
        }
      }
    }
    
    let finalFee = Number(preCalculatedFee) || 0;

    // Só tenta calcular frete automático se o pedido não tiver taxa cobrada
    if (finalFee === 0 && order.delivery_address) {
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
          const result = await calculateDeliveryFee(lat, lng, supabase, company?.delivery_regions_pricing);
          if (result.fee !== null && !result.isOutOfRange) {
            finalFee = result.fee;
          }
        }
      } catch (err: any) {
        console.warn('[Painel] Não foi possível calcular frete automático:', err?.message);
      }
    }

    // Validação Defensiva Pré-vôo
    const { data: currentOrder, error: currentOrderError } = await supabase
      .from('orders')
      .select('status, delivery_id')
      .eq('id', order.id)
      .maybeSingle();

    if (currentOrderError) {
      toast.error("Não foi possível validar o pedido no servidor. Nenhuma solicitação enviada.");
      return;
    }

    if (!currentOrder || currentOrder.status !== "ready" || currentOrder.delivery_id) {
      toast.warning("Não é possível chamar entregador: o pedido foi alterado ou já possui entrega.");
      fetchOrders();
      return;
    }

    if (isNaN(finalFee) || finalFee < 0) {
      toast.error("Erro no cálculo da taxa de entrega.");
      return;
    }

    try {
      toast.info("Solicitando entregador...", { id: "dispatch" });
      
      await createDeliveryMut.mutateAsync({ 
        orderId: order.id, 
        customValue: finalFee 
      });
      
      toast.success("🚚 Entregador Solicitado! Aguardando aceite.", { id: "dispatch" });
      fetchOrders();
    } catch (err: any) {
      console.error("[Painel] Erro ao despachar:", err);
      toast.error(`Falha ao despachar: ${err.message}`, { id: "dispatch" });
    } finally {
      releaseLock(order.id);
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

  if (loading || companyLoading) {

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
          
          {orders.some(o => o.status === "pending") && (
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
                 <Package className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                 <p className="text-2xl font-black text-foreground tracking-tight">{stats.preparing}</p>
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Em Preparo</p>
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
                    isProcessing={processingOrderIds.has(order.id)}
                    onAdvance={async () => {
                      const action = getNextActions(order.status);
                      if (action && action.next) {
                        await updateStatus(order.id, action.next);
                      }
                    }}
                    onDispatch={async () => {
                      const { data: realOrder } = await supabase.from('orders').select('status, delivery_id').eq('id', order.id).maybeSingle();
                      if (!realOrder || realOrder.status !== "ready") {
                        toast.warning("O status foi alterado. Lista sincronizada.");
                        fetchOrders();
                        return;
                      }
                      if (realOrder.delivery_id) {
                        toast.info("Já existe entrega vinculada.");
                        fetchOrders();
                        return;
                      }
                      await handleDispatch(order);
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

function OrderCard({ order, isProcessing, onAdvance, onDispatch, onCancel, onRefresh, action, updateStatus }: {
  order: Order;
  isProcessing?: boolean;
  onAdvance: () => void;
  onDispatch: () => void;
  onCancel: () => void;
  onRefresh: () => void;
  action: { label: string, next: OrderStatus } | null;
  updateStatus: (orderId: string, status: OrderStatus) => Promise<boolean>;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const age = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const isPending = order.status === "pending";

  return (
    <>
      <div className={cn(
        "bg-card border border-border/60 rounded-[1.5rem] p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30 group animate-in zoom-in-95 duration-300 relative overflow-hidden cursor-pointer",
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
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-foreground truncate leading-tight">
              {order.customer?.name || "Cliente Marketplace"}
            </p>
            {order.customer?.phone && order.customer.phone !== "Não informado" ? (
              <a 
                href={`https://wa.me/55${order.customer.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] text-primary font-black flex items-center gap-1 mt-1 hover:underline cursor-pointer bg-primary/10 px-2 py-0.5 rounded-lg w-fit"
                title="Clique para abrir WhatsApp"
              >
                 <Phone className="h-3 w-3 text-primary shrink-0" />
                 <span>{formatPhoneNumber(order.customer.phone) || order.customer.phone}</span>
              </a>
            ) : (
              <p className="text-[10px] text-muted-foreground/60 font-bold flex items-center gap-1 mt-0.5">
                 <Phone className="h-2.5 w-2.5" /> Sem telefone
              </p>
            )}
          </div>
        </div>

        {/* Info Row */}
        <div className="flex items-center gap-4 mb-3">
            <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-1">
              <Timer className="h-3 w-3" /> {age} min
            </p>
            <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate max-w-[100px]">
              {order.payment_method === 'money' || order.payment_method === 'cash' ? 'Dinheiro' : 
               order.payment_method === 'pix' ? 'Pix' : 
               order.payment_method === 'credit_card' ? 'Cartão de Crédito' : 
               order.payment_method === 'debit_card' ? 'Cartão de Débito' :
               order.payment_method === 'card' ? 'Cartão' : 
               order.payment_method === 'machine' ? 'Máquina Móvel' :
               order.payment_method === 'online' ? 'Online' :
               order.payment_method === 'voucher' ? 'Vale Refeição' :
               order.payment_method || 'Presencial'}
            </p>
        </div>

        {/* Items List - Tight */}
        <div className="space-y-1.5 mb-4">
          {order.items && order.items.length > 0 ? (
            order.items.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex flex-col text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-black text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-md leading-none">{item.quantity}x</span>
                  <span className="font-bold text-foreground/80 truncate leading-none">{item.product_name || item.products?.name}</span>
                </div>
                {item.notes && (
                  <span className="text-[10px] text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30 px-1.5 py-0.5 rounded mt-0.5 ml-8 self-start font-medium border border-amber-200/50 dark:border-amber-800/30">
                    <span className="font-bold text-amber-800 dark:text-amber-200">Obs:</span> {item.notes}
                  </span>
                )}
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
            <p className="text-lg font-black text-primary tracking-tighter italic leading-none">R$ {((order.items?.reduce((acc, curr) => acc + ((curr.price || curr.unit_price || 0) * curr.quantity), 0) || 0) + (order.delivery_fee || 0)).toFixed(2).replace(".", ",")}</p>
          </div>
          
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {isPending && (
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); onCancel(); }}
                disabled={isProcessing}
                className="w-10 h-10 rounded-xl bg-destructive/5 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-all disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
            {order.status === "ready" && !order.delivery_id && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDispatch(); }}
                disabled={isProcessing}
                className="flex-1 h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-foreground text-background disabled:opacity-50"
              >
                {isProcessing ? "Aguarde..." : "Chamar Entregador"}
                {!isProcessing && <Truck className="h-3 w-3" />}
              </button>
            )}
            {action && (!order.delivery_id || action.next !== "delivered") && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAdvance(); }}
                disabled={isProcessing}
                className={cn(
                  "flex-1 h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50",
                  isPending 
                    ? "bg-primary text-white shadow-md shadow-primary/20" 
                    : "bg-foreground text-background"
                )}
              >
                {isProcessing ? "Aguarde..." : action.label}
                {!isProcessing && <ArrowRight className="h-3 w-3" />}
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
        onDispatch={onDispatch}
      />
    </>
  );
}
