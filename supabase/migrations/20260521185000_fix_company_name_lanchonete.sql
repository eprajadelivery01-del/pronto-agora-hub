
-- ================================================================
-- CORREÇÃO EMERGENCIAL: Renomear empresa "Jose teste doiis"
-- → "Lanchonete Fim de Tarde"
-- Company ID: 571ed7b4-3b44-48fe-9980-538d68162ea0
-- User ID:    fc4997d0-990c-445c-af15-f3c8fb1d7258
-- ================================================================

-- Corrigir o nome da empresa
UPDATE public.companies
SET 
  name = 'Lanchonete Fim de Tarde',
  updated_at = now()
WHERE id = '571ed7b4-3b44-48fe-9980-538d68162ea0'
  AND user_id = 'fc4997d0-990c-445c-af15-f3c8fb1d7258';

-- Verificar resultado
SELECT 
  id,
  name,
  user_id,
  updated_at
FROM public.companies
WHERE id = '571ed7b4-3b44-48fe-9980-538d68162ea0';
