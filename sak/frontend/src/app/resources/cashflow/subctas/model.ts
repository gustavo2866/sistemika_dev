"use client";

import { z } from "zod";

const optionalVersion = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

export type ErpCashSubcta = {
  id: number | string;
  tpo_subcta: number;
  descripcion: string;
  nro_subcta: number;
  categoria: string;
  version?: number | string | null;
};

export const erpCashSubctaSchema = z.object({
  tpo_subcta: z.coerce.number().int().min(0),
  descripcion: z.string().trim().min(1).max(255),
  nro_subcta: z.coerce.number().int().min(0),
  categoria: z.string().trim().min(1).max(50),
  version: optionalVersion,
});

export type ErpCashSubctaFormValues = z.infer<typeof erpCashSubctaSchema>;

export const ERP_CASH_SUBCTA_DEFAULT: Partial<ErpCashSubctaFormValues> = {
  tpo_subcta: 0,
  descripcion: "",
  nro_subcta: 0,
  categoria: "",
};

export const normalizeErpCashSubctaPayload = (data: Partial<ErpCashSubctaFormValues>) => {
  const payload: Record<string, unknown> = {
    tpo_subcta: Number(data.tpo_subcta),
    descripcion: String(data.descripcion ?? "").trim(),
    nro_subcta: Number(data.nro_subcta),
    categoria: String(data.categoria ?? "").trim(),
  };
  if (data.version != null) payload.version = Number(data.version);
  return payload;
};
