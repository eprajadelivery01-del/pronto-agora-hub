-- Migration: fix_rpc_driver_ownership_steal.sql

CREATE OR REPLACE FUNCTION public.update_delivery_status_safe(p_delivery_id uuid, p_status text, p_driver_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_delivery RECORD;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_db_status TEXT;
  v_order_status TEXT := NULL;
  v_current_order_status TEXT;
  v_authenticated_driver_id UUID;
BEGIN
  -- 1. Identifica o Driver autenticado (Resolve a identidade real via auth.uid)
  SELECT id INTO v_authenticated_driver_id 
  FROM public.delivery_drivers 
  WHERE user_id = auth.uid() 
  LIMIT 1;

  IF v_authenticated_driver_id IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Acesso negado: Perfil de entregador nao encontrado.');
  END IF;

  -- 2. Anti-Steal: Trava o registro na tabela
  SELECT * INTO v_delivery 
  FROM public.deliveries 
  WHERE id = p_delivery_id
  FOR UPDATE; 

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Entrega nao encontrada');
  END IF;

  v_db_status := p_status;
  
  -- 3. Checagem Anti-Steal GLOBAL (Propriedade Inviolável)
  IF v_delivery.driver_id IS NOT NULL AND v_delivery.driver_id != v_authenticated_driver_id THEN
     RETURN jsonb_build_object('success', false, 'message', 'Esta corrida ja pertence a outro entregador.');
  END IF;

  -- 4. Bloqueio de delivery sem dono avancando sem ser accepted
  IF v_delivery.driver_id IS NULL AND v_db_status != 'accepted' THEN
     RETURN jsonb_build_object('success', false, 'message', 'Corrida sem entregador so pode receber status accepted.');
  END IF;

  -- 5. Checagem Duplo Aceite / Transicao Inicial
  IF v_db_status = 'accepted' THEN
     IF v_delivery.status::text != 'pending' AND v_delivery.status::text != 'broadcasted' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Esta corrida ja foi aceita por outro entregador.');
     END IF;
  END IF;
  
  -- 6. Atualiza a tabela deliveries de forma segura
  UPDATE public.deliveries
  SET 
    status = v_db_status::public.delivery_status,
    driver_id = CASE 
                  WHEN v_delivery.driver_id IS NULL AND v_db_status = 'accepted' THEN v_authenticated_driver_id 
                  ELSE v_delivery.driver_id 
                END,
    updated_at = v_now,
    accepted_at = CASE WHEN v_db_status = 'accepted' AND accepted_at IS NULL THEN v_now ELSE accepted_at END,
    collected_at = CASE WHEN (v_db_status = 'in_route' OR v_db_status = 'collecting') AND collected_at IS NULL THEN v_now ELSE collected_at END,
    delivered_at = CASE WHEN (v_db_status = 'delivered' OR v_db_status = 'completed') AND delivered_at IS NULL THEN v_now ELSE delivered_at END,
    cancelled_at = CASE WHEN v_db_status = 'cancelled' AND cancelled_at IS NULL THEN v_now ELSE cancelled_at END
  WHERE id = p_delivery_id;

  -- 7. Atualiza a tabela orders (Protecao de Retrocesso Mantida Intacta)
  BEGIN
    SELECT status::TEXT INTO v_current_order_status FROM public.orders WHERE delivery_id = p_delivery_id;

    IF v_db_status = 'accepted' THEN 
      IF v_current_order_status = 'ready' THEN v_order_status := 'ready';
      ELSIF v_current_order_status = 'in_route' THEN v_order_status := 'in_route';
      ELSE v_order_status := 'preparing'; END IF;
    ELSIF v_db_status = 'collecting' THEN 
      IF v_current_order_status = 'ready' THEN v_order_status := 'ready';
      ELSIF v_current_order_status = 'in_route' THEN v_order_status := 'in_route';
      ELSE v_order_status := 'preparing'; END IF;
    ELSIF v_db_status = 'in_route' THEN v_order_status := 'in_route';
    ELSIF v_db_status = 'completed' OR v_db_status = 'delivered' THEN v_order_status := 'delivered';
    ELSIF v_db_status = 'cancelled' THEN v_order_status := 'cancelled';
    END IF;

    IF v_order_status IS NOT NULL AND v_order_status != v_current_order_status THEN
      UPDATE public.orders SET status = v_order_status::public.order_status, updated_at = v_now WHERE delivery_id = p_delivery_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      IF v_order_status = 'confirmed' THEN
         IF v_current_order_status = 'ready' THEN UPDATE public.orders SET status = 'ready'::public.order_status WHERE delivery_id = p_delivery_id;
         ELSIF v_current_order_status = 'in_route' THEN UPDATE public.orders SET status = 'in_route'::public.order_status WHERE delivery_id = p_delivery_id;
         ELSE UPDATE public.orders SET status = 'preparing'::public.order_status WHERE delivery_id = p_delivery_id; END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN END;
  END;

  RETURN jsonb_build_object('success', true, 'message', 'Entrega atualizada com sucesso');
END;
$function$;
