-- ========================================================
-- Migration: 20260416130000_fix_region_id_and_orders_schema
-- Description: Ensures all required columns exist and fixes RLS
-- ========================================================

BEGIN;

-- 1. REPAIR ORDERS TABLE
-- These columns exist in DB but might be missing from some schema snapshots
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='region_id') THEN
    ALTER TABLE public.orders ADD COLUMN region_id UUID REFERENCES public.regions(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='city_id') THEN
    ALTER TABLE public.orders ADD COLUMN city_id UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_address') THEN
    ALTER TABLE public.orders ADD COLUMN delivery_address TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_latitude') THEN
    ALTER TABLE public.orders ADD COLUMN delivery_latitude DOUBLE PRECISION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_longitude') THEN
    ALTER TABLE public.orders ADD COLUMN delivery_longitude DOUBLE PRECISION;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_fee') THEN
    ALTER TABLE public.orders ADD COLUMN delivery_fee NUMERIC(10,2) DEFAULT 0;
  END IF;
END $$;

-- 2. REPAIR DELIVERIES TABLE
-- Ensure region_id exists here too, as it is often a source of "column does not exist" errors in joins/RLS
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='region_id') THEN
    ALTER TABLE public.deliveries ADD COLUMN region_id UUID REFERENCES public.regions(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='city_id') THEN
    ALTER TABLE public.deliveries ADD COLUMN city_id UUID;
  END IF;
END $$;

-- 3. FIX ORDERS RLS
-- Drop all existing policies to avoid conflicts
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'orders' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', pol.policyname);
    END LOOP;
END $$;

-- Allow Admins full access
CREATE POLICY "Admins can manage orders" ON public.orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow Companies to manage their own orders
-- This includes UPDATE which was likely missing or broken
CREATE POLICY "Companies can manage own orders" ON public.orders
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin')
  );

-- Allow Customers to view their own orders
CREATE POLICY "Customers can view own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin')
  );

-- 4. REFRESH PostgREST cache
NOTIFY pgrst, 'reload schema';

COMMIT;
