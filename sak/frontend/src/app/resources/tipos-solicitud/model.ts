/**
 * Modelo de dominio para Tipos de Solicitud
 * 
 * Define los tipos de solicitud parametrizables que determinan
 * el filtrado de artículos y departamentos sugeridos.
 */

import { createEntitySchema, stringField, referenceField } from "@/lib/form-detail-schema";
import {
  TIPO_ARTICULO_CHOICES,
  type TipoArticuloValue,
} from "../articulos/model";

// ============================================
// 1. CONFIGURACIÓN
// ============================================

export const VALIDATION_RULES = {
  NOMBRE: {
    MAX_LENGTH: 100,
  },
  DESCRIPCION: {
    MAX_LENGTH: 500,
  },
  TIPO_ARTICULO_FILTER: {
    MAX_LENGTH: 100,
  },
} as const;

// Referencias para ComboboxQuery
export const ARTICULOS_REFERENCE = {
  resource: "articulos",
  labelField: "nombre",
  limit: 100,
  staleTime: 5 * 60 * 1000,
} as const;

export const DEPARTAMENTOS_REFERENCE = {
  resource: "departamentos",
  labelField: "nombre",
  limit: 50,
  staleTime: 10 * 60 * 1000,
} as const;

export const TIPO_SOLICITUD_TIPO_ARTICULO_CHOICES = TIPO_ARTICULO_CHOICES;

// ============================================
// 2. TIPOS
// ============================================

export type TipoSolicitud = {
  id: number;
  nombre: string;
  descripcion?: string;
  tipo_articulo_filter?: TipoArticuloValue | null;
  articulo_default_id?: number;
  departamento_default_id?: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
  
  // Relaciones expandidas (cuando se incluyen con __expanded_list_relations__)
  articulo_default?: {
    id: number;
    nombre: string;
  };
  departamento_default?: {
    id: number;
    nombre: string;
  };
};

export type TipoSolicitudFormValues = {
  nombre: string;
  descripcion?: string;
  tipo_articulo_filter?: TipoArticuloValue | "";
  articulo_default_id?: string; // string para ComboboxQuery
  departamento_default_id?: string; // string para ComboboxQuery
  activo: boolean;
};

// ============================================
// 3. VALIDACIONES (Zod Schema)
// ============================================

export const tipoSolicitudSchema = createEntitySchema<
  TipoSolicitudFormValues,
  Omit<TipoSolicitud, "id" | "created_at" | "updated_at" | "articulo_default" | "departamento_default">
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
    tipo_articulo_filter: stringField({
      required: false,
      maxLength: VALIDATION_RULES.TIPO_ARTICULO_FILTER.MAX_LENGTH,
      defaultValue: "" as TipoArticuloValue | "",
    }),
    articulo_default_id: referenceField({
      resource: ARTICULOS_REFERENCE.resource,
      labelField: ARTICULOS_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
    departamento_default_id: referenceField({
      resource: DEPARTAMENTOS_REFERENCE.resource,
      labelField: DEPARTAMENTOS_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
  },
});

// ============================================
// 4. VALORES DEFAULT
// ============================================

export const TIPO_SOLICITUD_DEFAULT: TipoSolicitudFormValues = {
  nombre: "",
  descripcion: "",
  tipo_articulo_filter: "" as TipoArticuloValue | "",
  articulo_default_id: undefined,
  departamento_default_id: undefined,
  activo: true,
};
