-- ========================================================
-- Migration: 20260413082300_fix_storage_rls
-- Improve RLS policies for storage buckets
-- ========================================================

-- 1. Cleanup
DROP POLICY IF EXISTS "Store assets are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload store assets" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update their store assets" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete their store assets" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Upload Logic" ON storage.objects;
DROP POLICY IF EXISTS "Update Logic" ON storage.objects;
DROP POLICY IF EXISTS "Delete Logic" ON storage.objects;
DROP POLICY IF EXISTS "Public Avatar Access" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Upload Logic" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Update Logic" ON storage.objects;

-- 2. Bucket: store-assets
CREATE POLICY "Public Store Access" ON storage.objects FOR SELECT USING (bucket_id = 'store-assets');

CREATE POLICY "Owners Upload Store" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'store-assets' AND 
  (EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id::text = (storage.foldername(name))[1] 
    AND user_id = auth.uid()
  ))
);

CREATE POLICY "Owners Update Store" ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'store-assets' AND 
  (EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id::text = (storage.foldername(name))[1] 
    AND user_id = auth.uid()
  ))
);

CREATE POLICY "Owners Delete Store" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'store-assets' AND 
  (EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id::text = (storage.foldername(name))[1] 
    AND user_id = auth.uid()
  ))
);

-- 3. Bucket: avatars
CREATE POLICY "Public Avatar Access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users Upload Avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users Update Avatar" ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Notify PostgREST
NOTIFY pgrst, 'reload schema';
