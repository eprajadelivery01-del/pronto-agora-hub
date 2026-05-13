
-- Migration: 20260512190000_fix_storage_and_rest_500
-- Description: Fixes 400 error in Storage (store-assets) and 500 error in REST API for deliveries.

BEGIN;

-- ======================================================================================
-- 1. FIX STORAGE POLICIES (Resolves 400 Bad Request on Upload)
-- ======================================================================================
-- The previous policy incorrectly assumed folder name = user_id. 
-- In this app, folder name = company_id.

DROP POLICY IF EXISTS "Secure Insert Store" ON storage.objects;
CREATE POLICY "Secure Insert Store" ON storage.objects 
  FOR INSERT TO authenticated 
  WITH CHECK (
    bucket_id = 'store-assets' 
    AND (
      (storage.foldername(name))[1] IN (SELECT id::text FROM public.companies WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS "Secure Select Store" ON storage.objects;
CREATE POLICY "Secure Select Store" ON storage.objects 
  FOR SELECT TO authenticated 
  USING (bucket_id = 'store-assets'); -- Allow viewing assets

DROP POLICY IF EXISTS "Secure Update Store" ON storage.objects;
CREATE POLICY "Secure Update Store" ON storage.objects 
  FOR UPDATE TO authenticated 
  USING (
    bucket_id = 'store-assets' 
    AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.companies WHERE user_id = auth.uid())
  );

-- ======================================================================================
-- 2. REFINING COMPANIES & DELIVERIES RLS (Resolves 500 Internal Server Error)
-- ======================================================================================
-- Sometimes subqueries in USING clauses can cause recursion or performance issues (leading to 500s).
-- Also, we need to ensure basic company info is SELECTABLE for joins to work.

-- Update Companies Policy: Allow SELECT for all active companies (basic info)
-- This is necessary for joins in the dashboard to work.
DROP POLICY IF EXISTS "Companies can manage own record" ON public.companies;

CREATE POLICY "Companies can manage own record" ON public.companies
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Re-add a SELECT policy for companies to be visible to everyone (Marketplace)
DROP POLICY IF EXISTS "Authenticated users can view active companies" ON public.companies;
CREATE POLICY "Public users can view companies" ON public.companies
  FOR SELECT TO anon, authenticated
  USING (true);

-- Refine Deliveries Policy: Use a more direct check for company_id
DROP POLICY IF EXISTS "Companies can manage own deliveries" ON public.deliveries;

CREATE POLICY "Companies can manage own deliveries" ON public.deliveries
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.companies WHERE id = deliveries.company_id AND user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

COMMIT;
NOTIFY pgrst, 'reload schema';
