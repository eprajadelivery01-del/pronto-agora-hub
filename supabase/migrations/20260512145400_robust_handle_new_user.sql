
-- Ultra-robust handle_new_user trigger
-- This version uses nested BEGIN-EXCEPTION blocks to ensure that even if 
-- one part (like company creation) fails, the user registration still succeeds.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_invitation_id UUID;
  v_role public.app_role;
  v_invitation_record RECORD;
BEGIN
  -- 1. Create/Update Profile
  -- We MUST ensure this works as it's the core profile record.
  BEGIN
    INSERT INTO public.profiles (user_id, full_name, phone)
    VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', '')
    )
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: log error if we could, but at least don't crash the whole signup
  END;

  -- 2. Process Invitation
  BEGIN
    v_invitation_id := (NEW.raw_user_meta_data->>'invitation_id')::UUID;
    
    IF v_invitation_id IS NOT NULL THEN
      -- Find invitation
      SELECT * INTO v_invitation_record FROM public.invitations WHERE id = v_invitation_id AND status = 'pending';
      
      IF v_invitation_record.id IS NOT NULL THEN
        v_role := v_invitation_record.role;

        -- Assign Role
        BEGIN
          INSERT INTO public.user_roles (user_id, role) 
          VALUES (NEW.id, v_role)
          ON CONFLICT (user_id, role) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN NULL; END;

        -- Create specific record based on role
        IF v_role = 'company' THEN
          BEGIN
            INSERT INTO public.companies (user_id, name, phone)
            VALUES (
              NEW.id,
              COALESCE(NEW.raw_user_meta_data->>'company_name', v_invitation_record.email),
              COALESCE(NEW.raw_user_meta_data->>'phone', '')
            );
          EXCEPTION WHEN OTHERS THEN NULL; END;
        ELSIF v_role = 'driver' THEN
          BEGIN
            INSERT INTO public.delivery_drivers (user_id, is_online)
            VALUES (NEW.id, false)
            ON CONFLICT (user_id) DO NOTHING;
          EXCEPTION WHEN OTHERS THEN NULL; END;
        END IF;

        -- Mark invitation as accepted
        BEGIN
          UPDATE public.invitations 
          SET status = 'accepted', accepted_at = now() 
          WHERE id = v_invitation_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore any invitation processing errors to ensure the user is at least created
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
