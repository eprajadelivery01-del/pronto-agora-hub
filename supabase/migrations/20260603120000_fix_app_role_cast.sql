-- Migration: Fix app_role cast
-- Fixes "function public.has_role(uuid, unknown) is not unique" errors
-- By explicitly casting strings to ::public.app_role

BEGIN;

-- 1. CUSTOMERS
DROP POLICY IF EXISTS "customers_manage_stable" ON public.customers;
CREATE POLICY "customers_manage_stable" ON public.customers
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'company'::public.app_role) OR 
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    EXISTS (SELECT 1 FROM public.companies WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'company'::public.app_role) OR 
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    EXISTS (SELECT 1 FROM public.companies WHERE user_id = auth.uid())
  );

-- 2. ADDRESSES
DROP POLICY IF EXISTS "Companies can manage addresses" ON public.addresses;
CREATE POLICY "Companies can manage addresses" ON public.addresses
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'company'::public.app_role) OR 
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    EXISTS (SELECT 1 FROM public.companies WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'company'::public.app_role) OR 
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    EXISTS (SELECT 1 FROM public.companies WHERE user_id = auth.uid())
  );

-- 3. COUPONS
DROP POLICY IF EXISTS "Companies can manage own coupons" ON public.coupons;
CREATE POLICY "Companies can manage own coupons" ON public.coupons
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 4. PRODUCTS
DROP POLICY IF EXISTS "Company owners can manage products" ON public.products;
CREATE POLICY "Company owners can manage products" ON public.products
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 5. COMPANIES
DROP POLICY IF EXISTS "companies_manage_stable" ON public.companies;
CREATE POLICY "companies_manage_stable" ON public.companies
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR 
    public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    user_id = auth.uid() OR 
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Explicitly ensure select all is present for companies
-- (otherwise drivers won't be able to read companies, which breaks delivery lists)
DROP POLICY IF EXISTS "companies_select_all_authenticated" ON public.companies;
CREATE POLICY "companies_select_all_authenticated" ON public.companies
  FOR SELECT TO authenticated USING (true);

COMMIT;

NOTIFY pgrst, 'reload schema';
