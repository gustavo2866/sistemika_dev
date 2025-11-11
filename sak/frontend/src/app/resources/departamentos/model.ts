/**
 * Modelo de dominio para Departamentos
 * 
 * Este archivo contiene la definición del modelo de datos, validaciones
 * y valores por defecto para la entidad Departamento.
 */

import { createEntitySchema, stringField } from "@/lib/form-detail-schema";

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

// ============================================
// 2. TIPOS
// ============================================

export type Departamento = {
  id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type DepartamentoFormValues = {
  nombre: string;
  descripcion?: string;
  activo: boolean;
};

// ============================================
// 3. VALIDACIONES (Zod Schema)
// ============================================

export const departamentoSchema = createEntitySchema<
  DepartamentoFormValues,
  Omit<Departamento, "id" | "created_at" | "updated_at">
>({
  fields: {
    nombre: stringField({
      required: true,
      maxLength: VALIDATION_RULES.NOMBRE.MAX_LENGTH,
      defaultValue: "",
    }),
    descripcion: stringField({
      required: false,
      maxLength: VALIDATION_RULES.DESCRIPCION.MAX_LENGTH,
      defaultValue: "",
    }),
  },
});

// ============================================
// 4. VALORES DEFAULT
// ============================================

export const DEPARTAMENTO_DEFAULT: DepartamentoFormValues = {
  nombre: "",
  descripcion: "",
  activo: true,
};

