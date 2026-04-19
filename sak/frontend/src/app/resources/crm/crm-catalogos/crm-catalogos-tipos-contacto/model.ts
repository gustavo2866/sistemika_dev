"use client";

import { z } from "zod";

//#region Reglas de validacion

export const VALIDATION_RULES = {
  NOMBRE: {
    MAX_LENGTH: 100,
  },
} as const;

//#endregion Reglas de validacion

//#region Normalizadores internos

const normalizeBooleanInput = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  if (value == null || value === "") return false;
  return Boolean(value);
};

const trimText = (value?: string | null) => (value ?? "").trim();

//#endregion Normalizadores internos

//#region Schemas auxiliares

const booleanFromInputSchema = z.preprocess(normalizeBooleanInput, z.boolean());

//#endregion Schemas auxiliares

//#region Tipos del dominio

export type CRMTipoContacto = {
  id?: number | string;
  nombre?: string | null;
  activo?: boolean | null;
  created_at?: string;
  updated_at?: string;
};

export type CRMTipoContactoRecord = CRMTipoContacto & {
  id: number | string;
};

//#endregion Tipos del dominio

//#region Contrato del formulario

export const crmTipoContactoSchema = z.object({
  nombre: z.string().min(1).max(VALIDATION_RULES.NOMBRE.MAX_LENGTH),
  activo: booleanFromInputSchema,
});

export type CRMTipoContactoFormValues = z.infer<typeof crmTipoContactoSchema>;

export const CRM_TIPO_CONTACTO_DEFAULTS: CRMTipoContactoFormValues = {
  nombre: "",
  activo: true,
};

//#endregion Contrato del formulario

//#region Helpers publicos del recurso

export const getTipoContactoEstadoLabel = (activo?: boolean | null) =>
  activo === false ? "Inactivo" : "Activo";

export const getTipoContactoBadgeClass = (activo?: boolean | null) =>
  activo === false
    ? "border border-slate-300 bg-slate-100 text-slate-700"
    : "border border-emerald-200 bg-emerald-100 text-emerald-700";

export const normalizeTipoContactoPayload = (
  data: Partial<CRMTipoContactoFormValues>,
): CRMTipoContactoFormValues => ({
  nombre: trimText(data.nombre),
  activo: data.activo !== false,
});

//#endregion Helpers publicos del recurso
