"use client";

import { z } from "zod";
import { normalizeQuincenaDateValue } from "@/components/forms/form_order/form/quincena_date";

const requiredId = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().int().positive(),
);

const requiredDate = z.preprocess(
  (value) =>
    value === "" || value === null
      ? undefined
      : normalizeQuincenaDateValue(value),
  z.string().min(1, "La fecha es requerida"),
);

const decimalField = z.coerce.number().min(0);

export type ProyPresupuesto = {
  id: number;
  proyecto_id: number;
  fecha: string;
  mo_propia: number;
  mo_terceros: number;
  materiales: number;
  herramientas: number;
  horas: number;
  metros: number;
  importe: number;
  descripcion?: string | null;
  proyecto?: {
    id?: number;
    nombre?: string | null;
  } | null;
  created_at?: string;
  updated_at?: string;
};

export const proyPresupuestoSchema = z.object({
  proyecto_id: requiredId,
  fecha: requiredDate,
  mo_propia: decimalField,
  mo_terceros: decimalField,
  materiales: decimalField,
  herramientas: decimalField,
  horas: decimalField,
  metros: decimalField,
  importe: decimalField,
  descripcion: z.string().max(500).nullish(),
});

export type ProyPresupuestoFormValues = z.infer<typeof proyPresupuestoSchema>;

export const PROY_PRESUPUESTO_DEFAULT: ProyPresupuestoFormValues = {
  proyecto_id: undefined as unknown as number,
  fecha: normalizeQuincenaDateValue(new Date().toISOString().split("T")[0]),
  mo_propia: 0,
  mo_terceros: 0,
  materiales: 0,
  herramientas: 0,
  horas: 0,
  metros: 0,
  importe: 0,
  descripcion: "",
};

export const computeProyPresupuestoTotal = (values: {
  importe?: unknown;
  mo_propia?: unknown;
  mo_terceros?: unknown;
  materiales?: unknown;
  herramientas?: unknown;
}) => {
  const importe = values.importe;
  if (importe !== undefined && importe !== null && importe !== "") {
    const normalizedImporte = Number(importe);
    if (!Number.isNaN(normalizedImporte)) {
      return Number(normalizedImporte.toFixed(2));
    }
  }
  const moPropia = Number(values.mo_propia ?? 0);
  const moTerceros = Number(values.mo_terceros ?? 0);
  const materiales = Number(values.materiales ?? 0);
  const herramientas = Number(values.herramientas ?? 0);
  return Number((moPropia + moTerceros + materiales + herramientas).toFixed(2));
};

const toFiniteNumber = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

export const computeProyPresupuestoCostos = (values: {
  mo_propia?: unknown;
  mo_terceros?: unknown;
  materiales?: unknown;
  herramientas?: unknown;
}) =>
  Number(
    (
      toFiniteNumber(values.mo_propia) +
      toFiniteNumber(values.mo_terceros) +
      toFiniteNumber(values.materiales) +
      toFiniteNumber(values.herramientas)
    ).toFixed(2),
  );

export const computeProyPresupuestoNeto = (
  values: Parameters<typeof computeProyPresupuestoCostos>[0] & { importe?: unknown },
) => Number((toFiniteNumber(values.importe) - computeProyPresupuestoCostos(values)).toFixed(2));

export const parseProyPresupuestoProyectoId = (value: string | null) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};
