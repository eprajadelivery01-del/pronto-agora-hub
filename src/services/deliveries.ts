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
  cityId?: string;
}

export function useDeliveries(params?: UseDeliveriesParams) {
  const { status, search, companyId, driverId, dateFrom, dateTo, cityId, pageSize = 50, page = 0 } = params || {};

  return useQuery({
    queryKey: ["deliveries", status, search, companyId, driverId, dateFrom, dateTo, cityId, page, pageSize],
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
          price,
          commission,
          payment_method,
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
          companies!deliveries_company_id_fkey(name, phone),
          delivery_drivers(id, user_id, full_name, phone, vehicle_type, vehicle_plate)
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (status && status !== "all") {
        if (status === "completed") {
          query = query.or("status.eq.completed,status.eq.delivered");
        } else if (status === "in_route") {
          query = query.or("status.eq.in_route,status.eq.in_transit,status.eq.collecting");
        } else {
          query = query.eq("status", status);
        }
      }
      
      if (search) query = query.ilike("customer_name", `%${search}%`);
      if (companyId) query = query.eq("company_id", companyId);
      if (driverId) query = query.eq("driver_id", driverId);
      if (cityId) query = query.eq("city_id", cityId);
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

export function useDeliveryStats(params?: { companyId?: string; dateFrom?: string; dateTo?: string; cityId?: string }) {
  const { companyId, dateFrom, dateTo, cityId } = params || {};
  
  return useQuery({
    queryKey: ["delivery-stats", companyId, dateFrom, dateTo, cityId],
    queryFn: async () => {
      let query = supabase.from("deliveries").select("status, value, price, commission");

      if (dateFrom) {
        query = query.gte("created_at", new Date(dateFrom).toISOString());
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte("created_at", today.toISOString());
      }

      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte("created_at", end.toISOString());
      }

      if (companyId) {
        query = query.eq("company_id", companyId);
      }
      if (cityId) {
        query = query.eq("city_id", cityId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      let totalQuery = supabase.from("deliveries").select("id", { count: "exact", head: true });
      if (companyId) totalQuery = totalQuery.eq("company_id", companyId);
      if (cityId) totalQuery = totalQuery.eq("city_id", cityId);
      
      const [totalRes] = await Promise.all([totalQuery]);

      return {
        today: data.length,
        total: totalRes.count ?? 0,
        pending: data.filter((d) => d.status === "pending" || d.status === "broadcasted").length,
        inTransit: data.filter((d) => ["accepted", "collecting", "in_route", "in_transit"].includes(d.status)).length,
        delivered: data.filter((d) => d.status === "completed").length,
        cancelled: data.filter((d) => d.status === "cancelled").length,
        todayRevenue: data.filter((d) => d.status === "completed").reduce((sum, d) => sum + (Number((d as any).value) || Number((d as any).price) || 0), 0),
        todayCollection: data.filter((d) => d.status !== "cancelled").reduce((sum, d) => sum + (Number((d as any).value) || Number((d as any).price) || 0), 0),
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

  // 1.2 Busca a empresa para pegar as coordenadas de coleta
  let companyData = null;
  if (order.company_id) {
    const { data: comp } = await supabase
      .from("companies")
      .select("address, latitude, longitude")
      .eq("id", order.company_id)
      .maybeSingle();
    if (comp) companyData = comp;
  }

  // 2. VERIFICAÇÃO DE DUPLICIDADE: Verifica se já existe uma entrega ativa/existente para este pedido
  const { data: existingDeliveries } = await supabase
    .from("deliveries")
    .select("*")
    .eq("order_id", orderId)
    .not("status", "eq", "cancelled")
    .order("created_at", { ascending: false });

  const existingDelivery = existingDeliveries && existingDeliveries.length > 0 ? existingDeliveries[0] : null;

  const estimatedValue = Number(order.total || 0);
  const driverFee = customValue !== undefined && customValue !== null ? customValue : 0;

  if (existingDelivery) {
    console.log(`[Deliveries] Entrega já existe para o pedido ${orderId}. Atualizando para pending e retornando existente.`);
    
    // Atualizar o status para pending (caso estivesse como draft/hidden) e atualizar o valor
    await supabase.from("deliveries").update({ 
      status: "pending", 
      value: customValue !== undefined && customValue !== null ? customValue : existingDelivery.value,
      commission: customValue !== undefined && customValue !== null ? customValue : existingDelivery.commission,
      price: order.delivery_fee || existingDelivery.price || 0,
      estimated_value: estimatedValue
    }).eq("id", existingDelivery.id);

    // Assegurar que o pedido aponta para a entrega e atualiza status para delivering
    await supabase
      .from("orders")
      .update({ delivery_id: existingDelivery.id, status: 'delivering' } as any)
      .eq("id", orderId);

    return existingDelivery;
  }

  let rawPhone = customerData?.phone || (order as any).customer_phone || (order as any).customer?.phone || "";
  
  if (!rawPhone || rawPhone === "Não informado" || rawPhone.trim() === "") {
    const targetId = (order as any).user_id || (order as any).customer_id;
    if (targetId) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("phone")
        .or(`id.eq.${targetId},user_id.eq.${targetId}`)
        .maybeSingle();
      if (prof?.phone) {
        rawPhone = prof.phone;
      }
    }
  }

  let cleanPhone = rawPhone ? rawPhone.replace(/\D/g, "") : "";
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
      dropoff_address: dropoff,
      delivery_address: dropoff,
      value: driverFee,
      commission: driverFee,
      price: order.delivery_fee || 0,
      estimated_value: estimatedValue,
      notes: order.notes || null,
      region_id: (order as any).region_id || null,
      pickup_address: companyData?.address || "",
      pickup_latitude: companyData?.latitude || null,
      pickup_longitude: companyData?.longitude || null,
      delivery_latitude: (order as any).delivery_latitude || null,
      delivery_longitude: (order as any).delivery_longitude || null,
      status: "pending"
    })
    .select()
    .single();

  if (deliveryError) {
    console.error("[Deliveries] Erro na inserção da entrega:", deliveryError);
    throw deliveryError;
  }

  console.log(`[Deliveries] Entrega criada com ID: ${delivery.id}. Vinculando ao pedido...`);

  // 3. Associa a delivery_id ao pedido e marca status do pedido como delivering (Saiu para entrega)
  const { error: updateError } = await supabase
    .from("orders")
    .update({ delivery_id: delivery.id, status: 'delivering' } as any)
    .eq("id", orderId);

  if (updateError) {
    console.error("[Deliveries] Erro crítico ao associar delivery_id ao pedido:", updateError);
    // Mesmo que dê erro, retornamos a delivery, pois ela já foi criada e o motoboy pode aceitar,
    // mas o painel ficará dessincronizado se não tratarmos.
  }

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
    queryKey: ["order-delivery", orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data } = await supabase.from("orders").select("*, deliveries(id, status, driver_id, customer_name, address, value, price, commission, payment_method, created_at)").eq("id", orderId).single();
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
