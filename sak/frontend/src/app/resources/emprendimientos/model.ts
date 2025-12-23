import {
  createEntitySchema,
  selectField,
  stringField,
} from "@/lib/form-detail-schema";

export const EMPRENDIMIENTO_ESTADOS = [
  "planificacion",
  "construccion",
  "finalizado",
  "cancelado",
] as const;

export type EmprendimientoEstado = (typeof EMPRENDIMIENTO_ESTADOS)[number];

export const EMPRENDIMIENTO_ESTADO_CHOICES = EMPRENDIMIENTO_ESTADOS.map(
  (estado) => ({
    id: estado,
    name:
      estado === "planificacion"
        ? "Planificación"
        : estado.charAt(0).toUpperCase() + estado.slice(1),
  }),
);

export const EMPRENDIMIENTO_VALIDATIONS = {
  NOMBRE_MAX: 255,
  DESCRIPCION_MAX: 2000,
  UBICACION_MAX: 500,
} as const;

export type Emprendimiento = {
  id: number;
  nombre: string;
  descripcion?: string | null;
  ubicacion?: string | null;
  estado: EmprendimientoEstado;
  fecha_inicio?: string | null;
  fecha_fin_estimada?: string | null;
  activo: boolean;
};

export type EmprendimientoFormValues = {
  nombre: string;
  descripcion?: string | null;
  ubicacion?: string | null;
  estado: EmprendimientoEstado;
  fecha_inicio?: string | null;
  fecha_fin_estimada?: string | null;
  activo: boolean;
};

export const EMPRENDIMIENTO_DEFAULTS: EmprendimientoFormValues = {
  nombre: "",
  descripcion: "",
  ubicacion: "",
  estado: "planificacion",
  fecha_inicio: "",
  fecha_fin_estimada: "",
  activo: true,
};

export const emprendimientoSchema = createEntitySchema<
  EmprendimientoFormValues,
  Emprendimiento
>({
  fields: {
    nombre: stringField({
      required: true,
      maxLength: EMPRENDIMIENTO_VALIDATIONS.NOMBRE_MAX,
      defaultValue: "",
    }),
    descripcion: stringField({
      required: false,
      maxLength: EMPRENDIMIENTO_VALIDATIONS.DESCRIPCION_MAX,
      defaultValue: "",
    }),
    ubicacion: stringField({
      required: false,
      maxLength: EMPRENDIMIENTO_VALIDATIONS.UBICACION_MAX,
      defaultValue: "",
    }),
    estado: selectField({
      required: true,
      options: EMPRENDIMIENTO_ESTADO_CHOICES,
      defaultValue: "planificacion",
    }),
    fecha_inicio: stringField({
      required: false,
      defaultValue: "",
    }),
    fecha_fin_estimada: stringField({
      required: false,
      defaultValue: "",
    }),
  },
});
