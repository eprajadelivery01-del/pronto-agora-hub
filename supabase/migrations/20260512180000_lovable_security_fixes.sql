
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

-- Restrict base table access to Authenticated Owners/Admins
CREATE POLICY "Owners and admins can view company details" ON public.companies
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Create a SAFE VIEW for the Marketplace/Public
-- This view hides sensitive columns like phone, document, etc.
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

-- Allow drivers to only see deliveries explicitly assigned to them in full
CREATE POLICY "Drivers can view assigned deliveries" ON public.deliveries
  FOR SELECT TO authenticated
  USING (
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
    address, 
    region_id, 
    status, 
    value, 
    commission, 
    latitude, 
    longitude, 
    notes,
    created_at
FROM public.deliveries
WHERE (status = 'pending' OR status = 'broadcasted') AND driver_id IS NULL;

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
    -- Companies see reviews for their deliveries
    OR EXISTS (
      SELECT 1 FROM public.deliveries d
      JOIN public.companies c ON d.company_id = c.id
      WHERE d.id = reviews.delivery_id AND c.user_id = auth.uid()
    )
    -- Drivers see reviews for themselves
    OR EXISTS (
      SELECT 1 FROM public.delivery_drivers dr
      WHERE dr.id = reviews.driver_id AND dr.user_id = auth.uid()
    )
    -- The reviewer (if user_id exists in reviews, otherwise linked via delivery/order)
    OR EXISTS (
      SELECT 1 FROM public.deliveries d
      JOIN public.orders o ON d.id = o.delivery_id
      JOIN public.customers cu ON o.customer_id = cu.id
      WHERE d.id = reviews.delivery_id AND cu.user_id = auth.uid()
    )
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

-- Try to secure the settings table (handling multiple possible names)
DO $$ 
BEGIN 
  -- Handle 'platform_settings'
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='platform_settings') THEN
    ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Autenticados podem ler as configurações da plataforma" ON public.platform_settings;
    CREATE POLICY "Only admins can read platform settings" ON public.platform_settings
      FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  -- Handle 'platform_config'
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='platform_config') THEN
    ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Anyone can view platform config" ON public.platform_config;
    CREATE POLICY "Only admins can read platform config" ON public.platform_config
      FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

COMMIT;
NOTIFY pgrst, 'reload schema';
