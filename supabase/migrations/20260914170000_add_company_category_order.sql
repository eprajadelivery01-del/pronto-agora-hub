-- ==============================================================================
-- MIGRATION: 20260914170000_add_company_category_order.sql
-- Adiciona suporte à ordenação manual de categorias de produtos por loja
-- ==============================================================================

-- 1. Adiciona a coluna category_order na tabela companies caso não exista
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS category_order JSONB DEFAULT '[]'::jsonb;

-- 2. Concede permissões explícitas de leitura (anon e authenticated) e atualização (authenticated)
GRANT SELECT (category_order) ON public.companies TO anon, authenticated;
GRANT UPDATE (category_order) ON public.companies TO authenticated;

-- 3. Notifica o PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
