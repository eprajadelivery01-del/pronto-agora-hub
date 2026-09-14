-- ==============================================================================
-- ROLLBACK: 20260914170000_rollback_company_category_order.sql
-- Remove a coluna category_order na tabela companies caso necessário
-- ==============================================================================

ALTER TABLE public.companies
  DROP COLUMN IF EXISTS category_order;

NOTIFY pgrst, 'reload schema';
