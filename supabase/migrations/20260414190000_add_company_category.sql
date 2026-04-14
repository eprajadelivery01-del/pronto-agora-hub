-- Migration: Add the 'category' column to companies for marketplace filtering
-- This allows stores to be categorized as 'mercado', 'farmacia', etc.

-- 1. Add the column
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS category TEXT;

-- 2. Create an index for faster filtering
CREATE INDEX IF NOT EXISTS idx_companies_category ON public.companies(category);

-- 3. Set a default for existing companies (most are restaurants)
UPDATE public.companies 
SET category = 'restaurante' 
WHERE category IS NULL;

-- 4. Update RLS policies to ensure the column is visible to anyone (anon)
-- The existing 'Anyone can view active companies' policy already covers all columns, 
-- but we make sure the schema is refreshed for the API.
NOTIFY pgrst, 'reload schema';
