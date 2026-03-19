import { z } from "zod";

export const PROYECTO_VALIDATIONS = {
  NOMBRE_MAX: 150,
  ESTADO_MAX: 50,
  COMENTARIO_MAX: 1000,
} as const;

const optionalString = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional(),
);

const numberFromInput = z.preprocess((value) => {
  if (value === "" || value == null) return 0;
  if (typeof value === "string" && value.trim() === "") return 0;
  return value;
}, z.coerce.number().min(0));

const optionalDate = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional(),
);

export const proyectoSchema = z.object({
  nombre: z.string().min(1).max(PROYECTO_VALIDATIONS.NOMBRE_MAX),
  estado: optionalString.pipe(
    z.string().max(PROYECTO_VALIDATIONS.ESTADO_MAX).optional(),
  ),
  fecha_inicio: optionalDate,
  fecha_final: optionalDate,
  importe_mat: numberFromInput,
  importe_mo: numberFromInput,
  comentario: optionalString.pipe(
    z.string().max(PROYECTO_VALIDATIONS.COMENTARIO_MAX).optional(),
  ),
});

export type ProyectoFormValues = z.infer<typeof proyectoSchema>;

export const PROYECTO_DEFAULT: Partial<ProyectoFormValues> = {
  nombre: "",
  estado: "",
  fecha_inicio: "",
  fecha_final: "",
  importe_mat: 0,
  importe_mo: 0,
  comentario: "",
};
