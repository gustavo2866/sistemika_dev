"use client";

import { z } from "zod";

export const PROYECTO_VALIDATIONS = {
  NOMBRE_MAX: 150,
  ESTADO_MAX: 50,
  COMENTARIO_MAX: 1000,
  AVANCE_COMENTARIO_MAX: 1000,
  SUPERFICIE_MAX: 100,
  AVANCE_MAX: 100,
  HORAS_MAX: 9999,
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
  if (value == null || value === "") return 0;
  const normalizedValue = Number(value);
  return Number.isNaN(normalizedValue) ? value : normalizedValue;
};

const normalizeOptionalId = (value: unknown) =>
  value === "" || value === null ? undefined : value;

const resolveNumericId = (value: unknown) => {
  if (value == null || value === "") return undefined;
  if (typeof value === "object") {
    const candidate =
      (value as { id?: unknown; value?: unknown }).id ??
      (value as { value?: unknown }).value;
    return resolveNumericId(candidate);
  }
  const normalizedValue = Number(value);
  return Number.isFinite(normalizedValue) && normalizedValue > 0
    ? normalizedValue
    : undefined;
};

const optionalStringSchema = z.preprocess(
  normalizeOptionalString,
  z.string().optional(),
);

const nonNegativeNumberSchema = z.preprocess(
  normalizeNumberInput,
  z.number().min(0),
);

const optionalPositiveIdSchema = z.preprocess(
  normalizeOptionalId,
  z.coerce.number().int().positive().optional(),
);

const optionalDateSchema = z.preprocess(
  normalizeOptionalString,
  z.string().optional(),
);

export type ProyectoAvance = {
  id?: number | string;
  proyecto_id?: number | null;
  horas?: number | null;
  avance?: number | null;
  importe?: number | null;
  comentario?: string | null;
  fecha_registracion?: string | null;
};

export type Proyecto = {
  id?: number | string;
  nombre?: string | null;
  oportunidad_id?: number | null;
  responsable_id?: number | null;
  fecha_inicio?: string | null;
  fecha_final?: string | null;
  estado?: string | null;
  centro_costo?: number | null;
  importe_mat?: number | null;
  importe_mo?: number | null;
  terceros?: number | null;
  herramientas?: number | null;
  superficie?: number | null;
  ingresos?: number | null;
  comentario?: string | null;
  avances?: ProyectoAvance[];
  created_at?: string;
  updated_at?: string;
};

export type ProyectoRecord = Proyecto & {
  id: number | string;
};

export const proyectoAvanceSchema = z.object({
  id: optionalPositiveIdSchema,
  proyecto_id: optionalPositiveIdSchema,
  horas: z.preprocess(normalizeNumberInput, z.number().int().min(0).max(PROYECTO_VALIDATIONS.HORAS_MAX)),
  avance: z.preprocess(
    normalizeNumberInput,
    z.number().min(0).max(PROYECTO_VALIDATIONS.AVANCE_MAX),
  ),
  importe: nonNegativeNumberSchema,
  comentario: optionalStringSchema.pipe(
    z.string().max(PROYECTO_VALIDATIONS.AVANCE_COMENTARIO_MAX).optional(),
  ),
  fecha_registracion: z.string().min(1),
});

export const proyectoSchema = z.object({
  nombre: z.string().min(1).max(PROYECTO_VALIDATIONS.NOMBRE_MAX),
  oportunidad_id: optionalPositiveIdSchema,
  responsable_id: optionalPositiveIdSchema,
  estado: optionalStringSchema.pipe(
    z.string().max(PROYECTO_VALIDATIONS.ESTADO_MAX).optional(),
  ),
  fecha_inicio: optionalDateSchema,
  fecha_final: optionalDateSchema,
  centro_costo: optionalPositiveIdSchema,
  importe_mat: nonNegativeNumberSchema,
  importe_mo: nonNegativeNumberSchema,
  terceros: nonNegativeNumberSchema,
  herramientas: nonNegativeNumberSchema,
  superficie: z.preprocess(
    normalizeOptionalId,
    z.coerce.number().min(0).max(PROYECTO_VALIDATIONS.SUPERFICIE_MAX).optional(),
  ),
  ingresos: nonNegativeNumberSchema,
  comentario: optionalStringSchema.pipe(
    z.string().max(PROYECTO_VALIDATIONS.COMENTARIO_MAX).optional(),
  ),
  avances: z.array(proyectoAvanceSchema).default([]),
});

export type ProyectoFormValues = z.infer<typeof proyectoSchema>;
export type ProyectoAvanceFormValues = z.infer<typeof proyectoAvanceSchema>;

export const PROYECTO_DEFAULTS: ProyectoFormValues = {
  nombre: "",
  oportunidad_id: undefined,
  responsable_id: undefined,
  estado: "",
  fecha_inicio: "",
  fecha_final: "",
  centro_costo: undefined,
  importe_mat: 0,
  importe_mo: 0,
  terceros: 0,
  herramientas: 0,
  superficie: undefined,
  ingresos: 0,
  comentario: "",
  avances: [],
};

const getTodayDate = () => new Date().toISOString().slice(0, 10);

export const getProyectoAvanceDefaults = (): ProyectoAvanceFormValues => ({
  proyecto_id: undefined,
  horas: 0,
  avance: 0,
  importe: 0,
  comentario: "",
  fecha_registracion: getTodayDate(),
});

const normalizeEstadoKey = (value?: string | null) =>
  String(value ?? "").trim().toLowerCase();

export const getProyectoEstadoLabel = (value?: string | null) => {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue.length > 0 ? normalizedValue : "Sin estado";
};

export const getProyectoEstadoBadgeClass = (value?: string | null) => {
  const normalizedValue = normalizeEstadoKey(value);
  if (normalizedValue.startsWith("01-plan")) {
    return "border border-amber-200 bg-amber-100 text-amber-700";
  }
  if (normalizedValue.startsWith("02-ejeucion") || normalizedValue.startsWith("02-ejecucion")) {
    return "border border-sky-200 bg-sky-100 text-sky-700";
  }
  if (normalizedValue.startsWith("03-conclusion")) {
    return "border border-violet-200 bg-violet-100 text-violet-700";
  }
  if (normalizedValue.startsWith("04-terminados")) {
    return "border border-emerald-200 bg-emerald-100 text-emerald-700";
  }
  if (["finalizado", "finalizada", "cerrado", "cerrada", "completado", "completada"].includes(normalizedValue)) {
    return "border border-emerald-200 bg-emerald-100 text-emerald-700";
  }
  if (["en_proceso", "en proceso", "iniciado", "activa", "activo", "en_ejecucion", "ejecutando"].includes(normalizedValue)) {
    return "border border-sky-200 bg-sky-100 text-sky-700";
  }
  if (["pendiente", "planificado", "planificada", "borrador", "planificacion"].includes(normalizedValue)) {
    return "border border-amber-200 bg-amber-100 text-amber-700";
  }
  if (["cancelado", "cancelada", "pausado", "pausada"].includes(normalizedValue)) {
    return "border border-rose-200 bg-rose-100 text-rose-700";
  }
  return "border border-slate-300 bg-slate-100 text-slate-700";
};

export const computeProyectoPresupuestoTotal = (proyecto?: Partial<Proyecto>) =>
  Number(
    (
      Number(proyecto?.importe_mat ?? 0) +
      Number(proyecto?.importe_mo ?? 0) +
      Number(proyecto?.terceros ?? 0) +
      Number(proyecto?.herramientas ?? 0)
    ).toFixed(2),
  );

export const getProyectoHorasTotales = (avances?: Array<Partial<ProyectoAvance>>) =>
  Number(
    (avances ?? []).reduce((acc, avance) => acc + Number(avance.horas ?? 0), 0).toFixed(2),
  );

export const getProyectoUltimoAvance = (avances?: Array<Partial<ProyectoAvance>>) => {
  if (!Array.isArray(avances) || avances.length === 0) return 0;
  const sorted = [...avances].sort((a, b) =>
    String(b.fecha_registracion ?? "").localeCompare(String(a.fecha_registracion ?? "")),
  );
  return Number(sorted[0]?.avance ?? 0);
};

export const normalizeProyectoPayload = (
  data: Partial<ProyectoFormValues>,
): ProyectoFormValues => ({
  nombre: trimRequiredText(data.nombre),
  oportunidad_id: resolveNumericId(data.oportunidad_id),
  responsable_id: resolveNumericId(data.responsable_id),
  estado: trimOptionalText(data.estado),
  fecha_inicio: trimOptionalText(data.fecha_inicio),
  fecha_final: trimOptionalText(data.fecha_final),
  centro_costo: resolveNumericId(data.centro_costo),
  importe_mat: Number(data.importe_mat ?? 0),
  importe_mo: Number(data.importe_mo ?? 0),
  terceros: Number(data.terceros ?? 0),
  herramientas: Number(data.herramientas ?? 0),
  superficie:
    data.superficie == null
      ? undefined
      : Number(data.superficie),
  ingresos: Number(data.ingresos ?? 0),
  comentario: trimOptionalText(data.comentario),
  avances: (data.avances ?? []).map((avance) => ({
    id: resolveNumericId(avance.id),
    proyecto_id: resolveNumericId(avance.proyecto_id),
    horas: Number(avance.horas ?? 0),
    avance: Number(avance.avance ?? 0),
    importe: Number(avance.importe ?? 0),
    comentario: trimOptionalText(avance.comentario),
    fecha_registracion: trimRequiredText(avance.fecha_registracion),
  })),
});
