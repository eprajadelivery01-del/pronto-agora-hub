
-- Migration: 20260517003000_fix_user_roles_recursion
-- Description: Fixes RLS infinite recursion in the user_roles table by removing 
-- the self-referencing subquery and using the SECURITY DEFINER has_role function instead.

BEGIN;

-- 1. Drop the recursive policy from user_roles
DROP POLICY IF EXISTS "user_roles_admin_stable" ON public.user_roles;

-- 2. Create a clean, stable, non-recursive admin policy using has_role (which runs as SECURITY DEFINER and bypasses RLS)
CREATE POLICY "user_roles_admin_stable" ON public.user_roles
  FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

COMMIT;

NOTIFY pgrst, 'reload schema';
