export interface PaymentMethodInfo {
  label: string;
  detail: string;
  badgeClass: string;
  icon: string;
  troco: string | null;
  methodKey: string;
}

export function getPaymentMethodInfo(
  method?: string | null,
  notes?: string | null
): PaymentMethodInfo {
  const normMethod = (method || '').toLowerCase().trim();
  const rawNotes = notes || '';
  const notesLower = rawNotes.toLowerCase();

  // Detectar troco informado nas notas (ex: "Troco para R$ 50.00" ou "Troco para R$ 50,00")
  const hasTroco = rawNotes.includes('Troco para R$');
  const trocoValor = hasTroco ? rawNotes.split('Troco para R$')[1]?.trim() : null;

  if (
    normMethod === 'money' ||
    normMethod === 'cash' ||
    hasTroco ||
    notesLower.includes('dinheiro')
  ) {
    return {
      methodKey: 'money',
      label: 'Dinheiro',
      detail: trocoValor ? `Levar troco para R$ ${trocoValor}` : 'Sem troco (valor exato)',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
      icon: '💵',
      troco: trocoValor,
    };
  }

  if (
    normMethod === 'card' ||
    normMethod === 'machine' ||
    normMethod === 'maquina' ||
    notesLower.includes('cartao') ||
    notesLower.includes('cartão') ||
    notesLower.includes('maquininha')
  ) {
    return {
      methodKey: 'card',
      label: 'Máquina (Cartão / PIX)',
      detail: 'Levar maquininha de cartão ou PIX na entrega',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
      icon: '💳',
      troco: null,
    };
  }

  if (normMethod === 'credit_card') {
    return {
      methodKey: 'credit_card',
      label: 'Cartão de Crédito',
      detail: 'Cobrança no Cartão de Crédito',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
      icon: '💳',
      troco: null,
    };
  }

  if (normMethod === 'debit_card') {
    return {
      methodKey: 'debit_card',
      label: 'Cartão de Débito',
      detail: 'Cobrança no Cartão de Débito',
      badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800',
      icon: '💳',
      troco: null,
    };
  }

  if (normMethod === 'pix' || notesLower.includes('pix')) {
    return {
      methodKey: 'pix',
      label: 'PIX',
      detail: 'Pagamento via Chave PIX',
      badgeClass: 'bg-teal-50 text-teal-700 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
      icon: '📱',
      troco: null,
    };
  }

  if (normMethod === 'voucher' || notesLower.includes('vale')) {
    return {
      methodKey: 'voucher',
      label: 'Vale Refeição',
      detail: 'Pagamento via Vale / Ticket',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
      icon: '🎫',
      troco: null,
    };
  }

  if (normMethod === 'online') {
    return {
      methodKey: 'online',
      label: 'Pagamento Online',
      detail: 'Pago antecipadamente no aplicativo',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
      icon: '🌐',
      troco: null,
    };
  }

  // Se o método for qualquer outra string
  if (method && method.trim() !== '') {
    return {
      methodKey: method,
      label: method.toUpperCase(),
      detail: 'Forma indicada no pedido',
      badgeClass: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700',
      icon: '💰',
      troco: trocoValor,
    };
  }

  // Fallback
  return {
    methodKey: 'presencial',
    label: 'A Combinar / Balcão',
    detail: 'Confirmar cobrança na entrega/retirada',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-800',
    icon: '💰',
    troco: trocoValor,
  };
}
