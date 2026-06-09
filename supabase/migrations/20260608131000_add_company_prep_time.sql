-- Add average preparation time to companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS prep_time_min INTEGER NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS prep_time_max INTEGER NOT NULL DEFAULT 45;
