"use client";

import { z } from "zod";

export const ERP_CUENTA_RULES = {
  COD_CUENTA: {
    MAX_LENGTH: 50,
  },
  DESCRIPCION: {
    MAX_LENGTH: 500,
  },
} as const;

const requiredId = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive(),
);

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
  if (value == null || value === "") return true;
  return Boolean(value);
}, z.boolean());

export type ErpCuenta = {
  id: number | string;
  rubro_id?: number | string | null;
  nro_cuenta?: number | string | null;
  cod_cuenta?: string | null;
  descripcion?: string | null;
  activo?: boolean | string | number | null;
  proyectos_concepto_id?: number | string | null;
  rubro?: {
    id?: number | string;
    nombre?: string | null;
  } | null;
  proyectos_concepto?: {
    id?: number | string;
    nombre?: string | null;
    signo?: number | string | null;
  } | null;
  created_at?: string | null;
  updated_at?: string | null;
  version?: number | string | null;
};

export const erpCuentaSchema = z.object({
  rubro_id: requiredId,
  nro_cuenta: z.coerce.number().int().min(0),
  cod_cuenta: z.string().trim().min(1).max(ERP_CUENTA_RULES.COD_CUENTA.MAX_LENGTH),
  descripcion: z.string().trim().min(1).max(ERP_CUENTA_RULES.DESCRIPCION.MAX_LENGTH),
  activo: booleanFromInput,
  proyectos_concepto_id: optionalId,
  version: optionalVersion,
});

export type ErpCuentaFormValues = z.infer<typeof erpCuentaSchema>;

export const ERP_CUENTA_DEFAULT: Partial<ErpCuentaFormValues> = {
  rubro_id: undefined,
  nro_cuenta: 0,
  cod_cuenta: "",
  descripcion: "",
  activo: true,
  proyectos_concepto_id: undefined,
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toOptionalNumber = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toBoolean = (value: unknown, fallback = true) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return fallback;
};

export const normalizeErpCuentaPayload = (data: Partial<ErpCuentaFormValues>) => {
  const payload: Record<string, unknown> = {
    rubro_id: toNumber(data.rubro_id),
    nro_cuenta: toNumber(data.nro_cuenta),
    cod_cuenta: String(data.cod_cuenta ?? "").trim(),
    descripcion: String(data.descripcion ?? "").trim(),
    activo: toBoolean(data.activo),
    proyectos_concepto_id: toOptionalNumber(data.proyectos_concepto_id),
  };

  const version = toOptionalNumber(data.version);
  if (version != null) payload.version = version;

  return payload;
};

export const ACTIVO_SELECT_CHOICES = [
  { id: "true", name: "Si" },
  { id: "false", name: "No" },
];
