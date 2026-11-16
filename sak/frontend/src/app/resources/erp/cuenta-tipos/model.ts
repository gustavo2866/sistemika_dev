"use client";

import { z } from "zod";


const optionalVersion = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

export type ErpCuentaTipo = {
  id: number | string;
  nombre: string;
  descripcion?: string | null;
  cuenta: string;
  es_impuesto: boolean;
  version?: number | string | null;
};

export const erpCuentaTipoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  descripcion: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.string().trim().max(500).optional(),
  ),
  cuenta: z.string().trim().min(1, "La cuenta es obligatoria").max(50),
  es_impuesto: z.boolean(),
  version: optionalVersion,
});

export type ErpCuentaTipoFormValues = z.infer<typeof erpCuentaTipoSchema>;

export const ERP_CUENTA_TIPO_DEFAULT: Partial<ErpCuentaTipoFormValues> = {
  es_impuesto: false,
};

export const ERP_CUENTA_TIPO_IMPUESTO_CHOICES = [
  { id: true, name: "Sí" },
  { id: false, name: "No" },
];

export const normalizeErpCuentaTipoPayload = (
  data: Partial<ErpCuentaTipoFormValues>,
) => {
  const descripcion = String(data.descripcion ?? "").trim();
  const payload: Record<string, unknown> = {
    nombre: String(data.nombre ?? "").trim(),
    descripcion: descripcion || null,
    cuenta: String(data.cuenta ?? "").trim(),
    es_impuesto: Boolean(data.es_impuesto),
  };
  if (data.version != null) payload.version = Number(data.version);
  return payload;
};
