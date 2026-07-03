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

export function getDeliveryValue(d: any): number {
  if (!d) return 0;
  
  let orderFee = 0;
  let hasOrderFee = false;
  
  // 1. Tenta pegar do pedido associado (Marketplace)
  if (d.orders) {
    if (Array.isArray(d.orders) && d.orders.length > 0 && d.orders[0].delivery_fee != null) {
      orderFee = Number(d.orders[0].delivery_fee);
      hasOrderFee = true;
    } else if (!Array.isArray(d.orders) && d.orders.delivery_fee != null) {
      orderFee = Number(d.orders.delivery_fee);
      hasOrderFee = true;
    }
  }

  // 2. Valores das colunas da própria tabela deliveries
  const v = Number(d.value) || 0;
  const p = Number(d.price) || 0;
  const df = Number(d.delivery_fee) || 0;

  // Se veio do Marketplace e tem taxa > 0, respeita a taxa original
  if (hasOrderFee && orderFee > 0) {
    return orderFee;
  }
  
  // Para envios manuais (Lojista via Kanban ou Admin) a ordem pode não ter taxa 
  // e o valor estar gravado em 'value', 'price' ou 'delivery_fee'. 
  // Pegamos o maior valor preenchido nestas colunas.
  const maxDeliveryValue = Math.max(v, p, df);
  
  if (maxDeliveryValue > 0) {
    return maxDeliveryValue;
  }
  
  // Se todos forem 0, então é de fato um Frete Grátis (0.00)
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
