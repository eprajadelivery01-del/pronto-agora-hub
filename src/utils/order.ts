/**
 * Utilitários para tratamento e identificação de pedidos no App do Lojista.
 */

/**
 * Identifica se um pedido foi selecionado pelo cliente como Retirada no Local / Balcão.
 */
export function isPickupOrder(order: any): boolean {
  if (!order) return false;

  // 1. Campo explícito se existir
  if (order.fulfillment_mode === 'pickup') return true;

  // 2. Análise do endereço de entrega registrado
  const address = String(
    order.delivery_address ||
    order.address ||
    order.dropoff_address ||
    order.customer?.address ||
    ''
  ).trim().toLowerCase();

  if (
    address.includes('retirada no local') ||
    address === 'retirada' ||
    address.startsWith('retirada na loja') ||
    address === 'retirada no local ou endereço inválido'
  ) {
    return true;
  }

  // 3. Análise das observações do pedido (onde o Checkout injeta a tag canônica)
  const notes = String(order.notes || '').toLowerCase();
  if (
    notes.includes('[retirada no local]') ||
    notes.includes('retirada no local') ||
    notes.includes('[retirada') ||
    notes.includes('retirar na loja')
  ) {
    return true;
  }

  return false;
}
