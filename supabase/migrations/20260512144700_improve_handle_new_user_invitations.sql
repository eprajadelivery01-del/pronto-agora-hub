
-- Improve handle_new_user to process invitations automatically
-- This ensures that roles, company/driver records, and invitation status 
-- are handled server-side during signup, avoiding RLS issues for new users.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_invitation_id UUID;
  v_role public.app_role;
  v_invitation_record RECORD;
BEGIN
  -- 1. Create basic profile
  -- We use UPSERT in case the profile already exists (though it shouldn't for a new user)
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone;

  -- 2. Check for invitation
  BEGIN
    v_invitation_id := (NEW.raw_user_meta_data->>'invitation_id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_invitation_id := NULL;
  END;
  
  IF v_invitation_id IS NOT NULL THEN
    -- Find invitation
    SELECT * INTO v_invitation_record FROM public.invitations WHERE id = v_invitation_id AND status = 'pending';
    
    IF v_invitation_record.id IS NOT NULL THEN
      v_role := v_invitation_record.role;

      -- Assign role (using ON CONFLICT to prevent errors if already assigned)
      INSERT INTO public.user_roles (user_id, role) 
      VALUES (NEW.id, v_role)
      ON CONFLICT (user_id, role) DO NOTHING;

      -- Create specific record based on role
      IF v_role = 'company' THEN
        INSERT INTO public.companies (user_id, name, phone)
        VALUES (
          NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'company_name', v_invitation_record.email),
          COALESCE(NEW.raw_user_meta_data->>'phone', '')
        )
        ON CONFLICT DO NOTHING;
      ELSIF v_role = 'driver' THEN
        INSERT INTO public.delivery_drivers (user_id, is_online)
        VALUES (NEW.id, false)
        ON CONFLICT (user_id) DO NOTHING;
      END IF;

      -- Mark invitation as accepted
      UPDATE public.invitations 
      SET status = 'accepted', accepted_at = now() 
      WHERE id = v_invitation_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
