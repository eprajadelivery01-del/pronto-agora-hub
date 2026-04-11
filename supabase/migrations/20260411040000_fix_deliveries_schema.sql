-- =============================================
-- FIX: Ensure deliveries table has all required columns
-- This migration is safe to run multiple times (IF NOT EXISTS)
-- =============================================

-- Add 'address' column if missing (deliveries table uses 'address' for dropoff location)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'deliveries'
      AND column_name = 'address'
  ) THEN
    ALTER TABLE public.deliveries ADD COLUMN address TEXT;
  END IF;
END $$;

-- Add 'company_id' column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'deliveries'
      AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.deliveries ADD COLUMN company_id UUID REFERENCES public.companies(id);
  END IF;
END $$;

-- Add 'value' column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'deliveries'
      AND column_name = 'value'
  ) THEN
    ALTER TABLE public.deliveries ADD COLUMN value NUMERIC(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add 'commission' column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'deliveries'
      AND column_name = 'commission'
  ) THEN
    ALTER TABLE public.deliveries ADD COLUMN commission NUMERIC(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add 'customer_name' column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'deliveries'
      AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE public.deliveries ADD COLUMN customer_name TEXT;
  END IF;
END $$;

-- Add 'notes' column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'deliveries'
      AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.deliveries ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Ensure companies can create deliveries (RLS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'deliveries'
      AND policyname = 'Companies can create deliveries'
  ) THEN
    CREATE POLICY "Companies can create deliveries" ON public.deliveries
      FOR INSERT WITH CHECK (
        company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Ensure companies can view own deliveries (RLS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'deliveries'
      AND policyname = 'Companies can view own deliveries'
  ) THEN
    CREATE POLICY "Companies can view own deliveries" ON public.deliveries
      FOR SELECT USING (
        company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Ensure companies table has required columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
