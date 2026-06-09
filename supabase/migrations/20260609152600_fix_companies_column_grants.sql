-- Migration: Grant SELECT on new companies columns to anon and authenticated
-- Supabase requires re-granting SELECT when new columns are added if column-level privileges exist
-- or if the schema was reloaded improperly.

GRANT SELECT ON public.companies TO anon, authenticated;

-- Also refresh postgrest schema
NOTIFY pgrst, 'reload schema';
