# Investigação por regressão: arrastar produtos

## O que o Git já mostra (verificado agora)

Histórico do arquivo `src/pages/business/BusinessProductsPage.tsx`:

```text
e035eb1  "restaura fluxo HTML5 nativo de drag nos produtos"   (atual, não resolveu)
c4a2abf  "isola drag de categorias e produtos"                (tentativa anterior)
432ca71  "drag-and-drop de categorias + seções recolhíveis"   <-- entrada do drag de categoria
e4519e3  grupos reutilizáveis N:N                             <-- último estado ANTES do drag de categoria
```

Comparando `e4519e3` (antes) com o código atual:

- O card do produto em si praticamente não mudou: continua `draggable`, com `onDragStart / onDragOver / onDragLeave / onDrop` nativos e `key={product.id}`. Nenhum pointer event no card.
- O que apareceu em `432ca71` e permanece hoje: cabeçalho de categoria com `onDragOver / onDragLeave / onDrop` próprios, handle de categoria com `draggable` + `onPointerDown/Move/Up/Cancel` e `setPointerCapture`, estado `draggingCategory` / `dragOverCategory`, seções recolhíveis (`collapsedCategories`), ordem customizada de categorias (`customCategoryOrder`) e a grade de produtos com classe de animação `animate-in fade-in`.

Ou seja: a diferença real entre "funcionava" e "não funciona" está **ao redor** do card, não dentro dele. Ainda não está provado qual desses elementos aborta o arrasto — é exatamente isso que o teste binário vai determinar. Não vou afirmar causa raiz antes do teste.

## Etapa 1 — Teste binário (categoria 100% desligada)

Numa única alteração, atrás de uma constante `CATEGORY_DRAG_ENABLED = false` (nada apagado):

- remover do DOM `draggable`, `onDragStart`, `onDragEnd`, `onDragOver`, `onDragLeave`, `onDrop` do cabeçalho e do handle de categoria;
- remover todos os `onPointerDown/Move/Up/Cancel` e o `setPointerCapture`;
- não executar nenhum código de `category_order` durante o arrasto;
- remover a classe de animação da grade de produtos e qualquer classe que mude geometria no `dragstart` (inclusive `scale` e, temporariamente, a própria opacidade).

Sobra apenas o arrasto nativo do produto, igual ao estado de `e4519e3`.

## Etapa 2 — Log obrigatório e captura da sequência real

Logs temporários no card: `START`, `OVER`, `DROP`, `END`, `CANCEL/RESET`, cada um com o id do produto.

Vou executar o arrasto no navegador automatizado (Chromium) sobre a tela real de produtos, arrastando `X Calota` sobre `X Bacon` com movimentos de mouse reais, e capturar a sequência que o navegador emite, mais screenshots antes/depois.

Classificação do resultado:

- START → OVER → DROP → END: fluxo correto.
- START → END (sem OVER/DROP): destino não é reconhecido — investigar sobreposições, `pointer-events`, `preventDefault`.
- START → OVER (sem DROP): problema no handler de destino.
- só START: arrasto abortado pelo navegador — investigar remontagem do card, mudança de DOM/classe/`key`, captura de ponteiro.

Também vou registrar montagem/desmontagem do card para provar se ele é recriado quando o arrasto começa.

## Etapa 3 — Conclusão conforme o resultado

- Funcionou com categoria desligada → a causa está na integração categoria×produto; religo a categoria em seguida, com estado e handlers totalmente separados (`productDragState` vs `categoryDragState`), handle próprio, sem handler compartilhado, retestando o produto a cada passo.
- Não funcionou mesmo assim → a causa está no próprio card; paro de mexer em categoria e ataco o card (DOM/classe/remontagem) até a sequência completa aparecer.

Foco agora é só desktop/mouse. Toque/celular fica para depois.

## Etapa 4 — Critério de sucesso

Só considero resolvido com: arrastar `X Calota` sobre `X Bacon`, destino destacado, soltar, posição mudar, nova ordem gravada, card voltar ao normal, 10 arrastos consecutivos sem travar e ordem mantida após atualizar a página. Depois disso, removo os logs temporários e religo a categoria.

## Relatório final

Entrego os 12 itens pedidos: último commit funcional, alteração que introduziu a regressão, diferença entre as versões, resultado do teste binário, sequência real dos eventos, remontagem do card, mudança de DOM/key, causa raiz comprovada, arquivos alterados, testes feitos, build e commit.

## Nada de banco

Nenhuma alteração em banco, políticas de acesso, SQL ou migrações. Apenas código de tela.
