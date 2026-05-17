
-- Migration: 20260517002000_force_admin_account
-- Description: Forces the creation or reset of testedelivery@gmail.com with password '12345678.'
-- and assigns them the 'admin' role in user_roles and 'active' status in profiles.
-- Note: 'confirmed_at' and 'phone_confirmed_at' are auto-generated/managed in this schema, so we omit them.

BEGIN;

DO $$
DECLARE
  v_user_id UUID;
  v_encrypted_password TEXT;
BEGIN
  -- 1. Generate encrypted password for "12345678." using pgcrypto's crypt
  v_encrypted_password := crypt('12345678.', gen_salt('bf'));

  -- 2. Check if the user already exists in auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'testedelivery@gmail.com';

  IF v_user_id IS NULL THEN
    -- Generate a new UUID
    v_user_id := gen_random_uuid();

    -- Insert new user into auth.users (excluding generated confirmed_at column)
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
    -- Update existing user's password and confirm email (excluding generated confirmed_at)
    UPDATE auth.users
    SET 
      encrypted_password = v_encrypted_password,
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
    WHERE id = v_user_id;
  END IF;

  -- 3. Ensure they have a profile in public.profiles with status 'active' and role 'admin'
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
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    full_name = 'Admin Teste', 
    role = 'admin', 
    user_id = v_user_id,
    status = 'active'::public.user_status,
    updated_at = now();

  -- 4. Ensure they have the admin role in public.user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
