-- ========================================================
-- Migration: 20260417102600_fix_order_liberation
-- Description: Liberate orders when delivery is cancelled
-- ========================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.liberate_order_on_delivery_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF (NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled')) THEN
        UPDATE public.orders SET delivery_id = NULL WHERE delivery_id = OLD.id;
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cancel_delivery_liberation ON public.deliveries;

CREATE TRIGGER trg_cancel_delivery_liberation
AFTER UPDATE ON public.deliveries
FOR EACH ROW
EXECUTE FUNCTION public.liberate_order_on_delivery_cancel();

COMMIT;
