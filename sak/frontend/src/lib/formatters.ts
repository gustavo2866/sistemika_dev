export const CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

export const roundCurrency = (value: number) =>
  Number.isFinite(value) ? Number(value.toFixed(2)) : 0;

export function formatCurrency(value: number): string {
  return CURRENCY_FORMATTER.format(Number(value) || 0);
}

export function formatImporteDisplay(value: number): string {
  const asNumber = Number(value ?? 0);
  return Number.isFinite(asNumber) ? asNumber.toFixed(2) : "0.00";
}
