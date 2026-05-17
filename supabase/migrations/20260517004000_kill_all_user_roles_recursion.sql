-- Migration: 20260517004000_kill_all_user_roles_recursion
-- Description: Completely eliminates all RLS recursion loops on the user_roles table.
-- Replaces the FOR ALL policy (which triggers recursive SELECT loops) with a non-recursive FOR SELECT USING (true).

BEGIN;

-- 1. Drop all existing recursive policies from user_roles
DROP POLICY IF EXISTS "user_roles_admin_stable" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_stable" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_read_all" ON public.user_roles;

-- 2. Create a clean, completely non-recursive SELECT policy for authenticated users
CREATE POLICY "user_roles_read_all" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

-- 3. Revoke direct REST write permissions on user_roles (Admins should manage it via Service Role or SECURITY DEFINER functions only)
-- By not creating any INSERT, UPDATE, or DELETE policies, write operations are secure and only allowed via Service Role or SECURITY DEFINER.

COMMIT;

NOTIFY pgrst, 'reload schema';
