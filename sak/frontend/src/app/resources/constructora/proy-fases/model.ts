/**
 * Modelo de dominio para Fases de Proyecto
 */

import { z } from "zod";

export const VALIDATION_RULES = {
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

const booleanFromInput = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  if (value == null || value === "") return false;
  return Boolean(value);
}, z.boolean());

export type ProyFase = {
  id: number;
  nombre: string;
  orden: number;
  activo: boolean;
  descripcion?: string | null;
  created_at: string;
  updated_at: string;
};

export const proyFaseSchema = z.object({
  nombre: z.string().min(1).max(VALIDATION_RULES.NOMBRE.MAX_LENGTH),
  orden: z.coerce.number().int().min(1),
  activo: booleanFromInput,
  descripcion: optionalString.pipe(
    z.string().max(VALIDATION_RULES.DESCRIPCION.MAX_LENGTH).optional(),
  ),
});

export type ProyFaseFormValues = z.infer<typeof proyFaseSchema>;

export const PROY_FASE_DEFAULT: ProyFaseFormValues = {
  nombre: "",
  orden: 1,
  activo: true,
  descripcion: "",
};
