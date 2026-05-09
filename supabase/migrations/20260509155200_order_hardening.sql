-- =============================================
-- Migration: 20260509155200_order_hardening
-- Description: Adds idempotency index, enables realtime, and hardens RLS
-- =============================================

BEGIN;

-- 1. IDEMPOTENCY CONSTRAINT
-- We use a unique index for idempotency_key to allow NULLs but enforce uniqueness for values.
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_idx ON public.orders (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 2. ENABLE REALTIME
-- Add orders table to the realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  END IF;
END $$;

-- 3. HARDEN RLS FOR ORDERS
-- Drop old policy and create a more efficient one using user_id if possible
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can view own" ON public.orders;

CREATE POLICY "Customers can view own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id OR
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  );

-- 4. HARDEN RLS FOR ORDER_ITEMS
-- Optimize for performance using EXISTS
DROP POLICY IF EXISTS "Order viewers can see items" ON public.order_items;

CREATE POLICY "Order viewers can see items" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
      AND (
        o.user_id = auth.uid() OR
        o.customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()) OR
        o.company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
      )
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
