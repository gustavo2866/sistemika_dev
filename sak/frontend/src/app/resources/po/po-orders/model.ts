"use client";

import { z } from "zod";

const requiredId = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().int().positive(),
);

const optionalId = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
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

const optionalTipoCompra = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.enum(["normal", "directa"]).optional(),
);

export const poOrderDetalleSchema = z
  .object({
    id: optionalId,
    articulo_id: optionalId,
    descripcion: optionalString.pipe(z.string().max(500).optional()),
    unidad_medida: optionalString.pipe(z.string().max(50).optional()),
    centro_costo_id: optionalId,
    oportunidad_id: optionalId,
    cantidad: z.coerce.number().gt(0),
    precio: z.coerce.number().gt(0),
    importe: z.coerce.number().min(0),
  })
  .superRefine((val, ctx) => {
    // Round to 2 decimals like backend DECIMAL(15,2)
    const expected = Number((val.cantidad * val.precio).toFixed(2));
    const got = Number((val.importe ?? 0).toFixed(2));
    if (Number.isFinite(expected) && got !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["importe"],
        message: "El importe debe ser cantidad * precio",
      });
    }
  });

export const poOrderSchema = z.object({
  titulo: z.string().min(1).max(200),
  tipo_solicitud_id: requiredId,
  departamento_id: optionalId,
  order_status_id: requiredId,
  metodo_pago_id: optionalId,
  tipo_compra: optionalTipoCompra,
  solicitante_id: requiredId,
  proveedor_id: optionalId,
  centro_costo_id: optionalId,
  oportunidad_id: optionalId,
  fecha_necesidad: optionalDate,
  comentario: optionalString.pipe(z.string().max(1000).optional()),
  total: z.coerce.number().min(0),
  detalles: z.array(poOrderDetalleSchema).min(1),
});

export type PoOrderFormValues = z.infer<typeof poOrderSchema>;
export type PoOrderDetalleFormValues = z.infer<typeof poOrderDetalleSchema>;

export const getPoOrderDetalleDefaults = () => ({
  articulo_id: "",
  descripcion: "",
  unidad_medida: "",
  centro_costo_id: "",
  oportunidad_id: "",
  cantidad: 1,
  precio: 0,
  importe: 0,
});

export const normalizeStatusName = (value?: string | null) =>
  value ? String(value).trim().toLowerCase() : "";

export const capitalizeStatusName = (value: string) =>
  value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;

export const PO_ORDER_LOCKED_STATUS = ["aprobada", "rechazada"] as const;

export const isPoOrderLocked = (statusName?: string | null) =>
  PO_ORDER_LOCKED_STATUS.includes(
    normalizeStatusName(statusName) as (typeof PO_ORDER_LOCKED_STATUS)[number],
  );

export const ORDER_STATUS_BADGES: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-800",
  pendiente: "bg-amber-100 text-amber-800",
  aprobado: "bg-emerald-100 text-emerald-800",
  aprobada: "bg-emerald-100 text-emerald-800",
  rechazada: "bg-rose-100 text-rose-800",
  rechazado: "bg-rose-100 text-rose-800",
  en_proceso: "bg-sky-100 text-sky-800",
  finalizada: "bg-indigo-100 text-indigo-800",
  cancelada: "bg-zinc-100 text-zinc-800",
  cancelado: "bg-zinc-100 text-zinc-800",
};

export const getOrderStatusBadgeClass = (status?: string | null) => {
  const key = String(status ?? "").toLowerCase();
  return ORDER_STATUS_BADGES[key] ?? "bg-slate-100 text-slate-800";
};

export const computeDetalleImporte = (d: {
  cantidad?: unknown;
  precio?: unknown;
}) => {
  const cantidad = Number(d.cantidad ?? 0);
  const precio = Number(d.precio ?? 0);
  return Number((cantidad * precio).toFixed(2));
};

export const computePoOrderTotal = (detalles: Array<{ importe?: unknown }>) => {
  const total = detalles.reduce((acc, d) => {
    const val = Number(d.importe ?? 0);
    return acc + (Number.isFinite(val) ? val : 0);
  }, 0);
  return Number(total.toFixed(2));
};

export const normalizePoOrderPayload = (data: unknown) => {
  if (!data || typeof data !== "object") return data;
  const payload = data as { detalles?: Array<Record<string, unknown>> };
  if (!Array.isArray(payload.detalles)) return data;

  const detalles = payload.detalles.map((detalle) => ({
    ...detalle,
    importe: computeDetalleImporte(detalle),
  }));

  return {
    ...payload,
    detalles,
    total: computePoOrderTotal(detalles),
  };
};

export const TIPO_COMPRA_CHOICES = [
  { id: "normal", name: "Normal" },
  { id: "directa", name: "Directa" },
] as const;
