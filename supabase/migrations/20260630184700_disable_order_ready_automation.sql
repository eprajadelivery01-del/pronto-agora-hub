-- ==========================================
-- SCRIPT: Desativar Automação de Entregas
-- ==========================================
-- Isso fará com que o Painel do Lojista 
-- PARE de mandar pedidos direto para "Em Rota"
-- sem o usuário apertar "Chamar Entregador".

DROP TRIGGER IF EXISTS tr_order_ready_automation ON public.orders;
DROP FUNCTION IF EXISTS public.handle_order_ready_automation();
