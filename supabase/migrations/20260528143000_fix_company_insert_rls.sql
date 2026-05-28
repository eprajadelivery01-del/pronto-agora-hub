-- Migration: Add missing INSERT policy to companies table for lojistas
-- This allows newly registered merchants to successfully create their company record on the client-side.

-- 1. Create INSERT policy for authenticated users to insert their own company row
DROP POLICY IF EXISTS "Company owners can insert own" ON public.companies;
CREATE POLICY "Company owners can insert own" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2. Create SELECT policy for authenticated users to select their own company row, even if active/is_active is false
DROP POLICY IF EXISTS "Company owners can select own" ON public.companies;
CREATE POLICY "Company owners can select own" ON public.companies
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3. Reload schema cache to apply immediately
NOTIFY pgrst, 'reload schema';
