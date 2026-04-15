-- SECURITY HARDENING MIGRATION (2026-04-15)
-- Resolving 2 critical RLS vulnerabilities identified by the scanner

BEGIN;

-- 1. [INVITATIONS] RESTRICT TOKEN EXPOSURE
-- The previous policy 'Anyone can view invitation by token' allowed any user (authenticated or not) 
-- to read ALL invitations using SELECT * FROM invitations.
DROP POLICY IF EXISTS "Anyone can view invitation by token" ON public.invitations;

-- New Policy: Only allow selection if the exact token is known (lookup only)
-- Note: In Supabase, standard RLS 'SELECT' where 'token = target' is safe if the user doesn't have list permissions.
-- However, to be extra safe, we only allow admins to manage, and others to look up by exact token match.
CREATE POLICY "Look up invitation by token" ON public.invitations
  FOR SELECT USING (true); 
-- WAIT! The scanner said USING (true) is the problem because it allows LISTING.
-- To allow LOOKUP but prevent LISTING of all tokens:
-- We should use a policy that requires the token to be part of the query filter and not return everything.
-- But standard SQL RLS doesn't distinguish between 'lookup' and 'list' without complex logic.
-- Better approach: Only Admins can SELECT. For the signup flow, we can use a security definer function.
DROP POLICY IF EXISTS "Look up invitation by token" ON public.invitations;
CREATE POLICY "Admins can manage invitations" ON public.invitations
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 2. [STORAGE] HARDEN EMERGENCY POLICIES
-- Bucket: store-assets
DROP POLICY IF EXISTS "Emergency Insert Store" ON storage.objects;
CREATE POLICY "Secure Insert Store" ON storage.objects 
  FOR INSERT TO authenticated 
  WITH CHECK (
    bucket_id = 'store-assets' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Bucket: avatars
DROP POLICY IF EXISTS "Emergency Insert Avatar" ON storage.objects;
CREATE POLICY "Secure Insert Avatar" ON storage.objects 
  FOR INSERT TO authenticated 
  WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
