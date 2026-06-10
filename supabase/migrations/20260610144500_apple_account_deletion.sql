-- Migration: Add account deletion RPC to comply with Apple App Store Guidelines (5.1.1)

BEGIN;

-- Create a secure RPC function that allows a user to completely delete their own account.
-- This is a strict requirement for Apple App Store approval.
-- The function runs as SECURITY DEFINER to bypass RLS and delete from auth.users.
-- Due to ON DELETE CASCADE on our tables (profiles, customers, etc.), deleting from auth.users
-- will automatically wipe all personal data associated with the user, complying with GDPR/LGPD.

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the current authenticated user's ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado. Faça login para deletar a conta.';
  END IF;

  -- Delete the user from auth.users. 
  -- ON DELETE CASCADE will handle the rest.
  DELETE FROM auth.users WHERE id = v_user_id;

END;
$$;

-- Grant execution explicitly to authenticated users only
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM anon;

COMMIT;
