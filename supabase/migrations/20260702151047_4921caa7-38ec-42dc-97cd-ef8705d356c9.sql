DO $mig$
BEGIN
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.assign_invitation_role(
        _user_id UUID,
        _role TEXT
      )
      RETURNS VOID
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        _caller UUID := auth.uid();
      BEGIN
        IF _caller IS NULL THEN
          RAISE EXCEPTION 'Nao autorizado';
        END IF;

        -- Somente administradores existentes podem conceder o papel de admin
        IF _role = 'admin' THEN
          IF NOT public.has_role(_caller, 'admin'::public.app_role) THEN
            RAISE EXCEPTION 'Apenas administradores podem conceder o papel de administrador';
          END IF;
        ELSE
          -- Para papeis nao-admin, o usuario so pode atribuir para si mesmo
          -- (a menos que seja administrador)
          IF _caller <> _user_id AND NOT public.has_role(_caller, 'admin'::public.app_role) THEN
            RAISE EXCEPTION 'Nao e permitido atribuir papeis a outros usuarios';
          END IF;
        END IF;

        INSERT INTO public.user_roles (user_id, role)
        VALUES (_user_id, _role::public.app_role)
        ON CONFLICT (user_id, role) DO NOTHING;
      END;
      $body$;
    $fn$;

    EXECUTE 'GRANT EXECUTE ON FUNCTION public.assign_invitation_role(UUID, TEXT) TO authenticated';
  END IF;
END
$mig$;

NOTIFY pgrst, 'reload schema';