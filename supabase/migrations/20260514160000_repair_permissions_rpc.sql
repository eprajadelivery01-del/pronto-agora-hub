
-- RPC: FIX USER PERMISSIONS
-- This function allows a user to "self-repair" their role if they are stuck with no roles
-- but have a valid invitation_id in their auth metadata.

CREATE OR REPLACE FUNCTION public.fix_user_permissions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_invitation_id UUID;
  v_invitation_record RECORD;
  v_role TEXT;
  v_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  -- 1. Check if user already has roles
  SELECT count(*) INTO v_count FROM public.user_roles WHERE user_id = v_user_id;
  IF v_count > 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Usuário já possui permissões');
  END IF;

  -- 2. Get invitation_id from auth.users metadata
  SELECT (raw_user_meta_data->>'invitation_id')::UUID INTO v_invitation_id 
  FROM auth.users WHERE id = v_user_id;

  IF v_invitation_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite não encontrado no perfil');
  END IF;

  -- 3. Lookup invitation
  SELECT * INTO v_invitation_record FROM public.invitations 
  WHERE id = v_invitation_id;

  IF v_invitation_record.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite inválido ou excluído');
  END IF;

  v_role := v_invitation_record.role;

  -- 4. Assign Role
  INSERT INTO public.user_roles (user_id, role) 
  VALUES (v_user_id, v_role::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 5. Create specific record
  IF v_role = 'driver' THEN
    INSERT INTO public.delivery_drivers (user_id, is_online)
    VALUES (v_user_id, false)
    ON CONFLICT (user_id) DO NOTHING;
    
    INSERT INTO public.motoboys (name, is_online)
    VALUES (COALESCE((SELECT full_name FROM profiles WHERE user_id = v_user_id), 'Entregador'), false);
  ELSIF v_role = 'company' THEN
    INSERT INTO public.companies (user_id, name, phone)
    VALUES (
      v_user_id,
      COALESCE(v_invitation_record.email, 'Empresa'),
      ''
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- 6. Ensure profile status is active
  UPDATE public.profiles SET status = 'active' WHERE user_id = v_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Permissões restauradas com sucesso');
END;
$$;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION public.fix_user_permissions() TO authenticated;
