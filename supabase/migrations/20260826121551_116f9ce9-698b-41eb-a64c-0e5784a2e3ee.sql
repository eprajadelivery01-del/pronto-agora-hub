-- Remove leftover "Emergency" storage policies, replacing them with clean owner-scoped policies.
DROP POLICY IF EXISTS "Emergency Insert Store" ON storage.objects;
DROP POLICY IF EXISTS "Emergency Update Store" ON storage.objects;
DROP POLICY IF EXISTS "Emergency Delete Store" ON storage.objects;
DROP POLICY IF EXISTS "Emergency Insert Avatar" ON storage.objects;
DROP POLICY IF EXISTS "Emergency Update Avatar" ON storage.objects;
DROP POLICY IF EXISTS "Emergency Delete Avatar" ON storage.objects;

DROP POLICY IF EXISTS "Store assets authenticated insert" ON storage.objects;
CREATE POLICY "Store assets authenticated insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-assets');

DROP POLICY IF EXISTS "Store assets owner update" ON storage.objects;
CREATE POLICY "Store assets owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'store-assets' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'store-assets' AND owner = auth.uid());

DROP POLICY IF EXISTS "Store assets owner delete" ON storage.objects;
CREATE POLICY "Store assets owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'store-assets' AND owner = auth.uid());

DROP POLICY IF EXISTS "Avatars authenticated insert" ON storage.objects;
CREATE POLICY "Avatars authenticated insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatars owner update" ON storage.objects;
CREATE POLICY "Avatars owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());

DROP POLICY IF EXISTS "Avatars owner delete" ON storage.objects;
CREATE POLICY "Avatars owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid());