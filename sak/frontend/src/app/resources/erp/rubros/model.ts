"use client";

import { z } from "zod";

export const ERP_RUBRO_VALIDATION = {
  NOMBRE_MAX_LENGTH: 120,
  COD_CUENTA_MAX_LENGTH: 50,
  DESCRIPCION_MAX_LENGTH: 500,
} as const;

export const ACTIVO_SELECT_CHOICES = [
  { id: "true", name: "Si" },
  { id: "false", name: "No" },
];

const booleanFromInput = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  if (value == null || value === "") return false;
  return Boolean(value);
}, z.boolean());

const optionalId = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const optionalVersion = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

export type ErpCuenta = {
  id?: number | string;
  rubro_id?: number | string | null;
  nro_cuenta?: number | string | null;
  cod_cuenta?: string | null;
  descripcion?: string | null;
  activo?: boolean | string | number | null;
  created_at?: string | null;
  updated_at?: string | null;
  version?: number | string | null;
};

export type ErpRubro = {
  id: number | string;
  nombre?: string | null;
  activo?: boolean | string | number | null;
  cuentas?: ErpCuenta[];
  created_at?: string | null;
  updated_at?: string | null;
  version?: number | string | null;
};

export const erpCuentaSchema = z.object({
  id: optionalId,
  version: optionalVersion,
  nro_cuenta: z.coerce.number().int().min(0),
  cod_cuenta: z.string().trim().min(1).max(ERP_RUBRO_VALIDATION.COD_CUENTA_MAX_LENGTH),
  descripcion: z.string().trim().min(1).max(ERP_RUBRO_VALIDATION.DESCRIPCION_MAX_LENGTH),
  activo: booleanFromInput.default(true),
});

export const erpRubroSchema = z.object({
  nombre: z.string().trim().min(1).max(ERP_RUBRO_VALIDATION.NOMBRE_MAX_LENGTH),
  activo: booleanFromInput.default(true),
  version: optionalVersion,
  cuentas: z.array(erpCuentaSchema).min(1),
});

export type ErpCuentaFormValues = z.infer<typeof erpCuentaSchema>;
export type ErpRubroFormValues = z.infer<typeof erpRubroSchema>;

export const getErpCuentaDefaults = () => ({
  nro_cuenta: 0,
  cod_cuenta: "",
  descripcion: "",
  activo: true,
});

export const ERP_RUBRO_DEFAULTS: ErpRubroFormValues = {
  nombre: "",
  activo: true,
  cuentas: [getErpCuentaDefaults()],
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toOptionalNumber = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toBoolean = (value: unknown, fallback = true) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return fallback;
};

export const normalizeErpRubroPayload = (data: Partial<ErpRubroFormValues>) => ({
  ...data,
  nombre: String(data.nombre ?? "").trim(),
  activo: toBoolean(data.activo),
  cuentas: (data.cuentas ?? []).map((cuenta) => {
    const normalized: Record<string, unknown> = {
      nro_cuenta: toNumber(cuenta.nro_cuenta),
      cod_cuenta: String(cuenta.cod_cuenta ?? "").trim(),
      descripcion: String(cuenta.descripcion ?? "").trim(),
      activo: toBoolean(cuenta.activo),
    };
    const id = toOptionalNumber(cuenta.id);
    const version = toOptionalNumber(cuenta.version);
    if (id != null) normalized.id = id;
    if (version != null) normalized.version = version;
    return normalized;
  }),
});
