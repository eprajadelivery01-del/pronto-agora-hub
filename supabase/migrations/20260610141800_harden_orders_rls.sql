-- Migration: Harden Orders and Order Items RLS
-- Description: Replaces the insecure USING (true) WITH CHECK (true) policies with proper role-based checks.

BEGIN;

-- 1. Lock down 'orders' table
DROP POLICY IF EXISTS "orders_select_stable" ON public.orders;
DROP POLICY IF EXISTS "orders_manage_stable" ON public.orders;

-- SELECT: Admins can see all, Companies can see their own, Customers can see their own
CREATE POLICY "orders_select_secure" ON public.orders
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  );

-- INSERT: Only Admins or Companies can insert directly (Customers use RPC create_order_v3)
CREATE POLICY "orders_insert_secure" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- UPDATE: Only Admins or the owning Company can update an order
CREATE POLICY "orders_update_secure" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- DELETE: Only Admins or the owning Company can delete an order
CREATE POLICY "orders_delete_secure" ON public.orders
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );


-- 2. Lock down 'order_items' table
DROP POLICY IF EXISTS "order_items_select_stable" ON public.order_items;
DROP POLICY IF EXISTS "order_items_manage_stable" ON public.order_items;

-- SELECT: Same as orders (via join)
CREATE POLICY "order_items_select_secure" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders WHERE
        public.has_role(auth.uid(), 'admin') OR
        company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
        customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
    )
  );

-- INSERT: Only Admins or Companies
CREATE POLICY "order_items_insert_secure" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.orders WHERE
        public.has_role(auth.uid(), 'admin') OR
        company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  );

-- UPDATE: Only Admins or Companies
CREATE POLICY "order_items_update_secure" ON public.order_items
  FOR UPDATE TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders WHERE
        public.has_role(auth.uid(), 'admin') OR
        company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.orders WHERE
        public.has_role(auth.uid(), 'admin') OR
        company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  );

-- DELETE: Only Admins or Companies
CREATE POLICY "order_items_delete_secure" ON public.order_items
  FOR DELETE TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders WHERE
        public.has_role(auth.uid(), 'admin') OR
        company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  );

COMMIT;
