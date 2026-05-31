-- Migration: 20260528195000_rpc_get_company_for_current_user
-- Description: Creates a SECURITY DEFINER RPC that bypasses RLS to find the company
-- for the currently authenticated user, even when companies.user_id is NULL.
-- It also auto-heals the data (backfills user_id) so future lookups are fast.

CREATE OR REPLACE FUNCTION public.get_company_for_current_user()
RETURNS SETOF public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_company public.companies%ROWTYPE;
BEGIN
  -- Get the current user's ID and email from auth context
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN; -- Not authenticated
  END IF;

  -- Get the user's email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  -- Attempt 1: Direct match by user_id (fast path)
  SELECT * INTO v_company
  FROM public.companies
  WHERE user_id = v_user_id
  LIMIT 1;

  IF FOUND THEN
    RETURN NEXT v_company;
    RETURN;
  END IF;

  -- Attempt 2: Match by email (covers manually created companies with NULL user_id)
  IF v_user_email IS NOT NULL THEN
    SELECT * INTO v_company
    FROM public.companies
    WHERE LOWER(email) = LOWER(v_user_email)
    LIMIT 1;

    IF FOUND THEN
      -- Auto-heal: backfill user_id so next lookup is instant
      UPDATE public.companies
      SET user_id = v_user_id
      WHERE id = v_company.id AND user_id IS NULL;

      -- Also update profile role and status
      UPDATE public.profiles
      SET role = 'company', status = 'active'
      WHERE user_id = v_user_id AND (role != 'company' OR status != 'active');

      -- Ensure user_roles has the 'company' role
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_user_id, 'company')
      ON CONFLICT (user_id, role) DO NOTHING;

      -- Backfill profiles.company_id if column exists
      BEGIN
        EXECUTE format(
          'UPDATE public.profiles SET company_id = %L WHERE user_id = %L AND company_id IS NULL',
          v_company.id, v_user_id
        );
      EXCEPTION WHEN undefined_column THEN
        -- Column doesn't exist yet, ignore
        NULL;
      END;

      -- Return the company with updated user_id
      v_company.user_id := v_user_id;
      RETURN NEXT v_company;
      RETURN;
    END IF;
  END IF;

  -- No company found for this user
  RETURN;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_company_for_current_user() TO authenticated;

-- Also run the data repair directly as part of this migration:
-- Link companies to users by email match where user_id is NULL
UPDATE public.companies c
SET user_id = au.id
FROM auth.users au
WHERE c.user_id IS NULL
  AND c.email IS NOT NULL
  AND LOWER(c.email) = LOWER(au.email);

-- Fix profiles.role for company users
UPDATE public.profiles p
SET role = 'company', status = 'active'
FROM public.companies c
WHERE c.user_id = p.user_id
  AND (p.role != 'company' OR p.status != 'active');

-- Ensure user_roles is correct
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT c.user_id, 'company'::public.app_role
FROM public.companies c
WHERE c.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = c.user_id AND r.role = 'company'::public.app_role
  )
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
