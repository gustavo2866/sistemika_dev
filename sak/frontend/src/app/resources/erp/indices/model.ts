"use client";

import { z } from "zod";

export type ErpIndiceCodigo = "ICC" | "IPC" | "DOL";

export type ErpIndice = {
  id: number | string;
  codigo: ErpIndiceCodigo;
  fecha: string;
  valor: number | string;
  version?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export const ERP_INDICE_CODIGO_CHOICES: Array<{
  id: ErpIndiceCodigo;
  name: string;
}> = [
  { id: "ICC", name: "ICC" },
  { id: "IPC", name: "IPC" },
  { id: "DOL", name: "DOL" },
];

const optionalVersion = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const decimalValue = z.preprocess(
  (value) => typeof value === "string" ? value.trim().replace(",", ".") : value,
  z.coerce.number().finite("El valor debe ser numérico"),
);

export const erpIndiceSchema = z.object({
  codigo: z.enum(["ICC", "IPC", "DOL"]),
  fecha: z.string().min(1, "La fecha es obligatoria").date("La fecha no es válida"),
  valor: decimalValue,
  version: optionalVersion,
});

export type ErpIndiceFormValues = z.infer<typeof erpIndiceSchema>;

const firstDayOfCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
};

export const ERP_INDICE_DEFAULTS: ErpIndiceFormValues = {
  codigo: "ICC",
  fecha: firstDayOfCurrentMonth(),
  valor: 0,
};

export const normalizeErpIndicePayload = (
  data: Partial<ErpIndiceFormValues>,
) => {
  const payload: Record<string, unknown> = {
    codigo: String(data.codigo ?? "").trim().toUpperCase(),
    fecha: data.fecha,
    valor: Number(data.valor),
  };
  if (data.version != null) payload.version = Number(data.version);
  return payload;
};
