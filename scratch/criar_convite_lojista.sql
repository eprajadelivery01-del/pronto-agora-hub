
-- ================================================================
-- SCRIPT PARA CRIAR NOVO CONVITE DE LOJISTA
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- URL: https://supabase.com/dashboard/project/nptkxlrhrlssdsevpgqe/sql
-- ================================================================

-- PASSO 1: Ver convites existentes (diagnóstico)
SELECT id, token, email, role, status, expires_at, created_at
FROM public.invitations
ORDER BY created_at DESC
LIMIT 20;

-- ================================================================
-- PASSO 2: Criar novo convite de lojista (company)
-- O token gerado será o novo link de convite.
-- ================================================================

-- Primeiro, veja o ID do usuário admin para usar como invited_by:
-- SELECT id, email FROM auth.users LIMIT 5;

-- Insira o convite usando o admin existente:
-- Substitua 'SEU_ADMIN_USER_ID' pelo ID do admin encontrado acima.
-- Substitua 'email@do.lojista.com' pelo email do lojista convidado.

DO $$
DECLARE
  v_admin_id UUID;
  v_token UUID;
  v_invite_id UUID;
BEGIN
  -- Pega o primeiro usuário com role admin
  SELECT ur.user_id INTO v_admin_id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário admin encontrado. Crie um admin primeiro.';
  END IF;

  -- Gera novo token
  v_token := gen_random_uuid();

  -- Cria o convite
  INSERT INTO public.invitations (email, role, token, invited_by, status, expires_at)
  VALUES (
    'lojista@eprajadelivery.com',  -- <- Troque pelo email do lojista
    'company',
    v_token,
    v_admin_id,
    'pending',
    now() + interval '30 days'     -- Válido por 30 dias
  )
  RETURNING id INTO v_invite_id;

  RAISE NOTICE 'Convite criado com sucesso!';
  RAISE NOTICE 'ID: %', v_invite_id;
  RAISE NOTICE 'Token (URL): %', v_token;
  RAISE NOTICE 'Link completo: https://lojista.eprajadelivery.com/invite/%', v_token;
END $$;

-- PASSO 3: Ver o convite recém criado
SELECT
  id,
  token,
  email,
  role,
  status,
  expires_at,
  'https://lojista.eprajadelivery.com/invite/' || token AS link_convite
FROM public.invitations
ORDER BY created_at DESC
LIMIT 5;
