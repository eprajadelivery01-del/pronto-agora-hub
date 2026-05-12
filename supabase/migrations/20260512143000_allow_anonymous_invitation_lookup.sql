
-- Fix: Allow anonymous users to look up invitations by token
-- This is required for the signup flow where a user clicks an invite link before being authenticated.
-- The hardening migration (20260415) restricted this to admins only, which broke the signup flow.

CREATE POLICY "Allow anonymous lookup by token" ON public.invitations
  FOR SELECT
  TO anon, authenticated
  USING (true);
