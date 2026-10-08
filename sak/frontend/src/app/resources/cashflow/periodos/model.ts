"use client";

import { z } from "zod";

const optionalVersion = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const firstDayOfCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
};

export type ErpCashPeriodoEstado = "ABIERTO" | "CERRADO";

export type ErpCashPeriodo = {
  id: number | string;
  fecha_periodo: string;
  estado: ErpCashPeriodoEstado;
  ultima_sincronizacion?: string | null;
  movimientos_count: number;
  saldos_count: number;
  cerrado_en?: string | null;
  cerrado_por_id?: number | string | null;
  version?: number | string | null;
};

export const ERP_CASH_PERIODO_ESTADO_CHOICES: Array<{
  id: ErpCashPeriodoEstado;
  name: string;
}> = [
  { id: "ABIERTO", name: "Abierto" },
  { id: "CERRADO", name: "Cerrado" },
];

export const erpCashPeriodoSchema = z.object({
  fecha_periodo: z
    .string()
    .min(1, "El período es obligatorio")
    .refine((value) => /^\d{4}-\d{2}-01$/.test(value), {
      message: "El período debe corresponder al primer día del mes",
    }),
  estado: z.enum(["ABIERTO", "CERRADO"]),
  version: optionalVersion,
});

export type ErpCashPeriodoFormValues = z.infer<typeof erpCashPeriodoSchema>;

export const ERP_CASH_PERIODO_DEFAULT: Partial<ErpCashPeriodoFormValues> = {
  fecha_periodo: firstDayOfCurrentMonth(),
  estado: "ABIERTO",
};

export const normalizeErpCashPeriodoPayload = (
  data: Partial<ErpCashPeriodoFormValues>,
) => {
  const payload: Record<string, unknown> = {
    fecha_periodo: data.fecha_periodo,
    estado: data.estado,
  };
  if (data.version != null) payload.version = Number(data.version);
  return payload;
};
