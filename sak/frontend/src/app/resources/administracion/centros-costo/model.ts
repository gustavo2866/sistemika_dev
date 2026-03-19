/**
 * Modelo de dominio para Centros de Costo
 *
 * Define estructura, validaciones y defaults para el CRUD de centros de costo.
 */

import { createEntitySchema, selectField, stringField } from "@/lib/form-detail-schema";

// ============================================
// 1. CONFIGURACIÓN
// ============================================

export const CENTRO_COSTO_TIPOS = ["General", "Proyecto", "Propiedad", "Socios"] as const;

export type CentroCostoTipo = (typeof CENTRO_COSTO_TIPOS)[number];

export const CENTRO_COSTO_TIPO_CHOICES = CENTRO_COSTO_TIPOS.map((tipo) => ({
  id: tipo,
  name: tipo,
}));

export const VALIDATION_RULES = {
  NOMBRE_MAX: 200,
  CODIGO_MAX: 50,
  DESCRIPCION_MAX: 1000,
} as const;

// ============================================
// 2. TIPOS
// ============================================

export type CentroCosto = {
  id: number;
  nombre: string;
  tipo: CentroCostoTipo;
  codigo_contable: string;
  descripcion?: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type CentroCostoFormValues = {
  nombre: string;
  tipo: CentroCostoTipo;
  codigo_contable: string;
  descripcion?: string | null;
  activo: boolean;
};

// ============================================
// 3. VALIDACIONES
// ============================================

export const centroCostoSchema = createEntitySchema<
  CentroCostoFormValues,
  Omit<CentroCosto, "id" | "created_at" | "updated_at">
>({
  fields: {
    nombre: stringField({
      required: true,
      maxLength: VALIDATION_RULES.NOMBRE_MAX,
      defaultValue: "",
    }),
    tipo: selectField({
      required: true,
      options: CENTRO_COSTO_TIPO_CHOICES,
      defaultValue: CENTRO_COSTO_TIPOS[0],
    }),
    codigo_contable: stringField({
      required: true,
      maxLength: VALIDATION_RULES.CODIGO_MAX,
      defaultValue: "",
    }),
    descripcion: stringField({
      required: false,
      maxLength: VALIDATION_RULES.DESCRIPCION_MAX,
      defaultValue: "",
    }),
  },
});

// ============================================
// 4. VALORES DEFAULT
// ============================================

export const CENTRO_COSTO_DEFAULT: CentroCostoFormValues = {
  nombre: "",
  tipo: CENTRO_COSTO_TIPOS[0],
  codigo_contable: "",
  descripcion: "",
  activo: true,
};
