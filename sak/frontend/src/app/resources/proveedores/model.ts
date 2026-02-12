import { z } from "zod";

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

export const TIPOS_COMPROBANTE_REFERENCE = {
  resource: "tipos-comprobante",
  labelField: "name",
  limit: 100,
  staleTime: 10 * 60 * 1000,
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
  tipo_comprobante_id?: number | null;
  dias_vencimiento?: number | null;
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
  tipo_comprobante?: {
    id: number;
    name: string;
  };
};

const optionalId = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

const optionalString = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional(),
);

const optionalNumber = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().int().min(0).optional(),
);

const booleanFromInput = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  if (value == null || value === "") return false;
  return Boolean(value);
}, z.boolean());

export const proveedorSchema = z.object({
  nombre: z.string().min(1).max(PROVEEDOR_VALIDATIONS.NOMBRE_MAX),
  razon_social: z.string().min(1).max(PROVEEDOR_VALIDATIONS.RAZON_SOCIAL_MAX),
  cuit: z.string().min(1).max(PROVEEDOR_VALIDATIONS.CUIT_MAX),
  telefono: optionalString.pipe(
    z.string().max(PROVEEDOR_VALIDATIONS.TELEFONO_MAX).optional(),
  ),
  email: optionalString.pipe(
    z.string().email().max(PROVEEDOR_VALIDATIONS.EMAIL_MAX).optional(),
  ),
  direccion: optionalString.pipe(
    z.string().max(PROVEEDOR_VALIDATIONS.DIRECCION_MAX).optional(),
  ),
  cbu: optionalString.pipe(
    z.string().max(PROVEEDOR_VALIDATIONS.CBU_MAX).optional(),
  ),
  alias_bancario: optionalString.pipe(
    z.string().max(PROVEEDOR_VALIDATIONS.ALIAS_BANCARIO_MAX).optional(),
  ),
  concepto_id: optionalId,
  tipo_comprobante_id: optionalId,
  dias_vencimiento: optionalNumber,
  default_tipo_solicitud_id: optionalId,
  default_departamento_id: optionalId,
  default_metodo_pago_id: optionalId,
  default_usuario_responsable_id: optionalId,
  default_articulos_id: optionalId,
  activo: booleanFromInput,
});

export type ProveedorFormValues = z.infer<typeof proveedorSchema>;

export const PROVEEDOR_DEFAULT: Partial<ProveedorFormValues> = {
  nombre: "",
  razon_social: "",
  cuit: "",
  telefono: "",
  email: "",
  direccion: "",
  cbu: "",
  alias_bancario: "",
  concepto_id: "",
  tipo_comprobante_id: "",
  dias_vencimiento: "",
  default_tipo_solicitud_id: "",
  default_departamento_id: "",
  default_metodo_pago_id: "",
  default_usuario_responsable_id: "",
  default_articulos_id: "",
  activo: true,
};
