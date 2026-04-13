-- Migration: 20260413133000_nuclear_deliveries_rls
-- Description: Overhaul RLS policies for deliveries table to support all CRUD operations for companies

-- 1. CLEANUP: Drop all existing policies on deliveries to start fresh
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'deliveries' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.deliveries', pol.policyname);
    END LOOP;
END $$;

-- 2. ENABLE RLS (Ensure it's active)
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

-- 3. PERMISSIVE POLICIES FOR COMPANIES
-- Companies can managed their own deliveries (INSERT, UPDATE, DELETE, SELECT)
CREATE POLICY "Companies can manage own deliveries" ON public.deliveries
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin')
  );

-- 4. NUCLEAR FIX FOR COMPANIES (To ensure subqueries in deliveries always work)
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'companies' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.companies', pol.policyname);
    END LOOP;
END $$;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Companies can manage own record" ON public.companies
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can view active companies" ON public.companies
  FOR SELECT TO authenticated
  USING (is_active = true OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 5. RELOAD
NOTIFY pgrst, 'reload schema';
