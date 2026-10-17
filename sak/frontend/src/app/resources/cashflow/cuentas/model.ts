"use client";

import { z } from "zod";

const optionalVersion = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const optionalMetodoProyeccionId = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

export type ErpCashCuenta = {
  id: number | string;
  descripcion: string;
  tipo?: ErpCashCuentaTipo | null;
  id_metodo_proyeccion?: number | string | null;
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

export const normalizeErpCashCuentaTipo = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const optionalTipo = z.preprocess(
  (value) => normalizeErpCashCuentaTipo(value) || undefined,
  z.enum(["Ingreso", "Egreso", "Fondo"]).optional(),
);

export const erpCashCuentaSchema = z.object({
  descripcion: z.string().trim().min(1).max(255),
  tipo: optionalTipo,
  id_metodo_proyeccion: optionalMetodoProyeccionId,
  version: optionalVersion,
});

export type ErpCashCuentaFormValues = z.infer<typeof erpCashCuentaSchema>;

export const ERP_CASH_CUENTA_DEFAULT: Partial<ErpCashCuentaFormValues> = {
  descripcion: "",
  tipo: undefined,
  id_metodo_proyeccion: undefined,
};

export const normalizeErpCashCuentaPayload = (data: Partial<ErpCashCuentaFormValues>) => {
  const payload: Record<string, unknown> = {
    descripcion: String(data.descripcion ?? "").trim(),
    tipo: normalizeErpCashCuentaTipo(data.tipo) || null,
    id_metodo_proyeccion:
      data.id_metodo_proyeccion == null || String(data.id_metodo_proyeccion).trim() === ""
        ? null
        : Number(data.id_metodo_proyeccion),
  };
  if (data.version != null) payload.version = Number(data.version);
  return payload;
};
