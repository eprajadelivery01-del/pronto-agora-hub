-- Migration: Allow Customer Order Cancellation and Create RPC
-- Description: Creates a secure RPC and updates RLS so that customer order cancellations are immediately persisted in the database and reflected in the store panel.

BEGIN;

-- 1. Create SECURITY DEFINER RPC to cancel order
CREATE OR REPLACE FUNCTION public.cancel_order_customer(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_customer_id uuid;
  v_user_id uuid;
BEGIN
  -- Obtém dados do pedido
  SELECT company_id, customer_id, user_id
  INTO v_company_id, v_customer_id, v_user_id
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  -- 1. Atualiza o pedido para cancelado
  UPDATE public.orders
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_order_id;

  -- 2. Atualiza entregas vinculadas
  UPDATE public.deliveries
  SET status = 'cancelled', updated_at = now()
  WHERE order_id = p_order_id OR id IN (SELECT delivery_id FROM public.orders WHERE id = p_order_id);

  -- 3. Atualiza available_deliveries se existir
  UPDATE public.available_deliveries
  SET status = 'cancelled', updated_at = now()
  WHERE order_id = p_order_id;

  -- 4. Notifica o lojista
  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, created_at)
    SELECT c.user_id, 'Pedido Cancelado pelo Cliente', 'O cliente cancelou o pedido #' || UPPER(LEFT(p_order_id::text, 8)), 'order_cancelled', now()
    FROM public.companies c
    WHERE c.id = v_company_id AND c.user_id IS NOT NULL;
  END IF;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id);
END;
$$;

-- Permissões na RPC
GRANT EXECUTE ON FUNCTION public.cancel_order_customer(uuid) TO anon, authenticated, service_role;

-- 2. Atualiza política de UPDATE em orders para permitir clientes cancelarem
DROP POLICY IF EXISTS "orders_update_secure" ON public.orders;
CREATE POLICY "orders_update_secure" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    user_id = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    (user_id = auth.uid() AND status = 'cancelled')
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
