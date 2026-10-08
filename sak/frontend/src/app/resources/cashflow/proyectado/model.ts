"use client";

import { z } from "zod";

const optionalVersion = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const optionalText = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.string().trim().max(255).optional(),
);

const firstDayOfCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
};

export type ErpCashProyectadoTipo =
  | "PROYECCION"
  | "PRESUPUESTO"
  | "COMPROMETIDO"
  | "AJUSTE";

export type ErpCashProyectado = {
  id: number | string;
  cuenta_cash_id: number | string;
  fecha_periodo: string;
  tipo: ErpCashProyectadoTipo;
  importe: number | string;
  observacion?: string | null;
  version?: number | string | null;
};

export const ERP_CASH_PROYECTADO_TIPO_CHOICES: Array<{
  id: ErpCashProyectadoTipo;
  name: string;
}> = [
  { id: "PROYECCION", name: "Proyección" },
  { id: "PRESUPUESTO", name: "Presupuesto" },
  { id: "COMPROMETIDO", name: "Comprometido" },
  { id: "AJUSTE", name: "Ajuste" },
];

export const erpCashProyectadoSchema = z.object({
  cuenta_cash_id: z.coerce.number().int().positive(),
  fecha_periodo: z
    .string()
    .min(1, "El período es obligatorio")
    .refine((value) => /^\d{4}-\d{2}-01$/.test(value), {
      message: "El período debe corresponder al primer día del mes",
    }),
  tipo: z.enum(["PROYECCION", "PRESUPUESTO", "COMPROMETIDO", "AJUSTE"]),
  importe: z.coerce.number().finite(),
  observacion: optionalText,
  version: optionalVersion,
});

export type ErpCashProyectadoFormValues = z.infer<typeof erpCashProyectadoSchema>;

export const ERP_CASH_PROYECTADO_DEFAULT: Partial<ErpCashProyectadoFormValues> = {
  fecha_periodo: firstDayOfCurrentMonth(),
  tipo: "PROYECCION",
  importe: 0,
  observacion: undefined,
};

export const normalizeErpCashProyectadoPayload = (
  data: Partial<ErpCashProyectadoFormValues>,
) => {
  const observacion = String(data.observacion ?? "").trim();
  const payload: Record<string, unknown> = {
    cuenta_cash_id: Number(data.cuenta_cash_id),
    fecha_periodo: data.fecha_periodo,
    tipo: data.tipo,
    importe: Number(data.importe ?? 0),
    observacion: observacion || null,
  };
  if (data.version != null) payload.version = Number(data.version);
  return payload;
};
