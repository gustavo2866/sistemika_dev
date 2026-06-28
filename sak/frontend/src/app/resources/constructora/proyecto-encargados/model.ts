"use client";

import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

const requiredId = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive(),
);

const optionalDate = z.preprocess(emptyToUndefined, z.string().optional());

const optionalString = z.preprocess(
  emptyToUndefined,
  z.string().max(1000).optional(),
);

const booleanFromInput = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  if (value == null || value === "") return false;
  return Boolean(value);
}, z.boolean());

export type ProyectoEncargado = {
  id: number | string;
  proyecto_id?: number | string | null;
  contacto_id?: number | string | null;
  principal?: boolean | null;
  activo?: boolean | null;
  desde?: string | null;
  hasta?: string | null;
  notas?: string | null;
  proyecto?: { id?: number | string; nombre?: string | null } | null;
  contacto?: { id?: number | string; nombre_completo?: string | null } | null;
};

export const proyectoEncargadoSchema = z.object({
  proyecto_id: requiredId,
  contacto_id: requiredId,
  principal: booleanFromInput.default(false),
  activo: booleanFromInput.default(true),
  desde: optionalDate,
  hasta: optionalDate,
  notas: optionalString,
});

export type ProyectoEncargadoFormValues = z.infer<typeof proyectoEncargadoSchema>;

export const PROYECTO_ENCARGADO_DEFAULT: ProyectoEncargadoFormValues = {
  proyecto_id: undefined as unknown as number,
  contacto_id: undefined as unknown as number,
  principal: false,
  activo: true,
  desde: "",
  hasta: "",
  notas: "",
};

export const normalizeProyectoEncargadoPayload = (data: unknown) => {
  if (!data || typeof data !== "object") return data;
  const payload = { ...(data as Record<string, unknown>) };

  payload.proyecto_id = Number(payload.proyecto_id);
  payload.contacto_id = Number(payload.contacto_id);
  payload.principal = Boolean(payload.principal);
  payload.activo = payload.activo == null ? true : Boolean(payload.activo);

  for (const field of ["desde", "hasta", "notas"] as const) {
    if (payload[field] === "") {
      payload[field] = null;
    }
  }

  return payload;
};
