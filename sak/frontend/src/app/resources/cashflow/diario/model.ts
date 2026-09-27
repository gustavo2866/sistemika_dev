"use client";

import { z } from "zod";

const optionalText = (maxLength = 255) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.string().trim().max(maxLength).optional(),
  );

const optionalId = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

export type ErpCashDiario = {
  id: number | string;
  source_id: number;
  empresa_id: number;
  fecha: string;
  periodo_anio: number;
  periodo_mes: number;
  tipo_asiento?: string | null;
  nro_asiento?: string | null;
  nro_renglon?: string | null;
  cuenta_codigo: number;
  debe: number | string;
  haber: number | string;
  descripcion?: string | null;
  tipo_subcuenta?: string | null;
  nro_subcuenta?: string | null;
  centro_costo?: string | null;
  archivo_origen?: string | null;
  rubro?: string | null;
  cash?: string | null;
  cuenta_cash_id?: number | string | null;
  version?: number | string | null;
};

export const erpCashDiarioSchema = z.object({
  source_id: z.coerce.number().int().positive(),
  empresa_id: z.coerce.number().int().positive(),
  fecha: z.string().min(1),
  periodo_anio: z.coerce.number().int().min(2000).max(2200),
  periodo_mes: z.coerce.number().int().min(1).max(12),
  tipo_asiento: optionalText(),
  nro_asiento: optionalText(),
  nro_renglon: optionalText(),
  cuenta_codigo: z.coerce.number().int().min(0),
  debe: z.coerce.number(),
  haber: z.coerce.number(),
  descripcion: optionalText(5000),
  tipo_subcuenta: optionalText(),
  nro_subcuenta: optionalText(),
  centro_costo: optionalText(),
  archivo_origen: optionalText(),
  rubro: optionalText(),
  cash: optionalText(10),
  cuenta_cash_id: optionalId,
  version: optionalId,
});

export type ErpCashDiarioFormValues = z.infer<typeof erpCashDiarioSchema>;

export const ERP_CASH_DIARIO_DEFAULT: Partial<ErpCashDiarioFormValues> = {
  empresa_id: 1,
  periodo_anio: new Date().getFullYear(),
  periodo_mes: new Date().getMonth() + 1,
  debe: 0,
  haber: 0,
};

const nullableText = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text || null;
};

export const normalizeErpCashDiarioPayload = (data: Partial<ErpCashDiarioFormValues>) => {
  const payload: Record<string, unknown> = {
    source_id: Number(data.source_id),
    empresa_id: Number(data.empresa_id),
    fecha: data.fecha,
    periodo_anio: Number(data.periodo_anio),
    periodo_mes: Number(data.periodo_mes),
    tipo_asiento: nullableText(data.tipo_asiento),
    nro_asiento: nullableText(data.nro_asiento),
    nro_renglon: nullableText(data.nro_renglon),
    cuenta_codigo: Number(data.cuenta_codigo),
    debe: Number(data.debe ?? 0),
    haber: Number(data.haber ?? 0),
    descripcion: nullableText(data.descripcion),
    tipo_subcuenta: nullableText(data.tipo_subcuenta),
    nro_subcuenta: nullableText(data.nro_subcuenta),
    centro_costo: nullableText(data.centro_costo),
    archivo_origen: nullableText(data.archivo_origen),
    rubro: nullableText(data.rubro),
    cash: nullableText(data.cash),
    cuenta_cash_id: data.cuenta_cash_id ? Number(data.cuenta_cash_id) : null,
  };
  if (data.version != null) payload.version = Number(data.version);
  return payload;
};

export const CASH_CHOICES = [
  { id: "SI", name: "Sí" },
  { id: "NO", name: "No" },
];
