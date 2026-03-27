"use client";

import { z } from "zod";

const normalizeRequiredId = (value: unknown) =>
  value === "" || value === null ? undefined : value;

const normalizeOptionalString = (value: unknown) =>
  value === "" || value === null ? undefined : value;

const trimRequiredText = (value?: string | null) => (value ?? "").trim();

const trimOptionalText = (value?: string | null) => {
  const normalizedValue = (value ?? "").trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
};

const requiredId = z.preprocess(
  normalizeRequiredId,
  z.coerce.number().int().positive(),
);

const requiredDate = z.preprocess(
  normalizeRequiredId,
  z.string().min(1, "La fecha es requerida"),
);

const optionalStringSchema = z.preprocess(
  normalizeOptionalString,
  z.string().optional(),
);

export const PROYECTO_AVANCE_VALIDATIONS = {
  AVANCE_MIN: 0,
  AVANCE_MAX: 100,
  HORAS_MIN: 0,
  COMENTARIO_MAX: 1000,
} as const;

export type ProyectoAvance = {
  id?: number | string;
  proyecto_id?: number | null;
  fecha_registracion?: string | null;
  horas?: number | null;
  avance?: number | null;
  importe?: number | null;
  comentario?: string | null;
  proyecto?: {
    id?: number;
    nombre?: string | null;
  } | null;
  created_at?: string;
  updated_at?: string;
};

export const proyectoAvanceSchema = z.object({
  proyecto_id: requiredId,
  fecha_registracion: requiredDate,
  horas: z.coerce.number().min(PROYECTO_AVANCE_VALIDATIONS.HORAS_MIN),
  avance: z.coerce
    .number()
    .min(PROYECTO_AVANCE_VALIDATIONS.AVANCE_MIN)
    .max(PROYECTO_AVANCE_VALIDATIONS.AVANCE_MAX),
  importe: z.coerce.number().min(0),
  comentario: optionalStringSchema.pipe(
    z.string().max(PROYECTO_AVANCE_VALIDATIONS.COMENTARIO_MAX).optional(),
  ),
});

export type ProyectoAvanceFormValues = z.infer<typeof proyectoAvanceSchema>;

export const PROYECTO_AVANCE_DEFAULTS: ProyectoAvanceFormValues = {
  proyecto_id: undefined as unknown as number,
  fecha_registracion: new Date().toISOString().split("T")[0],
  horas: 0,
  avance: 0,
  importe: 0,
  comentario: "",
};

export const normalizeProyectoAvancePayload = (
  data: Partial<ProyectoAvanceFormValues>,
): ProyectoAvanceFormValues => ({
  proyecto_id: Number(data.proyecto_id),
  fecha_registracion: trimRequiredText(data.fecha_registracion),
  horas: Number(data.horas ?? 0),
  avance: Number(data.avance ?? 0),
  importe: Number(data.importe ?? 0),
  comentario: trimOptionalText(data.comentario),
});
