export function formatCurrencyMXN(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value || 0);
}
