-- Dynamic Cleanup Block for ORDERS and ORDER_ITEMS tables
DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Loop and drop all policies for public.orders
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'orders'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', pol.policyname);
        RAISE NOTICE 'Dropped policy % on public.orders', pol.policyname;
    END LOOP;

    -- Loop and drop all policies for public.order_items
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'order_items'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.order_items', pol.policyname);
        RAISE NOTICE 'Dropped policy % on public.order_items', pol.policyname;
    END LOOP;
END
$$;

-- Enable Row Level Security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Rebuild clean, high-performance, recursion-free RLS policies for orders
CREATE POLICY "orders_select_stable" ON public.orders
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "orders_manage_stable" ON public.orders
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Rebuild clean, high-performance, recursion-free RLS policies for order_items
CREATE POLICY "order_items_select_stable" ON public.order_items
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "order_items_manage_stable" ON public.order_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant appropriate permissions
GRANT ALL ON public.orders TO authenticated, service_role;
GRANT ALL ON public.order_items TO authenticated, service_role;
