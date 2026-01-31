import { roundCurrency } from "@/lib/formatters";

export const normalizeId = (value: string | null | undefined): number | null => {
  if (!value || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeNumber = (value: unknown): number => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const normalizeOptionalNumber = (value: unknown): number | null => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : null;
};

export const calculateImporte = (cantidad: number, precio: number): number => {
  const result = (cantidad || 0) * (precio || 0);
  return roundCurrency(result);
};

export const calculateTotal = <T extends { importe?: number; cantidad?: number; precio?: number }>(
  detalles: T[]
): number => {
  if (!Array.isArray(detalles)) return 0;
  const total = detalles.reduce((acc, detalle) => {
    if (!detalle) return acc;
    const importe =
      typeof detalle.importe === "number"
        ? detalle.importe
        : calculateImporte(Number(detalle.cantidad ?? 0), Number(detalle.precio ?? 0));
    return Number.isFinite(importe) ? acc + importe : acc;
  }, 0);
  return roundCurrency(total);
};

export const getArticuloFilterByTipo = (
  tipoSolicitudId: string | undefined,
  tiposSolicitud: Array<{ id: number; tipo_articulo_filter_id?: number | null }> | undefined,
  _tiposArticulo?: Array<{ id: number; nombre: string }> | undefined
): number | undefined => {
  if (!tipoSolicitudId || !tiposSolicitud) return undefined;
  const tipo = tiposSolicitud.find((item) => item.id === Number(tipoSolicitudId));
  return tipo?.tipo_articulo_filter_id ?? undefined;
};
