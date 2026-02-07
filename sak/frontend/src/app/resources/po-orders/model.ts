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

export const poOrderDetalleSchema = z
  .object({
    id: optionalId,
    articulo_id: optionalId,
    descripcion: z.string().min(1).max(500),
    unidad_medida: z.string().max(50).optional(),
    cantidad: z.coerce.number().min(0),
    precio: z.coerce.number().min(0),
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
  departamento_id: requiredId,
  order_status_id: requiredId,
  solicitante_id: requiredId,
  proveedor_id: optionalId,
  centro_costo_id: optionalId,
  oportunidad_id: optionalId,
  fecha_necesidad: optionalDate,
  comentario: z.string().max(1000).optional(),
  total: z.coerce.number().min(0),
  detalles: z.array(poOrderDetalleSchema).min(1),
});

export type PoOrderFormValues = z.infer<typeof poOrderSchema>;
export type PoOrderDetalleFormValues = z.infer<typeof poOrderDetalleSchema>;

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
