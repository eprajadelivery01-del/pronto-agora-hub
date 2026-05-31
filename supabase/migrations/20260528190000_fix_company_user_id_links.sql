-- Migration: 20260528190000_fix_company_user_id_links
-- Description: Fix companies where user_id is NULL or incorrectly set.
-- Links companies to their correct user accounts via email matching in auth.users/profiles.
-- Also adds a company_id column to profiles as a faster lookup mechanism.

-- ============================================================
-- STEP 1: Add company_id to profiles (fast reverse lookup)
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- ============================================================
-- STEP 2: Fix companies.user_id where it's NULL
-- Match by email: company.email -> auth.users.email -> user_id
-- ============================================================
UPDATE public.companies c
SET user_id = au.id
FROM auth.users au
WHERE c.user_id IS NULL
  AND c.email IS NOT NULL
  AND LOWER(c.email) = LOWER(au.email);

-- ============================================================
-- STEP 3: Backfill profiles.company_id for all company users
-- ============================================================
UPDATE public.profiles p
SET company_id = c.id
FROM public.companies c
WHERE c.user_id = p.user_id
  AND p.company_id IS NULL;

-- ============================================================
-- STEP 4: Ensure all company users have the correct role in user_roles
-- ============================================================
INSERT INTO public.user_roles (user_id, role)
SELECT c.user_id, 'company'::public.app_role
FROM public.companies c
WHERE c.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = c.user_id AND r.role = 'company'::public.app_role
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 5: Ensure all company users have 'company' role in profiles.role
-- ============================================================
UPDATE public.profiles p
SET role = 'company'
FROM public.companies c
WHERE c.user_id = p.user_id
  AND (p.role = 'customer' OR p.role IS NULL);

-- ============================================================
-- STEP 6: Ensure company users are 'active' status
-- ============================================================
UPDATE public.profiles p
SET status = 'active'
FROM public.companies c
WHERE c.user_id = p.user_id
  AND p.status != 'active';

-- ============================================================
-- STEP 7: Reload schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';
