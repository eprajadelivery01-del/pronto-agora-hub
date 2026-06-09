-- Migration: Fix anon access to companies table
-- Marketplace users are anonymous (not authenticated) before they log in.
-- They need to be able to see the stores.

BEGIN;

DROP POLICY IF EXISTS "companies_select_anon" ON public.companies;

CREATE POLICY "companies_select_anon" ON public.companies
  FOR SELECT TO anon USING (true);

COMMIT;
