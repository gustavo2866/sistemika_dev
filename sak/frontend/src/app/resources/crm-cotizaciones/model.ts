import {
  createEntitySchema,
  numberField,
  referenceField,
  stringField,
} from "@/lib/form-detail-schema";

export const CRM_COTIZACION_VALIDATIONS = {
  FUENTE_MAX: 100,
} as const;

export type CRMCotizacion = {
  id: number;
  moneda_origen_id: number;
  moneda_destino_id: number;
  tipo_cambio: number;
  fecha_vigencia: string;
  fuente?: string | null;
};

export type CRMCotizacionFormValues = {
  moneda_origen_id: number | null;
  moneda_destino_id: number | null;
  tipo_cambio: number;
  fecha_vigencia: string;
  fuente?: string | null;
};

export const CRM_COTIZACION_DEFAULTS: CRMCotizacionFormValues = {
  moneda_origen_id: null,
  moneda_destino_id: null,
  tipo_cambio: 0,
  fecha_vigencia: "",
  fuente: "",
};

export const crmCotizacionSchema = createEntitySchema<
  CRMCotizacionFormValues,
  CRMCotizacion
>({
  fields: {
    moneda_origen_id: referenceField({
      required: true,
      resource: "monedas",
      labelField: "nombre",
    }),
    moneda_destino_id: referenceField({
      required: true,
      resource: "monedas",
      labelField: "nombre",
    }),
    tipo_cambio: numberField({
      required: true,
      min: 0,
    }),
    fecha_vigencia: stringField({
      required: true,
      defaultValue: "",
    }),
    fuente: stringField({
      required: false,
      maxLength: CRM_COTIZACION_VALIDATIONS.FUENTE_MAX,
      defaultValue: "",
    }),
  },
});
