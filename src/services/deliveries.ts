import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  // Extended fields (may exist in DB but not in generated types)
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
        .select("id, company_id, driver_id, customer_name, address, value, estimated_value, status, created_at, updated_at, notes, pickup_address, dropoff_address, companies(name, phone)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (status && status !== "all") query = query.eq("status", status as any);
      if (search) query = query.ilike("customer_name", `%${search}%`);
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
      return { data: (data ?? []) as DeliveryWithRelations[], count: count || 0 };
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
        .select("status, value, estimated_value")
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
        todayCollection: data.filter((d) => d.status !== "cancelled").reduce((sum, d) => sum + Number((d as any).estimated_value ?? 0), 0),
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
    customerData = customer;
  }


  // Utilizamos preferencialmente o delivery_address que veio do Checkout.
  // Caso não exista, tentamos puxar o endereço padrão do customer, mas no nosso fluxo o Cliente já salva na Order.
  let dropoff = (order as any).delivery_address;
  
  if (!dropoff && order.customer_id) {
    const { data: address } = await supabase
      .from("addresses")
      .select("*")
      .eq("customer_id", order.customer_id)
      .maybeSingle();

    if (address) {
       dropoff = `${address.street}, ${address.number} - ${address.neighborhood}`;
    }
  }
  
  if (!dropoff) dropoff = "Retirada no Local ou Endereço Inválido";

  // 2. Insere na tabela de deliveries
  console.log(`[Deliveries] Criando registro na tabela de Entregas para ${customerData?.name || "Cliente"}...`);
  const { data: delivery, error: deliveryError } = await supabase
    .from("deliveries")
    .insert({
      company_id: order.company_id,
      customer_name: customerData?.name || order.customer_name || "Cliente Marketplace",
      address: dropoff,
      value: customValue || order.total || 0,
      status: "pending"
    })
    .select()
    .single();

  if (deliveryError) {
    console.error("[Deliveries] Erro na inserção da entrega:", deliveryError);
    throw deliveryError;
  }

  console.log(`[Deliveries] Entrega criada com ID: ${delivery.id}. Vinculando ao pedido...`);

  // 3. Associa a delivery_id ao pedido e mantém o status da Order como ready (ou muda se necessário)
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
      const { data } = await supabase.from("orders").select("*, deliveries(id, status, driver_id, customer_name, address, value, created_at, pickup_address, dropoff_address)").eq("id", orderId).single();
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
