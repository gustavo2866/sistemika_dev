"use client";

import { z } from "zod";

export const VALIDATION_RULES = {
  META_CELULAR_ID: {
    MAX_LENGTH: 255,
  },
  NUMERO_CELULAR: {
    MAX_LENGTH: 50,
  },
  ALIAS: {
    MAX_LENGTH: 255,
  },
} as const;

const optionalString = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional(),
);

const booleanFromInput = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  if (value == null || value === "") return false;
  return Boolean(value);
}, z.boolean());

export type CRMCelular = {
  id: number;
  meta_celular_id: string;
  numero_celular: string;
  alias?: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
};

export const crmCelularSchema = z.object({
  meta_celular_id: z.string().min(1).max(VALIDATION_RULES.META_CELULAR_ID.MAX_LENGTH),
  numero_celular: z.string().min(1).max(VALIDATION_RULES.NUMERO_CELULAR.MAX_LENGTH),
  alias: optionalString.pipe(z.string().max(VALIDATION_RULES.ALIAS.MAX_LENGTH).optional()),
  activo: booleanFromInput,
});

export type CRMCelularFormValues = z.infer<typeof crmCelularSchema>;

export const CRM_CELULAR_DEFAULTS: CRMCelularFormValues = {
  meta_celular_id: "",
  numero_celular: "",
  alias: "",
  activo: true,
};

