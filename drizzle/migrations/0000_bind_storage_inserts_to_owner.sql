DROP POLICY IF EXISTS "Avatars authenticated insert" ON storage.objects;
CREATE POLICY "Avatars authenticated insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND owner_id = (select auth.uid()::text));

DROP POLICY IF EXISTS "Store assets authenticated insert" ON storage.objects;
CREATE POLICY "Store assets authenticated insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-assets' AND owner_id = (select auth.uid()::text));