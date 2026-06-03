-- Migration: Fix customers RLS for merchants
-- This ensures that merchants can always insert customers even if their role is misconfigured.

BEGIN;

DROP POLICY IF EXISTS "customers_manage_stable" ON public.customers;

CREATE POLICY "customers_manage_stable" ON public.customers
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

COMMIT;

NOTIFY pgrst, 'reload schema';
