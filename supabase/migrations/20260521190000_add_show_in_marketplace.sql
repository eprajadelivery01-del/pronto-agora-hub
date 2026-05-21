
-- ================================================================
-- Adiciona campo show_in_marketplace na tabela companies
-- Controla se a loja aparece ou não no app marketplace público
-- Por padrão: FALSE (não exibir) — lojista precisa ativar manualmente
-- ================================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS show_in_marketplace BOOLEAN NOT NULL DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN public.companies.show_in_marketplace IS 
  'Se true, a loja aparece listada no marketplace público. Por padrão false (oculta).';

NOTIFY pgrst, 'reload schema';
