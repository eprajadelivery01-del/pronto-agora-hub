-- =============================================
-- Migration: Add cover_url and description to companies
-- =============================================

DO $$
BEGIN
  -- Add cover_url column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'cover_url'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN cover_url TEXT;
  END IF;

  -- Add description column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'description'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN description TEXT;
  END IF;
END $$;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
