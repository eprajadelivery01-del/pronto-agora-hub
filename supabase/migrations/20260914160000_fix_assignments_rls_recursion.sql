-- ==============================================================================
-- MIGRATION: 20260914160000_fix_assignments_rls_recursion.sql
-- Correção Definitiva do Infinite Recursion em product_option_group_assignments
--
-- REGRAS RESPEITADAS:
-- 1. NENHUM DADO DE PRODUTO, GRUPO OU OPÇÃO É ALTERADO.
-- 2. FUNÇÃO SECURITY DEFINER COM ESCOPO RESTRITO E SEARCH_PATH FIXO.
-- 3. REVOKE DE PUBLIC E GRANT EXCLUSIVO PARA authenticated.
-- 4. REMOÇÃO DE TODAS AS REFERÊNCIAS CIRCULARES ENTRE AS TABELAS.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. FUNÇÃO SECURITY DEFINER PARA VALIDAÇÃO DE ASSOCIAÇÃO
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_product_assignment(p_product_id UUID, p_group_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.product_option_groups g ON g.id = p_group_id
    JOIN public.companies c ON c.id = p.company_id
    WHERE p.id = p_product_id
      AND p.company_id = g.company_id
      AND c.user_id = auth.uid()
  );
$$;

-- Permissões estritas da função (Condição 3 do Usuário)
REVOKE ALL ON FUNCTION public.can_manage_product_assignment(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_product_assignment(uuid, uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. RECONSTRUIR POLICIES: product_option_group_assignments
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view option group assignments" ON public.product_option_group_assignments;
DROP POLICY IF EXISTS "Store owners and admins can manage option group assignments" ON public.product_option_group_assignments;
DROP POLICY IF EXISTS "pog_assignments_select" ON public.product_option_group_assignments;
DROP POLICY IF EXISTS "pog_assignments_select_anon" ON public.product_option_group_assignments;
DROP POLICY IF EXISTS "pog_assignments_select_authenticated" ON public.product_option_group_assignments;
DROP POLICY IF EXISTS "pog_assignments_insert" ON public.product_option_group_assignments;
DROP POLICY IF EXISTS "pog_assignments_delete" ON public.product_option_group_assignments;

-- SELECT para visitantes anônimos (Marketplace)
CREATE POLICY "pog_assignments_select_anon"
ON public.product_option_group_assignments
FOR SELECT
TO anon
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.companies c ON c.id = p.company_id
        WHERE p.id = product_option_group_assignments.product_id
          AND p.is_active = true
          AND COALESCE(p.active, true) = true
          AND COALESCE(c.is_active, true) = true
    )
);

-- SELECT para usuários logados (Admin, Dono do Produto ou Marketplace)
CREATE POLICY "pog_assignments_select_authenticated"
ON public.product_option_group_assignments
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
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
        JOIN public.companies c ON c.id = p.company_id
        WHERE p.id = product_option_group_assignments.product_id
          AND p.is_active = true
          AND COALESCE(p.active, true) = true
          AND COALESCE(c.is_active, true) = true
    )
);

-- INSERT: Admin ou Lojista Proprietário (via função blindada que elimina recursão)
CREATE POLICY "pog_assignments_insert"
ON public.product_option_group_assignments
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR
    public.can_manage_product_assignment(product_id, group_id)
);

-- DELETE: Admin ou Lojista Dono do Produto
CREATE POLICY "pog_assignments_delete"
ON public.product_option_group_assignments
FOR DELETE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR
    EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.companies c ON c.id = p.company_id
        WHERE p.id = product_option_group_assignments.product_id
          AND c.user_id = auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- 3. RECONSTRUIR POLICIES: product_option_groups (ELIMINAR REFERÊNCIA CIRCULAR)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view product option groups" ON public.product_option_groups;
DROP POLICY IF EXISTS "product_option_groups_select_public" ON public.product_option_groups;
DROP POLICY IF EXISTS "pog_select" ON public.product_option_groups;
DROP POLICY IF EXISTS "pog_select_anon" ON public.product_option_groups;
DROP POLICY IF EXISTS "pog_select_authenticated" ON public.product_option_groups;

-- SELECT Anon: Grupos pertencentes a empresas ativas (SEM subconsulta a assignments)
CREATE POLICY "pog_select_anon"
ON public.product_option_groups
FOR SELECT
TO anon
USING (
    company_id IN (
        SELECT c.id FROM public.companies c
        WHERE COALESCE(c.is_active, true) = true
    )
);

-- SELECT Authenticated: Admin, Dono da loja ou Clientes do Marketplace
CREATE POLICY "pog_select_authenticated"
ON public.product_option_groups
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR
    company_id IN (SELECT c.id FROM public.companies c WHERE c.user_id = auth.uid())
    OR
    company_id IN (SELECT c.id FROM public.companies c WHERE COALESCE(c.is_active, true) = true)
);

-- ------------------------------------------------------------------------------
-- 4. RECONSTRUIR POLICIES: product_options (ELIMINAR REFERÊNCIA CIRCULAR)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view product options" ON public.product_options;
DROP POLICY IF EXISTS "product_options_select_public" ON public.product_options;
DROP POLICY IF EXISTS "po_select" ON public.product_options;
DROP POLICY IF EXISTS "po_select_anon" ON public.product_options;
DROP POLICY IF EXISTS "po_select_authenticated" ON public.product_options;

-- SELECT Anon: Opções ativas de grupos com empresas ativas (SEM subconsulta a assignments)
CREATE POLICY "po_select_anon"
ON public.product_options
FOR SELECT
TO anon
USING (
    product_options.is_active = true
    AND
    EXISTS (
        SELECT 1 FROM public.product_option_groups g
        JOIN public.companies c ON c.id = g.company_id
        WHERE g.id = product_options.group_id
          AND COALESCE(c.is_active, true) = true
    )
);

-- SELECT Authenticated: Admin, Dono ou Marketplace
CREATE POLICY "po_select_authenticated"
ON public.product_options
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR
    EXISTS (
        SELECT 1 FROM public.product_option_groups g
        JOIN public.companies c ON c.id = g.company_id
        WHERE g.id = product_options.group_id
          AND c.user_id = auth.uid()
    )
    OR
    (
        product_options.is_active = true
        AND
        EXISTS (
            SELECT 1 FROM public.product_option_groups g
            JOIN public.companies c ON c.id = g.company_id
            WHERE g.id = product_options.group_id
              AND COALESCE(c.is_active, true) = true
        )
    )
);

-- ------------------------------------------------------------------------------
-- 5. CONFIRMAÇÃO DE GRANTS
-- ------------------------------------------------------------------------------
GRANT SELECT ON public.product_option_group_assignments TO anon, authenticated;
GRANT INSERT, DELETE ON public.product_option_group_assignments TO authenticated;
GRANT SELECT ON public.product_option_groups TO anon, authenticated;
GRANT SELECT ON public.product_options TO anon, authenticated;

COMMIT;
