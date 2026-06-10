CREATE OR REPLACE FUNCTION public.update_delivery_status_safe(
  p_delivery_id UUID,
  p_status TEXT,
  p_driver_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_db_status public.delivery_status;
  v_now TIMESTAMPTZ := now();
  v_order_status TEXT;
BEGIN
  -- 1. Validate authentication
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  -- 2. Convert text to enum status
  BEGIN
    v_db_status := p_status::public.delivery_status;
  EXCEPTION WHEN OTHERS THEN
    -- Try mapping delivered to completed or in_transit to in_route
    IF p_status = 'delivered' THEN
      v_db_status := 'completed'::public.delivery_status;
    ELSIF p_status = 'in_transit' THEN
      v_db_status := 'in_route'::public.delivery_status;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Status inválido: ' || p_status);
    END IF;
  END;

  -- 3. Update the delivery record (bypassing RLS because of SECURITY DEFINER)
  UPDATE public.deliveries
  SET 
    status = v_db_status,
    updated_at = v_now,
    driver_id = COALESCE(p_driver_id, driver_id),
    accepted_at = CASE WHEN v_db_status = 'accepted' AND accepted_at IS NULL THEN v_now ELSE accepted_at END,
    collected_at = CASE WHEN v_db_status = 'collecting' AND collected_at IS NULL THEN v_now ELSE collected_at END,
    delivered_at = CASE WHEN v_db_status = 'completed' AND delivered_at IS NULL THEN v_now ELSE delivered_at END,
    completed_at = CASE WHEN v_db_status = 'completed' AND completed_at IS NULL THEN v_now ELSE completed_at END,
    cancelled_at = CASE WHEN v_db_status = 'cancelled' AND cancelled_at IS NULL THEN v_now ELSE cancelled_at END
  WHERE id = p_delivery_id;

  -- 4. Also update any associated order status safely
  BEGIN
    IF v_db_status = 'accepted' THEN 
      v_order_status := 'ready';
    ELSIF v_db_status = 'collecting' THEN 
      v_order_status := 'ready';
    ELSIF v_db_status = 'in_route' THEN 
      v_order_status := 'in_route';
    ELSIF v_db_status = 'completed' THEN 
      v_order_status := 'delivered';
    ELSIF v_db_status = 'cancelled' THEN 
      v_order_status := 'cancelled';
    END IF;

    IF v_order_status IS NOT NULL THEN
      UPDATE public.orders
      SET 
        status = v_order_status::public.order_status,
        updated_at = v_now
      WHERE delivery_id = p_delivery_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore silently
  END;

  RETURN jsonb_build_object('success', true, 'message', 'Entrega atualizada com sucesso');
END;
$$;
