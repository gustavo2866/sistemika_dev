"use client";

import { z } from "zod";

export const VALIDATION_RULES = {
  NOMBRE: {
    MAX_LENGTH: 120,
  },
} as const;

const booleanFromInput = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  if (value == null || value === "") return false;
  return Boolean(value);
}, z.boolean());

export type ProyectoConcepto = {
  id: number;
  nombre: string;
  activo: boolean;
  signo: 1 | -1;
  created_at: string;
  updated_at: string;
};

export const SIGNO_CHOICES = [
  { id: 1, name: "Ingreso" },
  { id: -1, name: "Egreso" },
];

export const proyectoConceptoSchema = z.object({
  nombre: z.string().min(1).max(VALIDATION_RULES.NOMBRE.MAX_LENGTH),
  activo: booleanFromInput,
  signo: z.coerce.number().refine((value) => value === 1 || value === -1, {
    message: "El signo debe ser 1 o -1",
  }),
});

export type ProyectoConceptoFormValues = z.infer<typeof proyectoConceptoSchema>;

export const PROYECTO_CONCEPTO_DEFAULT: ProyectoConceptoFormValues = {
  nombre: "",
  activo: true,
  signo: 1,
};
