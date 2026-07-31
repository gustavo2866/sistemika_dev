"use client";

import { z } from "zod";

const requiredId = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().int().positive(),
);

const optionalId = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const requiredDate = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().min(1, "La fecha es requerida"),
);

const decimalField = z.coerce.number().min(0);

export type ErpPresupuesto = {
  id: number;
  fecha: string;
  proyecto_id: number;
  erp_cuenta_id: number;
  egreso: number;
  ingres: number;
  real_egreso: number;
  real_ingreso: number;
  obreros_cantidad: number;
  obreros_costo: number;
  proyecto?: {
    id?: number;
    nombre?: string | null;
  } | null;
  erp_cuenta?: {
    id?: number;
    cod_cuenta?: string | null;
    descripcion?: string | null;
    rubro?: {
      id?: number;
      nombre?: string | null;
    } | null;
  } | null;
  created_at?: string;
  updated_at?: string;
  version?: number;
};

export const erpPresupuestoSchema = z.object({
  fecha: requiredDate,
  proyecto_id: requiredId,
  rubro_id: optionalId,
  erp_cuenta_id: requiredId,
  ingres: decimalField,
  egreso: decimalField,
  real_ingreso: decimalField,
  real_egreso: decimalField,
  obreros_cantidad: decimalField,
  obreros_costo: decimalField,
});

export type ErpPresupuestoFormValues = z.infer<typeof erpPresupuestoSchema>;

export const ERP_PRESUPUESTO_DEFAULT: ErpPresupuestoFormValues = {
  fecha: new Date().toISOString().split("T")[0],
  proyecto_id: undefined as unknown as number,
  rubro_id: undefined,
  erp_cuenta_id: undefined as unknown as number,
  ingres: 0,
  egreso: 0,
  real_ingreso: 0,
  real_egreso: 0,
  obreros_cantidad: 0,
  obreros_costo: 0,
};

export const normalizeErpPresupuestoPayload = (
  data: Partial<ErpPresupuestoFormValues>,
) => {
  const { rubro_id: _rubroId, ...payload } = data;
  return payload;
};
