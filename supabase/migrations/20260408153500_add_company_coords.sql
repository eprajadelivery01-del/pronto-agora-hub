-- Add latitude and longitude to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Update RLS if necessary (usually select * already works)
-- Ensure the columns are documented in profiles if needed, but companies table is enough for now.
