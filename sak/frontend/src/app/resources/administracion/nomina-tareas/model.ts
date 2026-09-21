"use client";

import { z } from "zod";

export const VALIDATION_RULES = {
  CODIGO: { MAX_LENGTH: 5 },
  DESCRIPCION: { MAX_LENGTH: 255 },
} as const;

const emptyToUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

const booleanFromInput = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  if (value == null || value === "") return true;
  return Boolean(value);
}, z.boolean());

export type NominaTarea = {
  id: number;
  codigo: string;
  descripcion: string;
  activa: boolean;
  created_at: string;
  updated_at: string;
};

export const nominaTareaSchema = z.object({
  codigo: z.preprocess(
    emptyToUndefined,
    z.string().min(1).max(VALIDATION_RULES.CODIGO.MAX_LENGTH),
  ),
  descripcion: z.string().min(1).max(VALIDATION_RULES.DESCRIPCION.MAX_LENGTH),
  activa: booleanFromInput,
});

export type NominaTareaFormValues = z.infer<typeof nominaTareaSchema>;

export const NOMINA_TAREA_DEFAULT: NominaTareaFormValues = {
  codigo: "",
  descripcion: "",
  activa: true,
};

export const normalizeNominaTareaPayload = (data: unknown) => {
  if (!data || typeof data !== "object") return data;
  const payload = { ...(data as Record<string, unknown>) };

  if (typeof payload.codigo === "string") {
    payload.codigo = payload.codigo.trim().toUpperCase();
  }
  if (typeof payload.descripcion === "string") {
    payload.descripcion = payload.descripcion.trim();
  }
  payload.activa = Boolean(payload.activa);

  return payload;
};
