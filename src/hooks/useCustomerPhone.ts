import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface CustomerPhoneDetails {
  phone: string | null;
  formattedPhone: string | null;
  whatsappUrl: string | null;
  source: "orders" | "customers" | "profiles" | "addresses" | "deliveries" | "none";
}

/**
 * Limpa e valida uma string de telefone.
 * Retorna somente os dígitos se for válido.
 */
export function cleanPhoneNumber(rawPhone?: string | null): string | null {
  if (!rawPhone) return null;
  const trimmed = String(rawPhone).trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === "não informado" ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "undefined" ||
    trimmed.toLowerCase() === "s/n"
  ) {
    return null;
  }
  const numeric = trimmed.replace(/\D/g, "");
  if (numeric.length < 8) return null;
  return numeric;
}

/**
 * Formata um número de telefone numérico para (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 */
export function formatPhoneNumber(numericPhone?: string | null): string | null {
  if (!numericPhone) return null;
  let digits = cleanPhoneNumber(numericPhone) || numericPhone;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.substring(2);
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

/**
 * Hook customizado para resgatar e sincronizar qualquer telefone que o cliente tenha cadastrado no sistema.
 * Busca em:
 * 1. Tabela 'orders' (campo customer_phone)
 * 2. Tabela 'customers' (campo phone)
 * 3. Tabela 'profiles' (campo phone, vinculado por user_id ou id)
 * 4. Tabela 'deliveries' (campo customer_phone)
 * 5. Tabela 'addresses' (campo phone)
 */
export function useCustomerPhone(
  customerId?: string | null,
  userId?: string | null,
  orderId?: string | null
) {
  const [phoneDetails, setPhoneDetails] = useState<CustomerPhoneDetails>({
    phone: null,
    formattedPhone: null,
    whatsappUrl: null,
    source: "none",
  });
  const [loading, setLoading] = useState(false);

  const fetchPhone = useCallback(async () => {
    if (!customerId && !userId && !orderId) return;
    setLoading(true);

    try {
      // 1. Tentar na tabela 'orders'
      if (orderId) {
        const { data: orderData } = await supabase
          .from("orders")
          .select("customer_phone, user_id, customer_id")
          .eq("id", orderId)
          .maybeSingle();

        const orderPhone = cleanPhoneNumber(orderData?.customer_phone);
        if (orderPhone) {
          const formatted = formatPhoneNumber(orderPhone);
          setPhoneDetails({
            phone: orderPhone,
            formattedPhone: formatted,
            whatsappUrl: `https://wa.me/55${orderPhone}`,
            source: "orders",
          });
          setLoading(false);
          return;
        }

        if (!userId && orderData?.user_id) userId = orderData.user_id;
        if (!customerId && orderData?.customer_id) customerId = orderData.customer_id;
      }

      // 2. Tentar na tabela 'customers'
      if (customerId) {
        const { data: customerData } = await supabase
          .from("customers")
          .select("phone, user_id")
          .eq("id", customerId)
          .maybeSingle();

        const custPhone = cleanPhoneNumber(customerData?.phone);
        if (custPhone) {
          const formatted = formatPhoneNumber(custPhone);
          setPhoneDetails({
            phone: custPhone,
            formattedPhone: formatted,
            whatsappUrl: `https://wa.me/55${custPhone}`,
            source: "customers",
          });
          setLoading(false);
          return;
        }
        if (!userId && customerData?.user_id) {
          userId = customerData.user_id;
        }
      }

      // 3. Tentar na tabela 'profiles' por user_id ou id (Auth ID)
      const targetUserId = userId || customerId;
      if (targetUserId) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("phone")
          .or(`id.eq.${targetUserId},user_id.eq.${targetUserId}`)
          .maybeSingle();

        const profPhone = cleanPhoneNumber(profileData?.phone);
        if (profPhone) {
          const formatted = formatPhoneNumber(profPhone);
          setPhoneDetails({
            phone: profPhone,
            formattedPhone: formatted,
            whatsappUrl: `https://wa.me/55${profPhone}`,
            source: "profiles",
          });

          // Sincronizar de forma resiliente na tabela 'customers' se estiver zerado lá
          if (customerId) {
            supabase.from("customers").update({ phone: profPhone }).eq("id", customerId).then();
          }
          if (orderId) {
            supabase.from("orders").update({ customer_phone: profPhone } as any).eq("id", orderId).then();
          }
          setLoading(false);
          return;
        }
      }

      // 4. Tentar na tabela 'deliveries' por order_id
      if (orderId) {
        const { data: deliveryData } = await supabase
          .from("deliveries")
          .select("customer_phone")
          .eq("order_id", orderId)
          .maybeSingle();

        const delPhone = cleanPhoneNumber(deliveryData?.customer_phone);
        if (delPhone) {
          const formatted = formatPhoneNumber(delPhone);
          setPhoneDetails({
            phone: delPhone,
            formattedPhone: formatted,
            whatsappUrl: `https://wa.me/55${delPhone}`,
            source: "deliveries",
          });
          setLoading(false);
          return;
        }
      }

      // 5. Tentar na tabela 'addresses' por user_id/customer_id
      if (targetUserId) {
        const { data: addrData } = await supabase
          .from("addresses")
          .select("phone")
          .or(`user_id.eq.${targetUserId},customer_id.eq.${targetUserId}`)
          .not("phone", "is", null)
          .limit(1)
          .maybeSingle();

        const addrPhone = cleanPhoneNumber(addrData?.phone);
        if (addrPhone) {
          const formatted = formatPhoneNumber(addrPhone);
          setPhoneDetails({
            phone: addrPhone,
            formattedPhone: formatted,
            whatsappUrl: `https://wa.me/55${addrPhone}`,
            source: "addresses",
          });
          setLoading(false);
          return;
        }
      }

      setPhoneDetails({ phone: null, formattedPhone: null, whatsappUrl: null, source: "none" });
    } catch (err) {
      console.warn("[useCustomerPhone] Erro ao carregar telefone:", err);
    } finally {
      setLoading(false);
    }
  }, [customerId, userId, orderId]);

  useEffect(() => {
    fetchPhone();
  }, [fetchPhone]);

  return { ...phoneDetails, loading, refetch: fetchPhone };
}
