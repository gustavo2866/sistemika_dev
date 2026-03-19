/**
 * Modelo de dominio para Tipos de Solicitud
 * 
 * Define los tipos de solicitud parametrizables que determinan
 * el filtrado de artículos y departamentos sugeridos.
 */

import { z } from "zod";
import {
  TIPO_ARTICULO_CHOICES,
  type TipoArticuloValue,
} from "../../po/articulos/model";

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
  tipo_articulo_filter_id?: number | null;
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
  tipo_articulo_filter_rel?: {
    id: number;
    nombre: string;
  };
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

export const tipoSolicitudSchema = z.object({
  nombre: z.string().min(1).max(VALIDATION_RULES.NOMBRE.MAX_LENGTH),
  descripcion: optionalString.pipe(
    z.string().max(VALIDATION_RULES.DESCRIPCION.MAX_LENGTH).optional(),
  ),
  tipo_articulo_filter_id: optionalId,
  articulo_default_id: optionalId,
  departamento_default_id: optionalId,
  activo: booleanFromInput,
});

export type TipoSolicitudFormValues = z.infer<typeof tipoSolicitudSchema>;

// ============================================
// 4. VALORES DEFAULT
// ============================================

export const TIPO_SOLICITUD_DEFAULT: TipoSolicitudFormValues = {
  nombre: "",
  descripcion: "",
  tipo_articulo_filter_id: undefined,
  articulo_default_id: undefined,
  departamento_default_id: undefined,
  activo: true,
};
