import {
  createEntitySchema,
  referenceField,
  selectField,
  stringField,
} from "@/lib/form-detail-schema";

export const CRM_EVENTO_ESTADOS = ["pendiente", "hecho"] as const;

export type CRMEventoEstado = (typeof CRM_EVENTO_ESTADOS)[number];

export const CRM_EVENTO_ESTADO_CHOICES = CRM_EVENTO_ESTADOS.map((estado) => ({
  id: estado,
  name: estado.charAt(0).toUpperCase() + estado.slice(1),
}));

export const CRM_EVENTO_VALIDATIONS = {
  DESCRIPCION_MAX: 2000,
  PROXIMO_PASO_MAX: 500,
} as const;

export type CRMEvento = {
  id: number;
  contacto_id: number;
  tipo_id: number;
  motivo_id: number;
  fecha_evento: string;
  descripcion: string;
  asignado_a_id: number;
  oportunidad_id?: number | null;
  origen_lead_id?: number | null;
  proximo_paso?: string | null;
  fecha_compromiso?: string | null;
  estado_evento: CRMEventoEstado;
  tipo?: { nombre?: string } | null;
  motivo?: { nombre?: string } | null;
};

export type CRMEventoFormValues = {
  contacto_id: number | null;
  tipo_id: number | null;
  motivo_id: number | null;
  fecha_evento: string;
  descripcion: string;
  asignado_a_id: number | null;
  oportunidad_id?: number | null;
  origen_lead_id?: number | null;
  proximo_paso?: string | null;
  fecha_compromiso?: string | null;
  estado_evento: CRMEventoEstado;
};

export const CRM_EVENTO_DEFAULTS: CRMEventoFormValues = {
  contacto_id: null,
  tipo_id: null,
  motivo_id: null,
  fecha_evento: "",
  descripcion: "",
  asignado_a_id: null,
  oportunidad_id: null,
  origen_lead_id: null,
  proximo_paso: "",
  fecha_compromiso: "",
  estado_evento: "pendiente",
};

export const crmEventoSchema = createEntitySchema<
  CRMEventoFormValues,
  CRMEvento
>({
  fields: {
    contacto_id: referenceField({
      required: true,
      resource: "crm/contactos",
      labelField: "nombre_completo",
    }),
    tipo_id: referenceField({
      required: true,
      resource: "crm/catalogos/tipos-evento",
      labelField: "nombre",
    }),
    motivo_id: referenceField({
      required: true,
      resource: "crm/catalogos/motivos-evento",
      labelField: "nombre",
    }),
    fecha_evento: stringField({
      required: true,
      defaultValue: "",
    }),
    descripcion: stringField({
      required: true,
      maxLength: CRM_EVENTO_VALIDATIONS.DESCRIPCION_MAX,
      defaultValue: "",
    }),
    asignado_a_id: referenceField({
      required: true,
      resource: "users",
      labelField: "nombre",
    }),
    oportunidad_id: referenceField({
      required: false,
      resource: "crm/oportunidades",
      labelField: "id",
    }),
    origen_lead_id: referenceField({
      required: false,
      resource: "crm/catalogos/origenes-lead",
      labelField: "nombre",
    }),
    proximo_paso: stringField({
      required: false,
      maxLength: CRM_EVENTO_VALIDATIONS.PROXIMO_PASO_MAX,
      defaultValue: "",
    }),
    fecha_compromiso: stringField({
      required: false,
      defaultValue: "",
    }),
    estado_evento: selectField({
      required: true,
      options: CRM_EVENTO_ESTADO_CHOICES,
      defaultValue: "pendiente",
    }),
  },
});
