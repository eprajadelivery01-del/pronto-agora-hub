-- Fix: Restore select permission to delivery_regions_pricing on companies table for anon and authenticated users
GRANT SELECT (delivery_regions_pricing) ON public.companies TO anon;
GRANT SELECT (delivery_regions_pricing) ON public.companies TO authenticated;

-- Fix: Enforce phone number on new user signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_invitation_id UUID;
  v_role TEXT;
  v_invitation_record RECORD;
  v_phone TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_invitation_id UUID;
  v_role TEXT;
  v_invitation_record RECORD;
  v_phone TEXT;
BEGIN
  -- Extract and clean phone number from metadata
  v_phone := regexp_replace(COALESCE(NEW.raw_user_meta_data->>'phone', ''), '\D', '', 'g');

  -- Enforce that a valid phone number (at least 10 digits for DDD + number) is required
  IF v_phone IS NULL OR length(v_phone) < 10 THEN
    RAISE EXCEPTION 'O preenchimento do número de telefone com DDD é obrigatório para realizar o cadastro.';
  END IF;

  -- 1. Tentar criar/atualizar o Perfil (Profiles)
  BEGIN
    INSERT INTO public.profiles (user_id, full_name, phone, document)
    VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      COALESCE(NEW.raw_user_meta_data->>'document', '')
    )
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      document = EXCLUDED.document;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Erro ao criar perfil no signup: %', SQLERRM;
  END;

  -- 2. Processar Convite e Atribuir Funções
  BEGIN
    IF (NEW.raw_user_meta_data->>'invitation_id') IS NOT NULL THEN
      v_invitation_id := (NEW.raw_user_meta_data->>'invitation_id')::UUID;
      
      SELECT * INTO v_invitation_record FROM public.invitations 
      WHERE id = v_invitation_id AND status IN ('pending', 'accepted');
      
      IF v_invitation_record.id IS NOT NULL THEN
        v_role := v_invitation_record.role;

        -- Atribuir Role
        BEGIN
          INSERT INTO public.user_roles (user_id, role) 
          VALUES (NEW.id, v_role::public.app_role)
          ON CONFLICT (user_id, role) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN NULL; END;

        -- Criar registro específico (Entregador ou Empresa)
        IF v_role = 'driver' THEN
          BEGIN
            INSERT INTO public.delivery_drivers (user_id, is_online, full_name, phone)
            VALUES (
              NEW.id, 
              false,
              COALESCE(NEW.raw_user_meta_data->>'full_name', 'Entregador'),
              COALESCE(NEW.raw_user_meta_data->>'phone', '')
            )
            ON CONFLICT (user_id) DO UPDATE SET
              full_name = EXCLUDED.full_name,
              phone = EXCLUDED.phone;
          EXCEPTION WHEN OTHERS THEN NULL; END;
          
          BEGIN
            INSERT INTO public.motoboys (name, is_online)
            VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', 'Novo Entregador'), false);
          EXCEPTION WHEN OTHERS THEN NULL; END;

        ELSIF v_role = 'company' THEN
          BEGIN
            INSERT INTO public.companies (user_id, name, phone, email, address)
            VALUES (
              NEW.id,
              COALESCE(NEW.raw_user_meta_data->>'company_name', v_invitation_record.email),
              COALESCE(NEW.raw_user_meta_data->>'phone', ''),
              NEW.email,
              COALESCE(NEW.raw_user_meta_data->>'address', '')
            );
          EXCEPTION WHEN OTHERS THEN NULL; END;
        END IF;

        UPDATE public.invitations SET status = 'accepted', accepted_at = now() WHERE id = v_invitation_id;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Erro ao processar convite no signup: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
