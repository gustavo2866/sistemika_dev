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

const trimNullableText = (value?: string | null) => {
  const normalizedValue = (value ?? "").trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
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

const optionalIdSchema = z.preprocess(
  (value) => {
    if (value == null || value === "") return undefined;
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
  },
  z.number().int().positive().optional(),
);

const numberFromInputSchema = z.preprocess(
  normalizeNumberInput,
  z.number().finite(),
);

export type ParteDiarioDetalle = {
  id?: number | string;
  idnomina?: number | null;
  horas?: number | null;
  idestado?: number | null;
  ingreso?: string | null;
  egreso?: string | null;
  descripcion?: string | null;
};

export type ParteDiario = {
  id?: number | string;
  idproyecto?: number | null;
  contacto_id?: number | null;
  contacto?: { id?: number | string | null; nombre_completo?: string | null } | null;
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
  id: optionalIdSchema,
  idnomina: numberFromInputSchema.pipe(z.number().int().positive()),
  idestado: optionalIdSchema,
  horas: numberFromInputSchema.pipe(
    z
      .number()
      .min(VALIDATION_RULES.HORAS.MIN)
      .max(VALIDATION_RULES.HORAS.MAX),
  ),
  ingreso: optionalStringSchema,
  egreso: optionalStringSchema,
  descripcion: optionalStringSchema.pipe(
    z
      .string()
      .max(VALIDATION_RULES.DETALLE_DESCRIPCION.MAX_LENGTH)
      .optional(),
  ),
});

export const parteDiarioSchema = z.object({
  idproyecto: numberFromInputSchema.pipe(z.number().int().positive()),
  contacto_id: optionalIdSchema,
  fecha: z.string().min(1),
  estado: z.enum(["borrador", "confirmado", "cerrado"]).default("borrador"),
  descripcion: optionalStringSchema.pipe(
    z.string().max(VALIDATION_RULES.DESCRIPCION.MAX_LENGTH).optional(),
  ),
  detalles: z.array(parteDiarioDetalleSchema).default([]),
});

export type ParteDiarioFormValues = z.infer<typeof parteDiarioSchema>;

export const PARTE_DIARIO_DEFAULTS: ParteDiarioFormValues = {
  idproyecto: undefined as unknown as number,
  contacto_id: undefined,
  fecha: "",
  estado: "borrador",
  descripcion: "",
  detalles: [],
};

export const getParteDiarioDetalleDefaults = () => ({
  idnomina: "",
  horas: 0,
  idestado: "",
  ingreso: "",
  egreso: "",
  descripcion: "",
});

export { getEstadoParteBadgeClass, getEstadoParteLabel };

export const normalizeParteDiarioPayload = (
  data: Partial<ParteDiarioFormValues>,
) => ({
  idproyecto: Number(data.idproyecto),
  contacto_id: data.contacto_id ? Number(data.contacto_id) : null,
  fecha: trimRequiredText(data.fecha),
  estado: data.estado === "confirmado" || data.estado === "cerrado" ? data.estado : "borrador",
  descripcion: trimNullableText(data.descripcion),
  detalles: (data.detalles ?? []).map((detalle) => ({
    ...(detalle.id ? { id: Number(detalle.id) } : {}),
    idnomina: Number(detalle.idnomina),
    horas: Number(detalle.horas ?? 0),
    idestado: detalle.idestado ? Number(detalle.idestado) : null,
    ingreso: trimNullableText(detalle.ingreso),
    egreso: trimNullableText(detalle.egreso),
    descripcion: trimNullableText(detalle.descripcion),
  })),
});
