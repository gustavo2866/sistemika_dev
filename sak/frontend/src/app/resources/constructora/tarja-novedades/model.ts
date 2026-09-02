"use client";

import { z } from "zod";

export const VALIDATION_RULES = {
  OBSERVACIONES: { MAX_LENGTH: 1000 },
} as const;

const emptyToUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

const requiredId = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive(),
);

const optionalId = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive().optional(),
);

const amountFromInput = z.preprocess(
  (value) => {
    if (value == null || value === "") return 0;
    const numeric = Number(value);
    return Number.isNaN(numeric) ? value : numeric;
  },
  z.number().finite().min(0),
);

const booleanFromInput = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return Boolean(value);
}, z.boolean());

export type TarjaNovedad = {
  id: number;
  tarja_id: number;
  nomina_id?: number | null;
  nomina_categoria_id?: number | null;
  nomina_tarea_id?: number | null;
  horas_justificadas: number;
  presentismo: boolean;
  adicional: number;
  premio: number;
  observaciones?: string | null;
  documentos?: string[] | null;
  created_at: string;
  updated_at: string;
};

export const tarjaNovedadSchema = z.object({
  tarja_id: requiredId,
  nomina_id: optionalId,
  nomina_categoria_id: optionalId,
  nomina_tarea_id: optionalId,
  horas_justificadas: amountFromInput,
  presentismo: booleanFromInput,
  adicional: amountFromInput,
  premio: amountFromInput,
  observaciones: z.preprocess(
    emptyToUndefined,
    z.string().max(VALIDATION_RULES.OBSERVACIONES.MAX_LENGTH).optional(),
  ),
});

export type TarjaNovedadFormValues = z.infer<typeof tarjaNovedadSchema>;

export const TARJA_NOVEDAD_DEFAULT: TarjaNovedadFormValues = {
  tarja_id: undefined as unknown as number,
  nomina_id: undefined,
  nomina_categoria_id: undefined,
  nomina_tarea_id: undefined,
  horas_justificadas: 0,
  presentismo: false,
  adicional: 0,
  premio: 0,
  observaciones: "",
};

const trimNullableText = (value?: string | null) => {
  const normalized = String(value ?? "").trim();
  return normalized.length ? normalized : null;
};

export const normalizeTarjaNovedadPayload = (data: unknown) => {
  if (!data || typeof data !== "object") return data;
  const payload = { ...(data as Record<string, unknown>) };

  payload.tarja_id = Number(payload.tarja_id);
  payload.nomina_id =
    payload.nomina_id == null || payload.nomina_id === ""
      ? null
      : Number(payload.nomina_id);
  payload.nomina_categoria_id =
    payload.nomina_categoria_id == null || payload.nomina_categoria_id === ""
      ? null
      : Number(payload.nomina_categoria_id);
  payload.nomina_tarea_id =
    payload.nomina_tarea_id == null || payload.nomina_tarea_id === ""
      ? null
      : Number(payload.nomina_tarea_id);
  payload.horas_justificadas = Number(payload.horas_justificadas ?? 0);
  payload.presentismo = Boolean(payload.presentismo);
  payload.adicional = Number(payload.adicional ?? 0);
  payload.premio = Number(payload.premio ?? 0);
  payload.observaciones = trimNullableText(payload.observaciones as string | null);

  return payload;
};
