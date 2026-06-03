-- Migration: Resilient RLS Policies
-- This ensures that merchants can always manage their data even if user_roles has anomalies.

BEGIN;

-- 1. ADDRESSES
DROP POLICY IF EXISTS "Companies can manage addresses" ON public.addresses;
CREATE POLICY "Companies can manage addresses" ON public.addresses
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'company') OR 
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.companies WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'company') OR 
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.companies WHERE user_id = auth.uid())
  );

-- 2. COUPONS
DROP POLICY IF EXISTS "Companies can manage own coupons" ON public.coupons;
CREATE POLICY "Companies can manage own coupons" ON public.coupons
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin')
  );

-- 3. PRODUCTS (Ensuring it uses the direct relation)
DROP POLICY IF EXISTS "Company owners can manage products" ON public.products;
CREATE POLICY "Company owners can manage products" ON public.products
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin')
  );

-- 4. COMPANIES (Ensuring companies_manage_stable is bulletproof)
DROP POLICY IF EXISTS "companies_manage_stable" ON public.companies;
CREATE POLICY "companies_manage_stable" ON public.companies
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR 
    public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    user_id = auth.uid() OR 
    public.has_role(auth.uid(), 'admin')
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
