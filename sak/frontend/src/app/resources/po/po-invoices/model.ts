"use client";

import { z } from "zod";

const requiredId = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().int().positive(),
);

const optionalId = z.preprocess(
  (v) => (v === "" || v === null || v === 0 || v === "0" ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

const optionalDate = z.preprocess((v) => {
  if (v === "" || v === null) return undefined;
  return v;
}, z.string().optional());

const optionalString = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional(),
);

const optionalNonNegativeNumber = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().min(0).optional(),
);

export const poInvoiceDetalleSchema = z.object({
  id: optionalId,
  articulo_id: optionalId,
  descripcion: optionalString.pipe(z.string().max(500).optional()),
  centro_costo_id: optionalId,
  oportunidad_id: optionalId,
  poOrderDetail_id: optionalId,
  cantidad: z.coerce.number().gt(0),
  precio_unitario: z.coerce.number().gt(0),
  importe: z.coerce.number().min(0),
});

export const poInvoiceTaxSchema = z.object({
  id: optionalId,
  concepto_id: optionalId,
  descripcion: optionalString.pipe(z.string().max(50).optional()),
  importe: z.coerce.number().min(0),
  importe_base: optionalNonNegativeNumber,
  porcentaje: optionalNonNegativeNumber,
});

export const poInvoiceSchema = z.object({
  titulo: z.string().min(1).max(50),
  numero: z.string().min(1).max(50),
  id_tipocomprobante: requiredId,
  fecha_emision: z.string().min(1),
  fecha_vencimiento: optionalDate,
  fecha_pago: optionalDate,
  observaciones: optionalString.pipe(z.string().max(1000).optional()),
  centro_costo_id: optionalId,
  oportunidad_id: optionalId,
  subtotal: z.coerce.number().min(0),
  total_impuestos: z.coerce.number().min(0),
  total: z.coerce.number().min(0),
  proveedor_id: requiredId,
  usuario_responsable_id: requiredId,
  invoice_status_id: requiredId,
  invoice_status_fin_id: optionalId,
  metodo_pago_id: optionalId,
  fecha_estado: optionalString,
  detalles: z.array(poInvoiceDetalleSchema).min(1),
  taxes: z.array(poInvoiceTaxSchema).optional(),
});

export type PoInvoiceFormValues = z.infer<typeof poInvoiceSchema>;
export type PoInvoiceDetalleFormValues = z.infer<typeof poInvoiceDetalleSchema>;
export type PoInvoiceTaxFormValues = z.infer<typeof poInvoiceTaxSchema>;

export type PoOrderDetailRaw = {
  id?: number | string | null;
  order_id?: number | string | null;
  articulo_id?: number | string | null;
  descripcion?: string | null;
  cantidad?: number | string | null;
  precio?: number | string | null;
  importe?: number | string | null;
  centro_costo_id?: number | string | null;
  oportunidad_id?: number | string | null;
};

export const getPoInvoiceDetalleDefaults = () => ({
  articulo_id: "",
  descripcion: "",
  centro_costo_id: "",
  oportunidad_id: "",
  cantidad: 1,
  precio_unitario: 0,
  importe: 0,
  poOrderDetail_id: "",
});

export const getPoInvoiceTaxDefaults = () => ({
  concepto_id: "",
  descripcion: "",
  importe: 0,
});

export const INVOICE_STATUS_BADGES: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-800",
  emitida: "bg-sky-100 text-sky-800",
  aprobada: "bg-emerald-100 text-emerald-800",
  rechazada: "bg-rose-100 text-rose-800",
  recibida: "bg-amber-100 text-amber-800",
  cerrada: "bg-indigo-100 text-indigo-800",
  anulada: "bg-zinc-100 text-zinc-800",
};

export const INVOICE_STATUS_FIN_BADGES: Record<string, string> = {
  inicial: "bg-slate-100 text-slate-800",
  agendada: "bg-sky-100 text-sky-800",
  autorizada: "bg-emerald-100 text-emerald-800",
  pagada: "bg-indigo-100 text-indigo-800",
  cancelada: "bg-rose-100 text-rose-800",
  cancelado: "bg-rose-100 text-rose-800",
};

export const getInvoiceStatusBadgeClass = (status?: string | null) => {
  const key = String(status ?? "").toLowerCase();
  return INVOICE_STATUS_BADGES[key] ?? "bg-slate-100 text-slate-800";
};

export const getInvoiceStatusFinBadgeClass = (status?: string | null) => {
  const key = String(status ?? "").toLowerCase();
  return INVOICE_STATUS_FIN_BADGES[key] ?? "bg-slate-100 text-slate-800";
};

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toOptionalNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const round2 = (value: number) => Number(value.toFixed(2));

export const computeDetalleImporte = (d: {
  cantidad?: unknown;
  precio_unitario?: unknown;
}) => {
  const cantidad = toNumber(d.cantidad);
  const precio = toNumber(d.precio_unitario);
  return round2(cantidad * precio);
};

export const mapPoOrderDetailToInvoiceDetail = (
  detalle: PoOrderDetailRaw,
): PoInvoiceDetalleFormValues => {
  const cantidad = toNumber(detalle.cantidad);
  const precioUnitario = toNumber(detalle.precio);
  const importe = toOptionalNumber(detalle.importe) ?? round2(cantidad * precioUnitario);

  return {
    id: undefined,
    poOrderDetail_id: toOptionalNumber(detalle.id),
    articulo_id: toOptionalNumber(detalle.articulo_id),
    descripcion: String(detalle.descripcion ?? ""),
    cantidad,
    precio_unitario: precioUnitario,
    importe,
    centro_costo_id: toOptionalNumber(detalle.centro_costo_id),
    oportunidad_id: toOptionalNumber(detalle.oportunidad_id),
  };
};

export const mergeInvoiceDetails = (
  existing: PoInvoiceDetalleFormValues[],
  incoming: PoInvoiceDetalleFormValues[],
) => {
  const existingIds = new Set(
    (existing ?? [])
      .map((item) => toOptionalNumber(item.poOrderDetail_id))
      .filter((value): value is number => typeof value === "number"),
  );

  const filtered = (incoming ?? []).filter((item) => {
    const id = toOptionalNumber(item.poOrderDetail_id);
    if (typeof id !== "number") return true;
    return !existingIds.has(id);
  });

  return [...(existing ?? []), ...filtered];
};

export const computePoInvoiceSubtotal = (
  detalles: Array<{ importe?: unknown; cantidad?: unknown; precio_unitario?: unknown }>,
) => {
  const subtotal = detalles.reduce((acc, d) => {
    const value = toOptionalNumber(d.importe) ?? computeDetalleImporte(d);
    return acc + (Number.isFinite(value) ? value : 0);
  }, 0);
  return round2(subtotal);
};

export const computePoInvoiceTaxesImporte = (
  taxes: Array<{ importe?: unknown }>,
) => {
  const total = taxes.reduce((acc, t) => {
    const value = toOptionalNumber(t.importe) ?? 0;
    return acc + (Number.isFinite(value) ? value : 0);
  }, 0);
  return round2(total);
};

const normalizeDetalle = (detalle: Record<string, unknown>) => {
  const { poOrderDetail: _poOrderDetail, order_id: _orderId, ...rest } =
    detalle as Record<string, unknown>;
  const cantidad = toOptionalNumber(detalle.cantidad) ?? 0;
  const precioUnitario = toOptionalNumber(detalle.precio_unitario) ?? 0;
  const importe = toOptionalNumber(detalle.importe) ?? round2(cantidad * precioUnitario);

  return {
    ...rest,
    cantidad,
    precio_unitario: precioUnitario,
    importe,
  };
};

const normalizeTaxes = (taxes: Array<Record<string, unknown>>) => {
  return taxes
    .map((tax) => {
      const importe = toOptionalNumber(tax.importe) ?? 0;
      return {
        id: tax.id,
        concepto_id: tax.concepto_id,
        descripcion: tax.descripcion,
        importe,
      };
    })
    .filter((tax) => {
      const conceptoId = toOptionalNumber(tax.concepto_id);
      const descripcion = String(tax.descripcion ?? "").trim();
      const importe = toOptionalNumber(tax.importe) ?? 0;
      return conceptoId || descripcion || importe !== 0;
    });
};

export const normalizePoInvoicePayload = (data: unknown) => {
  if (!data || typeof data !== "object") return data;
  const payload = data as {
    detalles?: Array<Record<string, unknown>>;
    taxes?: Array<Record<string, unknown>>;
    subtotal?: unknown;
    total_impuestos?: unknown;
    total?: unknown;
  };

  const detalles = Array.isArray(payload.detalles)
    ? payload.detalles.map(normalizeDetalle)
    : [];

  const taxes = Array.isArray(payload.taxes)
    ? normalizeTaxes(payload.taxes)
    : [];

  const subtotalComputed = computePoInvoiceSubtotal(detalles);
  const impuestosExtra = taxes.length
    ? computePoInvoiceTaxesImporte(taxes)
    : 0;

  const subtotal =
    toOptionalNumber(payload.subtotal) ?? subtotalComputed;
  const totalImpuestos =
    toOptionalNumber(payload.total_impuestos) ?? round2(impuestosExtra);
  const total =
    toOptionalNumber(payload.total) ?? round2(subtotal + totalImpuestos);

  return {
    ...payload,
    detalles,
    taxes,
    subtotal,
    total_impuestos: totalImpuestos,
    total,
  };
};
