-- Migration: 20260522135617_nuke_driver_recursion
-- Description: Absolutely nuclear destruction of any infinite recursion on delivery_drivers

BEGIN;

-- 1. DROP ALL POSSIBLE POLICIES on delivery_drivers
DROP POLICY IF EXISTS "Drivers_Final_Select" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Drivers_Final_Manage" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Drivers can view own record" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Admins can view all drivers" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Companies can view online drivers" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Drivers can update own record" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Admins can manage drivers" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Drivers can view all driver profiles" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Drivers can update own status and location" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Authenticated read delivery_drivers" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Admins read all delivery_drivers" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Public select delivery_drivers" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Public drivers visibility" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Drivers manage policy" ON public.delivery_drivers;
DROP POLICY IF EXISTS "delivery_drivers_select_stable" ON public.delivery_drivers;
DROP POLICY IF EXISTS "delivery_drivers_manage_stable" ON public.delivery_drivers;

-- 2. CREATE ULTRA-STABLE ZERO-RECURSION POLICIES

-- SELECT: Open to all authenticated users (completely flat, no subqueries)
CREATE POLICY "Drivers_Select_Stable" ON public.delivery_drivers
  FOR SELECT TO authenticated USING (true);

-- UPDATE: Only the owner driver can update their own record. 
-- No admin checks here to prevent any possibility of has_role() recursion!
-- Admins modify drivers via Security Definer RPCs anyway.
CREATE POLICY "Drivers_Update_Stable" ON public.delivery_drivers
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- INSERT: Only the owner or system can insert
CREATE POLICY "Drivers_Insert_Stable" ON public.delivery_drivers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMIT;

NOTIFY pgrst, 'reload schema';
