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
  JORNADA: {
    MIN: 0,
    MAX: 24,
  },
} as const;

export const PARTE_DIARIO_PROYECTO_ESTADOS_ACTIVOS = [
  "01-plan",
  "02-ejecucion",
  "03-conclusion",
] as const;

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

export const getParteDiarioJornadaEsperada = (value: unknown) => {
  const raw =
    value instanceof Date && !Number.isNaN(value.getTime())
      ? value.toISOString()
      : String(value ?? "").trim();
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!isoMatch) return 0;
  const day = new Date(`${isoMatch[1]}T00:00:00Z`).getUTCDay();
  if (day === 0) return 0;
  if (day === 6) return 6;
  return 9;
};

export type ParteDiarioDetalle = {
  id?: number | string;
  idnomina?: number | null;
  horas?: number | null;
  idestado?: number | null;
  nomina_licencia_id?: number | null;
  ingreso?: string | null;
  egreso?: string | null;
  descripcion?: string | null;
};

export type ParteDiarioLicenciaVigente = {
  id: number | string;
  nomina_licencia_id: number | string;
  idnomina: number | string;
  idestado: number | string;
  fecha_desde: string;
  fecha_hasta?: string | null;
  horas?: number | null;
  ingreso?: string | null;
  egreso?: string | null;
  descripcion?: string | null;
};

export type ParteDiarioLicenciaDetalle = {
  idnomina: number;
  idestado: number;
  nomina_licencia_id: number;
  horas: number;
  ingreso: string;
  egreso: string;
  descripcion: string;
};

export const getParteDiarioLicenciaDetalle = (
  licencia: ParteDiarioLicenciaVigente,
): ParteDiarioLicenciaDetalle => ({
  idnomina: Number(licencia.idnomina),
  idestado: Number(licencia.idestado),
  nomina_licencia_id: Number(licencia.nomina_licencia_id),
  horas: 0,
  ingreso: licencia.ingreso ?? "",
  egreso: licencia.egreso ?? "",
  descripcion: licencia.descripcion ?? "Licencia",
});

export type ParteDiario = {
  id?: number | string;
  idproyecto?: number | null;
  generico_proyecto_id?: number | null;
  contacto_id?: number | null;
  contacto?: { id?: number | string | null; nombre_completo?: string | null } | null;
  fecha?: string | null;
  jornada?: number | null;
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
  nomina_licencia_id: optionalIdSchema,
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

export const parteDiarioSchema = z
  .object({
    idproyecto: numberFromInputSchema.pipe(z.number().int().positive()),
    proyecto_generico: z.boolean().default(false),
    generico_proyecto_id: optionalIdSchema,
    contacto_id: optionalIdSchema,
    fecha: z.string().min(1),
    jornada: numberFromInputSchema.pipe(
      z
        .number()
        .min(VALIDATION_RULES.JORNADA.MIN)
        .max(VALIDATION_RULES.JORNADA.MAX),
    ),
    estado: z.enum(["borrador", "confirmado", "cerrado"]).default("borrador"),
    descripcion: optionalStringSchema.pipe(
      z.string().max(VALIDATION_RULES.DESCRIPCION.MAX_LENGTH).optional(),
    ),
    detalles: z.array(parteDiarioDetalleSchema).default([]),
  })
  .superRefine((values, context) => {
    if (values.proyecto_generico && values.generico_proyecto_id == null) {
      context.addIssue({
        code: "custom",
        path: ["generico_proyecto_id"],
        message: "El proyecto asociado es obligatorio para una obra generica.",
      });
    }
    const jornada = values.jornada;
    values.detalles.forEach((detalle, index) => {
      if (detalle.horas < jornada && detalle.idestado == null) {
        context.addIssue({
          code: "custom",
          path: ["detalles", index, "idestado"],
          message: `El estado es obligatorio cuando las horas son menores a ${jornada} h.`,
        });
      }
    });
  });

export type ParteDiarioFormValues = z.infer<typeof parteDiarioSchema>;

export const PARTE_DIARIO_DEFAULTS: ParteDiarioFormValues = {
  idproyecto: undefined as unknown as number,
  proyecto_generico: false,
  generico_proyecto_id: undefined,
  contacto_id: undefined,
  fecha: "",
  jornada: 0,
  estado: "borrador",
  descripcion: "",
  detalles: [],
};

export const getParteDiarioDetalleDefaults = () => ({
  idnomina: "",
  horas: 0,
  idestado: "",
  nomina_licencia_id: "",
  ingreso: "",
  egreso: "",
  descripcion: "",
});

export { getEstadoParteBadgeClass, getEstadoParteLabel };

export const normalizeParteDiarioPayload = (
  data: Partial<ParteDiarioFormValues>,
) => ({
  idproyecto: Number(data.idproyecto),
  generico_proyecto_id: data.generico_proyecto_id
    ? Number(data.generico_proyecto_id)
    : null,
  contacto_id: data.contacto_id ? Number(data.contacto_id) : null,
  fecha: trimRequiredText(data.fecha),
  jornada: Number(data.jornada ?? getParteDiarioJornadaEsperada(data.fecha)),
  estado: data.estado === "confirmado" || data.estado === "cerrado" ? data.estado : "borrador",
  descripcion: trimNullableText(data.descripcion),
  detalles: (data.detalles ?? []).map((detalle) => ({
    ...(detalle.id ? { id: Number(detalle.id) } : {}),
    idnomina: Number(detalle.idnomina),
    horas: Number(detalle.horas ?? 0),
    idestado: detalle.idestado ? Number(detalle.idestado) : null,
    nomina_licencia_id: detalle.nomina_licencia_id
      ? Number(detalle.nomina_licencia_id)
      : null,
    ingreso: trimNullableText(detalle.ingreso),
    egreso: trimNullableText(detalle.egreso),
    descripcion: trimNullableText(detalle.descripcion),
  })),
});
