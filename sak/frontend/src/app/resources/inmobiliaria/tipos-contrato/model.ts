import { z } from "zod";

export const TIPO_CONTRATO_VALIDATIONS = {
  NOMBRE_MAX: 120,
  DESCRIPCION_MAX: 500,
} as const;

export type TipoContrato = {
  id: number;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
  template?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const booleanFromInput = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  if (value == null || value === "") return false;
  return Boolean(value);
}, z.boolean());

export const clausulaSchema = z.object({
  numero: z.string().min(1, "Requerido").max(20),
  titulo: z.string().min(1, "Requerido").max(200),
  cuerpo: z.string().min(1, "Requerido"),
});

export type ClausulaFormValues = z.infer<typeof clausulaSchema>;

const templateSchema = z
  .object({
    titulo: z.string().max(200).nullable().optional(),
    subtitulo: z.string().max(200).nullable().optional(),
    lugar_y_fecha: z.string().nullable().optional(),
    clausulas: z.array(clausulaSchema).default([]),
  })
  .transform((val) => {
    if (!val) return null;
    const hasContent =
      val.titulo || val.subtitulo || val.lugar_y_fecha || val.clausulas.length > 0;
    return hasContent ? val : null;
  })
  .nullable()
  .optional();

export const tipoContratoSchema = z.object({
  nombre: z.string().min(1).max(TIPO_CONTRATO_VALIDATIONS.NOMBRE_MAX),
  descripcion: z.string().max(TIPO_CONTRATO_VALIDATIONS.DESCRIPCION_MAX).nullable().optional(),
  activo: booleanFromInput,
  template: templateSchema,
});

export type TipoContratoFormValues = z.infer<typeof tipoContratoSchema>;

export const TIPO_CONTRATO_DEFAULT: Partial<TipoContratoFormValues> = {
  nombre: "",
  descripcion: "",
  activo: true,
  template: {
    titulo: "",
    subtitulo: "",
    lugar_y_fecha: "",
    clausulas: [],
  },
};
