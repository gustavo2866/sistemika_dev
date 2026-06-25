"use client";

import { z } from "zod";
import { getEstadoTarjaBadgeClass, getEstadoTarjaLabel } from "./constants";

export const VALIDATION_RULES = {
  DESCRIPCION: { MAX_LENGTH: 1000 },
  DETALLE_DESCRIPCION: { MAX_LENGTH: 500 },
  OBSERVACIONES: { MAX_LENGTH: 1000 },
  HORAS: { MIN: 0, MAX: 999.99 },
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

const optionalNumberFromInputSchema = z.preprocess(
  (value) => {
    if (value == null || value === "") return 0;
    return normalizeNumberInput(value);
  },
  z.number().finite(),
);

export type TarjaDetalle = {
  id?: number | string;
  idnomina?: number | null;
  fecha?: string | null;
  idestado?: number | null;
  horas?: number | null;
  descripcion?: string | null;
  parte_diario_detalle_id?: number | null;
};

export type TarjaNovedad = {
  id?: number | string;
  horas_enfermedad_justif?: number | null;
  presentismo?: number | null;
  premio?: number | null;
  observaciones?: string | null;
  documentos?: string[] | null;
};

export type Tarja = {
  id?: number | string;
  idproyecto?: number | null;
  fechainicio?: string | null;
  fechafinal?: string | null;
  estado?: string | null;
  descripcion?: string | null;
  detalles?: TarjaDetalle[];
  novedades?: TarjaNovedad[];
  created_at?: string;
  updated_at?: string;
};

export type TarjaRecord = Tarja & {
  id: number | string;
};

const tarjaDetalleSchema = z.object({
  id: optionalIdSchema,
  idnomina: numberFromInputSchema.pipe(z.number().int().positive()),
  fecha: z.string().min(1),
  idestado: optionalIdSchema,
  horas: numberFromInputSchema.pipe(
    z.number().min(VALIDATION_RULES.HORAS.MIN).max(VALIDATION_RULES.HORAS.MAX),
  ),
  descripcion: z.preprocess(
    normalizeOptionalString,
    z.string().max(VALIDATION_RULES.DETALLE_DESCRIPCION.MAX_LENGTH).optional(),
  ),
  parte_diario_detalle_id: optionalIdSchema,
});

const tarjaNovedadSchema = z.object({
  id: optionalIdSchema,
  horas_enfermedad_justif: optionalNumberFromInputSchema,
  presentismo: optionalNumberFromInputSchema,
  premio: optionalNumberFromInputSchema,
  observaciones: z.preprocess(
    normalizeOptionalString,
    z.string().max(VALIDATION_RULES.OBSERVACIONES.MAX_LENGTH).optional(),
  ),
  documentos: z.array(z.string()).optional().nullable(),
});

export const tarjaSchema = z.object({
  idproyecto: numberFromInputSchema.pipe(z.number().int().positive()),
  fechainicio: z.string().min(1),
  fechafinal: z.string().min(1),
  estado: z.enum(["borrador", "cerrado"]).default("borrador"),
  descripcion: z.preprocess(
    normalizeOptionalString,
    z.string().max(VALIDATION_RULES.DESCRIPCION.MAX_LENGTH).optional(),
  ),
  detalles: z.array(tarjaDetalleSchema).default([]),
  novedades: z.array(tarjaNovedadSchema).default([]),
});

export type TarjaFormValues = z.infer<typeof tarjaSchema>;

export const TARJA_DEFAULTS: TarjaFormValues = {
  idproyecto: undefined as unknown as number,
  fechainicio: "",
  fechafinal: "",
  estado: "borrador",
  descripcion: "",
  detalles: [],
  novedades: [
    {
      horas_enfermedad_justif: 0,
      presentismo: 0,
      premio: 0,
      observaciones: "",
      documentos: [],
    },
  ],
};

export const getTarjaDetalleDefaults = () => ({
  idnomina: "",
  fecha: "",
  idestado: "",
  horas: 0,
  descripcion: "",
  parte_diario_detalle_id: "",
});

export const normalizeTarjaPayload = (data: Partial<TarjaFormValues>) => {
  const novedades = data.novedades?.length
    ? data.novedades
    : TARJA_DEFAULTS.novedades;

  return {
    idproyecto: Number(data.idproyecto),
    fechainicio: trimRequiredText(data.fechainicio),
    fechafinal: trimRequiredText(data.fechafinal),
    estado: data.estado === "cerrado" ? "cerrado" : "borrador",
    descripcion: trimNullableText(data.descripcion),
    detalles: (data.detalles ?? []).map((detalle) => ({
      ...(detalle.id ? { id: Number(detalle.id) } : {}),
      idnomina: Number(detalle.idnomina),
      fecha: trimRequiredText(detalle.fecha),
      idestado: detalle.idestado ? Number(detalle.idestado) : null,
      horas: Number(detalle.horas ?? 0),
      descripcion: trimNullableText(detalle.descripcion),
      parte_diario_detalle_id: detalle.parte_diario_detalle_id
        ? Number(detalle.parte_diario_detalle_id)
        : null,
    })),
    novedades: novedades.map((novedad) => ({
      ...(novedad.id ? { id: Number(novedad.id) } : {}),
      horas_enfermedad_justif: Number(novedad.horas_enfermedad_justif ?? 0),
      presentismo: Number(novedad.presentismo ?? 0),
      premio: Number(novedad.premio ?? 0),
      observaciones: trimNullableText(novedad.observaciones),
      documentos: novedad.documentos ?? [],
    })),
  };
};

export { getEstadoTarjaBadgeClass, getEstadoTarjaLabel };
