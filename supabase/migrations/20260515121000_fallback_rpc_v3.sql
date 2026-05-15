-- Migration: Create fallback create_order_v3 RPC
-- This is a safety net for users with cached frontends still calling the old RPC.
-- It mimics the logic of the create-order Edge Function.

CREATE OR REPLACE FUNCTION public.create_order_v3(
  p_items jsonb,
  p_company_id uuid,
  p_address_id uuid,
  p_payment_method text,
  p_coupon_code text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_needs_change boolean DEFAULT false,
  p_change_for numeric DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_order_id uuid;
  v_user_id uuid;
  v_customer_id uuid;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_item record;
  v_product record;
  v_company record;
  v_address record;
  v_coupon record;
  v_final_notes text;
  v_delivery_address text;
  v_region_id uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  -- 1) Address
  SELECT * INTO v_address FROM public.addresses WHERE id = p_address_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Address not found');
  END IF;

  -- 2) Company
  SELECT * INTO v_company FROM public.companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Company not found');
  END IF;

  -- 3) Customer
  SELECT id INTO v_customer_id FROM public.customers WHERE user_id = v_user_id LIMIT 1;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (user_id, name)
    VALUES (v_user_id, COALESCE((SELECT full_name FROM public.profiles WHERE id = v_user_id), 'Cliente'))
    RETURNING id INTO v_customer_id;
  END IF;

  -- 4) Idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_order_id FROM public.orders WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('order_id', v_order_id, 'idempotent', true);
    END IF;
  END IF;

  -- 5) Calculate Subtotal and validate items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id uuid, quantity int, notes text, options jsonb)
  LOOP
    SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Product ' || v_item.product_id || ' not found');
    END IF;
    IF v_product.company_id != p_company_id THEN
      RETURN jsonb_build_object('error', 'Product ' || v_item.product_id || ' does not belong to company');
    END IF;
    v_subtotal := v_subtotal + (v_product.price * v_item.quantity);
  END LOOP;

  -- 6) Coupon
  IF p_coupon_code IS NOT NULL AND p_coupon_code != '' THEN
    SELECT * INTO v_coupon FROM public.coupons WHERE code = UPPER(p_coupon_code) AND active = true;
    IF FOUND THEN
      IF v_coupon.min_order_value IS NULL OR v_subtotal >= v_coupon.min_order_value THEN
        IF v_coupon.discount_type = 'percentage' THEN
          v_discount := (v_subtotal * v_coupon.discount_value / 100);
          IF v_coupon.max_discount_value IS NOT NULL THEN
            v_discount := LEAST(v_discount, v_coupon.max_discount_value);
          END IF;
        ELSE
          v_discount := LEAST(v_subtotal, v_coupon.discount_value);
        END IF;
      END IF;
    END IF;
  END IF;

  -- 7) Delivery Fee
  IF v_company.delivery_fee IS NOT NULL THEN
    v_delivery_fee := v_company.delivery_fee;
  ELSE
    -- Try regions (simplified check)
    SELECT id, COALESCE(price, delivery_fee, 0) INTO v_region_id, v_delivery_fee 
    FROM public.regions 
    WHERE active = true 
    ORDER BY price ASC LIMIT 1; 
  END IF;

  v_total := GREATEST(0, v_subtotal - v_discount) + v_delivery_fee;

  -- 8) Final Notes
  v_final_notes := p_notes;
  IF p_payment_method = 'money' AND p_needs_change AND p_change_for IS NOT NULL THEN
    v_final_notes := COALESCE(v_final_notes || ' • ', '') || 'Troco para R$ ' || p_change_for::text;
  END IF;

  v_delivery_address := v_address.street || ', ' || v_address.number || ' - ' || v_address.neighborhood || ', ' || v_address.city;

  -- 9) Insert Order
  INSERT INTO public.orders (
    customer_id, user_id, company_id, status, total, delivery_fee, 
    delivery_address, payment_method, notes, idempotency_key, region_id,
    delivery_latitude, delivery_longitude
  ) VALUES (
    v_customer_id, v_user_id, p_company_id, 'pending', v_total, v_delivery_fee,
    v_delivery_address, p_payment_method, v_final_notes, p_idempotency_key, v_region_id,
    v_address.latitude, v_address.longitude
  ) RETURNING id INTO v_order_id;

  -- 10) Insert Items
  INSERT INTO public.order_items (order_id, product_id, quantity, price, unit_price, product_name, notes, options)
  SELECT 
    v_order_id, 
    x.product_id, 
    x.quantity, 
    p.price, 
    p.price, 
    p.name, 
    x.notes, 
    x.options
  FROM jsonb_to_recordset(p_items) AS x(product_id uuid, quantity int, notes text, options jsonb)
  JOIN public.products p ON p.id = x.product_id;

  -- 11) Delivery
  INSERT INTO public.deliveries (
    order_id, company_id, pickup_address, delivery_address, 
    pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude,
    status, value, price, region_id
  ) VALUES (
    v_order_id, p_company_id, v_company.address, v_delivery_address,
    v_company.latitude, v_company.longitude, v_address.latitude, v_address.longitude,
    'pending', v_total, v_delivery_fee, v_region_id
  );

  RETURN jsonb_build_object('order_id', v_order_id, 'success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_order_v3 TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_v3 TO anon;
