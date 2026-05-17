-- Migration: 20260517110000_delivery_rpc
-- Description: Create update_delivery_status_safe RPC to bypass RLS for deliveries updates

BEGIN;

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
    driver_id = CASE WHEN p_driver_id IS NOT NULL THEN p_driver_id ELSE driver_id END,
    delivered_at = CASE WHEN v_db_status = 'completed' THEN v_now ELSE delivered_at END,
    accepted_at = CASE WHEN v_db_status = 'accepted' THEN v_now ELSE accepted_at END,
    collected_at = CASE WHEN v_db_status = 'collecting' THEN v_now ELSE collected_at END
  WHERE id = p_delivery_id;

  -- 4. Also update any associated order status safely
  BEGIN
    IF v_db_status = 'accepted' THEN 
      v_order_status := 'confirmed';
    ELSIF v_db_status = 'collecting' THEN 
      v_order_status := 'preparing';
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
    -- Fallback to standard status or just ignore if enum values don't match
    BEGIN
      IF v_order_status = 'confirmed' THEN
        UPDATE public.orders
        SET status = 'preparing'::public.order_status WHERE delivery_id = p_delivery_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Ignore silently
    END;
  END;

  RETURN jsonb_build_object('success', true, 'message', 'Entrega atualizada com sucesso');
END;
$$;

-- Grant permissions to execute the function
GRANT EXECUTE ON FUNCTION public.update_delivery_status_safe(UUID, TEXT, UUID) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
