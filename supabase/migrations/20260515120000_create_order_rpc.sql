-- Migration: create_order_rpc
-- Descrição: Cria uma função RPC para processar pedidos como alternativa robusta às Edge Functions.
-- Isso resolve problemas de conectividade e garante que pedidos possam ser criados diretamente no banco.

CREATE OR REPLACE FUNCTION public.create_order_v3(
  p_items jsonb, -- Array de {product_id, quantity, notes, options}
  p_company_id uuid,
  p_address_id uuid,
  p_payment_method text,
  p_coupon_code text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_needs_change boolean DEFAULT false,
  p_change_for numeric DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_delivery_fee numeric DEFAULT 0,
  p_region_id uuid DEFAULT NULL,
  p_total numeric DEFAULT 0,
  p_subtotal numeric DEFAULT 0,
  p_discount numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_customer_id uuid;
  v_order_id uuid;
  v_address record;
  v_company record;
  v_item_input record;
  v_product record;
  v_final_notes text;
  v_delivery_address text;
  v_res jsonb;
BEGIN
  -- 1. Identificar usuário
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Usuário não autenticado');
  END IF;

  -- 2. Idempotência
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_order_id FROM public.orders WHERE idempotency_key = p_idempotency_key;
    IF v_order_id IS NOT NULL THEN
      RETURN jsonb_build_object('order_id', v_order_id, 'idempotent', true);
    END IF;
  END IF;

  -- 3. Garantir registro de Customer
  SELECT id INTO v_customer_id FROM public.customers WHERE user_id = v_user_id LIMIT 1;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (user_id, name)
    VALUES (v_user_id, COALESCE((SELECT full_name FROM public.profiles WHERE user_id = v_user_id LIMIT 1), 'Cliente'))
    RETURNING id INTO v_customer_id;
  END IF;

  -- 4. Coletar dados de endereço e empresa
  SELECT street, number, neighborhood, city, latitude, longitude INTO v_address FROM public.addresses WHERE id = p_address_id;
  IF v_address.street IS NULL THEN
    RETURN jsonb_build_object('error', 'Endereço não localizado');
  END IF;

  SELECT name, address, latitude, longitude INTO v_company FROM public.companies WHERE id = p_company_id;
  IF v_company.name IS NULL THEN
    RETURN jsonb_build_object('error', 'Empresa não localizada');
  END IF;

  v_delivery_address := v_address.street || ', ' || v_address.number || ' - ' || v_address.neighborhood || ', ' || v_address.city;

  -- 5. Preparar Notas
  v_final_notes := p_notes;
  IF p_payment_method = 'money' AND p_needs_change AND p_change_for IS NOT NULL THEN
    v_final_notes := COALESCE(v_final_notes || ' • ', '') || 'Troco para R$ ' || TRIM(TRAILING '0' FROM p_change_for::text);
  END IF;

  -- 6. Inserir Pedido Principal
  INSERT INTO public.orders (
    customer_id, user_id, company_id, status, total, delivery_fee, 
    delivery_address, payment_method, notes, idempotency_key, region_id,
    delivery_latitude, delivery_longitude
  ) VALUES (
    v_customer_id, v_user_id, p_company_id, 'pending', p_total, p_delivery_fee,
    v_delivery_address, p_payment_method, v_final_notes, p_idempotency_key, p_region_id,
    v_address.latitude, v_address.longitude
  ) RETURNING id INTO v_order_id;

  -- 7. Inserir Itens (validando preços no banco)
  FOR v_item_input IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id uuid, quantity int, notes text, options jsonb)
  LOOP
    SELECT name, price INTO v_product FROM public.products WHERE id = v_item_input.product_id;
    
    INSERT INTO public.order_items (
      order_id, product_id, quantity, price, unit_price, product_name, notes, options
    ) VALUES (
      v_order_id, v_item_input.product_id, v_item_input.quantity, v_product.price, v_product.price, v_product.name, v_item_input.notes, v_item_input.options
    );
  END LOOP;

  -- 8. Inserir Entrega (Delivery)
  INSERT INTO public.deliveries (
    order_id, company_id, pickup_address, delivery_address,
    pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude,
    status, value, price, region_id
  ) VALUES (
    v_order_id, p_company_id, COALESCE(v_company.address, v_company.name), v_delivery_address,
    v_company.latitude, v_company.longitude, v_address.latitude, v_address.longitude,
    'pending', p_total, p_delivery_fee, p_region_id
  );

  RETURN jsonb_build_object('order_id', v_order_id, 'success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_v3 TO authenticated;
