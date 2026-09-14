-- ==============================================================================
-- ROLLBACK: 20260914160000_rollback_assignments_rls_recursion.sql
-- Restaura integralmente o estado anterior das políticas RLS caso ocorra regressão
-- ==============================================================================

BEGIN;

-- 1. Remove a função security definer
DROP FUNCTION IF EXISTS public.can_manage_product_assignment(uuid, uuid);

-- 2. Restaura políticas de product_option_group_assignments
DROP POLICY IF EXISTS "pog_assignments_select_anon" ON public.product_option_group_assignments;
DROP POLICY IF EXISTS "pog_assignments_select_authenticated" ON public.product_option_group_assignments;
DROP POLICY IF EXISTS "pog_assignments_insert" ON public.product_option_group_assignments;
DROP POLICY IF EXISTS "pog_assignments_delete" ON public.product_option_group_assignments;

CREATE POLICY "pog_assignments_select_anon"
ON public.product_option_group_assignments
FOR SELECT TO anon
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

CREATE POLICY "pog_assignments_select_authenticated"
ON public.product_option_group_assignments
FOR SELECT TO authenticated
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

CREATE POLICY "pog_assignments_insert"
ON public.product_option_group_assignments
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
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

CREATE POLICY "pog_assignments_delete"
ON public.product_option_group_assignments
FOR DELETE TO authenticated
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

-- 3. Restaura políticas de product_option_groups
DROP POLICY IF EXISTS "pog_select_anon" ON public.product_option_groups;
DROP POLICY IF EXISTS "pog_select_authenticated" ON public.product_option_groups;

CREATE POLICY "pog_select_anon"
ON public.product_option_groups
FOR SELECT TO anon
USING (
    EXISTS (
        SELECT 1 FROM public.product_option_group_assignments a
        JOIN public.products p ON p.id = a.product_id
        JOIN public.companies c ON c.id = p.company_id
        WHERE a.group_id = product_option_groups.id
          AND p.is_active = true
          AND COALESCE(p.active, true) = true
          AND COALESCE(c.is_active, true) = true
    )
    OR
    EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.companies c ON c.id = p.company_id
        WHERE p.id = product_option_groups.product_id
          AND p.is_active = true
          AND COALESCE(p.active, true) = true
          AND COALESCE(c.is_active, true) = true
    )
);

CREATE POLICY "pog_select_authenticated"
ON public.product_option_groups
FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR
    company_id IN (SELECT c.id FROM public.companies c WHERE c.user_id = auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.product_option_group_assignments a
        JOIN public.products p ON p.id = a.product_id
        JOIN public.companies c ON c.id = p.company_id
        WHERE a.group_id = product_option_groups.id
          AND p.is_active = true
          AND COALESCE(p.active, true) = true
          AND COALESCE(c.is_active, true) = true
    )
    OR
    EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.companies c ON c.id = p.company_id
        WHERE p.id = product_option_groups.product_id
          AND p.is_active = true
          AND COALESCE(p.active, true) = true
          AND COALESCE(c.is_active, true) = true
    )
);

COMMIT;
