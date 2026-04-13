-- ========================================================
-- Migration: 20260413083700_nuclear_storage_rls
-- Emergency bypass for storage RLS to allow immediate uploads
-- ========================================================

-- 1. Radical cleanup of all storage policies
DELETE FROM storage.policies WHERE bucket_id IN ('store-assets', 'avatars');

-- 2. Bucket: store-assets
-- Allow public select
CREATE POLICY "Public Select Store" ON storage.objects FOR SELECT USING (bucket_id = 'store-assets');

-- Allow any authenticated user to insert into store-assets (NO FOLDER VALIDATION)
CREATE POLICY "Emergency Insert Store" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'store-assets');

-- Manage only own files (basic security)
CREATE POLICY "Emergency Update Store" ON storage.objects FOR UPDATE TO authenticated USING (auth.uid() = owner AND bucket_id = 'store-assets');
CREATE POLICY "Emergency Delete Store" ON storage.objects FOR DELETE TO authenticated USING (auth.uid() = owner AND bucket_id = 'store-assets');

-- 3. Bucket: avatars
-- Allow public select
CREATE POLICY "Public Select Avatar" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- Allow any authenticated user to insert into avatars (NO FOLDER VALIDATION)
CREATE POLICY "Emergency Insert Avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

-- Manage only own files
CREATE POLICY "Emergency Update Avatar" ON storage.objects FOR UPDATE TO authenticated USING (auth.uid() = owner AND bucket_id = 'avatars');
CREATE POLICY "Emergency Delete Avatar" ON storage.objects FOR DELETE TO authenticated USING (auth.uid() = owner AND bucket_id = 'avatars');

-- 4. Notify PostgREST
NOTIFY pgrst, 'reload schema';
