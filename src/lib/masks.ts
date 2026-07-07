export const maskPhone = (value: string) => {
  if (!value) return "";
  value = value.replace(/\D/g, "");
  if (value.length > 11) value = value.slice(0, 11);
  if (value.length <= 10) {
    return value.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  }
  return value.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
};

export const maskTime = (value: string) => {
  if (!value) return "";
  value = value.replace(/\D/g, "");
  if (value.length > 4) value = value.slice(0, 4);
  if (value.length >= 3) {
    return `${value.slice(0, 2)}:${value.slice(2)}`;
  }
  return value;
};

export const maskCPF = (value: string) => {
  if (!value) return "";
  value = value.replace(/\D/g, "");
  if (value.length > 11) value = value.slice(0, 11);
  return value
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})/, "$1-$2")
    .replace(/(-\d{2})\d+?$/, "$1");
};

export const maskCurrency = (value: string) => {
  if (!value) return "";
  value = value.replace(/\D/g, "");
  if (value === "") return "";
  const numberValue = Number(value) / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numberValue);
};
