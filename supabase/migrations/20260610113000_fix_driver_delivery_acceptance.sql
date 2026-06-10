-- Migration: 20260610113000_fix_driver_delivery_acceptance.sql
-- Description: Fixes driver acceptance by updating the RPC to automatically assign the driver and overloaded signatures. Also fixes RLS so drivers can update pending deliveries.

BEGIN;

-- 1. Create an overloaded version of the RPC that takes exactly 2 parameters
-- so that PostgREST correctly maps the frontend call.
CREATE OR REPLACE FUNCTION public.update_delivery_status_safe(
  p_delivery_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Forward to the 3-parameter version with a NULL driver_id
  RETURN public.update_delivery_status_safe(p_delivery_id, p_status, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_delivery_status_safe(UUID, TEXT) TO authenticated;

-- 2. Modify the main RPC to AUTOMATICALLY assign the calling driver
-- when accepting a delivery, if p_driver_id is not explicitly provided.
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
  v_actual_driver_id UUID := p_driver_id;
  v_current_delivery_status public.delivery_status;
BEGIN
  -- Validate authentication
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  -- Verify delivery exists and check current status
  SELECT status INTO v_current_delivery_status FROM public.deliveries WHERE id = p_delivery_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entrega não encontrada');
  END IF;

  -- Convert text to enum status
  BEGIN
    v_db_status := p_status::public.delivery_status;
  EXCEPTION WHEN OTHERS THEN
    IF p_status = 'delivered' THEN
      v_db_status := 'completed'::public.delivery_status;
    ELSIF p_status = 'in_transit' THEN
      v_db_status := 'in_route'::public.delivery_status;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Status inválido: ' || p_status);
    END IF;
  END;

  -- Automatically assign the authenticated driver if accepting the delivery
  IF v_db_status = 'accepted' AND v_actual_driver_id IS NULL THEN
    SELECT id INTO v_actual_driver_id FROM public.delivery_drivers WHERE user_id = auth.uid() LIMIT 1;
    
    -- If somehow the user is not a driver, we probably shouldn't let them accept
    IF v_actual_driver_id IS NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Usuário não é um entregador válido');
    END IF;
  END IF;

  -- Update the delivery record
  UPDATE public.deliveries
  SET 
    status = v_db_status,
    updated_at = v_now,
    driver_id = CASE WHEN v_actual_driver_id IS NOT NULL THEN v_actual_driver_id ELSE driver_id END,
    delivered_at = CASE WHEN v_db_status = 'completed' THEN v_now ELSE delivered_at END,
    accepted_at = CASE WHEN v_db_status = 'accepted' THEN v_now ELSE accepted_at END,
    collected_at = CASE WHEN v_db_status = 'collecting' THEN v_now ELSE collected_at END
  WHERE id = p_delivery_id;

  -- Also update any associated order status safely
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
    BEGIN
      IF v_order_status = 'confirmed' THEN
        UPDATE public.orders
        SET status = 'preparing'::public.order_status WHERE delivery_id = p_delivery_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
    END;
  END;

  RETURN jsonb_build_object('success', true, 'message', 'Entrega atualizada com sucesso');
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_delivery_status_safe(UUID, TEXT, UUID) TO authenticated;

-- 3. Fix the RLS Policy so the REST fallback works for drivers accepting a pending delivery.
-- The driver can UPDATE if:
--   - They already own the delivery (driver_id matches)
--   - OR the delivery has no driver and is pending/broadcasted (they are accepting it)
DROP POLICY IF EXISTS "deliveries_update_company_driver_admin" ON public.deliveries;

CREATE POLICY "deliveries_update_company_driver_admin" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR driver_id IN (SELECT id FROM public.delivery_drivers WHERE user_id = auth.uid())
    OR (driver_id IS NULL AND status IN ('pending', 'broadcasted') AND EXISTS (SELECT 1 FROM public.delivery_drivers WHERE user_id = auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR driver_id IN (SELECT id FROM public.delivery_drivers WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
