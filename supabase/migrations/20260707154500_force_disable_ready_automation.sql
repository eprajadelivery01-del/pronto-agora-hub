-- Script definitivo para remover a automação indevida de criação de entregas
-- Corrigindo o erro de digitação do nome da trigger ('tr_order_ready_automation' vs 'trg_order_ready')

-- 1. Remove a trigger com o nome correto
DROP TRIGGER IF EXISTS trg_order_ready ON public.orders;

-- 2. Remove também o nome com erro de digitação (por segurança)
DROP TRIGGER IF EXISTS tr_order_ready_automation ON public.orders;

-- 3. Remove a função associada (com CASCADE para forçar remoção de dependentes se houver)
DROP FUNCTION IF EXISTS public.handle_order_ready_automation() CASCADE;
