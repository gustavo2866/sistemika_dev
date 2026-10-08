"use client";

import { z } from "zod";

const optionalVersion = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

export type ErpCashCuenta = {
  id: number | string;
  descripcion: string;
  tipo?: ErpCashCuentaTipo | null;
  version?: number | string | null;
};

export type ErpCashCuentaTipo = "Ingreso" | "Egreso" | "Fondo";

export const ERP_CASH_CUENTA_TIPO_CHOICES: Array<{
  id: ErpCashCuentaTipo;
  name: string;
}> = [
  { id: "Ingreso", name: "Ingreso" },
  { id: "Egreso", name: "Egreso" },
  { id: "Fondo", name: "Fondo" },
];

const optionalTipo = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.enum(["Ingreso", "Egreso", "Fondo"]).optional(),
);

export const erpCashCuentaSchema = z.object({
  descripcion: z.string().trim().min(1).max(255),
  tipo: optionalTipo,
  version: optionalVersion,
});

export type ErpCashCuentaFormValues = z.infer<typeof erpCashCuentaSchema>;

export const ERP_CASH_CUENTA_DEFAULT: Partial<ErpCashCuentaFormValues> = {
  descripcion: "",
  tipo: undefined,
};

export const normalizeErpCashCuentaPayload = (data: Partial<ErpCashCuentaFormValues>) => {
  const payload: Record<string, unknown> = {
    descripcion: String(data.descripcion ?? "").trim(),
    tipo: data.tipo || null,
  };
  if (data.version != null) payload.version = Number(data.version);
  return payload;
};
