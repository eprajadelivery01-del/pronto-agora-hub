/**
 * Utilitários de exibição para entregas (deliveries).
 *
 * A tabela `deliveries` no Supabase tem duas colunas monetárias herdadas
 * — `value` e `price`. Dependendo do fluxo que originou a corrida,
 * o valor real pode estar em uma OU em outra:
 *   - `value` = 0 / null  → usar `price`
 *   - `value` > 0         → usar `value`
 *   - ambos vazios        → 0
 *
 * Use estes helpers em qualquer lugar que EXIBA o valor da corrida
 * (lista, detalhes, histórico, relatórios, notificações).
 *
 * ⚠️ Não usar em telas de Financeiro/Faturas: lá a cobrança é calculada
 * a partir da coluna `value` autoritativa para não alterar valores
 * faturados ao lojista.
 */

export type DeliveryValueShape = {
  value?: number | string | null;
  price?: number | string | null;
  delivery_fee?: number | string | null;
};

/** Retorna o valor numérico da corrida com fallback `value → price → 0`. */
export function getDeliveryValue(d: DeliveryValueShape | null | undefined): number {
  if (!d) return 0;
  const f = Number(d.delivery_fee);
  if (f) return f;
  const p = Number(d.price);
  if (p) return p;
  const v = Number(d.value);
  if (v) return v;
  return 0;
}

/** Mesma lógica, formatada com 2 casas decimais (ex.: "6.00"). */
export function formatDeliveryValue(d: DeliveryValueShape | null | undefined): string {
  return getDeliveryValue(d).toFixed(2);
}

/** Mesma lógica, já prefixada com "R$ " (ex.: "R$ 6,00"). */
export function formatDeliveryValueBRL(
  d: DeliveryValueShape | null | undefined,
  { commaDecimal = false }: { commaDecimal?: boolean } = {},
): string {
  const fixed = formatDeliveryValue(d);
  return `R$ ${commaDecimal ? fixed.replace(".", ",") : fixed}`;
}
