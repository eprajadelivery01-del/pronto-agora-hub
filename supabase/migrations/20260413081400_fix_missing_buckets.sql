-- ========================================================
-- SCRIPT DE CORREÇÃO: CRIAÇÃO DE BUCKETS DE STORAGE
-- ========================================================

-- 1. Criar Buckets se não existirem
INSERT INTO storage.buckets (id, name, public) 
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas para o bucket 'store-assets'
CREATE POLICY "Store assets are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'store-assets');

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

-- 3. Políticas para o bucket 'avatars'
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
