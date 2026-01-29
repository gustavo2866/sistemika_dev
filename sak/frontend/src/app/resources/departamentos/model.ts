/**
 * Modelo de dominio para Departamentos
 * 
 * Este archivo contiene la definición del modelo de datos, validaciones
 * y valores por defecto para la entidad Departamento.
 */

import { createEntitySchema, referenceField, stringField } from "@/lib/form-detail-schema";

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

export type DepartamentoFormValues = {
  nombre: string;
  descripcion?: string;
  activo: boolean;
  centro_costo_id?: string;
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
    centro_costo_id: referenceField({
      resource: CENTROS_COSTO_REFERENCE.resource,
      labelField: CENTROS_COSTO_REFERENCE.labelField,
      required: false,
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
  centro_costo_id: "",
};

