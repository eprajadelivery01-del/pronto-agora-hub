DO $$
BEGIN
  -- Only (re)create the hardened function when the required schema objects exist.
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role')
     AND EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.assign_invitation_role(_user_id uuid, _role public.app_role)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        _caller uuid := auth.uid();
        _caller_is_admin boolean;
      BEGIN
        IF _caller IS NULL THEN
          RAISE EXCEPTION 'Não autenticado';
        END IF;

        SELECT EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = _caller AND role = 'admin'
        ) INTO _caller_is_admin;

        -- Only admins may grant the admin role.
        IF _role = 'admin' AND NOT _caller_is_admin THEN
          RAISE EXCEPTION 'Acesso negado: apenas administradores podem atribuir a função de administrador';
        END IF;

        -- Non-admins may only assign roles to their own account.
        IF NOT _caller_is_admin AND _caller <> _user_id THEN
          RAISE EXCEPTION 'Acesso negado: você só pode atribuir funções à sua própria conta';
        END IF;

        INSERT INTO public.user_roles (user_id, role)
        VALUES (_user_id, _role)
        ON CONFLICT (user_id, role) DO NOTHING;
      END;
      $body$;
    $fn$;
  END IF;
END $$;