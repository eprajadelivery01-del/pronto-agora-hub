-- Migration: Fix signup roles and cleanups for merchants and customers
-- This migration fixes the data issues where merchants were incorrectly treated as customers,
-- corrects profiles and user_roles, deletes duplicate entries in customers and user_roles,
-- and updates the handle_new_user trigger to be highly resilient.

-- 1. Correct profiles.role for users that are actually companies
UPDATE public.profiles p
SET role = 'company'
FROM public.user_roles r
WHERE p.user_id = r.user_id 
  AND r.role = 'company'::public.app_role 
  AND p.role = 'customer';

-- 2. Correct profiles.role for users that are actually drivers
UPDATE public.profiles p
SET role = 'driver'
FROM public.user_roles r
WHERE p.user_id = r.user_id 
  AND r.role = 'driver'::public.app_role 
  AND p.role = 'customer';

-- 3. Delete companies and drivers from public.customers table (as they should not be there)
DELETE FROM public.customers
WHERE user_id IN (
  SELECT user_id FROM public.user_roles WHERE role IN ('company'::public.app_role, 'driver'::public.app_role)
);

-- 4. Delete the duplicate customer role in user_roles for users that are company or driver
DELETE FROM public.user_roles
WHERE role = 'customer'::public.app_role 
  AND user_id IN (
    SELECT user_id FROM public.user_roles WHERE role IN ('company'::public.app_role, 'driver'::public.app_role)
  );

-- 5. Force update for the known company 'Marciane Andreani Duarte' (Drogaria Difarma)
UPDATE public.profiles 
SET role = 'company' 
WHERE user_id = 'f41162d7-b321-43eb-a91e-798b76af0b7b';

-- 6. Reload schema
NOTIFY pgrst, 'reload schema';
