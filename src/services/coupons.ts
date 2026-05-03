import { supabase } from "@/lib/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Coupon {
  id: string;
  company_id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  applies_to: "all" | "specific";
  is_active: boolean;
  usage_limit: number | null;
  usage_count: number;
  valid_from: string | null;
  valid_until: string | null;
  min_order_value: number;
  created_at: string;
  updated_at: string;
}

export interface CouponProduct {
  id: string;
  coupon_id: string;
  product_id: string;
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

export function useCouponProducts(couponId?: string) {
  return useQuery({
    queryKey: ["coupon-products", couponId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupon_products")
        .select("*")
        .eq("coupon_id", couponId!);
      if (error) throw error;
      return data as CouponProduct[];
    },
    enabled: !!couponId,
  });
}

export function useCouponMutations(companyId?: string) {
  const qc = useQueryClient();

  const createCoupon = useMutation({
    mutationFn: async (payload: {
      code: string;
      discount_type: "percentage" | "fixed";
      discount_value: number;
      applies_to: "all" | "specific";
      usage_limit?: number | null;
      valid_from?: string | null;
      valid_until?: string | null;
      min_order_value?: number;
      product_ids?: string[];
    }) => {
      const { product_ids, ...couponData } = payload;
      const { data, error } = await supabase
        .from("coupons")
        .insert({ ...couponData, company_id: companyId } as any)
        .select()
        .single();
      if (error) throw error;

      if (payload.applies_to === "specific" && product_ids?.length) {
        const rows = product_ids.map((pid) => ({
          coupon_id: (data as any).id,
          product_id: pid,
        }));
        const { error: linkErr } = await supabase
          .from("coupon_products")
          .insert(rows as any);
        if (linkErr) throw linkErr;
      }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });

  const updateCoupon = useMutation({
    mutationFn: async ({ id, data: updateData }: { id: string; data: Partial<Coupon> & { product_ids?: string[] } }) => {
      const { product_ids, ...couponData } = updateData;
      const { error } = await supabase
        .from("coupons")
        .update(couponData as any)
        .eq("id", id);
      if (error) throw error;

      if (product_ids !== undefined) {
        await supabase.from("coupon_products").delete().eq("coupon_id", id);
        if (product_ids.length > 0) {
          const rows = product_ids.map((pid) => ({ coupon_id: id, product_id: pid }));
          const { error: linkErr } = await supabase.from("coupon_products").insert(rows as any);
          if (linkErr) throw linkErr;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coupons"] });
      qc.invalidateQueries({ queryKey: ["coupon-products"] });
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
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("coupons")
        .update({ is_active } as any)
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
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { valid: false, message: "Cupom não encontrado." } as const;

  const coupon = data as Coupon;
  const now = new Date();

  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return { valid: false, message: "Cupom expirado." } as const;
  }
  if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
    return { valid: false, message: "Cupom esgotado." } as const;
  }

  // Get linked products if specific
  let productIds: string[] = [];
  if (coupon.applies_to === "specific") {
    const { data: links } = await supabase
      .from("coupon_products")
      .select("product_id")
      .eq("coupon_id", coupon.id);
    productIds = (links || []).map((l: any) => l.product_id);
  }

  return { valid: true, coupon, productIds } as const;
}

/** Calculate discount for cart items */
export function calculateDiscount(
  coupon: Coupon,
  applicableProductIds: string[],
  cartItems: { id: string; price: number; quantity: number }[]
) {
  const eligibleItems =
    coupon.applies_to === "all"
      ? cartItems
      : cartItems.filter((i) => applicableProductIds.includes(i.id));

  const eligibleTotal = eligibleItems.reduce((s, i) => s + i.price * i.quantity, 0);

  if (coupon.discount_type === "percentage") {
    return Math.min(eligibleTotal, (eligibleTotal * coupon.discount_value) / 100);
  }
  return Math.min(eligibleTotal, coupon.discount_value);
}
