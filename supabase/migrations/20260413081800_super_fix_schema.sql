-- ========================================================
-- Migration: 20260413081800_super_fix_schema
-- Consolidate missing columns and storage infrastructure
-- ========================================================

-- 1. Companies Schema Fix
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'cover_url') THEN
    ALTER TABLE public.companies ADD COLUMN cover_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'description') THEN
    ALTER TABLE public.companies ADD COLUMN description TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'latitude') THEN
    ALTER TABLE public.companies ADD COLUMN latitude DOUBLE PRECISION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'longitude') THEN
    ALTER TABLE public.companies ADD COLUMN longitude DOUBLE PRECISION;
  END IF;
END $$;

-- 2. Storage Buckets Fix
INSERT INTO storage.buckets (id, name, public) VALUES ('store-assets', 'store-assets', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies Fix
DROP POLICY IF EXISTS "Store assets are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload store assets" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update their store assets" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete their store assets" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;

CREATE POLICY "Store assets are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'store-assets');
CREATE POLICY "Authenticated users can upload store assets" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'store-assets' AND (EXISTS (SELECT 1 FROM public.companies WHERE id::text = (storage.foldername(name))[1] AND user_id = auth.uid()))
);
CREATE POLICY "Owners can update their store assets" ON storage.objects FOR UPDATE USING (
  bucket_id = 'store-assets' AND (EXISTS (SELECT 1 FROM public.companies WHERE id::text = (storage.foldername(name))[1] AND user_id = auth.uid()))
);
CREATE POLICY "Owners can delete their store assets" ON storage.objects FOR DELETE USING (
  bucket_id = 'store-assets' AND (EXISTS (SELECT 1 FROM public.companies WHERE id::text = (storage.foldername(name))[1] AND user_id = auth.uid()))
);

CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
