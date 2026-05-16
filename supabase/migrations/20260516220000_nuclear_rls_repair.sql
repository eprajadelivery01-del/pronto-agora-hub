
-- Migration: 20260516220000_nuclear_rls_repair
-- Description: Drops EVERY known RLS policy for profiles and delivery_drivers 
-- to ensure no hidden recursion exists. Then sets up a clean, stable state.

BEGIN;

-- 1. CLEANUP PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Companies can view customer profiles" ON public.profiles;
DROP POLICY IF EXISTS "Lojistas veem perfis de seus clientes" ON public.profiles;
DROP POLICY IF EXISTS "Permissions_Unlock_Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Os usuários atualizam seus próprios perfis" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by users who own them" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Names are public" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are visible to owners" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are visible to admins" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are visible for order context" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles visibility" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile safely" ON public.profiles;

-- 2. CLEANUP DELIVERY_DRIVERS
DROP POLICY IF EXISTS "Drivers can view own record" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Admins can view all drivers" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Drivers can update own record" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Admins can manage drivers" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Companies can view online drivers" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Drivers can view all driver profiles" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Drivers can update own status and location" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Authenticated read delivery_drivers" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Admins read all delivery_drivers" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Public select delivery_drivers" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Public drivers visibility" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Drivers manage policy" ON public.delivery_drivers;

-- 3. ESTABLISH CLEAN STABLE STATE
-- Profiles: SELECT is completely open to authenticated users (No recursion possible)
CREATE POLICY "Profiles_Final_Select" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Profiles: UPDATE only for owner or admin
CREATE POLICY "Profiles_Final_Update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Delivery Drivers: SELECT is completely open to authenticated users
CREATE POLICY "Drivers_Final_Select" ON public.delivery_drivers
  FOR SELECT TO authenticated
  USING (true);

-- Delivery Drivers: ALL only for owner or admin
CREATE POLICY "Drivers_Final_Manage" ON public.delivery_drivers
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

COMMIT;

NOTIFY pgrst, 'reload schema';
