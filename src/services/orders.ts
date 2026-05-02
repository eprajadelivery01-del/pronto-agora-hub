import { supabase } from "@/lib/supabaseClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * FUNÇÕES
 */
export async function calculateDeliveryFee(lat: number, lng: number) {
  // Chama a função RPC do Postgres que criamos (find_region_for_point)
  const { data: regionId, error: regionError } = await supabase.rpc("find_region_for_point", {
    _lat: lat,
    _lng: lng,
  });

  if (regionError) throw regionError;
  if (!regionId) return { fee: 0, regionId: null, message: "Fora da área de cobertura" };

  const { data: region, error: regError } = await supabase
    .from("regions")
    .select("price, delivery_price")
    .eq("id", regionId)
    .single();

  if (regError) throw regError;

  const validFee = (region as any).delivery_price ?? (region as any).price ?? 0;

  return { fee: validFee, regionId: regionId };
}

export async function createOrder(orderData: {
  company_id: string;
  customer_id: string;
  address_id?: string;
  delivery_fee?: number;
  items: { product_id: string; quantity: number; price: number }[];
  total: number;
}) {
  // 1. Criar o pedido (Order)
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      company_id: orderData.company_id,
      customer_id: orderData.customer_id,
      address_id: orderData.address_id,
      delivery_fee: orderData.delivery_fee,
      total: orderData.total,
      status: "pending",
    })
    .select()
    .single();

  if (orderError) throw orderError;

  // 2. Criar os itens do pedido (Order Items)
  const orderItems = orderData.items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    price: item.price,
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
  if (itemsError) throw itemsError;

  return order;
}

export async function getCompanyOrders(companyId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*), customers(*), deliveries(id, status, driver_id, customer_name, address, value, created_at, pickup_address, dropoff_address)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateOrderStatus(orderId: string, status: "pending" | "preparing" | "ready" | "delivered" | "cancelled") {
  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * HOOKS
 */
export function useCalculateDeliveryFee() {
  return useMutation({
    mutationFn: ({ lat, lng }: { lat: number; lng: number }) => calculateDeliveryFee(lat, lng),
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useOrders(customerId?: string) {
  return useQuery({
    queryKey: ["orders", customerId],
    queryFn: async () => {
      let query = supabase.from("orders").select("*, order_items(*), companies(name)");
      if (customerId) query = query.eq("customer_id", customerId);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });
}

export function useCompanyOrders(companyId?: string | null) {
  return useQuery({
    queryKey: ["orders", "company", companyId],
    queryFn: () => getCompanyOrders(companyId as string),
    enabled: !!companyId,
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: any }) => updateOrderStatus(orderId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

// Opcional para componentizar escuta Realtime:
import { useEffect } from "react";
export function useRealtimeOrders(companyId?: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`orders-company-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `company_id=eq.${companyId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["orders", "company", companyId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, qc]);
}
