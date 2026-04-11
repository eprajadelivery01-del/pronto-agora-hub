import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

/**
 * Retorna todos os clientes que já fizeram pedido em uma determinada empresa.
 * Retorna os dados do cliente e o agregado de pedidos (LTV - Life Time Value).
 */
export async function getCustomersByCompany(companyId: string) {
  // O Supabase não tem "Distinct" nativo nas relações m-para-m facilmente
  // Mas podemos buscar os Orders e agrupar no JS, ou usar inner join se tivéssemos RPC
  
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*, customers(*)")
    .eq("company_id", companyId);

  if (error) throw error;

  // Agrupando por cliente
  const customerMap = new Map();
  orders.forEach((order) => {
    const cust = order.customers as any;
    if (!cust) return;

    if (!customerMap.has(cust.id)) {
      customerMap.set(cust.id, {
        ...cust,
        total_orders: 0,
        total_spent: 0,
        last_order_date: order.created_at,
      });
    }
    
    const stats = customerMap.get(cust.id);
    stats.total_orders += 1;
    stats.total_spent += order.total || 0;
    if (new Date(order.created_at) > new Date(stats.last_order_date)) {
      stats.last_order_date = order.created_at;
    }
  });

  return Array.from(customerMap.values());
}

export async function getCustomerAddresses(customerId: string) {
  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("customer_id", customerId)
    .order("is_default", { ascending: false });
  
  if (error) throw error;
  return data;
}

/**
 * HOOKS
 */
export function useCustomers(companyId?: string | null) {
  return useQuery({
    queryKey: ["customers", "company", companyId],
    queryFn: () => getCustomersByCompany(companyId as string),
    enabled: !!companyId,
  });
}

export function useCustomerAddresses(customerId?: string | null) {
  return useQuery({
    queryKey: ["addresses", "customer", customerId],
    queryFn: () => getCustomerAddresses(customerId as string),
    enabled: !!customerId,
  });
}

/**
 * Busca clientes pelo nome ou telefone vinculados a uma empresa.
 */
export async function searchCustomers(companyId: string, query: string) {
  if (!query) return [];

  const { data: orders, error } = await supabase
    .from("orders")
    .select("*, customers(*)")
    .eq("company_id", companyId)
    .ilike("customers.name", `%${query}%`);

  if (error) throw error;

  const customerMap = new Map();
  orders.forEach((order) => {
    const cust = order.customers as any;
    if (!cust) return;
    if (!customerMap.has(cust.id)) {
      customerMap.set(cust.id, { ...cust });
    }
  });

  return Array.from(customerMap.values());
}
