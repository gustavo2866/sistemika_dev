/**
 * Modelo de dominio para Departamentos
 * 
 * Este archivo contiene la definición del modelo de datos, validaciones
 * y valores por defecto para la entidad Departamento.
 */

import { z } from "zod";

// ============================================
// 1. CONFIGURACIÓN
// ============================================

export const VALIDATION_RULES = {
  NOMBRE: {
    MAX_LENGTH: 100,
    MIN_LENGTH: 3,
  },
  DESCRIPCION: {
    MAX_LENGTH: 500,
  },
} as const;

export const CENTROS_COSTO_REFERENCE = {
  resource: "centros-costo",
  labelField: "nombre",
  limit: 100,
  staleTime: 5 * 60 * 1000,
  filter: { activo: true },
} as const;

// ============================================
// 2. TIPOS
// ============================================

export type Departamento = {
  id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  centro_costo_id?: number | null;
  created_at: string;
  updated_at: string;
};

// ============================================
// 3. VALIDACIONES (Zod Schema)
// ============================================

const optionalId = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

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

export const departamentoSchema = z.object({
  nombre: z
    .string()
    .min(VALIDATION_RULES.NOMBRE.MIN_LENGTH)
    .max(VALIDATION_RULES.NOMBRE.MAX_LENGTH),
  descripcion: optionalString.pipe(
    z.string().max(VALIDATION_RULES.DESCRIPCION.MAX_LENGTH).optional(),
  ),
  centro_costo_id: optionalId,
  activo: booleanFromInput,
});

export type DepartamentoFormValues = z.infer<typeof departamentoSchema>;

// ============================================
// 4. VALORES DEFAULT
// ============================================

export const DEPARTAMENTO_DEFAULT: DepartamentoFormValues = {
  nombre: "",
  descripcion: "",
  activo: true,
  centro_costo_id: undefined,
};

