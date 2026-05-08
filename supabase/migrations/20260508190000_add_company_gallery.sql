-- Migration: Add gallery to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS gallery JSONB DEFAULT '[]'::jsonb;

-- Update RLS if necessary (usually public.companies update policy covers all columns)
NOTIFY pgrst, 'reload schema';
