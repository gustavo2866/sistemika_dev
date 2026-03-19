"use client";

import { z } from "zod";

export const ADM_CONCEPTO_RULES = {
  NOMBRE: {
    MAX_LENGTH: 200,
  },
  DESCRIPCION: {
    MAX_LENGTH: 500,
  },
  CUENTA: {
    MAX_LENGTH: 50,
  },
} as const;

const optionalString = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional(),
);

const booleanFromInput = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  if (value == null || value === "") return false;
  return Boolean(value);
}, z.boolean());

export const admConceptoSchema = z.object({
  nombre: z.string().min(1).max(ADM_CONCEPTO_RULES.NOMBRE.MAX_LENGTH),
  cuenta: z.string().min(1).max(ADM_CONCEPTO_RULES.CUENTA.MAX_LENGTH),
  descripcion: optionalString.pipe(
    z.string().max(ADM_CONCEPTO_RULES.DESCRIPCION.MAX_LENGTH).optional(),
  ),
  es_impuesto: booleanFromInput,
});

export type AdmConceptoFormValues = z.infer<typeof admConceptoSchema>;

export const ADM_CONCEPTO_DEFAULT = {
  nombre: "",
  cuenta: "",
  descripcion: "",
  es_impuesto: false,
} satisfies Partial<AdmConceptoFormValues>;
