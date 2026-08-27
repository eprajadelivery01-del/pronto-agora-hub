-- Migration: Fix RLS Vulnerabilities (Data Breach Prevention)
-- Description: Replaces overly permissive USING (true) SELECT policies with proper index-based role checks to prevent unauthorized data access.

BEGIN;

-- 1. Secure ORDERS table
DROP POLICY IF EXISTS "orders_select_stable" ON public.orders;
CREATE POLICY "orders_select_stable" ON public.orders
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR 
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'driver')
  );

-- 2. Secure ORDER_ITEMS table
DROP POLICY IF EXISTS "order_items_select_stable" ON public.order_items;
CREATE POLICY "order_items_select_stable" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    order_id IN (
       SELECT id FROM public.orders WHERE 
          user_id = auth.uid() OR 
          company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
          public.has_role(auth.uid(), 'admin') OR
          public.has_role(auth.uid(), 'driver')
    )
  );

-- 3. Secure DELIVERIES table
DROP POLICY IF EXISTS "deliveries_select_stable" ON public.deliveries;
CREATE POLICY "deliveries_select_stable" ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    driver_id = auth.uid() OR
    status = 'pending' OR
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'driver')
  );

-- 4. Secure CUSTOMERS table
DROP POLICY IF EXISTS "customers_select_stable" ON public.customers;
CREATE POLICY "customers_select_stable" ON public.customers
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'company') OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'driver')
  );

-- 5. Secure USER_ROLES table
DROP POLICY IF EXISTS "user_roles_select_stable" ON public.user_roles;
CREATE POLICY "user_roles_select_stable" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin')
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
