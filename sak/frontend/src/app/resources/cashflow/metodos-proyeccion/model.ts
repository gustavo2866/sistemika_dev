"use client";

import { z } from "zod";

export type FuncionProyeccion = "PROMEDIO" | "SUMA" | "MAX" | "MIN" | "ULTIMO" | "AJUSTE_PONDERADO";

export type MetodoProyeccionDetalle = {
  id?: number | string;
  version?: number | string | null;
  mes_destino: number;
  mes_base_desde: number;
  mes_base_hasta: number;
  funcion?: FuncionProyeccion | null;
  factor: number | string;
};

export type MetodoProyeccion = {
  id: number | string;
  nombre: string;
  tipo_calculo: "HISTORICO" | "RELACIONAL" | "PENDIENTE";
  descripcion?: string | null;
  activo: boolean;
  detalles?: MetodoProyeccionDetalle[];
  created_at?: string | null;
  updated_at?: string | null;
  version?: number | string | null;
};

export const TIPO_CALCULO_CHOICES = [
  { id: "HISTORICO", name: "Histórico" },
  { id: "RELACIONAL", name: "Relacional" },
  { id: "PENDIENTE", name: "Pendiente" },
];

export const FUNCION_PROYECCION_CHOICES: Array<{
  id: FuncionProyeccion;
  name: string;
}> = [
  { id: "PROMEDIO", name: "Promedio" },
  { id: "SUMA", name: "Suma" },
  { id: "MAX", name: "Máximo" },
  { id: "MIN", name: "Mínimo" },
  { id: "ULTIMO", name: "Último valor" },
  { id: "AJUSTE_PONDERADO", name: "Ajuste ponderado" },
];

export const METODO_PROYECCION_ACTIVO_CHOICES = [
  { id: "true", name: "Sí" },
  { id: "false", name: "No" },
];

export const getMesBaseLabel = (offset: number) => {
  if (offset === -1) return "Mes anterior";
  if (offset === -12) return "Mismo mes del año anterior";
  return `${Math.abs(offset)} meses antes`;
};

export const getMesBaseChoices = (...currentValues: number[]) => {
  const offsets = new Set(Array.from({ length: 120 }, (_, index) => -index - 1));
  currentValues.forEach((value) => {
    if (Number.isInteger(value) && value < 0) offsets.add(value);
  });
  return [...offsets].sort((a, b) => b - a).map((id) => ({
    id,
    name: getMesBaseLabel(id),
  }));
};

export const getMesBaseRangeDescription = (month: number, from: number, to: number) => {
  if (
    !Number.isInteger(month) || month < 1 || month > 12 ||
    !Number.isInteger(from) || !Number.isInteger(to) || from > to || to >= 0
  ) return "";

  const describeMonth = (offset: number) => {
    const absoluteMonth = month - 1 + offset;
    const yearOffset = Math.floor(absoluteMonth / 12);
    const monthIndex = ((absoluteMonth % 12) + 12) % 12;
    const name = new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" })
      .format(new Date(Date.UTC(2000, monthIndex, 1)));
    const year = yearOffset === 0 ? "del mismo año"
      : yearOffset === -1 ? "del año anterior"
      : `de ${Math.abs(yearOffset)} años antes`;
    return `${name} ${year}`;
  };

  return from === to
    ? `Período base: ${describeMonth(from)}.`
    : `Período base: desde ${describeMonth(from)} hasta ${describeMonth(to)} (inclusive).`;
};

const optionalId = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const optionalVersion = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const booleanFromInput = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return Boolean(value);
}, z.boolean());

export const metodoProyeccionDetalleSchema = z
  .object({
    id: optionalId,
    version: optionalVersion,
    mes_destino: z.coerce.number().int().min(1).max(12),
    mes_base_desde: z.coerce.number().int().max(-1, "Seleccioná un mes anterior al mes destino"),
    mes_base_hasta: z.coerce.number().int().max(-1, "Seleccioná un mes anterior al mes destino"),
    funcion: z.enum(["PROMEDIO", "SUMA", "MAX", "MIN", "ULTIMO", "AJUSTE_PONDERADO"]).nullable(),
    factor: z.coerce.number().finite(),
  })
  .refine((detalle) => detalle.mes_base_desde <= detalle.mes_base_hasta, {
    message: "La base hasta debe ser igual o posterior a la base desde",
    path: ["mes_base_hasta"],
  })
  .refine((detalle) => detalle.funcion !== "AJUSTE_PONDERADO" || (detalle.factor >= 0 && detalle.factor <= 1), {
    message: "El factor de Ajuste ponderado debe estar entre 0 y 1",
    path: ["factor"],
  });

export const metodoProyeccionSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  tipo_calculo: z.enum(["HISTORICO", "RELACIONAL", "PENDIENTE"]).default("HISTORICO"),
  descripcion: z.string().trim().max(1000).optional().nullable(),
  activo: booleanFromInput.default(true),
  version: optionalVersion,
  detalles: z.array(metodoProyeccionDetalleSchema).default([]),
}).superRefine((values, ctx) => {
  if (values.tipo_calculo === "HISTORICO" && !values.detalles.length) {
    ctx.addIssue({ code: "custom", message: "Debe ingresar al menos una regla", path: ["detalles"] });
  }
  const seen = new Set<number>();
  values.detalles.forEach((rule, index) => {
    if (seen.has(rule.mes_destino)) ctx.addIssue({ code: "custom", message: "Mes destino repetido", path: ["detalles", index, "mes_destino"] });
    seen.add(rule.mes_destino);
  });
});

export type MetodoProyeccionFormValues = z.infer<typeof metodoProyeccionSchema>;

export const getMetodoProyeccionDetalleDefaults = () => ({
  mes_destino: 1,
  mes_base_desde: -6,
  mes_base_hasta: -1,
  funcion: "PROMEDIO" as const,
  factor: 1,
});

export const METODO_PROYECCION_DEFAULTS: MetodoProyeccionFormValues = {
  nombre: "",
  tipo_calculo: "HISTORICO",
  descripcion: null,
  activo: true,
  detalles: [getMetodoProyeccionDetalleDefaults()],
};

const toOptionalNumber = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return Boolean(value);
};

export const normalizeMetodoProyeccionPayload = (
  data: Partial<MetodoProyeccionFormValues>,
) => {
  const descripcion = String(data.descripcion ?? "").trim();
  const payload: Record<string, unknown> = {
    nombre: String(data.nombre ?? "").trim(),
    tipo_calculo: data.tipo_calculo ?? "HISTORICO",
    descripcion: descripcion || null,
    activo: toBoolean(data.activo),
    detalles: (data.tipo_calculo && data.tipo_calculo !== "HISTORICO" ? [] : data.detalles ?? []).map((detalle) => {
      const normalized: Record<string, unknown> = {
        mes_destino: Number(detalle.mes_destino),
        mes_base_desde: Number(detalle.mes_base_desde),
        mes_base_hasta: Number(detalle.mes_base_hasta),
        funcion: detalle.funcion || null,
        factor: Number(detalle.factor),
      };
      const id = toOptionalNumber(detalle.id);
      const version = toOptionalNumber(detalle.version);
      if (id != null) normalized.id = id;
      if (version != null) normalized.version = version;
      return normalized;
    }),

  };
  const version = toOptionalNumber(data.version);
  if (version != null) payload.version = version;
  return payload;
};
