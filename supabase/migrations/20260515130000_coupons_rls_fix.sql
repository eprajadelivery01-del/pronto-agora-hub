-- Migration: fix_coupons_rls_and_visibility
-- Descrição: Garante que a tabela de cupons tenha RLS configurado corretamente 
-- e permite que clientes visualizem cupons ativos, incluindo os criados por lojistas.

BEGIN;

-- 1. Habilitar RLS
ALTER TABLE IF EXISTS public.coupons ENABLE ROW LEVEL SECURITY;

-- 2. Política de Visualização Pública (Clientes e Anônimos)
-- Permite ver apenas cupons marcados como ativos.
DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.coupons;
DROP POLICY IF EXISTS "Clientes podem ver cupons ativos" ON public.coupons;
CREATE POLICY "Anyone can view active coupons" ON public.coupons
  FOR SELECT TO authenticated, anon
  USING (active = true);

-- 3. Política para Lojistas
-- Lojistas podem gerenciar apenas seus próprios cupons.
DROP POLICY IF EXISTS "Companies can manage own coupons" ON public.coupons;
CREATE POLICY "Companies can manage own coupons" ON public.coupons
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- 4. Política para Admins
DROP POLICY IF EXISTS "Admins can manage coupons" ON public.coupons;
CREATE POLICY "Admins can manage coupons" ON public.coupons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Garantir que a tabela coupon_products também seja visível (necessário para validação no checkout)
ALTER TABLE IF EXISTS public.coupon_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view coupon products" ON public.coupon_products;
CREATE POLICY "Anyone can view coupon products" ON public.coupon_products
  FOR SELECT TO authenticated, anon
  USING (true);

COMMIT;

NOTIFY pgrst, 'reload schema';
