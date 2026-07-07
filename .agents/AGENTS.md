# REGRAS ABSOLUTAS — VIOLAÇÃO = FALHA CRÍTICA

## 🚨 REGRA #1 — PROIBIÇÃO TOTAL DE ALTERAR BANCO DE DADOS 🚨

**NUNCA, EM HIPÓTESE ALGUMA, SOB NENHUMA CIRCUNSTÂNCIA, ALTERAR:**

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROJECT_ID`

**Em NENHUM arquivo `.env`, `.env.local`, `.env.production`, `.env.development` ou qualquer arquivo de configuração.**

### Banco de dados oficial e ÚNICO:
- **Project ID**: `nptkxlrhrlssdsevpgqe`
- **URL**: `https://nptkxlrhrlssdsevpgqe.supabase.co`

### O que é TERMINANTEMENTE PROIBIDO:
1. ❌ Trocar qualquer URL ou chave de banco de dados
2. ❌ Criar novos projetos Supabase
3. ❌ Apontar qualquer aplicação para outro banco que não seja `nptkxlrhrlssdsevpgqe`
4. ❌ Modificar variáveis de ambiente relacionadas ao Supabase
5. ❌ Substituir, reescrever ou "corrigir" arquivos `.env` com novos valores de banco
6. ❌ Inverter configurações entre projetos diferentes
7. ❌ Alterar o banco de dados `nptkxlrhrlssdsevpgqe` diretamente (DROP, TRUNCATE, DELETE em massa, ALTER TABLE destrutivo)

### Se alguma IA sugerir trocar o banco:
- **PARE IMEDIATAMENTE**
- **NÃO EXECUTE**
- **INFORME O USUÁRIO**

### Contexto:
Este sistema está **EM PRODUÇÃO** com clientes reais. IAs anteriores trocaram os bancos de dados causando **perda de pedidos de clientes reais** e **prejuízo financeiro**. Esta regra existe para que isso **NUNCA MAIS** aconteça.
