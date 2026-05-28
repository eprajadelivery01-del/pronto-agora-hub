
-- ================================================================
-- Adiciona campo show_in_marketplace na tabela companies
-- Controla se a loja aparece ou não no app marketplace público
-- Por padrão: TRUE (exibir) — lojista agora aparece automaticamente
-- ================================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS show_in_marketplace BOOLEAN NOT NULL DEFAULT true;

-- Comentário explicativo
COMMENT ON COLUMN public.companies.show_in_marketplace IS 
  'Se true, a loja aparece listada no marketplace público. Por padrão true (visível).';

NOTIFY pgrst, 'reload schema';
