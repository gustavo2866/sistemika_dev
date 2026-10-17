"use client";

import { z } from "zod";

export type FuncionProyeccion = "PROMEDIO" | "SUMA" | "MAX" | "MIN" | "ULTIMO";

export type MetodoProyeccionDetalle = {
  id?: number | string;
  version?: number | string | null;
  mes_destino: number;
  mes_base_desde: number;
  mes_base_hasta: number;
  funcion?: FuncionProyeccion | null;
  factor: number | string;
};

export type MetodoProyeccionCuenta = {
  id?: number | string;
  version?: number | string | null;
  nro_cuenta: number | string;
  activo: boolean;
};

export type MetodoProyeccion = {
  id: number | string;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
  detalles?: MetodoProyeccionDetalle[];
  cuentas?: MetodoProyeccionCuenta[];
  created_at?: string | null;
  updated_at?: string | null;
  version?: number | string | null;
};

export const FUNCION_PROYECCION_CHOICES: Array<{
  id: FuncionProyeccion;
  name: string;
}> = [
  { id: "PROMEDIO", name: "Promedio" },
  { id: "SUMA", name: "Suma" },
  { id: "MAX", name: "Máximo" },
  { id: "MIN", name: "Mínimo" },
  { id: "ULTIMO", name: "Último valor" },
];

export const METODO_PROYECCION_ACTIVO_CHOICES = [
  { id: "true", name: "Sí" },
  { id: "false", name: "No" },
];

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
    mes_base_desde: z.coerce.number().int(),
    mes_base_hasta: z.coerce.number().int(),
    funcion: z.enum(["PROMEDIO", "SUMA", "MAX", "MIN", "ULTIMO"]).nullable(),
    factor: z.coerce.number().finite(),
  })
  .refine((detalle) => detalle.mes_base_desde <= detalle.mes_base_hasta, {
    message: "El mes base hasta debe ser mayor o igual al mes base desde",
    path: ["mes_base_hasta"],
  });

export const metodoProyeccionCuentaSchema = z.object({
  id: optionalId,
  version: optionalVersion,
  nro_cuenta: z.coerce.number().int().min(0, "El número de cuenta es obligatorio"),
  activo: booleanFromInput.default(true),
});

export const metodoProyeccionSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  descripcion: z.string().trim().max(1000).optional().nullable(),
  activo: booleanFromInput.default(true),
  version: optionalVersion,
  detalles: z.array(metodoProyeccionDetalleSchema).min(1, "Debe ingresar al menos una regla"),
  cuentas: z.array(metodoProyeccionCuentaSchema).default([]),
}).superRefine((values, ctx) => {
  const cuentasVistas = new Set<number>();
  values.cuentas.forEach((cuenta, index) => {
    const nroCuenta = Number(cuenta.nro_cuenta);
    if (cuentasVistas.has(nroCuenta)) {
      ctx.addIssue({
        code: "custom",
        message: "La cuenta ya fue agregada",
        path: ["cuentas", index, "nro_cuenta"],
      });
    }
    cuentasVistas.add(nroCuenta);
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

export const getMetodoProyeccionCuentaDefaults = () => ({
  nro_cuenta: undefined,
  activo: true,
});

export const METODO_PROYECCION_DEFAULTS: MetodoProyeccionFormValues = {
  nombre: "",
  descripcion: null,
  activo: true,
  detalles: [getMetodoProyeccionDetalleDefaults()],
  cuentas: [],
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
    descripcion: descripcion || null,
    activo: toBoolean(data.activo),
    detalles: (data.detalles ?? []).map((detalle) => {
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
    cuentas: (data.cuentas ?? []).map((cuenta) => {
      const normalized: Record<string, unknown> = {
        nro_cuenta: Number(cuenta.nro_cuenta),
        activo: toBoolean(cuenta.activo),
      };
      const id = toOptionalNumber(cuenta.id);
      const version = toOptionalNumber(cuenta.version);
      if (id != null) normalized.id = id;
      if (version != null) normalized.version = version;
      return normalized;
    }),
  };
  const version = toOptionalNumber(data.version);
  if (version != null) payload.version = version;
  return payload;
};
