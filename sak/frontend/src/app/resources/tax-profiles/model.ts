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

const optionalString = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional(),
);

const optionalBoolean = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.boolean().optional(),
);

export const taxProfileDetailSchema = z.object({
  id: optionalId,
  concepto_id: requiredId,
  porcentaje: z.coerce.number().min(0),
  descripcion: optionalString.pipe(z.string().max(255).optional()),
  activo: optionalBoolean,
  fecha_vigencia: z.string().min(1),
});

export const taxProfileSchema = z.object({
  nombre: z.string().min(1).max(255),
  descripcion: optionalString.pipe(z.string().max(500).optional()),
  activo: optionalBoolean,
  details: z.array(taxProfileDetailSchema).min(1),
});

export type TaxProfileFormValues = z.infer<typeof taxProfileSchema>;
export type TaxProfileDetailFormValues = z.infer<typeof taxProfileDetailSchema>;
