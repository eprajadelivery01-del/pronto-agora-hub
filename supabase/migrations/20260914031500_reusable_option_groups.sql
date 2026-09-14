-- ==============================================================================
-- MIGRATION: Grupos de Opções Reutilizáveis (N:N) com Proteção Multi-Empresa
-- Data: 2026-09-14
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. CRIAR TABELA DE ASSOCIAÇÃO N:N (product_option_group_assignments)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_option_group_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.product_option_groups(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_option_group_assignment UNIQUE (product_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_pog_assignments_product_id 
  ON public.product_option_group_assignments(product_id);

CREATE INDEX IF NOT EXISTS idx_pog_assignments_group_id 
  ON public.product_option_group_assignments(group_id);

ALTER TABLE public.product_option_group_assignments ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. AJUSTAR TABELA product_option_groups: company_id E product_id LEGADO
-- ------------------------------------------------------------------------------
ALTER TABLE public.product_option_groups 
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.product_option_groups 
  ALTER COLUMN product_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pog_company_id 
  ON public.product_option_groups(company_id);

-- ------------------------------------------------------------------------------
-- 3. MIGRAR DADOS EXISTENTES: DEFINIR company_id A PARTIR DO PRODUTO ATUAL
-- ------------------------------------------------------------------------------
UPDATE public.product_option_groups g
SET company_id = p.company_id
FROM public.products p
WHERE g.product_id = p.id AND g.company_id IS NULL;

-- ------------------------------------------------------------------------------
-- 4. VALIDAÇÃO PRÉ-CONSTRAINT: CONFIRMAR QUE NENHUM GRUPO FICOU SEM EMPRESA
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_null_count 
  FROM public.product_option_groups 
  WHERE company_id IS NULL;

  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORTADA: Existem % grupo(s) em product_option_groups com company_id NULL após o UPDATE.', v_null_count;
  END IF;
END $$;

-- Tornar company_id obrigatório
ALTER TABLE public.product_option_groups 
  ALTER COLUMN company_id SET NOT NULL;

-- ------------------------------------------------------------------------------
-- 5. MIGRAR ASSOCIAÇÕES EXISTENTES: PRESERVAR ASSOCIAÇÃO X CALOTA -> TURBO
-- ------------------------------------------------------------------------------
INSERT INTO public.product_option_group_assignments (product_id, group_id)
SELECT g.product_id, g.id
FROM public.product_option_groups g
WHERE g.product_id IS NOT NULL
ON CONFLICT (product_id, group_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 6. NORMALIZAR CONFIGURAÇÃO DO GRUPO TURBO EXISTENTE (OPCIONAL 0 A 20)
-- ------------------------------------------------------------------------------
UPDATE public.product_option_groups
SET required = false, min_options = 0, max_options = 20
WHERE id = '8f9d9d20-ac29-4666-b3f0-ee94285db0ea';

-- ------------------------------------------------------------------------------
-- 7. TRIGGER IDEMPOTENTE DE UPDATED_AT NA TABELA DE ASSIGNMENTS
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_pog_assignments_updated_at ON public.product_option_group_assignments;
CREATE TRIGGER update_pog_assignments_updated_at
  BEFORE UPDATE ON public.product_option_group_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 8. POLÍTICAS DE RLS: TABELA product_option_group_assignments
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view option group assignments" ON public.product_option_group_assignments;
DROP POLICY IF EXISTS "Store owners and admins can manage option group assignments" ON public.product_option_group_assignments;
DROP POLICY IF EXISTS "pog_assignments_select" ON public.product_option_group_assignments;
DROP POLICY IF EXISTS "pog_assignments_insert" ON public.product_option_group_assignments;
DROP POLICY IF EXISTS "pog_assignments_delete" ON public.product_option_group_assignments;

-- SELECT: Anon/Marketplace somente produtos ativos; Lojista vê os seus; Admin vê tudo
CREATE POLICY "pog_assignments_select" 
  ON public.product_option_group_assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.companies c ON c.id = p.company_id
      WHERE p.id = product_option_group_assignments.product_id
        AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_option_group_assignments.product_id
        AND p.is_active = true
    )
  );

-- INSERT: Dono só associa seu produto a grupo da SUA PRÓPRIA loja (bloqueio multi-empresa)
CREATE POLICY "pog_assignments_insert"
  ON public.product_option_group_assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.product_option_groups g ON g.id = product_option_group_assignments.group_id
      JOIN public.companies c ON c.id = p.company_id
      WHERE p.id = product_option_group_assignments.product_id
        AND p.company_id = g.company_id
        AND c.user_id = auth.uid()
    )
  );

-- DELETE: Dono só remove associação dos seus próprios produtos
CREATE POLICY "pog_assignments_delete"
  ON public.product_option_group_assignments
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.companies c ON c.id = p.company_id
      WHERE p.id = product_option_group_assignments.product_id
        AND c.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- 9. POLÍTICAS DE RLS: TABELA product_option_groups
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view product option groups" ON public.product_option_groups;
DROP POLICY IF EXISTS "Company owners can manage groups" ON public.product_option_groups;
DROP POLICY IF EXISTS "Company owners and admins can manage groups" ON public.product_option_groups;
DROP POLICY IF EXISTS "pog_select" ON public.product_option_groups;
DROP POLICY IF EXISTS "pog_insert" ON public.product_option_groups;
DROP POLICY IF EXISTS "pog_update" ON public.product_option_groups;
DROP POLICY IF EXISTS "pog_delete" ON public.product_option_groups;

-- SELECT
CREATE POLICY "pog_select"
  ON public.product_option_groups
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.product_option_group_assignments a
      JOIN public.products p ON p.id = a.product_id
      WHERE a.group_id = product_option_groups.id
        AND p.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_option_groups.product_id
        AND p.is_active = true
    )
  );

-- INSERT
CREATE POLICY "pog_insert"
  ON public.product_option_groups
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- UPDATE
CREATE POLICY "pog_update"
  ON public.product_option_groups
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- DELETE
CREATE POLICY "pog_delete"
  ON public.product_option_groups
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- ------------------------------------------------------------------------------
-- 10. POLÍTICAS DE RLS: TABELA product_options
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view product options" ON public.product_options;
DROP POLICY IF EXISTS "Company owners can manage options" ON public.product_options;
DROP POLICY IF EXISTS "Company owners and admins can manage options" ON public.product_options;
DROP POLICY IF EXISTS "po_select" ON public.product_options;
DROP POLICY IF EXISTS "po_insert" ON public.product_options;
DROP POLICY IF EXISTS "po_update" ON public.product_options;
DROP POLICY IF EXISTS "po_delete" ON public.product_options;

-- SELECT
CREATE POLICY "po_select"
  ON public.product_options
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    EXISTS (
      SELECT 1 FROM public.product_option_groups g
      JOIN public.companies c ON c.id = g.company_id
      WHERE g.id = product_options.group_id
        AND c.user_id = auth.uid()
    )
    OR
    is_active = true
  );

-- INSERT
CREATE POLICY "po_insert"
  ON public.product_options
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    EXISTS (
      SELECT 1 FROM public.product_option_groups g
      JOIN public.companies c ON c.id = g.company_id
      WHERE g.id = product_options.group_id
        AND c.user_id = auth.uid()
    )
  );

-- UPDATE
CREATE POLICY "po_update"
  ON public.product_options
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    EXISTS (
      SELECT 1 FROM public.product_option_groups g
      JOIN public.companies c ON c.id = g.company_id
      WHERE g.id = product_options.group_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    EXISTS (
      SELECT 1 FROM public.product_option_groups g
      JOIN public.companies c ON c.id = g.company_id
      WHERE g.id = product_options.group_id
        AND c.user_id = auth.uid()
    )
  );

-- DELETE
CREATE POLICY "po_delete"
  ON public.product_options
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    EXISTS (
      SELECT 1 FROM public.product_option_groups g
      JOIN public.companies c ON c.id = g.company_id
      WHERE g.id = product_options.group_id
        AND c.user_id = auth.uid()
    )
  );

COMMIT;
