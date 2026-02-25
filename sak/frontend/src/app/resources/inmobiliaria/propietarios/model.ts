import { z } from "zod";

export const PROPIETARIO_VALIDATIONS = {
  NOMBRE_MAX: 200,
  COMENTARIO_MAX: 1000,
} as const;

export const CONCEPTOS_REFERENCE = {
  resource: "api/v1/adm/conceptos",
  labelField: "nombre",
  limit: 200,
  staleTime: 5 * 60 * 1000,
} as const;

export const CENTROS_COSTO_REFERENCE = {
  resource: "centros-costo",
  labelField: "nombre",
  limit: 100,
  staleTime: 5 * 60 * 1000,
} as const;

export type Propietario = {
  id: number;
  nombre: string;
  adm_concepto_id?: number | null;
  centro_costo_id?: number | null;
  comentario?: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

const optionalId = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

const optionalString = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional(),
);

const booleanFromInput = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  if (value == null || value === "") return false;
  return Boolean(value);
}, z.boolean());

export const propietarioSchema = z.object({
  nombre: z.string().min(1).max(PROPIETARIO_VALIDATIONS.NOMBRE_MAX),
  adm_concepto_id: optionalId,
  centro_costo_id: optionalId,
  comentario: optionalString.pipe(
    z.string().max(PROPIETARIO_VALIDATIONS.COMENTARIO_MAX).optional(),
  ),
  activo: booleanFromInput,
});

export type PropietarioFormValues = z.infer<typeof propietarioSchema>;

export const PROPIETARIO_DEFAULT: Partial<PropietarioFormValues> = {
  nombre: "",
  adm_concepto_id: undefined,
  centro_costo_id: undefined,
  comentario: "",
  activo: true,
};
