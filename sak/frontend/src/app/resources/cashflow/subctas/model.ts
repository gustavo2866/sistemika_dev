"use client";

import { z } from "zod";

export const ERP_CASH_SUBCTA_ESTADO_CHOICES = [
  { id: "activa", name: "Activa" },
  { id: "error", name: "Error" },
  { id: "bloqueada", name: "Bloqueada" },
];

export const ERP_CASH_SUBCTA_ESTADO_CLASSES = {
  activa: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-red-200 bg-red-50 text-red-700",
  bloqueada: "border-amber-200 bg-amber-50 text-amber-700",
};

const optionalVersion = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

export type ErpCashSubcta = {
  id: number | string;
  tpo_subcta: number;
  descripcion: string;
  nro_subcta: number;
  categoria: string | null;
  estado: "activa" | "error" | "bloqueada";
  version?: number | string | null;
};

export const erpCashSubctaSchema = z.object({
  tpo_subcta: z.coerce.number().int().min(0),
  descripcion: z.string().trim().min(1).max(255),
  nro_subcta: z.coerce.number().int().min(0),
  categoria: z.string().trim().max(50).nullish(),
  estado: z.enum(["activa", "error", "bloqueada"]),
  version: optionalVersion,
}).superRefine((data, context) => {
  if (data.categoria?.toLowerCase() === "error") {
    context.addIssue({ code: "custom", path: ["categoria"], message: "ERROR es un estado, no una categoría" });
  }
});

export type ErpCashSubctaFormValues = z.infer<typeof erpCashSubctaSchema>;

export const ERP_CASH_SUBCTA_DEFAULT: Partial<ErpCashSubctaFormValues> = {
  tpo_subcta: 0,
  descripcion: "",
  nro_subcta: 0,
  categoria: "",
  estado: "error",
};

export const normalizeErpCashSubctaPayload = (data: Partial<ErpCashSubctaFormValues>) => {
  const payload: Record<string, unknown> = {
    tpo_subcta: Number(data.tpo_subcta),
    descripcion: String(data.descripcion ?? "").trim(),
    nro_subcta: Number(data.nro_subcta),
    categoria: String(data.categoria ?? "").trim() || null,
    estado: data.estado ?? "error",
  };
  if (data.version != null) payload.version = Number(data.version);
  return payload;
};
