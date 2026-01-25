import { createEntitySchema, referenceField, stringField } from "@/lib/form-detail-schema";

export const PROVEEDOR_VALIDATIONS = {
  NOMBRE_MAX: 255,
  RAZON_SOCIAL_MAX: 255,
  CUIT_MAX: 15,
  TELEFONO_MAX: 20,
  EMAIL_MAX: 255,
  DIRECCION_MAX: 500,
  CBU_MAX: 22,
  ALIAS_BANCARIO_MAX: 100,
} as const;

export const CONCEPTOS_REFERENCE = {
  resource: "api/v1/adm/conceptos",
  labelField: "nombre",
  limit: 200,
  staleTime: 5 * 60 * 1000,
} as const;

export const TIPOS_SOLICITUD_REFERENCE = {
  resource: "tipos-solicitud",
  labelField: "nombre",
  limit: 50,
  staleTime: 10 * 60 * 1000,
} as const;

export const DEPARTAMENTOS_REFERENCE = {
  resource: "departamentos",
  labelField: "nombre",
  limit: 50,
  staleTime: 10 * 60 * 1000,
} as const;

export const METODOS_PAGO_REFERENCE = {
  resource: "metodos-pago",
  labelField: "nombre",
  limit: 100,
  staleTime: 5 * 60 * 1000,
} as const;

export const ARTICULOS_REFERENCE = {
  resource: "articulos",
  labelField: "nombre",
  limit: 100,
  staleTime: 5 * 60 * 1000,
} as const;

export const USERS_REFERENCE = {
  resource: "users",
  labelField: "nombre",
} as const;

export type Proveedor = {
  id: number;
  nombre: string;
  razon_social: string;
  cuit: string;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  cbu?: string | null;
  alias_bancario?: string | null;
  concepto_id?: number | null;
  default_tipo_solicitud_id?: number | null;
  default_departamento_id?: number | null;
  default_metodo_pago_id?: number | null;
  default_usuario_responsable_id?: number | null;
  default_articulos_id?: number | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  concepto?: {
    id: number;
    nombre: string;
  };
};

export type ProveedorFormValues = {
  nombre: string;
  razon_social: string;
  cuit: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  cbu?: string;
  alias_bancario?: string;
  concepto_id?: string;
  default_tipo_solicitud_id?: string;
  default_departamento_id?: string;
  default_metodo_pago_id?: string;
  default_usuario_responsable_id?: string;
  default_articulos_id?: string;
  activo: boolean;
};

export const proveedorSchema = createEntitySchema<
  ProveedorFormValues,
  Omit<Proveedor, "id" | "created_at" | "updated_at" | "concepto">
>({
  fields: {
    nombre: stringField({
      required: true,
      maxLength: PROVEEDOR_VALIDATIONS.NOMBRE_MAX,
      defaultValue: "",
    }),
    razon_social: stringField({
      required: true,
      maxLength: PROVEEDOR_VALIDATIONS.RAZON_SOCIAL_MAX,
      defaultValue: "",
    }),
    cuit: stringField({
      required: true,
      maxLength: PROVEEDOR_VALIDATIONS.CUIT_MAX,
      defaultValue: "",
    }),
    telefono: stringField({
      required: false,
      maxLength: PROVEEDOR_VALIDATIONS.TELEFONO_MAX,
      defaultValue: "",
    }),
    email: stringField({
      required: false,
      maxLength: PROVEEDOR_VALIDATIONS.EMAIL_MAX,
      defaultValue: "",
    }),
    direccion: stringField({
      required: false,
      maxLength: PROVEEDOR_VALIDATIONS.DIRECCION_MAX,
      defaultValue: "",
    }),
    cbu: stringField({
      required: false,
      maxLength: PROVEEDOR_VALIDATIONS.CBU_MAX,
      defaultValue: "",
    }),
    alias_bancario: stringField({
      required: false,
      maxLength: PROVEEDOR_VALIDATIONS.ALIAS_BANCARIO_MAX,
      defaultValue: "",
    }),
    concepto_id: referenceField({
      resource: CONCEPTOS_REFERENCE.resource,
      labelField: CONCEPTOS_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
    default_tipo_solicitud_id: referenceField({
      resource: TIPOS_SOLICITUD_REFERENCE.resource,
      labelField: TIPOS_SOLICITUD_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
    default_departamento_id: referenceField({
      resource: DEPARTAMENTOS_REFERENCE.resource,
      labelField: DEPARTAMENTOS_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
    default_metodo_pago_id: referenceField({
      resource: METODOS_PAGO_REFERENCE.resource,
      labelField: METODOS_PAGO_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
    default_usuario_responsable_id: referenceField({
      resource: USERS_REFERENCE.resource,
      labelField: USERS_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
    default_articulos_id: referenceField({
      resource: ARTICULOS_REFERENCE.resource,
      labelField: ARTICULOS_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
  },
});

export const PROVEEDOR_DEFAULT: ProveedorFormValues = {
  nombre: "",
  razon_social: "",
  cuit: "",
  telefono: "",
  email: "",
  direccion: "",
  cbu: "",
  alias_bancario: "",
  concepto_id: "",
  default_tipo_solicitud_id: "",
  default_departamento_id: "",
  default_metodo_pago_id: "",
  default_usuario_responsable_id: "",
  default_articulos_id: "",
  activo: true,
};
