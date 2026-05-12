
-- Migration: 20260512180000_lovable_security_fixes
-- Description: Fix security vulnerabilities identified by the Lovable Security Scan.

BEGIN;

-- ======================================================================================
-- 1. COMPANIES - RESTRICT SENSITIVE DATA (Email, Phone, Document)
-- ======================================================================================

-- Drop ALL existing policies on companies to start fresh
DO $$ 
DECLARE pol record;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'companies' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.companies', pol.policyname);
    END LOOP;
END $$;

-- Allow Companies to manage their own record (ALL operations)
CREATE POLICY "Companies can manage own record" ON public.companies
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Create a SAFE VIEW for the Marketplace/Public
-- This view hides sensitive columns like phone, document, and email.
CREATE OR REPLACE VIEW public.store_public_info AS
SELECT 
    id, 
    name, 
    logo_url, 
    cover_url, 
    description, 
    address, 
    latitude, 
    longitude, 
    is_active,
    created_at
FROM public.companies
WHERE is_active = true;

-- Grant access to the view
GRANT SELECT ON public.store_public_info TO anon, authenticated;

-- ======================================================================================
-- 2. DELIVERIES - PROTECT CUSTOMER PII (Name, Phone, CPF)
-- ======================================================================================

-- Drop ALL existing policies on deliveries to start fresh
DO $$ 
DECLARE pol record;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'deliveries' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.deliveries', pol.policyname);
    END LOOP;
END $$;

-- Allow Companies to manage their own deliveries (ALL operations)
CREATE POLICY "Companies can manage own deliveries" ON public.deliveries
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) 
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) 
    OR public.has_role(auth.uid(), 'admin')
  );

-- Allow drivers to see deliveries explicitly assigned to them in full
CREATE POLICY "Drivers can view assigned deliveries" ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    driver_id IN (SELECT id FROM public.delivery_drivers WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Allow drivers to accept and update their deliveries
CREATE POLICY "Drivers can update assigned deliveries" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (
    driver_id IN (SELECT id FROM public.delivery_drivers WHERE user_id = auth.uid())
    OR (status IN ('pending', 'broadcasted') AND driver_id IS NULL) -- Allow claiming
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    driver_id IN (SELECT id FROM public.delivery_drivers WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Create a SAFE VIEW for available (pending/broadcasted) deliveries
-- This view redacts PII until the driver is assigned.
CREATE OR REPLACE VIEW public.available_deliveries AS
SELECT 
    id, 
    company_id, 
    -- Redact PII
    'Cliente'::TEXT as customer_name,
    '***'::TEXT as customer_phone,
    '***'::TEXT as customer_cpf,
    delivery_address, 
    delivery_latitude, 
    delivery_longitude, 
    status, 
    value, 
    commission, 
    notes,
    created_at
FROM public.deliveries
WHERE (status = 'pending' OR status = 'broadcasted') AND driver_id IS NULL AND motoboy_id IS NULL;

-- Grant access to the view
GRANT SELECT ON public.available_deliveries TO authenticated;

-- ======================================================================================
-- 3. REVIEWS - RESTRICT TO RELEVANT PARTIES
-- ======================================================================================

-- Drop ALL existing policies on reviews to start fresh
DO $$ 
DECLARE pol record;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'reviews' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.reviews', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "Relevant parties can view reviews" ON public.reviews
  FOR SELECT TO authenticated
  USING (
    -- Admins
    public.has_role(auth.uid(), 'admin')
    -- User who wrote the review
    OR user_id = auth.uid()
    -- Company being reviewed
    OR (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
    -- Driver being reviewed
    OR (driver_id IN (SELECT id FROM public.delivery_drivers WHERE user_id = auth.uid()))
  );

-- ======================================================================================
-- 4. MOTOBOYS (DRIVER LIST) - RESTRICT ACCESS
-- ======================================================================================

ALTER TABLE IF EXISTS public.motoboys ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on motoboys to start fresh
DO $$ 
DECLARE pol record;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'motoboys' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.motoboys', pol.policyname);
    END LOOP;
END $$;

-- Only Admins and Companies can see the full list of drivers for dispatch
CREATE POLICY "Admins and Companies can view motoboys" ON public.motoboys
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'company')
  );

-- ======================================================================================
-- 5. PLATFORM SETTINGS - RESTRICT TO ADMINS
-- ======================================================================================

ALTER TABLE IF EXISTS public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on platform_settings to start fresh
DO $$ 
DECLARE pol record;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'platform_settings' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.platform_settings', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "Only admins can read platform settings" ON public.platform_settings
  FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

COMMIT;
NOTIFY pgrst, 'reload schema';
