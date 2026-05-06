import { supabase } from "@/lib/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Coupon {
  id: string;
  company_id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  active: boolean;
  usage_limit: number | null;
  used_count: number;
  expires_at: string | null;
  min_order_value: number;
  max_discount_value: number | null;
  created_at: string;
}

export function useCoupons(companyId?: string) {
  return useQuery({
    queryKey: ["coupons", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Coupon[];
    },
    enabled: !!companyId,
  });
}

export function useCouponMutations(companyId?: string) {
  const qc = useQueryClient();

  const createCoupon = useMutation({
    mutationFn: async (payload: {
      code: string;
      description?: string | null;
      discount_type: "percentage" | "fixed";
      discount_value: number;
      usage_limit?: number | null;
      expires_at?: string | null;
      min_order_value?: number;
      max_discount_value?: number | null;
    }) => {
      const { data, error } = await supabase
        .from("coupons")
        .insert({ ...payload, company_id: companyId, active: true } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });

  const updateCoupon = useMutation({
    mutationFn: async ({ id, data: updateData }: { id: string; data: Partial<Coupon> }) => {
      const { error } = await supabase
        .from("coupons")
        .update(updateData as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coupons"] });
    },
  });

  const deleteCoupon = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("coupons")
        .update({ active } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });

  return { createCoupon, updateCoupon, deleteCoupon, toggleActive };
}

/** Validate a coupon code for a given company */
export async function validateCoupon(code: string, companyId: string) {
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("company_id", companyId)
    .eq("code", code.toUpperCase().trim())
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { valid: false, message: "Cupom não encontrado." } as const;

  const coupon = data as Coupon;
  const now = new Date();

  if (coupon.expires_at && new Date(coupon.expires_at) < now) {
    return { valid: false, message: "Cupom expirado." } as const;
  }
  if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
    return { valid: false, message: "Cupom esgotado." } as const;
  }

  return { valid: true, coupon } as const;
}

/** Calculate discount for cart items */
export function calculateDiscount(
  coupon: Coupon,
  cartItems: { id: string; price: number; quantity: number }[]
) {
  const eligibleTotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);

  if (coupon.discount_type === "percentage") {
    const discount = (eligibleTotal * coupon.discount_value) / 100;
    if (coupon.max_discount_value) {
      return Math.min(discount, coupon.max_discount_value);
    }
    return Math.min(eligibleTotal, discount);
  }
  return Math.min(eligibleTotal, coupon.discount_value);
}
