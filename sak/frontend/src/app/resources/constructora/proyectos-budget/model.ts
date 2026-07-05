"use client";

import { z } from "zod";

const requiredId = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().int().positive(),
);

const requiredDate = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().min(1, "La fecha es requerida"),
);

const decimalField = z.coerce.number().min(0);

const optionalString = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().optional(),
);

export type ProyectosBudget = {
  id: number;
  fecha: string;
  proyecto_id: number;
  proyectos_concepto_id: number;
  proyectos_macrorubro_id: number;
  importe: number;
  descripcion?: string | null;
  horas: number;
  empleados: number;
  valor_hora: number;
  proyecto?: {
    id?: number;
    nombre?: string | null;
  } | null;
  proyectos_concepto?: {
    id?: number;
    nombre?: string | null;
    signo?: number | null;
  } | null;
  proyectos_macrorubro?: {
    id?: number;
    nombre?: string | null;
  } | null;
  created_at?: string;
  updated_at?: string;
};

export const proyectosBudgetSchema = z.object({
  fecha: requiredDate,
  proyecto_id: requiredId,
  proyectos_concepto_id: requiredId,
  proyectos_macrorubro_id: requiredId,
  importe: decimalField,
  descripcion: optionalString.pipe(z.string().max(500).optional()),
  horas: decimalField,
  empleados: z.coerce.number().int().min(0),
  valor_hora: decimalField,
});

export type ProyectosBudgetFormValues = z.infer<typeof proyectosBudgetSchema>;

export const PROYECTOS_BUDGET_DEFAULT: ProyectosBudgetFormValues = {
  fecha: new Date().toISOString().split("T")[0],
  proyecto_id: undefined as unknown as number,
  proyectos_concepto_id: undefined as unknown as number,
  proyectos_macrorubro_id: undefined as unknown as number,
  importe: 0,
  descripcion: "",
  horas: 0,
  empleados: 0,
  valor_hora: 0,
};
