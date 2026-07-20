/**
 * Retorna o melhor telefone para exibir para o lojista.
 * Prioriza o telefone que foi preenchido na hora do pedido,
 * fazendo fallback para o telefone do cadastro (customers ou profiles).
 */
export function getCustomerDisplayPhone(order: any, customerProfile?: any): string {
  // 1. Tenta o telefone direto no pedido ou salvo durante a entrega
  const orderPhone = order?.customer_phone || order?.customer?.phone;
  
  // 2. Tenta o telefone vindo do cadastro (customers, profiles) ou do parâmetro extra
  const registrationPhone = customerProfile?.phone || order?.customers?.phone || order?.profiles?.phone;
  
  const isValid = (phone: string | null | undefined) => {
    return phone && phone !== "Não informado" && phone.trim() !== "" && phone.trim() !== "null";
  };

  if (isValid(orderPhone)) {
    return orderPhone;
  }
  
  if (isValid(registrationPhone)) {
    return registrationPhone;
  }
  
  return "Não informado";
}

/**
 * Retorna o melhor nome para exibir para o lojista.
 */
export function getCustomerDisplayName(order: any, customerProfile?: any): string {
  const orderName = order?.customer_name || order?.customer?.name;
  const registrationName = customerProfile?.name || customerProfile?.full_name || order?.customers?.name || order?.profiles?.full_name;
  
  const isGeneric = (name: string | null | undefined) => {
    if (!name) return true;
    const lower = name.toLowerCase();
    return lower === "cliente marketplace" || lower === "consumidor" || lower === "cliente" || lower === "null" || name.trim() === "";
  };

  if (!isGeneric(orderName)) {
    return orderName;
  }
  
  if (!isGeneric(registrationName)) {
    return registrationName;
  }
  
  return "Cliente Marketplace";
}
