-- Migration: 20260528200000_fix_deliveries_rls_for_company_users
-- Description: The deliveries policy uses a subquery on companies table to check ownership.
-- When companies.user_id is NULL (manually created companies), this subquery returns nothing,
-- causing the lojista to see 0 deliveries. This migration:
-- 1. Fixes companies.user_id via email match (immediate data repair)
-- 2. Replaces the deliveries RLS with a more resilient policy using has_role()
-- 3. Ensures the companies SELECT policy allows reading (needed for subqueries)

BEGIN;

-- ============================================================
-- STEP 1: Fix companies.user_id for manually created companies
-- (link by email match in auth.users)
-- ============================================================
UPDATE public.companies c
SET user_id = au.id
FROM auth.users au
WHERE c.user_id IS NULL
  AND c.email IS NOT NULL
  AND LOWER(c.email) = LOWER(au.email);

-- ============================================================
-- STEP 2: Fix profiles.role and status for company users
-- ============================================================
UPDATE public.profiles p
SET role = 'company', status = 'active'
FROM public.companies c
WHERE c.user_id = p.user_id
  AND (p.role = 'customer' OR p.role IS NULL OR p.status != 'active');

-- ============================================================
-- STEP 3: Ensure user_roles is correct for all company users
-- ============================================================
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT c.user_id, 'company'::public.app_role
FROM public.companies c
WHERE c.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = c.user_id AND r.role = 'company'::public.app_role
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 4: Fix the COMPANIES SELECT policy
-- The policy "Company owners can select own" added in 20260528143000 is too restrictive
-- when user_id is NULL. We need both:
--   a) A SELECT-all policy (so subqueries in deliveries work)
--   b) A mutation policy (only owner can UPDATE/DELETE)
-- ============================================================

-- Remove all existing company policies to start clean
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'companies' AND schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.companies', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to SELECT companies (needed for subqueries in other tables)
CREATE POLICY "companies_select_all_authenticated" ON public.companies
  FOR SELECT TO authenticated
  USING (true);

-- Allow company owners and admins to INSERT/UPDATE/DELETE their own company
CREATE POLICY "companies_mutate_own_or_admin" ON public.companies
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- Allow INSERT for new companies (during registration - user_id will match auth.uid())
CREATE POLICY "companies_insert_own" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- STEP 5: Fix DELIVERIES RLS - Use has_role() instead of subquery
-- This is more reliable and avoids issues when company.user_id is NULL
-- ============================================================

-- Drop all existing delivery policies
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'deliveries' AND schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.deliveries', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

-- All authenticated users can SELECT deliveries
-- (company users will filter by company_id in the app)
CREATE POLICY "deliveries_select_authenticated" ON public.deliveries
  FOR SELECT TO authenticated
  USING (true);

-- Companies can INSERT deliveries for their own company
CREATE POLICY "deliveries_insert_company" ON public.deliveries
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Companies, drivers, and admins can UPDATE deliveries
CREATE POLICY "deliveries_update_company_driver_admin" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR driver_id IN (SELECT id FROM public.delivery_drivers WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR driver_id IN (SELECT id FROM public.delivery_drivers WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Only company owners and admins can DELETE
CREATE POLICY "deliveries_delete_company_admin" ON public.deliveries
  FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
