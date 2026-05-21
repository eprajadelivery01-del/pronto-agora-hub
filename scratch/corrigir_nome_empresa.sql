
-- ================================================================
-- CORREÇÃO: Nome da empresa mostrando nome do usuário no marketplace
-- PROBLEMA: O trigger handle_new_user criava a empresa com o email/
--           nome do convite porque 'company_name' não estava nos metadados
-- 
-- Este script corrige empresas cujo nome é igual ao full_name do usuário
-- ou ao email do convite (padrão convite_xxx@eprajadelivery.com)
-- ================================================================

-- Ver empresas com nomes suspeitos (nome de usuário ou email de convite)
SELECT 
  c.id AS company_id,
  c.name AS company_name,
  p.full_name AS user_name,
  u.email AS user_email,
  c.user_id
FROM public.companies c
JOIN auth.users u ON u.id = c.user_id
LEFT JOIN public.profiles p ON p.user_id = c.user_id
WHERE 
  c.name = p.full_name  -- Nome da empresa igual ao nome do usuário (bug)
  OR c.name LIKE 'convite_%@eprajadelivery.com'  -- Email de convite usado como nome
  OR c.name LIKE 'pending_%@nexus.pro'  -- Email antigo usado como nome
ORDER BY c.created_at DESC;

-- ================================================================
-- Para CORRIGIR manualmente um lojista específico, execute:
-- Substitua 'NOME_CORRETO_DA_LOJA' e 'EMAIL_DO_LOJISTA'
-- ================================================================

-- UPDATE public.companies
-- SET name = 'Lanchonete Fim de Tarde'  -- <- coloque o nome correto da loja
-- WHERE user_id = (
--   SELECT id FROM auth.users WHERE email = 'email_do_lojista@exemplo.com'
-- );
