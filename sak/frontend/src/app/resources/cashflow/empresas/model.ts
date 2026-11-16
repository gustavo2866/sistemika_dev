"use client";

import { z } from "zod";

const optionalVersion = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

export type ErpEmpresa = {
  id: number | string;
  empresa_id: number | string;
  empresa_nombre: string;
  grupo: string;
  version?: number | string | null;
};

export const erpEmpresaSchema = z.object({
  empresa_id: z.coerce.number().int().positive("El ID de empresa debe ser mayor a cero"),
  empresa_nombre: z.string().trim().min(1, "El nombre es obligatorio").max(255),
  grupo: z.string().trim().min(1, "El grupo es obligatorio").max(50),
  version: optionalVersion,
});

export type ErpEmpresaFormValues = z.infer<typeof erpEmpresaSchema>;

export const ERP_EMPRESA_DEFAULT: Partial<ErpEmpresaFormValues> = {
  grupo: "otros",
};

export const normalizeErpEmpresaPayload = (data: Partial<ErpEmpresaFormValues>) => {
  const payload: Record<string, unknown> = {
    empresa_id: Number(data.empresa_id),
    empresa_nombre: String(data.empresa_nombre ?? "").trim(),
    grupo: String(data.grupo ?? "").trim(),
  };

  if (data.version != null) payload.version = Number(data.version);
  return payload;
};
