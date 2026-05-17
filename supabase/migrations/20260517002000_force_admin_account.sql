
-- Migration: 20260517002000_force_admin_account
-- Description: Forces the creation or reset of testedelivery@gmail.com with password '12345678.'
-- and assigns them the 'admin' role in user_roles and 'active' status in profiles.
-- Bulletproof version that ensures 'role' and 'status' columns exist on public.profiles to prevent rollback.

BEGIN;

-- 1. Ensure public.profiles has the 'role' column (prevent crash if missing)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';

-- 2. Ensure public.user_status enum exists and 'status' column is added safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_namespace n ON t.typnamespace = n.oid 
    WHERE t.typname = 'user_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.user_status AS ENUM ('pending', 'active', 'rejected');
  END IF;
END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status public.user_status NOT NULL DEFAULT 'pending';

-- 3. Create or Reset the testedelivery@gmail.com user
DO $$
DECLARE
  v_user_id UUID;
  v_encrypted_password TEXT;
BEGIN
  -- Generate encrypted password for "12345678." using bcrypt
  v_encrypted_password := crypt('12345678.', gen_salt('bf'));

  -- Get user ID if exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'testedelivery@gmail.com';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    -- Insert new user into auth.users (excluding auto-managed confirmed_at)
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      role,
      aud,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      is_super_admin
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'testedelivery@gmail.com',
      v_encrypted_password,
      now(),
      'authenticated',
      'authenticated',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Admin Teste"}'::jsonb,
      now(),
      now(),
      false
    );
  ELSE
    -- If user exists, reset password and ensure email is confirmed
    UPDATE auth.users
    SET 
      encrypted_password = v_encrypted_password,
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
    WHERE id = v_user_id;
  END IF;

  -- 4. Clean up any existing profile to prevent duplicate key constraint violations
  DELETE FROM public.profiles WHERE user_id = v_user_id;

  -- 5. Insert clean profile with 'admin' role and 'active' status
  INSERT INTO public.profiles (
    id, 
    user_id, 
    full_name, 
    role, 
    status,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id, 
    v_user_id, 
    'Admin Teste', 
    'admin', 
    'active'::public.user_status,
    now(),
    now()
  );

  -- 6. Ensure the user has the 'admin' role in user_roles
  DELETE FROM public.user_roles WHERE user_id = v_user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin');

END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
