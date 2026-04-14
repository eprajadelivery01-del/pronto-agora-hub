-- Migration: Add 'is_open' status and 'business_hours' info to companies
-- This allows merchants to manually open/close their stores and show schedule to customers.

-- 1. Add the columns
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT true;

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS business_hours TEXT;

-- 2. Update existing companies to be open by default
UPDATE public.companies SET is_open = true WHERE is_open IS NULL;

-- 3. Notify postgrest to reload the schema
NOTIFY pgrst, 'reload schema';
