"use client";

import { z } from "zod";

//#region Reglas de validacion

export const VALIDATION_RULES = {
  CODIGO: {
    MAX_LENGTH: 50,
  },
  NOMBRE: {
    MAX_LENGTH: 200,
  },
  DESCRIPCION: {
    MAX_LENGTH: 500,
  },
} as const;

//#endregion Reglas de validacion

//#region Normalizadores internos

// Convierte strings vacios o nulos en un valor opcional consistente.
const normalizeOptionalString = (value: unknown) =>
  value === "" || value === null ? undefined : value;

// Convierte valores comunes del formulario en un booleano consistente.
const normalizeBooleanInput = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  if (value == null || value === "") return false;
  return Boolean(value);
};

// Normaliza textos para evitar espacios residuales en el payload final.
const trimText = (value?: string | null) => (value ?? "").trim();

//#endregion Normalizadores internos

//#region Schemas auxiliares

const optionalStringSchema = z.preprocess(
  normalizeOptionalString,
  z.string().optional(),
);

const booleanFromInputSchema = z.preprocess(normalizeBooleanInput, z.boolean());

//#endregion Schemas auxiliares

//#region Tipos del dominio

export type CRMTipoOperacion = {
  id?: number | string;
  codigo?: string | null;
  nombre?: string | null;
  descripcion?: string | null;
  activo?: boolean | null;
  created_at?: string;
  updated_at?: string;
};

// Tipo específico para uso con React Admin que garantiza que id existe
export type CRMTipoOperacionRecord = CRMTipoOperacion & {
  id: number | string;
};

//#endregion Tipos del dominio

//#region Contrato del formulario

// Define el contrato tipado del formulario para este recurso.
export const crmTipoOperacionSchema = z.object({
  codigo: z.string().min(1).max(VALIDATION_RULES.CODIGO.MAX_LENGTH),
  nombre: z.string().min(1).max(VALIDATION_RULES.NOMBRE.MAX_LENGTH),
  descripcion: optionalStringSchema.pipe(
    z.string().max(VALIDATION_RULES.DESCRIPCION.MAX_LENGTH).optional(),
  ),
  activo: booleanFromInputSchema,
});

export type CRMTipoOperacionFormValues = z.infer<typeof crmTipoOperacionSchema>;

// Centraliza los valores iniciales del formulario del recurso.
export const CRM_TIPO_OPERACION_DEFAULTS: CRMTipoOperacionFormValues = {
  codigo: "",
  nombre: "",
  descripcion: "",
  activo: true,
};

//#endregion Contrato del formulario

//#region Helpers publicos del recurso

// Devuelve la etiqueta visible del estado de un tipo de operacion.
export const getTipoOperacionEstadoLabel = (activo?: boolean | null) =>
  activo === false ? "Inactivo" : "Activo";

// Devuelve las clases visuales del badge segun el estado actual.
export const getTipoOperacionBadgeClass = (activo?: boolean | null) =>
  activo === false
    ? "border border-slate-300 bg-slate-100 text-slate-700"
    : "border border-emerald-200 bg-emerald-100 text-emerald-700";

// Normaliza el payload antes de enviarlo al backend.
export const normalizeTipoOperacionPayload = (
  data: Partial<CRMTipoOperacionFormValues>,
): CRMTipoOperacionFormValues => ({
  codigo: trimText(data.codigo),
  nombre: trimText(data.nombre),
  descripcion: trimText(data.descripcion),
  activo: data.activo !== false,
});

//#endregion Helpers publicos del recurso
