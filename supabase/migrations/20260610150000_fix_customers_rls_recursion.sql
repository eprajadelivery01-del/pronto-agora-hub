-- Migration: Fix Customers and Deliveries RLS Recursion (Error 42P17)
-- Description: Completely removes recursive subqueries on orders and establishes direct user_id and role checks.

BEGIN;

-- 1. Remove all old/conflicting customer policies
DROP POLICY IF EXISTS "customers_select_stable" ON public.customers;
DROP POLICY IF EXISTS "customers_manage_stable" ON public.customers;
DROP POLICY IF EXISTS "customers_self_select" ON public.customers;
DROP POLICY IF EXISTS "customers_self_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_self_update" ON public.customers;
DROP POLICY IF EXISTS "Companies can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Customers can view own" ON public.customers;
DROP POLICY IF EXISTS "customers_select_clean" ON public.customers;
DROP POLICY IF EXISTS "customers_manage_clean" ON public.customers;

-- 2. Create clean direct policy for customers (no circular dependency on orders)
CREATE POLICY "customers_select_clean" ON public.customers
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'company') OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'driver')
  );

CREATE POLICY "customers_manage_clean" ON public.customers
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'company') OR
    public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'company') OR
    public.has_role(auth.uid(), 'admin')
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
