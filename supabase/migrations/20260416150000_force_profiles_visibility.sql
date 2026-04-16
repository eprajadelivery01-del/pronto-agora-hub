-- ========================================================
-- Migration: 20260416150000_force_profiles_visibility
-- Description: Unlocks customer profile data (name/phone) for companies
-- ========================================================

BEGIN;

-- 1. Ensure Profiles table is accessible by companies for their own orders
DROP POLICY IF EXISTS "Companies can view customer profiles" ON public.profiles;
DROP POLICY IF EXISTS "Lojistas veem perfis de seus clientes" ON public.profiles;

CREATE POLICY "Companies can view customer profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    -- Permite se o profile ID é o customer_id de algum pedido da empresa do usuário logado
    id IN (
      SELECT customer_id FROM public.orders 
      WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
    OR
    user_id IN (
      SELECT customer_id FROM public.orders 
      WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
    OR
    -- Dono do perfil sempre vê
    auth.uid() = user_id
    OR
    -- Admin sempre vê
    public.has_role(auth.uid(), 'admin')
  );

-- 2. Ensure Deliveries table is also fully accessible for order context
DROP POLICY IF EXISTS "Companies can view own deliveries" ON public.deliveries;
CREATE POLICY "Companies can view own deliveries" ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR
    public.has_role(auth.uid(), 'admin')
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
