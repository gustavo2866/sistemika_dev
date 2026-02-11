"use client";

import { z } from "zod";

export const TIPO_ARTICULO_RULES = {
  NOMBRE: {
    MAX_LENGTH: 100,
  },
  DESCRIPCION: {
    MAX_LENGTH: 500,
  },
} as const;

const optionalString = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional(),
);

const requiredId = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().int().positive(),
);

const booleanFromInput = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  if (value == null || value === "") return false;
  return Boolean(value);
}, z.boolean());

export const tipoArticuloSchema = z.object({
  nombre: z.string().min(1).max(TIPO_ARTICULO_RULES.NOMBRE.MAX_LENGTH),
  adm_concepto_id: requiredId,
  descripcion: optionalString.pipe(
    z.string().max(TIPO_ARTICULO_RULES.DESCRIPCION.MAX_LENGTH).optional(),
  ),
  activo: booleanFromInput,
});

export type TipoArticuloFormValues = z.infer<typeof tipoArticuloSchema>;

export const TIPO_ARTICULO_DEFAULT = {
  nombre: "",
  descripcion: "",
  activo: true,
} satisfies Partial<TipoArticuloFormValues>;
