
## Objetivo

Substituir o componente de mapa (`RegionPickerMap`) no formulário de nova solicitação por uma grade de cards/caixas selecionáveis, conforme os prints de referência. Cada card mostra um indicador colorido, o nome da região e o valor da entrega. O lojista apenas seleciona a região — não pode editar os valores.

## Alterações

### 1. Criar componente `RegionPickerGrid`

Novo arquivo: `src/components/business/RegionPickerGrid.tsx`

- Busca as regiões do Supabase (filtrando por `city_id` se fornecido), igual ao `RegionPickerMap`
- Renderiza um grid responsivo (3 colunas em desktop, 2 em mobile) de cards
- Cada card exibe:
  - Bolinha colorida (cor da região)
  - Nome da região em negrito
  - Valor (`R$ X,XX`) abaixo do nome
- Ao clicar, o card fica selecionado (borda azul/primária, fundo levemente colorido, ícone de check)
- Dispara `onRegionSelect(fee, regionId)` ao selecionar
- Valores são somente leitura — o lojista não pode editá-los

### 2. Atualizar `NewDeliveryForm.tsx`

- Substituir o import e uso de `RegionPickerMap` por `RegionPickerGrid`
- Remover o wrapper `rounded-[2rem] overflow-hidden border` do mapa
- Adicionar label "Região de Entrega" acima do grid
- Quando uma região é selecionada, o campo "Taxa de Entrega" é preenchido automaticamente e fica readonly (não editável manualmente), mostrando um badge com o nome da região selecionada
- Manter toda a lógica de submit inalterada

### 3. Opcionalmente manter `RegionPickerMap`

O arquivo `RegionPickerMap.tsx` não será deletado (pode ser usado em outros contextos), apenas deixará de ser importado no formulário.

## Detalhes técnicos

- O grid usa classes Tailwind existentes (`grid grid-cols-2 md:grid-cols-3 gap-3`)
- Estado `selectedRegionId` controlado no grid para highlight visual
- O campo de taxa de entrega no form passa a ser `readOnly` quando uma região está selecionada, com um badge mostrando o nome da região
- A busca de regiões reutiliza o mesmo padrão do `RegionPickerMap` (query direta ao Supabase na tabela `regions`)
