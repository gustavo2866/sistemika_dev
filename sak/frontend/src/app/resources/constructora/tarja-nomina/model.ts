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

export type TarjaNomina = {
  id: number;
  tarja_id: number;
  nomina_id?: number | null;
  nomina_categoria_id?: number | null;
  nomina_tarea_id?: number | null;
  horas_justificadas: number;
  presentismo: boolean;
  presentismo_importe: number;
  adicional_importe: number;
  premio: boolean;
  premio_importe: number;
  viatico: boolean;
  viatico_importe: number;
  sueldo_importe: number;
  mejora_importe: number;
  cargas_importe: number;
  fecha_desde: string;
  fecha_hasta: string;
  observaciones?: string | null;
  documentos?: string[] | null;
  tipo_novedad?: string | null;
  editable?: boolean | null;
  created_at: string;
  updated_at: string;
};

export const tarjaNominaSchema = z.object({
  tarja_id: requiredId,
  nomina_id: requiredId,
  nomina_categoria_id: optionalId,
  nomina_tarea_id: optionalId,
  horas_justificadas: amountFromInput,
  presentismo: booleanFromInput,
  presentismo_importe: amountFromInput,
  adicional_importe: amountFromInput,
  premio: booleanFromInput,
  premio_importe: amountFromInput,
  viatico: booleanFromInput,
  viatico_importe: amountFromInput,
  sueldo_importe: amountFromInput,
  mejora_importe: amountFromInput,
  cargas_importe: amountFromInput,
  fecha_desde: z.string().min(1),
  fecha_hasta: z.string().min(1),
  tarja_fecha_desde: z.string().optional(),
  tarja_fecha_hasta: z.string().optional(),
  confirmar_traspaso: z.boolean().optional(),
  observaciones: z.preprocess(
    emptyToUndefined,
    z.string().max(VALIDATION_RULES.OBSERVACIONES.MAX_LENGTH).optional(),
  ),
}).superRefine((values, context) => {
  if (
    values.tarja_fecha_desde &&
    values.fecha_desde < values.tarja_fecha_desde
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["fecha_desde"],
      message: "La fecha de ingreso debe estar dentro de la quincena",
    });
  }
  if (
    values.tarja_fecha_hasta &&
    values.fecha_desde > values.tarja_fecha_hasta
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["fecha_desde"],
      message: "La fecha de ingreso debe estar dentro de la quincena",
    });
  }
});

export type TarjaNominaFormValues = z.infer<typeof tarjaNominaSchema>;

export const TARJA_NOMINA_DEFAULT: TarjaNominaFormValues = {
  tarja_id: undefined as unknown as number,
  nomina_id: undefined as unknown as number,
  nomina_categoria_id: undefined,
  nomina_tarea_id: undefined,
  horas_justificadas: 0,
  presentismo: false,
  presentismo_importe: 0,
  adicional_importe: 0,
  premio: false,
  premio_importe: 0,
  viatico: false,
  viatico_importe: 0,
  sueldo_importe: 0,
  mejora_importe: 0,
  cargas_importe: 0,
  fecha_desde: "",
  fecha_hasta: "",
  tarja_fecha_desde: "",
  tarja_fecha_hasta: "",
  confirmar_traspaso: false,
  observaciones: "",
};

const trimNullableText = (value?: string | null) => {
  const normalized = String(value ?? "").trim();
  return normalized.length ? normalized : null;
};

export const normalizeTarjaNominaPayload = (data: unknown) => {
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
  payload.presentismo_importe = Number(payload.presentismo_importe ?? 0);
  payload.adicional_importe = Number(payload.adicional_importe ?? 0);
  payload.premio = Boolean(payload.premio);
  payload.premio_importe = Number(payload.premio_importe ?? 0);
  payload.viatico = Boolean(payload.viatico);
  payload.viatico_importe = Number(payload.viatico_importe ?? 0);
  payload.sueldo_importe = Number(payload.sueldo_importe ?? 0);
  payload.mejora_importe = Number(payload.mejora_importe ?? 0);
  payload.cargas_importe = Number(payload.cargas_importe ?? 0);
  payload.observaciones = trimNullableText(payload.observaciones as string | null);
  delete payload.tarja_fecha_desde;
  delete payload.tarja_fecha_hasta;

  return payload;
};
