
-- Migration: 20260516210000_de_recursify_rls
-- Description: Fixes 500 errors caused by RLS recursion in user_roles and profiles.
-- Also hardens delivery_drivers access.

BEGIN;

-- 1. Redefine has_role to be even more robust
-- Using a SECURITY DEFINER function to bypass RLS on user_roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 2. Fix User Roles Policies (The Root of Recursion)
-- We must avoid calling has_role inside user_roles policies!
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- Basic user access
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admin access (Direct check to avoid recursion)
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 3. Fix Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Companies can view customer profiles" ON public.profiles;

-- Owner always sees own
CREATE POLICY "Profiles are visible to owners" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins see everything (Using the robust has_role)
CREATE POLICY "Profiles are visible to admins" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Marketplace/Company visibility
CREATE POLICY "Profiles are visible for order context" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT customer_id FROM public.orders 
      WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
    OR
    user_id IN (
      SELECT customer_id FROM public.orders 
      WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  );

-- 4. Fix Delivery Drivers Policies
DROP POLICY IF EXISTS "Drivers can view own record" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Admins can view all drivers" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Companies can view online drivers" ON public.delivery_drivers;

CREATE POLICY "Drivers can view own record" ON public.delivery_drivers
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all drivers" ON public.delivery_drivers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Companies can view online drivers" ON public.delivery_drivers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'company')); -- Simplified check

COMMIT;

NOTIFY pgrst, 'reload schema';
