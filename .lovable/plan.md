## Diagnóstico

Os dois sintomas têm a **mesma causa raiz**: todas as páginas do painel lojista dependem de uma linha em `public.companies` com `user_id = auth.uid()`. Quando essa linha não é encontrada (conta nova, vínculo não criado, ou bloqueio de RLS), o estado `companyId` permanece `null` e:

- **Botões desativados** — em `src/pages/business/BusinessProductsPage.tsx` (linhas 135 e 159) os botões "Novo Item" / "Começar agora" usam `disabled={!companyId}`. O mesmo padrão existe no fluxo de "Lançar corrida" (`NewDeliveryForm` exige `companyId` e `selectedRegionId`).
- **Loading infinito** — em `src/pages/business/BusinessOrdersPage.tsx` o `useEffect` de inicialização (linhas 305‑341) só chama `setCompanyId` quando encontra empresa; se não encontra, **nunca chama `setLoading(false)`** (o `fetchOrders` só roda quando `companyId` existe), então o skeleton fica girando. `BusinessHomePage`, `BusinessFinancePage`, `BusinessCouponsPage`, `BusinessCustomersPage` e `BusinessHistoryPage` têm o mesmo padrão de `enabled: !!companyId` sem estado de "empresa não vinculada".

Hoje o usuário não recebe nenhum aviso — a UI simplesmente parece quebrada.

## O que vamos fazer

### 1. Hook central `useCurrentCompany`
Criar `src/hooks/useCurrentCompany.ts` que encapsula a busca atual (companies por `user_id` + fallback admin já presente em `src/services/companies.ts`) e devolve:
```
{ companyId, company, isLoading, isLinked, error }
```
Substituir as duplicações de `useEffect` que hoje refazem essa lógica em `BusinessProductsPage`, `BusinessOrdersPage`, `BusinessLayout`, `BusinessHomePage`.

### 2. Estado "empresa não vinculada"
Criar `src/components/business/CompanyNotLinkedState.tsx` — tela de aviso com:
- Mensagem clara: "Sua conta de lojista ainda não está vinculada a uma empresa."
- ID do usuário (para suporte) e botão "Copiar".
- Botões: "Falar com suporte" e "Sair".

Renderizar esse componente em todas as páginas do painel quando `isLinked === false && !isLoading`, em vez de mostrar skeletons eternos ou botões mortos.

### 3. Corrigir loops de loading
Em cada página que hoje deixa `loading = true` quando não acha empresa, garantir `setLoading(false)` no caminho "sem empresa". Pontos a ajustar:
- `src/pages/business/BusinessOrdersPage.tsx` (init useEffect)
- `src/pages/business/BusinessHomePage.tsx`
- `src/pages/business/BusinessFinancePage.tsx`
- `src/pages/business/BusinessCouponsPage.tsx`
- `src/pages/business/BusinessCustomersPage.tsx`
- `src/pages/business/BusinessHistoryPage.tsx`

### 4. Botões "Novo Item" / "Lançar corrida"
Quando `companyId` existe → habilitados normalmente. Quando não existe → em vez de ficar `disabled` silenciosamente, mostram um toast explicando "Empresa não vinculada — contate o suporte" ao clicar (a página já vai estar no estado da etapa 2, mas isso protege caminhos onde só o botão é visível).

### 5. Diagnóstico no console
Adicionar `console.info("[Lojista] companyId resolvido:", { userId, companyId, source })` em `useCurrentCompany` para facilitar suporte futuro.

## Detalhes técnicos

- Nenhuma alteração de schema/RLS — apenas frontend.
- O `AuthContext` e `supabaseClient` (Supabase externo `nptkxlrhrlssdsevpgqe`) ficam intactos.
- Reuso de `fetchCompanyByUserId` já existente em `src/services/companies.ts` (que já tem fallback para admin).
- Realtime channels em `BusinessLayout` e `BusinessOrdersPage` continuam subscritos apenas quando `companyId` existir (já é o caso hoje).

## Fora de escopo

- Criar/vincular automaticamente uma empresa para a conta — isso exige decisão do admin no painel administrativo (outro projeto).
- Mexer nos painéis admin/driver/marketplace.
