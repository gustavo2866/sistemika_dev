import {
  createEntitySchema,
  numberField,
  referenceField,
  selectField,
  stringField,
} from "@/lib/form-detail-schema";

export const CRM_OPORTUNIDAD_ESTADOS = [
  "1-abierta",
  "2-visita",
  "3-cotiza",
  "4-reserva",
  "5-ganada",
  "6-perdida",
] as const;

export type CRMOportunidadEstado = (typeof CRM_OPORTUNIDAD_ESTADOS)[number];

export const CRM_OPORTUNIDAD_ESTADO_CHOICES = CRM_OPORTUNIDAD_ESTADOS.map(
  (estado) => ({
    id: estado,
    name: estado.replace("-", " "),
  }),
);

export const CRM_OPORTUNIDAD_ESTADO_BADGES: Record<CRMOportunidadEstado, string> =
  {
    "1-abierta": "bg-blue-100 text-blue-800",
    "2-visita": "bg-cyan-100 text-cyan-800",
    "3-cotiza": "bg-amber-100 text-amber-800",
    "4-reserva": "bg-violet-100 text-violet-800",
    "5-ganada": "bg-emerald-100 text-emerald-800",
    "6-perdida": "bg-rose-100 text-rose-800",
  };

export const formatEstadoOportunidad = (
  estado?: CRMOportunidadEstado | null,
) => {
  if (!estado) {
    return "Sin estado";
  }
  const found = CRM_OPORTUNIDAD_ESTADO_CHOICES.find(
    (choice) => choice.id === estado,
  );
  return found?.name ?? estado;
};

export const CRM_OPORTUNIDAD_VALIDATIONS = {
  DESCRIPCION_MAX: 1000,
} as const;

export type CRMOportunidad = {
  id: number;
  contacto_id: number;
  tipo_operacion_id: number;
  emprendimiento_id?: number | null;
  propiedad_id: number;
  estado: CRMOportunidadEstado;
  fecha_estado: string;
  motivo_perdida_id?: number | null;
  monto?: number | null;
  moneda_id?: number | null;
  condicion_pago_id?: number | null;
  probabilidad?: number | null;
  fecha_cierre_estimada?: string | null;
  responsable_id: number;
  descripcion_estado?: string | null;
  cotizacion_aplicada?: number | null;
};

export type CRMOportunidadFormValues = {
  contacto_id: number | null;
  tipo_operacion_id: number | null;
  emprendimiento_id?: number | null;
  propiedad_id: number | null;
  estado: CRMOportunidadEstado;
  fecha_estado?: string | null;
  motivo_perdida_id?: number | null;
  monto?: number | null;
  moneda_id?: number | null;
  condicion_pago_id?: number | null;
  probabilidad?: number | null;
  fecha_cierre_estimada?: string | null;
  responsable_id: number | null;
  descripcion_estado?: string | null;
  cotizacion_aplicada?: number | null;
};

export const CRM_OPORTUNIDAD_DEFAULTS: CRMOportunidadFormValues = {
  contacto_id: null,
  tipo_operacion_id: null,
  emprendimiento_id: null,
  propiedad_id: null,
  estado: "1-abierta",
  fecha_estado: "",
  motivo_perdida_id: null,
  monto: undefined,
  moneda_id: null,
  condicion_pago_id: null,
  probabilidad: undefined,
  fecha_cierre_estimada: "",
  responsable_id: null,
  descripcion_estado: "",
  cotizacion_aplicada: undefined,
};

export const crmOportunidadSchema = createEntitySchema<
  CRMOportunidadFormValues,
  CRMOportunidad
>({
  fields: {
    contacto_id: referenceField({
      required: true,
      resource: "crm/contactos",
      labelField: "nombre_completo",
    }),
    tipo_operacion_id: referenceField({
      required: true,
      resource: "crm/catalogos/tipos-operacion",
      labelField: "nombre",
    }),
    propiedad_id: referenceField({
      required: true,
      resource: "propiedades",
      labelField: "nombre",
    }),
    emprendimiento_id: referenceField({
      required: false,
      resource: "emprendimientos",
      labelField: "nombre",
    }),
    estado: selectField({
      required: true,
      options: CRM_OPORTUNIDAD_ESTADO_CHOICES,
      defaultValue: "1-abierta",
    }),
    fecha_estado: stringField({
      required: false,
      defaultValue: "",
    }),
    motivo_perdida_id: referenceField({
      required: false,
      resource: "crm/catalogos/motivos-perdida",
      labelField: "nombre",
    }),
    monto: numberField({
      required: false,
      min: 0,
    }),
    moneda_id: referenceField({
      required: false,
      resource: "monedas",
      labelField: "nombre",
    }),
    condicion_pago_id: referenceField({
      required: false,
      resource: "crm/catalogos/condiciones-pago",
      labelField: "nombre",
    }),
    probabilidad: numberField({
      required: false,
      min: 0,
      max: 100,
    }),
    fecha_cierre_estimada: stringField({
      required: false,
      defaultValue: "",
    }),
    responsable_id: referenceField({
      required: true,
      resource: "users",
      labelField: "nombre",
    }),
    descripcion_estado: stringField({
      required: false,
      maxLength: CRM_OPORTUNIDAD_VALIDATIONS.DESCRIPCION_MAX,
      defaultValue: "",
    }),
    cotizacion_aplicada: numberField({
      required: false,
      min: 0,
    }),
  },
});
