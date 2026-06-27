-- =====================================================================
-- SECURITY FIX — Finding: emergency_insert_storage
-- Run this in your EXTERNAL Supabase project (SQL Editor) to harden the
-- emergency storage policies on the `store-assets` and `avatars` buckets.
--
-- It drops the permissive emergency UPDATE/DELETE policies and replaces
-- them with owner-scoped policies: an authenticated user may only modify
-- or delete files inside their own user-id-prefixed folder.
-- =====================================================================

BEGIN;

-- ---------- Bucket: store-assets ----------
DROP POLICY IF EXISTS "Emergency Update Store" ON storage.objects;
DROP POLICY IF EXISTS "Emergency Delete Store" ON storage.objects;

CREATE POLICY "Secure Update Store" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Secure Delete Store" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Bucket: avatars ----------
DROP POLICY IF EXISTS "Emergency Update Avatar" ON storage.objects;
DROP POLICY IF EXISTS "Emergency Delete Avatar" ON storage.objects;

CREATE POLICY "Secure Update Avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Secure Delete Avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

COMMIT;
