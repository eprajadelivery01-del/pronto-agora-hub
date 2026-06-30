-- ESTE SCRIPT UNE AS DUAS CORRECOES CRITICAS DO SISTEMA:
-- 1. Anti-Steal: Trava de concorrencia com SELECT FOR UPDATE para que 2 motoboys nao aceitem a mesma corrida.
-- 2. Anti-Kanban-Loop: Checa se o pedido ja esta 'ready' (Pronto) ou 'in_route' (Em Rota) no lojista antes de retroceder o status.

DROP FUNCTION IF EXISTS public.update_delivery_status_safe(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.update_delivery_status_safe(p_delivery_id uuid, p_status text, p_driver_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
DECLARE
  v_delivery RECORD;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_db_status TEXT;
  v_order_status TEXT := NULL;
  v_current_order_status TEXT;
BEGIN
  -- 1. Anti-Steal: Trava o registro na tabela para evitar condicoes de corrida (Race Condition)
  SELECT * INTO v_delivery 
  FROM public.deliveries 
  WHERE id = p_delivery_id
  FOR UPDATE; -- <=== TRAVA A LINHA

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Entrega nao encontrada');
  END IF;

  v_db_status := p_status;
  
  -- Checagem Anti-Steal de Status
  IF v_db_status = 'accepted' THEN
     IF v_delivery.status::text != 'pending' AND v_delivery.status::text != 'broadcasted' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Esta corrida ja foi aceita por outro entregador.');
     END IF;
     IF v_delivery.driver_id IS NOT NULL AND v_delivery.driver_id != p_driver_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Esta corrida ja tem um entregador.');
     END IF;
  END IF;
  
  -- 2. Atualiza a tabela deliveries
  UPDATE public.deliveries
  SET 
    status = v_db_status::public.delivery_status,
    driver_id = COALESCE(p_driver_id, driver_id),
    updated_at = v_now,
    accepted_at = CASE WHEN v_db_status = 'accepted' AND accepted_at IS NULL THEN v_now ELSE accepted_at END,
    collected_at = CASE WHEN (v_db_status = 'in_route' OR v_db_status = 'collecting') AND collected_at IS NULL THEN v_now ELSE collected_at END,
    delivered_at = CASE WHEN (v_db_status = 'delivered' OR v_db_status = 'completed') AND delivered_at IS NULL THEN v_now ELSE delivered_at END,
    cancelled_at = CASE WHEN v_db_status = 'cancelled' AND cancelled_at IS NULL THEN v_now ELSE cancelled_at END
  WHERE id = p_delivery_id;

  -- 3. Atualiza a tabela orders (Lojista Kanban) com Protecao de Retrocesso
  BEGIN
    -- Busca o status atual do pedido para nao retroceder o Kanban
    SELECT status::TEXT INTO v_current_order_status FROM public.orders WHERE delivery_id = p_delivery_id;

    IF v_db_status = 'accepted' THEN 
      IF v_current_order_status = 'ready' THEN
        v_order_status := 'ready'; -- Mantem pronto
      ELSIF v_current_order_status = 'in_route' THEN
        v_order_status := 'in_route'; -- Mantem em rota
      ELSE
        v_order_status := 'preparing';
      END IF;
    ELSIF v_db_status = 'collecting' THEN 
      IF v_current_order_status = 'ready' THEN
        v_order_status := 'ready'; -- Mantem pronto
      ELSIF v_current_order_status = 'in_route' THEN
        v_order_status := 'in_route'; -- Mantem em rota
      ELSE
        v_order_status := 'preparing';
      END IF;
    ELSIF v_db_status = 'in_route' THEN 
      v_order_status := 'in_route';
    ELSIF v_db_status = 'completed' OR v_db_status = 'delivered' THEN 
      v_order_status := 'delivered';
    ELSIF v_db_status = 'cancelled' THEN 
      v_order_status := 'cancelled';
    END IF;

    IF v_order_status IS NOT NULL AND v_order_status != v_current_order_status THEN
      UPDATE public.orders
      SET 
        status = v_order_status::public.order_status,
        updated_at = v_now
      WHERE delivery_id = p_delivery_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback em caso de erro no cast
    BEGIN
      IF v_order_status = 'confirmed' THEN
         IF v_current_order_status = 'ready' THEN
            UPDATE public.orders SET status = 'ready'::public.order_status WHERE delivery_id = p_delivery_id;
         ELSIF v_current_order_status = 'in_route' THEN
            UPDATE public.orders SET status = 'in_route'::public.order_status WHERE delivery_id = p_delivery_id;
         ELSE
            UPDATE public.orders SET status = 'preparing'::public.order_status WHERE delivery_id = p_delivery_id;
         END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
    END;
  END;

  RETURN jsonb_build_object('success', true, 'message', 'Entrega atualizada com sucesso');
END;
$$;
