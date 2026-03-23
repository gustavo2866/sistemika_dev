"use client";

import { z } from "zod";
import { getEstadoParteBadgeClass, getEstadoParteLabel } from "./constants";

export const VALIDATION_RULES = {
  DESCRIPCION: {
    MAX_LENGTH: 1000,
  },
  DETALLE_DESCRIPCION: {
    MAX_LENGTH: 500,
  },
  HORAS: {
    MIN: 0,
    MAX: 999.99,
  },
} as const;

const normalizeOptionalString = (value: unknown) =>
  value === "" || value === null ? undefined : value;

const trimRequiredText = (value?: string | null) => (value ?? "").trim();

const trimOptionalText = (value?: string | null) => {
  const normalizedValue = (value ?? "").trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
};

const normalizeNumberInput = (value: unknown) => {
  if (typeof value === "number") return value;
  if (value == null || value === "") return undefined;
  const normalizedValue = Number(value);
  return Number.isNaN(normalizedValue) ? value : normalizedValue;
};

const optionalStringSchema = z.preprocess(
  normalizeOptionalString,
  z.string().optional(),
);

const numberFromInputSchema = z.preprocess(
  normalizeNumberInput,
  z.number().finite(),
);

export type ParteDiarioDetalle = {
  id?: number | string;
  idnomina?: number | null;
  horas?: number | null;
  tipolicencia?: string | null;
  descripcion?: string | null;
};

export type ParteDiario = {
  id?: number | string;
  idproyecto?: number | null;
  fecha?: string | null;
  estado?: string | null;
  descripcion?: string | null;
  detalles?: ParteDiarioDetalle[];
  created_at?: string;
  updated_at?: string;
};

export type ParteDiarioRecord = ParteDiario & {
  id: number | string;
};

const parteDiarioDetalleSchema = z.object({
  id: optionalStringSchema,
  idnomina: numberFromInputSchema.pipe(z.number().int().positive()),
  horas: numberFromInputSchema.pipe(
    z
      .number()
      .min(VALIDATION_RULES.HORAS.MIN)
      .max(VALIDATION_RULES.HORAS.MAX),
  ),
  tipolicencia: optionalStringSchema.pipe(z.string().optional()),
  descripcion: optionalStringSchema.pipe(
    z
      .string()
      .max(VALIDATION_RULES.DETALLE_DESCRIPCION.MAX_LENGTH)
      .optional(),
  ),
});

export const parteDiarioSchema = z.object({
  idproyecto: numberFromInputSchema.pipe(z.number().int().positive()),
  fecha: z.string().min(1),
  estado: z.enum(["pendiente", "cerrado"]).default("pendiente"),
  descripcion: optionalStringSchema.pipe(
    z.string().max(VALIDATION_RULES.DESCRIPCION.MAX_LENGTH).optional(),
  ),
  detalles: z.array(parteDiarioDetalleSchema).default([]),
});

export type ParteDiarioFormValues = z.infer<typeof parteDiarioSchema>;

export const PARTE_DIARIO_DEFAULTS: ParteDiarioFormValues = {
  idproyecto: undefined as unknown as number,
  fecha: "",
  estado: "pendiente",
  descripcion: "",
  detalles: [],
};

export { getEstadoParteBadgeClass, getEstadoParteLabel };

export const normalizeParteDiarioPayload = (
  data: Partial<ParteDiarioFormValues>,
): ParteDiarioFormValues => ({
  idproyecto: Number(data.idproyecto),
  fecha: trimRequiredText(data.fecha),
  estado: data.estado === "cerrado" ? "cerrado" : "pendiente",
  descripcion: trimOptionalText(data.descripcion),
  detalles: (data.detalles ?? []).map((detalle) => ({
    id: detalle.id,
    idnomina: Number(detalle.idnomina),
    horas: Number(detalle.horas ?? 0),
    tipolicencia: trimOptionalText(detalle.tipolicencia),
    descripcion: trimOptionalText(detalle.descripcion),
  })),
});
