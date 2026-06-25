"use client";

import { z } from "zod";

export const VALIDATION_RULES = {
  ABREVIATURA: { MAX_LENGTH: 10 },
  NOMBRE: { MAX_LENGTH: 100 },
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

export type TarjaEstado = {
  id: number;
  abreviatura: string;
  nombre: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export const tarjaEstadoSchema = z.object({
  abreviatura: z.preprocess(
    emptyToUndefined,
    z.string().min(1).max(VALIDATION_RULES.ABREVIATURA.MAX_LENGTH),
  ),
  nombre: z.string().min(1).max(VALIDATION_RULES.NOMBRE.MAX_LENGTH),
  activo: booleanFromInput,
});

export type TarjaEstadoFormValues = z.infer<typeof tarjaEstadoSchema>;

export const TARJA_ESTADO_DEFAULT: TarjaEstadoFormValues = {
  abreviatura: "",
  nombre: "",
  activo: true,
};

export const normalizeTarjaEstadoPayload = (data: unknown) => {
  if (!data || typeof data !== "object") return data;
  const payload = { ...(data as Record<string, unknown>) };

  if (typeof payload.abreviatura === "string") {
    payload.abreviatura = payload.abreviatura.trim().toUpperCase();
  }
  if (typeof payload.nombre === "string") {
    payload.nombre = payload.nombre.trim();
  }
  payload.activo = Boolean(payload.activo);

  return payload;
};
