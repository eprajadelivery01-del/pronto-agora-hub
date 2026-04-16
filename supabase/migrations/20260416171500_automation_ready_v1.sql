-- ========================================================
-- Migration: 20260416171500_automation_ready_v1
-- Description: Automation to create delivery on order ready
-- ========================================================

BEGIN;

-- Ensure missing columns for complete flow
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS address_id UUID REFERENCES public.addresses(id);

-- Create motoboys table
CREATE TABLE IF NOT EXISTS public.motoboys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  is_online boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Associate deliveries with motoboys
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS motoboy_id uuid REFERENCES public.motoboys(id);

-- Automation Function
CREATE OR REPLACE FUNCTION public.handle_order_ready_automation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    v_customer_name TEXT;
    v_address TEXT;
    v_delivery_id UUID;
    v_motoboy_id UUID;
BEGIN
    IF (NEW.status = 'ready' AND (OLD.status IS NULL OR OLD.status != 'ready')) THEN
        BEGIN
            IF (NEW.user_id IS NOT NULL) THEN
                SELECT full_name INTO v_customer_name FROM public.profiles WHERE user_id = NEW.user_id;
            ELSE
                SELECT c.name INTO v_customer_name FROM public.customers c WHERE c.id = NEW.customer_id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_customer_name := 'Cliente';
        END;

        BEGIN
            IF (NEW.address_id IS NOT NULL) THEN
                SELECT (street || ', ' || number || ' - ' || neighborhood || ' - ' || city)
                INTO v_address FROM public.addresses WHERE id = NEW.address_id;
            ELSE
                v_address := NEW.delivery_address;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_address := 'Endereço não informado';
        END;

        SELECT id INTO v_motoboy_id FROM public.motoboys WHERE is_online = true LIMIT 1;

        INSERT INTO public.deliveries (
            company_id,
            customer_name,
            address,
            value,
            status,
            motoboy_id,
            created_at,
            updated_at
        ) VALUES (
            NEW.company_id,
            COALESCE(v_customer_name, 'Cliente'),
            COALESCE(v_address, 'Endereço não informado'),
            NEW.total,
            'pending',
            v_motoboy_id,
            now(),
            now()
        ) RETURNING id INTO v_delivery_id;

        UPDATE public.orders SET delivery_id = v_delivery_id WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$function$;

-- Trigger
DROP TRIGGER IF EXISTS trg_order_ready ON public.orders;
CREATE TRIGGER trg_order_ready
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_ready_automation();

COMMIT;
