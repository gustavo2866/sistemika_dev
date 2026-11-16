"use client";

import { z } from "zod";


const optionalText = (maxLength: number) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.string().trim().max(maxLength).optional(),
  );

const optionalDate = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.string().date("La fecha no es válida").optional(),
);

const optionalVersion = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

export type ErpLibroMayor = {
  id: number | string;
  source_id: number | string;
  empresa_id: number | string;
  periodo_anio: number | string;
  periodo_mes: number | string;
  nivel: string;
  cuenta_codigo: number | string;
  tipo_subcuenta?: string | null;
  nro_subcuenta?: string | null;
  centro_costo?: string | null;
  total_debe: number | string;
  total_haber: number | string;
  total_debe_actualizado?: number | string | null;
  total_haber_actualizado?: number | string | null;
  saldo_periodo: number | string;
  saldo_acumulado: number | string;
  saldo_anterior: number | string;
  fecha_periodo?: string | null;
  recalculado_en?: string | null;
  version?: number | string | null;
};

export const erpLibroMayorSchema = z.object({
  source_id: z.coerce.number().int().positive("El ID de origen debe ser mayor a cero"),
  empresa_id: z.coerce.number().int().positive("La empresa debe ser mayor a cero"),
  periodo_anio: z.coerce.number().int().min(2000).max(2200),
  periodo_mes: z.coerce.number().int().min(1).max(12),
  nivel: z.string().trim().min(1, "El nivel es obligatorio").max(10),
  cuenta_codigo: z.coerce.number().int().min(0),
  tipo_subcuenta: optionalText(50),
  nro_subcuenta: optionalText(50),
  centro_costo: optionalText(20),
  total_debe: z.coerce.number().finite(),
  total_haber: z.coerce.number().finite(),
  total_debe_actualizado: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().finite().optional(),
  ),
  total_haber_actualizado: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().finite().optional(),
  ),
  saldo_periodo: z.coerce.number().finite(),
  saldo_acumulado: z.coerce.number().finite(),
  saldo_anterior: z.coerce.number().finite(),
  fecha_periodo: optionalDate,
  version: optionalVersion,
});

export type ErpLibroMayorFormValues = z.infer<typeof erpLibroMayorSchema>;

export const ERP_LIBRO_MAYOR_DEFAULT: Partial<ErpLibroMayorFormValues> = {
  empresa_id: 1,
  periodo_anio: new Date().getFullYear(),
  periodo_mes: new Date().getMonth() + 1,
  nivel: "cuenta",
  total_debe: 0,
  total_haber: 0,
  saldo_periodo: 0,
  saldo_acumulado: 0,
  saldo_anterior: 0,
};

const nullableText = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text || null;
};

export const normalizeErpLibroMayorPayload = (
  data: Partial<ErpLibroMayorFormValues>,
) => {
  const payload: Record<string, unknown> = {
    source_id: Number(data.source_id),
    empresa_id: Number(data.empresa_id),
    periodo_anio: Number(data.periodo_anio),
    periodo_mes: Number(data.periodo_mes),
    nivel: String(data.nivel ?? "").trim(),
    cuenta_codigo: Number(data.cuenta_codigo),
    tipo_subcuenta: nullableText(data.tipo_subcuenta),
    nro_subcuenta: nullableText(data.nro_subcuenta),
    centro_costo: nullableText(data.centro_costo),
    total_debe: Number(data.total_debe ?? 0),
    total_haber: Number(data.total_haber ?? 0),
    total_debe_actualizado:
      data.total_debe_actualizado == null ? null : Number(data.total_debe_actualizado),
    total_haber_actualizado:
      data.total_haber_actualizado == null ? null : Number(data.total_haber_actualizado),
    saldo_periodo: Number(data.saldo_periodo ?? 0),
    saldo_acumulado: Number(data.saldo_acumulado ?? 0),
    saldo_anterior: Number(data.saldo_anterior ?? 0),
    fecha_periodo: data.fecha_periodo || null,
  };
  if (data.version != null) payload.version = Number(data.version);
  return payload;
};
