-- ========================================================
-- Migration: 20260413084800_sync_schema_and_rls
-- Resolve: pickup_address constraint & customers RLS
-- ========================================================

-- 1. FIX DELIVERIES SCHEMA
-- Ensure pickup_address exists and is NULLABLE to avoid constraint violations
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='pickup_address') THEN
    ALTER TABLE public.deliveries ADD COLUMN pickup_address TEXT;
  END IF;
  
  -- Ensure it's not restricted as NOT NULL if we want flexibility
  ALTER TABLE public.deliveries ALTER COLUMN pickup_address DROP NOT NULL;
END $$;

-- 2. FIX CUSTOMERS RLS
-- Allow companies to MANAGE (Insert/Update) customers they interact with
DROP POLICY IF EXISTS "Companies can manage customers" ON public.customers;
CREATE POLICY "Companies can manage customers" ON public.customers
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'company') OR 
    public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'company') OR 
    public.has_role(auth.uid(), 'admin')
  );

-- 3. FIX ADDRESSES RLS
-- Allow companies to MANAGE addresses for the customers they are delivering to
DROP POLICY IF EXISTS "Companies can manage addresses" ON public.addresses;
CREATE POLICY "Companies can manage addresses" ON public.addresses
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'company') OR 
    public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'company') OR 
    public.has_role(auth.uid(), 'admin')
  );

-- 4. REFRESH
NOTIFY pgrst, 'reload schema';
