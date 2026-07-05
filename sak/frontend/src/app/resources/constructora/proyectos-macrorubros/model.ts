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

export type ProyectoMacrorubro = {
  id: number;
  nombre: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export const proyectoMacrorubroSchema = z.object({
  nombre: z.string().min(1).max(VALIDATION_RULES.NOMBRE.MAX_LENGTH),
  activo: booleanFromInput,
});

export type ProyectoMacrorubroFormValues = z.infer<typeof proyectoMacrorubroSchema>;

export const PROYECTO_MACRORUBRO_DEFAULT: ProyectoMacrorubroFormValues = {
  nombre: "",
  activo: true,
};
