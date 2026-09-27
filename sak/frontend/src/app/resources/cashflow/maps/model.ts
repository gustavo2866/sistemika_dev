"use client";

import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().trim().max(50).optional(),
);

const optionalVersion = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

export type ErpCashMap = {
  id: number | string;
  nro_cta: number;
  moneda: string;
  categoria?: string | null;
  map_debe_id: number | string;
  map_haber_id: number | string;
  version?: number | string | null;
};

export const erpCashMapSchema = z.object({
  nro_cta: z.coerce.number().int().min(0),
  moneda: z.string().trim().min(1).max(10),
  categoria: optionalText,
  map_debe_id: z.coerce.number().int().positive(),
  map_haber_id: z.coerce.number().int().positive(),
  version: optionalVersion,
});

export type ErpCashMapFormValues = z.infer<typeof erpCashMapSchema>;

export const ERP_CASH_MAP_DEFAULT: Partial<ErpCashMapFormValues> = {
  nro_cta: 0,
  moneda: "ARS",
  categoria: undefined,
  map_debe_id: undefined,
  map_haber_id: undefined,
};

export const normalizeErpCashMapPayload = (data: Partial<ErpCashMapFormValues>) => {
  const categoria = String(data.categoria ?? "").trim();
  const payload: Record<string, unknown> = {
    nro_cta: Number(data.nro_cta),
    moneda: String(data.moneda ?? "").trim().toUpperCase(),
    categoria: categoria || null,
    map_debe_id: Number(data.map_debe_id),
    map_haber_id: Number(data.map_haber_id),
  };
  if (data.version != null) payload.version = Number(data.version);
  return payload;
};
