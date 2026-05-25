-- Migration: 20260525181000_rpc_assign_invitation_role
-- Description: Cria função SECURITY DEFINER para atribuir role ao aceitar convite,
--              já que user_roles não tem política de INSERT para usuários normais.

BEGIN;

CREATE OR REPLACE FUNCTION public.assign_invitation_role(
  _user_id UUID,
  _role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Garantir que qualquer usuário autenticado pode chamar esta função
GRANT EXECUTE ON FUNCTION public.assign_invitation_role(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
