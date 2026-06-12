import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import type { DeliveryStatus } from "@/types/models";

export interface DeliveryWithRelations {
  id: string;
  company_id: string | null;
  driver_id: string | null;
  customer_name: string | null;
  address: string;
  value: number | null;
  status: DeliveryStatus;
  created_at: string;
  updated_at: string;
  companies?: { name: string; phone: string | null } | null;
  delivery_drivers?: { 
    id: string; 
    user_id: string; 
    vehicle: string;
    profiles?: { full_name: string; phone: string | null } | null;
  } | null;
  pickup_latitude?: number | null;
  pickup_longitude?: number | null;
  dropoff_address?: string | null;
  price?: number | null;
  notes?: string | null;
  accepted_at?: string | null;
  collected_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  [key: string]: any;
}

interface UseDeliveriesParams {
  status?: string;
  search?: string;
  companyId?: string;
  driverId?: string;
  dateFrom?: string;
  dateTo?: string;
  pageSize?: number;
  page?: number;
}

export function useDeliveries(params?: UseDeliveriesParams) {
  const { status, search, companyId, driverId, dateFrom, dateTo, pageSize = 50, page = 0 } = params || {};

  return useQuery({
    queryKey: ["deliveries", status, search, companyId, driverId, dateFrom, dateTo, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from("deliveries")
        .select(`
          id, 
          company_id, 
          driver_id, 
          customer_name, 
          address, 
          value, 
          status, 
          created_at, 
          updated_at, 
          region_id,
          notes,
          estimated_value,
          orders(
            total,
            order_items(quantity, price, products(name))
          ),
          companies(name, phone),
          delivery_drivers(id, user_id, full_name, phone, vehicle_type, vehicle_plate)
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (status && status !== "all") query = query.eq("status", status as any);
      
      if (search) {
        // Multi-column search for better UX
        query = query.or(`customer_name.ilike.%${search}%,address.ilike.%${search}%,dropoff_address.ilike.%${search}%`);
      }
      if (companyId) query = query.eq("company_id", companyId);
      if (driverId) query = query.eq("driver_id", driverId);
      if (dateFrom) query = query.gte("created_at", new Date(dateFrom).toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte("created_at", end.toISOString());
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const filteredData = (data ?? []).filter((d: any) => d.notes !== "Cancelamento automático de entrega prematura");

      const mappedData = filteredData.map((delivery: any) => {
        if (delivery.delivery_drivers) {
          const dd = delivery.delivery_drivers;
          return {
            ...delivery,
            delivery_drivers: {
              ...dd,
              vehicle: dd.vehicle_type || dd.vehicle_plate || "Veículo não inf.",
              profiles: {
                full_name: dd.full_name || "Entregador Atribuído",
                phone: dd.phone || null
              }
            }
          };
        }
        return delivery;
      });

      return { data: mappedData as unknown as DeliveryWithRelations[], count: count || 0 };
    },
  });
}

export function useDeliveryStats(params?: { companyId?: string }) {
  const { companyId } = params || {};
  
  return useQuery({
    queryKey: ["delivery-stats", companyId],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let query = supabase
        .from("deliveries")
        .select("status, value")
        .gte("created_at", today.toISOString());

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const [totalRes] = await Promise.all([
        supabase.from("deliveries").select("id", { count: "exact", head: true }).match(companyId ? { company_id: companyId } : {}),
      ]);

      return {
        today: data.length,
        total: totalRes.count ?? 0,
        pending: data.filter((d) => d.status === "pending" || d.status === "broadcasted").length,
        inTransit: data.filter((d) => ["accepted", "collecting", "in_route", "in_transit"].includes(d.status)).length,
        delivered: data.filter((d) => d.status === "completed").length,
        cancelled: data.filter((d) => d.status === "cancelled").length,
        todayRevenue: data.filter((d) => d.status === "completed").reduce((sum, d) => sum + Number((d as any).value ?? 0), 0),
        todayCollection: data.filter((d) => d.status !== "cancelled").reduce((sum, d) => sum + Number((d as any).value ?? 0), 0),
      };
    },
    refetchInterval: 30000,
  });
}

export function useUpdateDeliveryStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DeliveryStatus }) => {
      const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("deliveries").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-stats"] });
    },
  });
}

export function useReassignDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, driverId }: { id: string; driverId: string | null }) => {
      const { error } = await supabase.from("deliveries").update({ driver_id: driverId, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deliveries"] }),
  });
}

/**
 * INTEGRAÇÕES COM PAINEL LOJISTA (iFood Style)
 */
export async function createDeliveryRequest({ orderId, customValue }: { orderId: string, customValue?: number }) {
  console.log(`[Deliveries] Iniciando criação de entrega para pedido: ${orderId} (Valor customizado: ${customValue || 'Não'})`);
  
  // 1. Puxa os dados do pedido (Sem Joins problemáticos)
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*") 
    .eq("id", orderId)
    .single();

  if (orderError) {
    console.error("[Deliveries] Erro ao buscar pedido:", orderError);
    throw orderError;
  }
  if (!order) throw new Error("Pedido não encontrado");

  // 1.1 Busca o cliente separadamente (Resiliente)
  let customerData = null;
  if (order.customer_id) {
    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, phone")
      .eq("id", order.customer_id)
      .maybeSingle();
    if (customer) customerData = customer;
  }
  
  if (!customerData && (order as any).user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .eq("id", (order as any).user_id)
      .maybeSingle();
    if (profile) customerData = { id: profile.id, name: profile.full_name, phone: profile.phone };
  }

  // Utilizamos preferencialmente o delivery_address que veio do Checkout.
  // Caso não exista, tentamos puxar o endereço padrão do customer, mas no nosso fluxo o Cliente já salva na Order.
  let dropoff = (order as any).delivery_address;
  
  if (!dropoff && (order as any).address_id) {
    const { data: address } = await supabase
      .from("addresses")
      .select("*")
      .eq("id", (order as any).address_id)
      .maybeSingle();
    if (address) dropoff = `${address.street}, ${address.number}${address.complement ? ' - ' + address.complement : ''} - ${address.neighborhood}`;
  }
  
  if (!dropoff && order.customer_id) {
    const { data: address } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", order.customer_id)
      .maybeSingle();

    if (address) {
       dropoff = `${address.street}, ${address.number}${address.complement ? ' - ' + address.complement : ''} - ${address.neighborhood}`;
    }
  }
  
  if (!dropoff && (order as any).user_id) {
    const { data: address } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", (order as any).user_id)
      .maybeSingle();

    if (address) {
       dropoff = `${address.street}, ${address.number}${address.complement ? ' - ' + address.complement : ''} - ${address.neighborhood}`;
    }
  }
  
  if (!dropoff) dropoff = "Retirada no Local ou Endereço Inválido";

  // 2. VERIFICAÇÃO DE DUPLICIDADE: Verifica se já existe uma entrega para este pedido
  const { data: existingDelivery } = await supabase
    .from("deliveries")
    .select("*")
    .eq("order_id", orderId)
    .not("status", "eq", "cancelled")
    .maybeSingle();

  if (existingDelivery) {
    console.log(`[Deliveries] Entrega já existe para o pedido ${orderId}. Atualizando para pending e retornando existente.`);
    
    // Atualizar o status para pending (caso estivesse como draft/hidden) e atualizar o valor
    await supabase.from("deliveries").update({ 
      status: "pending", 
      value: customValue !== undefined && customValue !== null ? customValue : existingDelivery.value 
    }).eq("id", existingDelivery.id);

    // Assegurar que o pedido aponta para a entrega corretamente
    await supabase
      .from("orders")
      .update({ delivery_id: existingDelivery.id, status: "ready" } as any)
      .eq("id", orderId);

    return existingDelivery;
  }

  const rawPhone = customerData?.phone || (order as any).customer_phone || "";
  let cleanPhone = rawPhone.replace(/\D/g, "");
  if (cleanPhone.startsWith("55") && (cleanPhone.length === 12 || cleanPhone.length === 13)) {
    cleanPhone = cleanPhone.substring(2);
  }

  // 3. Cria a entrega vinculada
  const { data: delivery, error: deliveryError } = await supabase
    .from("deliveries")
    .insert({
      company_id: order.company_id,
      order_id: orderId,
      customer_name: customerData?.name || (order as any).customer_name || "Cliente Marketplace",
      customer_phone: cleanPhone || null,
      address: dropoff,
      value: customValue !== undefined && customValue !== null ? customValue : 0,
      status: "pending"
    })
    .select()
    .single();

  if (deliveryError) {
    console.error("[Deliveries] Erro na inserção da entrega:", deliveryError);
    throw deliveryError;
  }

  console.log(`[Deliveries] Entrega criada com ID: ${delivery.id}. Vinculando ao pedido...`);

  // 3. Associa a delivery_id ao pedido e muda o status para 'ready' para aguardar o entregador
  await supabase
    .from("orders")
    .update({ delivery_id: delivery.id, status: "ready" } as any)
    .eq("id", orderId);

  return delivery;
}

export function useCreateDeliveryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createDeliveryRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

import { useEffect } from "react";
export function useDeliveryTracking(orderId?: string | null) {
  const qc = useQueryClient();

  const { data: order } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data } = await supabase.from("orders").select("*, deliveries(id, status, driver_id, customer_name, address, value, created_at)").eq("id", orderId).single();
      return data;
    },
    enabled: !!orderId,
  });

  const deliveryId = (order as any)?.delivery_id;

  useEffect(() => {
    if (!deliveryId) return;
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Math.random().toString(36).substring(2, 11);

    const channel = supabase
      .channel(`delivery-tracker-${deliveryId}-${uuid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries", filter: `id=eq.${deliveryId}` },
        () => qc.invalidateQueries({ queryKey: ["order", orderId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [deliveryId, orderId, qc]);

  return { order, delivery: (order as any)?.deliveries };
}
