import { z } from "zod";

export const TIPO_ACTUALIZACION_VALIDATIONS = {
  NOMBRE_MAX: 100,
} as const;

export type TipoActualizacion = {
  id: number;
  nombre: string;
  cantidad_meses: number;
  activa: boolean;
  created_at: string;
  updated_at: string;
};

const optionalNumber = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().int().min(1).optional(),
);

const booleanFromInput = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  if (value == null || value === "") return false;
  return Boolean(value);
}, z.boolean());

export const tipoActualizacionSchema = z.object({
  nombre: z.string().min(1).max(TIPO_ACTUALIZACION_VALIDATIONS.NOMBRE_MAX),
  cantidad_meses: optionalNumber,
  activa: booleanFromInput,
});

export type TipoActualizacionFormValues = z.infer<typeof tipoActualizacionSchema>;

export const TIPO_ACTUALIZACION_DEFAULT: Partial<TipoActualizacionFormValues> = {
  nombre: "",
  cantidad_meses: 12,
  activa: true,
};
