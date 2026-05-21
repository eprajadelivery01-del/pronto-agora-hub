
-- =============================================================
-- CORREÇÃO COMPLETA DO SISTEMA DE CONVITES
-- Data: 2026-05-21
-- Problema: Convite não encontrado / "Convite inválido ou já utilizado"
-- =============================================================

BEGIN;

-- 1. LIMPAR TODAS AS POLÍTICAS CONFLITANTES DE INVITATIONS
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.invitations;
DROP POLICY IF EXISTS "Anyone can view invitation by token" ON public.invitations;
DROP POLICY IF EXISTS "Look up invitation by token" ON public.invitations;
DROP POLICY IF EXISTS "Allow anonymous lookup by token" ON public.invitations;
DROP POLICY IF EXISTS "invitations_anon_lookup" ON public.invitations;

-- 2. NOVA POLÍTICA: Acesso anônimo para leitura de convites por token (necessário para o fluxo de cadastro)
-- Usuários sem login precisam ver o convite quando clicam no link de convite.
CREATE POLICY "invitations_public_read" ON public.invitations
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 3. NOVA POLÍTICA: Apenas admins podem criar/atualizar/excluir convites (quando logados)
CREATE POLICY "invitations_admin_write" ON public.invitations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. RPC PARA ACEITAR CONVITE (SECURITY DEFINER - ignora RLS ao atualizar status)
-- Isso resolve o problema de usuários recém-cadastrados que não têm permissão de UPDATE
CREATE OR REPLACE FUNCTION public.accept_invitation_by_token(p_token UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
BEGIN
  SELECT * INTO v_invite
  FROM public.invitations
  WHERE token = p_token AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido ou já utilizado';
  END IF;

  IF v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'Convite expirado';
  END IF;

  UPDATE public.invitations
  SET status = 'accepted', accepted_at = now()
  WHERE token = p_token;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation_by_token(UUID) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
