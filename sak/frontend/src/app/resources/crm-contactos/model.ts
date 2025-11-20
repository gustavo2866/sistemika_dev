import {
  createEntitySchema,
  referenceField,
  stringField,
} from "@/lib/form-detail-schema";

export const CRM_CONTACTO_VALIDATIONS = {
  NOMBRE_MAX: 255,
  EMAIL_MAX: 255,
  RED_SOCIAL_MAX: 255,
  NOTAS_MAX: 1000,
} as const;

export type CRMContacto = {
  id: number;
  nombre_completo: string;
  telefonos: string[];
  email?: string | null;
  red_social?: string | null;
  origen_lead_id?: number | null;
  origen_lead_nombre?: string | null;
  responsable_id: number;
  responsable_nombre?: string | null;
  notas?: string | null;
};

export type CRMContactoFormValues = {
  nombre_completo: string;
  telefonos: string[];
  email?: string | null;
  red_social?: string | null;
  origen_lead_id?: number | null;
  responsable_id: number | null;
  notas?: string | null;
};

export const CRM_CONTACTO_DEFAULTS: CRMContactoFormValues = {
  nombre_completo: "",
  telefonos: [],
  email: "",
  red_social: "",
  origen_lead_id: null,
  responsable_id: null,
  notas: "",
};

export const crmContactoSchema = createEntitySchema<
  CRMContactoFormValues,
  CRMContacto
>({
  fields: {
    nombre_completo: stringField({
      required: true,
      maxLength: CRM_CONTACTO_VALIDATIONS.NOMBRE_MAX,
      defaultValue: "",
    }),
    email: stringField({
      required: false,
      maxLength: CRM_CONTACTO_VALIDATIONS.EMAIL_MAX,
      defaultValue: "",
    }),
    red_social: stringField({
      required: false,
      maxLength: CRM_CONTACTO_VALIDATIONS.RED_SOCIAL_MAX,
      defaultValue: "",
    }),
    origen_lead_id: referenceField({
      required: false,
      resource: "crm/catalogos/origenes-lead",
      labelField: "nombre",
    }),
    responsable_id: referenceField({
      required: true,
      resource: "users",
      labelField: "nombre",
    }),
    notas: stringField({
      required: false,
      maxLength: CRM_CONTACTO_VALIDATIONS.NOTAS_MAX,
      defaultValue: "",
    }),
  },
});
