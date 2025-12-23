import {
  createEntitySchema,
  referenceField,
  selectField,
  stringField,
} from "@/lib/form-detail-schema";

export const CRM_EVENTO_ESTADOS = ["1-pendiente", "2-realizado", "3-cancelado", "4-reagendar"] as const;

export type CRMEventoEstado = (typeof CRM_EVENTO_ESTADOS)[number];

export const CRM_EVENTO_ESTADO_CHOICES = CRM_EVENTO_ESTADOS.map((estado) => ({
  id: estado,
  name: estado.split('-')[1].charAt(0).toUpperCase() + estado.split('-')[1].slice(1),
}));

export const CRM_EVENTO_TIPO_CHOICES = [
  { id: "llamada", name: "Llamada" },
  { id: "reunion", name: "Reunion" },
  { id: "visita", name: "Visita" },
  { id: "email", name: "Email" },
  { id: "whatsapp", name: "WhatsApp" },
  { id: "nota", name: "Nota" },
];

export const CRM_EVENTO_VALIDATIONS = {
  DESCRIPCION_MAX: 2000,
  PROXIMO_PASO_MAX: 500,
} as const;

export type CRMEvento = {
  id: number;
  oportunidad_id: number;
  contacto_id?: number | null;
  tipo_id: number;
  motivo_id?: number | null;
  tipo_evento?: string | null;
  titulo: string;
  descripcion?: string | null;
  fecha_evento: string;
  estado_evento: CRMEventoEstado;
  asignado_a_id: number;
  resultado?: string | null;
  fecha_estado?: string | null;
  tipo_catalogo?: { id?: number; codigo?: string; nombre?: string } | null;
  oportunidad?: {
    id?: number;
    estado?: string;
    titulo?: string | null;
    descripcion_estado?: string;
    contacto_id?: number;
    propiedad_id?: number;
    contacto?: { id?: number; nombre?: string; nombre_completo?: string } | null;
  } | null;
  asignado_a?: { id?: number; nombre?: string } | null;
};

export type CRMEventoFormValues = {
  oportunidad_id: number | null;
  tipo_id: number | null;
  titulo: string;
  descripcion?: string | null;
  fecha_evento: string;
  estado_evento: CRMEventoEstado;
  asignado_a_id: number | null;
  resultado?: string | null;
};

export const CRM_EVENTO_DEFAULTS: CRMEventoFormValues = {
  oportunidad_id: null,
  tipo_id: null,
  titulo: "",
  descripcion: "",
  fecha_evento: "",
  estado_evento: "1-pendiente",
  asignado_a_id: null,
  resultado: "",
};

export const crmEventoSchema = createEntitySchema<
  CRMEventoFormValues,
  CRMEvento
>({
  fields: {
    oportunidad_id: referenceField({
      required: true,
      resource: "crm/oportunidades",
      labelField: "id",
    }),
    titulo: stringField({
      required: true,
      maxLength: 255,
      defaultValue: "",
    }),
    descripcion: stringField({
      required: false,
      maxLength: CRM_EVENTO_VALIDATIONS.DESCRIPCION_MAX,
      defaultValue: "",
    }),
    tipo_id: referenceField({
      required: true,
      resource: "crm/catalogos/tipos-evento",
      labelField: "nombre",
      defaultValue: null,
    }),
    fecha_evento: stringField({
      required: true,
      defaultValue: "",
    }),
    estado_evento: selectField({
      required: true,
      options: CRM_EVENTO_ESTADO_CHOICES,
      defaultValue: "1-pendiente",
    }),
    asignado_a_id: referenceField({
      required: true,
      resource: "users",
      labelField: "nombre",
    }),
    resultado: stringField({
      required: false,
      maxLength: CRM_EVENTO_VALIDATIONS.DESCRIPCION_MAX,
      defaultValue: "",
    }),
  },
});
