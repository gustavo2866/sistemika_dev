/**
 * Modelo de dominio para Estados de Propiedades
 */

import { z } from "zod";

export const VALIDATION_RULES = {
  NOMBRE: {
    MAX_LENGTH: 50,
  },
  DESCRIPCION: {
    MAX_LENGTH: 200,
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

export type PropiedadesStatus = {
  id: number;
  nombre: string;
  descripcion?: string | null;
  orden: number;
  activo: boolean;
  es_inicial: boolean;
  es_final: boolean;
  created_at: string;
  updated_at: string;
};

export const propiedadesStatusSchema = z.object({
  nombre: z.string().min(1).max(VALIDATION_RULES.NOMBRE.MAX_LENGTH),
  descripcion: optionalString.pipe(
    z.string().max(VALIDATION_RULES.DESCRIPCION.MAX_LENGTH).optional(),
  ),
  orden: z.coerce.number().int().min(1),
  activo: booleanFromInput,
  es_inicial: booleanFromInput,
  es_final: booleanFromInput,
});

export type PropiedadesStatusFormValues = z.infer<typeof propiedadesStatusSchema>;

export const PROPIEDADES_STATUS_DEFAULT: PropiedadesStatusFormValues = {
  nombre: "",
  descripcion: "",
  orden: 1,
  activo: true,
  es_inicial: false,
  es_final: false,
};
