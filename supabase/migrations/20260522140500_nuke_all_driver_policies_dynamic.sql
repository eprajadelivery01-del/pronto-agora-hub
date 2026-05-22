-- Migration: 20260522140500_nuke_all_driver_policies_dynamic.sql

BEGIN;

-- 1. DYNAMICALLY DROP EVERY POLICY ON delivery_drivers
-- This catches ANY policy created manually via the Supabase Dashboard UI or Lovable
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'delivery_drivers' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.delivery_drivers', pol.policyname);
    END LOOP;
END $$;

-- 2. CREATE ULTRA-STABLE ZERO-RECURSION POLICIES

-- SELECT: Open to all authenticated users (completely flat, no subqueries)
CREATE POLICY "Drivers_Select_Stable" ON public.delivery_drivers
  FOR SELECT TO authenticated USING (true);

-- UPDATE: Only the owner driver can update their own record. 
-- No admin checks here to prevent any possibility of has_role() recursion!
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
