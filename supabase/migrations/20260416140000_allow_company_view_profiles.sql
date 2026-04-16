-- ========================================================
-- Migration: 20260416140000_allow_company_view_profiles
-- Description: Permits Companies to view basic profiles of their customers
-- ========================================================

BEGIN;

-- Allow companies to view profiles of users who have an order with them
DROP POLICY IF EXISTS "Companies can view customer profiles" ON public.profiles;

CREATE POLICY "Companies can view customer profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    -- Permite se o profile.id ou profile.user_id aparecer como customer_id em algum pedido desta empresa
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
    -- Mantém a permissão do próprio usuário ver seu perfil
    auth.uid() = user_id
    OR
    public.has_role(auth.uid(), 'admin')
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
