-- Migration: 20260525180000_nuclear_fix_user_roles_403
-- Description: DEFINITIVO - Mata a policy "user_roles_admin_stable" que ficou
--              orphanada de migrações anteriores e causava 403 para novos lojistas.
--              Substitui por uma única policy SELECT não-recursiva.
--              O controle de escrita é feito via SECURITY DEFINER RPCs e service_role.

BEGIN;

-- =====================================================================
-- 1. DERRUBAR *TODAS* as policies existentes em user_roles
--    (incluindo as que a 20260516230000 e 20260517004000 não removeram)
-- =====================================================================
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END;
$$;

-- =====================================================================
-- 2. ÚNICA POLICY LIMPA: qualquer usuário autenticado pode ler roles
--    (sem subquery, sem recursão)
-- =====================================================================
CREATE POLICY "user_roles_select_authenticated"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================================
-- 3. GARANTIR que user_roles tem RLS habilitado
-- =====================================================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 4. Recriar has_role como SECURITY DEFINER para que políticas de
--    outras tabelas (companies, orders, etc.) continuem funcionando
--    sem recursão
-- =====================================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =====================================================================
-- 5. Notificar PostgREST para recarregar schema
-- =====================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
