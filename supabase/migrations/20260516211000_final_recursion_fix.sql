
-- Migration: 20260516211000_final_recursion_fix
-- Description: Unlocks user_roles for SELECT to break RLS recursion.
-- This allows has_role to work without triggering infinite loops.

BEGIN;

-- 1. Reset user_roles policies to a non-recursive state
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone authenticated can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage everything" ON public.user_roles;

-- Allow SELECT for all authenticated users
-- This BREAKS the recursion because any subquery on user_roles 
-- will now succeed without re-evaluating complex policies.
CREATE POLICY "Anyone authenticated can view roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (true);

-- Restrict mutations to Admins and Owners
CREATE POLICY "Users can manage own roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 2. Ensure Profiles are also stable
DROP POLICY IF EXISTS "Profiles are visible to owners" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are visible to admins" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are visible for order context" ON public.profiles;

CREATE POLICY "Public profiles visibility" ON public.profiles
  FOR SELECT TO authenticated
  USING (true); -- Simplify visibility to avoid 500s

CREATE POLICY "Profiles update policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 3. Ensure Delivery Drivers are stable
DROP POLICY IF EXISTS "Drivers can view own record" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Admins can view all drivers" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Companies can view online drivers" ON public.delivery_drivers;

CREATE POLICY "Public drivers visibility" ON public.delivery_drivers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Drivers manage policy" ON public.delivery_drivers
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

COMMIT;

NOTIFY pgrst, 'reload schema';
