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

export type ProjectionBase = "HISTORICO" | "RELACIONAL" | "PENDIENTE";

export const getTotalProyectado = (
  base: ProjectionBase,
  proyectado: number,
  pendiente: number,
  comprometido: number,
) => (base === "PENDIENTE" ? pendiente : proyectado) + comprometido;

export type ErpCashProyectado = {
  id: number | string;
  cuenta_cash_id: number | string;
  fecha_periodo: string;
  id_metodo_proyeccion?: number | null;
  tipo_calculo: ProjectionBase;
  importe_proyectado: number | string;
  importe_pendiente: number | string;
  importe_comprometido: number | string;
  total_proyectado: number | string;
  observacion?: string | null;
  version?: number | string | null;
};

export const erpCashProyectadoSchema = z.object({
  cuenta_cash_id: z.coerce.number().int().positive(),
  fecha_periodo: z
    .string()
    .min(1, "El período es obligatorio")
    .refine((value) => /^\d{4}-\d{2}-01$/.test(value), {
      message: "El período debe corresponder al primer día del mes",
    }),
  id_metodo_proyeccion: z.preprocess(
    (value) => value === "" || value == null ? null : value,
    z.coerce.number().int().positive().nullable(),
  ),
  importe_proyectado: z.coerce.number().finite(),
  importe_pendiente: z.coerce.number().finite(),
  importe_comprometido: z.coerce.number().finite(),
  observacion: optionalText,
  version: optionalVersion,
});

export type ErpCashProyectadoFormValues = z.infer<typeof erpCashProyectadoSchema>;

export const ERP_CASH_PROYECTADO_DEFAULT: Partial<ErpCashProyectadoFormValues> = {
  fecha_periodo: firstDayOfCurrentMonth(),
  id_metodo_proyeccion: null,
  importe_proyectado: 0,
  importe_pendiente: 0,
  importe_comprometido: 0,
  observacion: undefined,
};

export const normalizeErpCashProyectadoPayload = (
  data: Partial<ErpCashProyectadoFormValues>,
) => {
  const observacion = String(data.observacion ?? "").trim();
  const payload: Record<string, unknown> = {
    cuenta_cash_id: Number(data.cuenta_cash_id),
    fecha_periodo: data.fecha_periodo,
    id_metodo_proyeccion: data.id_metodo_proyeccion ?? null,
    importe_proyectado: Number(data.importe_proyectado ?? 0),
    importe_pendiente: Number(data.importe_pendiente ?? 0),
    importe_comprometido: Number(data.importe_comprometido ?? 0),
    observacion: observacion || null,
  };
  if (data.version != null) payload.version = Number(data.version);
  return payload;
};
