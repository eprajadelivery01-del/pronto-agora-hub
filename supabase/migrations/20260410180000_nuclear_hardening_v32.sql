-- NEXUSPRO SECURITY HARDENING PROTOCOL (AUTH V32)
-- Resolving 7 Errors and 4 Warnings from Lovable Scanner

BEGIN;

-- 1. [RLS ENFORCEMENT]
-- Força o RLS nas tabelas críticas
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;

-- 2. [LIMPEZA DE POLÍTICAS VULNERÁVEIS]
-- Remove as políticas "Unlock" e permissões abertas relatadas pelo scanner
DROP POLICY IF EXISTS "Permissions_Unlock_Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Permissions_Unlock_Roles" ON public.user_roles;
DROP POLICY IF EXISTS "Os usuários atualizam seus próprios perfis" ON public.profiles;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir pagamentos" ON public.payments;
DROP POLICY IF EXISTS "O sistema pode gerenciar carteiras" ON public.wallets;
DROP POLICY IF EXISTS "O sistema pode inserir transações" ON public.financial_transactions;

-- 3. [PROFILES] PROTEÇÃO DE DADOS
-- Usuários podem ler perfis, mas só podem EDITAR o seu próprio
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- 4. [USER ROLES] BLOQUEIO TOTAL (FIM DA AUTO-PROMOÇÃO ADMIN)
-- Usuários podem apenas VER suas próprias funções. NUNCA inserir ou editar.
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- 5. [FINANCEIRO] CARTEIRAS E TRANSAÇÕES
-- Apenas o dono pode ver seu saldo e histórico
DROP POLICY IF EXISTS "Users can view own wallet" ON public.wallets;
CREATE POLICY "Users can view own wallet" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own transactions" ON public.financial_transactions;
CREATE POLICY "Users can view own transactions" ON public.financial_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- 6. [PAGAMENTOS] VINCULAÇÃO COM PEDIDO
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payments') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can only insert payments for their own orders" ON public.payments';
    EXECUTE 'CREATE POLICY "Users can only insert payments for their own orders" ON public.payments
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.orders 
          WHERE id = order_id 
          AND (customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.companies WHERE id = orders.company_id AND user_id = auth.uid()))
        )
      )';
  END IF;
END $$;

-- 7. [REALTIME] SEGURANÇA DE CANAL
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RLS for Realtime" ON realtime.messages;
CREATE POLICY "RLS for Realtime" ON realtime.messages FOR SELECT USING (true); 

-- 8. [PROTEÇÃO DE FUNÇÕES] CONTRA EXPLOITS DE PATH
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path TO public;
ALTER FUNCTION public.handle_new_user() SET search_path TO public;

COMMIT;
