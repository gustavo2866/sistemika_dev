"use client";

import { z } from "zod";

const optionalVersion = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

export type ErpCashCuenta = {
  id: number | string;
  descripcion: string;
  version?: number | string | null;
};

export const erpCashCuentaSchema = z.object({
  descripcion: z.string().trim().min(1).max(255),
  version: optionalVersion,
});

export type ErpCashCuentaFormValues = z.infer<typeof erpCashCuentaSchema>;

export const ERP_CASH_CUENTA_DEFAULT: Partial<ErpCashCuentaFormValues> = {
  descripcion: "",
};

export const normalizeErpCashCuentaPayload = (data: Partial<ErpCashCuentaFormValues>) => {
  const payload: Record<string, unknown> = {
    descripcion: String(data.descripcion ?? "").trim(),
  };
  if (data.version != null) payload.version = Number(data.version);
  return payload;
};
