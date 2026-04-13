-- ========================================================
-- Migration: 20260413083300_ultimate_storage_rls
-- Robust RLS policies for storage buckets using split_part
-- ========================================================

-- 1. Cleanup all previous attempts
DROP POLICY IF EXISTS "Public Store Access" ON storage.objects;
DROP POLICY IF EXISTS "Owners Upload Store" ON storage.objects;
DROP POLICY IF EXISTS "Owners Update Store" ON storage.objects;
DROP POLICY IF EXISTS "Owners Delete Store" ON storage.objects;
DROP POLICY IF EXISTS "Public Avatar Access" ON storage.objects;
DROP POLICY IF EXISTS "Users Upload Avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users Update Avatar" ON storage.objects;
DROP POLICY IF EXISTS "Public Read" ON storage.objects;
DROP POLICY IF EXISTS "Lojista Upload" ON storage.objects;
DROP POLICY IF EXISTS "Lojista Update" ON storage.objects;
DROP POLICY IF EXISTS "Lojista Delete" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Public Read" ON storage.objects;
DROP POLICY IF EXISTS "User Avatar Upload" ON storage.objects;
DROP POLICY IF EXISTS "User Avatar Update" ON storage.objects;

-- 2. Bucket: store-assets
CREATE POLICY "Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'store-assets');

CREATE POLICY "Lojista Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'store-assets' AND 
  (EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id::text = split_part(name, '/', 1)
    AND user_id = auth.uid()
  ))
);

CREATE POLICY "Lojista Update" ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'store-assets' AND 
  (EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id::text = split_part(name, '/', 1)
    AND user_id = auth.uid()
  ))
);

CREATE POLICY "Lojista Delete" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'store-assets' AND 
  (EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id::text = split_part(name, '/', 1)
    AND user_id = auth.uid()
  ))
);

-- 3. Bucket: avatars
CREATE POLICY "Avatar Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "User Avatar Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'avatars' AND 
  split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "User Avatar Update" ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'avatars' AND 
  split_part(name, '/', 1) = auth.uid()::text
);

-- 4. Notify PostgREST
NOTIFY pgrst, 'reload schema';
