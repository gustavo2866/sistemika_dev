"use client";

import { z } from "zod";

export const ESTADO_CHOICES = [
  { id: true, name: "Activo" },
  { id: false, name: "Inactivo" },
];

export const VALIDATION_RULES = {
  NOMBRE: { MAX_LENGTH: 120 },
  APELLIDO: { MAX_LENGTH: 120 },
  DNI: { MAX_LENGTH: 20 },
  EMAIL: { MAX_LENGTH: 255 },
  TELEFONO: { MAX_LENGTH: 20 },
  DIRECCION: { MAX_LENGTH: 255 },
  NRO_LEGAJO: { MAX_LENGTH: 10 },
  URL_FOTO: { MAX_LENGTH: 500 },
} as const;

const emptyToUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

const optionalString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().max(maxLength).optional());

const requiredId = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive(),
);

const optionalId = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive().optional(),
);

const optionalDate = z.preprocess(emptyToUndefined, z.string().optional());

const optionalAmount = z.preprocess(
  emptyToUndefined,
  z.coerce.number().min(0).optional(),
);

const booleanFromInput = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  if (value == null || value === "") return true;
  return Boolean(value);
}, z.boolean());

export const nominaSchema = z.object({
  nombre: z.string().min(1).max(VALIDATION_RULES.NOMBRE.MAX_LENGTH),
  apellido: z.string().min(1).max(VALIDATION_RULES.APELLIDO.MAX_LENGTH),
  dni: z.string().min(1).max(VALIDATION_RULES.DNI.MAX_LENGTH),
  idproyecto: requiredId,
  nomina_categoria_id: optionalId,
  nomina_tarea_id: optionalId,
  encargado_contacto_id: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().optional(),
  ),
  email: optionalString(VALIDATION_RULES.EMAIL.MAX_LENGTH).pipe(
    z.string().email().max(VALIDATION_RULES.EMAIL.MAX_LENGTH).optional(),
  ),
  telefono: optionalString(VALIDATION_RULES.TELEFONO.MAX_LENGTH),
  direccion: optionalString(VALIDATION_RULES.DIRECCION.MAX_LENGTH),
  nro_legajo: optionalString(VALIDATION_RULES.NRO_LEGAJO.MAX_LENGTH),
  fecha_nacimiento: optionalDate,
  fecha_ingreso: optionalDate,
  fecha_egreso: optionalDate,
  salario_mensual: optionalAmount,
  url_foto: optionalString(VALIDATION_RULES.URL_FOTO.MAX_LENGTH).pipe(
    z.string().url().max(VALIDATION_RULES.URL_FOTO.MAX_LENGTH).optional(),
  ),
  activo: booleanFromInput,
});

export type NominaFormValues = z.infer<typeof nominaSchema>;

export const NOMINA_DEFAULT: NominaFormValues = {
  nombre: "",
  apellido: "",
  dni: "",
  idproyecto: 0,
  nomina_categoria_id: undefined,
  nomina_tarea_id: undefined,
  encargado_contacto_id: undefined,
  email: "",
  telefono: "",
  direccion: "",
  nro_legajo: "",
  fecha_nacimiento: "",
  fecha_ingreso: "",
  fecha_egreso: "",
  salario_mensual: undefined,
  url_foto: "",
  activo: true,
};

const nullableStringFields = [
  "email",
  "telefono",
  "direccion",
  "nro_legajo",
  "fecha_nacimiento",
  "fecha_ingreso",
  "fecha_egreso",
  "url_foto",
] as const;

export const normalizeNominaPayload = (data: unknown) => {
  if (!data || typeof data !== "object") return data;
  const payload = { ...(data as Record<string, unknown>) };

  nullableStringFields.forEach((field) => {
    if (payload[field] === "") {
      payload[field] = null;
    }
  });

  if (payload.salario_mensual === "") {
    payload.salario_mensual = null;
  } else if (payload.salario_mensual != null) {
    payload.salario_mensual = Number(payload.salario_mensual);
  }

  if (payload.idproyecto != null && payload.idproyecto !== "") {
    payload.idproyecto = Number(payload.idproyecto);
  }
  if (payload.nomina_categoria_id === "") {
    payload.nomina_categoria_id = null;
  } else if (payload.nomina_categoria_id != null) {
    payload.nomina_categoria_id = Number(payload.nomina_categoria_id);
  }
  if (payload.nomina_tarea_id === "") {
    payload.nomina_tarea_id = null;
  } else if (payload.nomina_tarea_id != null) {
    payload.nomina_tarea_id = Number(payload.nomina_tarea_id);
  }
  if (payload.encargado_contacto_id === "") {
    payload.encargado_contacto_id = null;
  } else if (payload.encargado_contacto_id != null) {
    payload.encargado_contacto_id = Number(payload.encargado_contacto_id);
  }

  payload.activo = Boolean(payload.activo);

  return payload;
};
