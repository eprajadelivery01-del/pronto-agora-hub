DO $migration$
BEGIN
  IF to_regclass('public.user_roles') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public' AND t.typname = 'app_role'
     ) THEN
    EXECUTE 'DROP FUNCTION IF EXISTS public.assign_invitation_role(uuid, public.app_role)';

    EXECUTE $function$
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
        _caller_is_admin BOOLEAN := FALSE;
      BEGIN
        IF _caller IS NULL THEN
          RAISE EXCEPTION 'Nao autorizado' USING ERRCODE = '42501';
        END IF;

        IF _role NOT IN ('admin', 'driver', 'company', 'customer') THEN
          RAISE EXCEPTION 'Papel invalido' USING ERRCODE = '22023';
        END IF;

        SELECT EXISTS (
          SELECT 1
          FROM public.user_roles
          WHERE user_id = _caller
            AND role::TEXT = 'admin'
        ) INTO _caller_is_admin;

        IF _role = 'admin' AND NOT _caller_is_admin THEN
          RAISE EXCEPTION 'Apenas administradores podem conceder o papel de administrador'
            USING ERRCODE = '42501';
        END IF;

        IF NOT _caller_is_admin AND _caller <> _user_id THEN
          RAISE EXCEPTION 'Nao e permitido atribuir papeis a outros usuarios'
            USING ERRCODE = '42501';
        END IF;

        INSERT INTO public.user_roles (user_id, role)
        VALUES (_user_id, _role::public.app_role)
        ON CONFLICT (user_id, role) DO NOTHING;
      END;
      $body$
    $function$;

    EXECUTE 'REVOKE ALL ON FUNCTION public.assign_invitation_role(UUID, TEXT) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.assign_invitation_role(UUID, TEXT) FROM anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.assign_invitation_role(UUID, TEXT) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.assign_invitation_role(UUID, TEXT) TO service_role';
  END IF;
END
$migration$;

NOTIFY pgrst, 'reload schema';