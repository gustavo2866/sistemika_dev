"use client";

import { z } from "zod";

//#region Reglas de validacion

export const VALIDATION_RULES = {
  META_CELULAR_ID: {
    MAX_LENGTH: 255,
  },
  NUMERO_CELULAR: {
    MAX_LENGTH: 50,
  },
  ALIAS: {
    MAX_LENGTH: 255,
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

// Normaliza textos obligatorios para evitar espacios residuales.
const trimRequiredText = (value?: string | null) => (value ?? "").trim();

// Normaliza textos opcionales devolviendo undefined cuando quedan vacios.
const trimOptionalText = (value?: string | null) => {
  const normalizedValue = (value ?? "").trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
};

//#endregion Normalizadores internos

//#region Schemas auxiliares

const optionalStringSchema = z.preprocess(
  normalizeOptionalString,
  z.string().optional(),
);

const booleanFromInputSchema = z.preprocess(normalizeBooleanInput, z.boolean());

//#endregion Schemas auxiliares

//#region Tipos del dominio

export type CRMCelular = {
  id?: number | string;
  meta_celular_id?: string | null;
  numero_celular?: string | null;
  alias?: string | null;
  activo?: boolean | null;
  created_at?: string;
  updated_at?: string;
};

// Tipo específico para uso con React Admin que garantiza que id existe
export type CRMCelularRecord = CRMCelular & {
  id: number | string;
};

//#endregion Tipos del dominio

//#region Contrato del formulario

export const crmCelularSchema = z.object({
  meta_celular_id: z
    .string()
    .min(1)
    .max(VALIDATION_RULES.META_CELULAR_ID.MAX_LENGTH),
  numero_celular: z
    .string()
    .min(1)
    .max(VALIDATION_RULES.NUMERO_CELULAR.MAX_LENGTH),
  alias: optionalStringSchema.pipe(
    z.string().max(VALIDATION_RULES.ALIAS.MAX_LENGTH).optional(),
  ),
  activo: booleanFromInputSchema,
});

export type CRMCelularFormValues = z.infer<typeof crmCelularSchema>;

export const CRM_CELULAR_DEFAULTS: CRMCelularFormValues = {
  meta_celular_id: "",
  numero_celular: "",
  alias: "",
  activo: true,
};

//#endregion Contrato del formulario

//#region Helpers publicos del recurso

// Devuelve la etiqueta visible del estado del celular.
export const getCelularEstadoLabel = (activo?: boolean | null) =>
  activo === false ? "Inactivo" : "Activo";

// Devuelve las clases visuales del badge segun el estado actual.
export const getCelularBadgeClass = (activo?: boolean | null) =>
  activo === false
    ? "border border-slate-300 bg-slate-100 text-slate-700"
    : "border border-emerald-200 bg-emerald-100 text-emerald-700";

// Normaliza el payload antes de enviarlo al backend.
export const normalizeCelularPayload = (
  data: Partial<CRMCelularFormValues>,
): CRMCelularFormValues => ({
  meta_celular_id: trimRequiredText(data.meta_celular_id),
  numero_celular: trimRequiredText(data.numero_celular),
  alias: trimOptionalText(data.alias),
  activo: data.activo !== false,
});

//#endregion Helpers publicos del recurso
