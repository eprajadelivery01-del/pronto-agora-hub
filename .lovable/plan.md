# Corrigir registro de notificações do lojista

## Objetivo
Eliminar o erro repetido ao registrar o celular para notificações, mantendo compatibilidade com a estrutura atual do banco externo.

## Implementação
- Remover do registro obrigatório qualquer campo de controle que não exista em todas as versões da tabela de celulares.
- Fazer a função de notificações repetir a atualização apenas com campos compatíveis quando o banco rejeitar campos opcionais.
- Evitar que versões antigas do aplicativo gerem alertas repetidos para esse erro já conhecido, sem esconder outros erros reais.
- Não alterar SQL, tabelas, permissões ou regras do banco.

## Validação
- Confirmar que o registro básico do celular continua salvando token, usuário, plataforma e aplicativo.
- Confirmar que a função aceita bancos sem `failure_count`.
- Verificar compilação e registros do painel após a mudança.
