# Arrastar categorias novas no cardápio

## O que está acontecendo

Categorias criadas depois que a ordem foi salva pela primeira vez não podem ser arrastadas. Elas aparecem na tela (sempre no fim da lista), mas ao soltá-las nada acontece e nada é salvo.

Motivo confirmado no código: a lista de ordem salva da loja só é preenchida uma única vez, quando ainda está vazia. Quando uma categoria nova surge, ela é exibida por um caminho alternativo, mas nunca entra nessa lista salva. Na hora de reordenar, o sistema procura a categoria dentro da lista salva, não encontra, e cancela a operação silenciosamente — tanto arrastando a categoria nova quanto soltando outra em cima dela.

## Correção

1. Manter a lista de ordem sempre completa: sempre que aparecer uma categoria que ainda não está nela (categoria nova, renomeada ou importada em lote), acrescentá-la ao fim automaticamente, sem apagar a ordem já definida pelo lojista.
2. Tornar a reordenação tolerante: se por algum motivo a origem ou o destino ainda não estiver na lista, reconstruir a ordem a partir das categorias visíveis na tela e aplicar o movimento — nunca abortar em silêncio.
3. Remover categorias que não existem mais quando a ordem for salva, para a lista não crescer indefinidamente.
4. Se a gravação falhar, voltar a ordem anterior na tela e avisar o lojista (comportamento já existente, mantido).

Nada muda no arrastar de produtos, nem no comportamento do toque no celular.

## Detalhes técnicos

Arquivo único: `src/pages/business/BusinessProductsPage.tsx`.

- `useEffect` de sincronização (linhas ~479-484): trocar a condição `customCategoryOrder.length === 0` por um merge — acrescentar ao estado qualquer item de `allCategories` ausente em `customCategoryOrder`, preservando a ordem atual; rodar quando a lista de categorias mudar (chave derivada de `allCategories.join("|")`).
- `reorderCategories` (linhas ~436-452): usar como base `prev.length ? prev : allCategories` e, quando `srcIdx` ou `tgtIdx` for `-1`, recompor a base com as categorias faltantes (via ref com as categorias atuais) antes de calcular os índices; só retornar `prev` se origem e destino realmente não existirem entre as categorias visíveis.
- `saveCategoryOrder`: filtrar a lista mesclada contra as categorias existentes antes do `update({ category_order })`, mantendo o merge com `remoteCategories`.
- Sem SQL, sem migration, sem alteração de RLS. A coluna `category_order` já existe.

## Verificação

Testar no navegador: criar/renomear uma categoria nova, arrastar o ícone de alça para outra posição, confirmar que a posição muda, recarregar a página e confirmar que a ordem permaneceu; repetir arrastando uma categoria antiga para cima da nova; confirmar que o arrastar de produtos continua igual.
