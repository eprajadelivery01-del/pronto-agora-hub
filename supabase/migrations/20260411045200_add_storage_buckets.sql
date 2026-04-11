-- =============================================
-- CREATE STORAGE BUCKET FOR STORE ASSETS
-- =============================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for public accessibility
CREATE POLICY "Store assets are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'store-assets');

-- Policies for authenticated uploads
-- Pattern: store-assets/{company_id}/{filename}
-- We check if the user uploading is the owner of the company associated with the company_id in the path
CREATE POLICY "Authenticated users can upload store assets" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'store-assets' 
    AND (
      EXISTS (
        SELECT 1 FROM public.companies 
        WHERE id::text = (storage.foldername(name))[1] 
        AND user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Owners can update their store assets" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'store-assets' 
    AND (
      EXISTS (
        SELECT 1 FROM public.companies 
        WHERE id::text = (storage.foldername(name))[1] 
        AND user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Owners can delete their store assets" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'store-assets' 
    AND (
      EXISTS (
        SELECT 1 FROM public.companies 
        WHERE id::text = (storage.foldername(name))[1] 
        AND user_id = auth.uid()
      )
    )
  );
