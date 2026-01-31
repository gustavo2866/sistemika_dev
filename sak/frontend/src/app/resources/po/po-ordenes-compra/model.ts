import {
  createDetailSchema,
  createEntitySchema,
  numberField,
  referenceField,
  selectField,
  stringField,
} from "@/lib/form-detail-schema";
import { getArticuloFilterByTipo } from "../shared/po-utils";

export const ESTADO_CHOICES = [
  { id: "borrador", name: "Borrador" },
  { id: "emitida", name: "Emitida" },
  { id: "aprobada", name: "Aprobada" },
  { id: "rechazada", name: "Rechazada" },
  { id: "recibida", name: "Recibida" },
  { id: "cerrada", name: "Cerrada" },
  { id: "anulada", name: "Anulada" },
];

export const TIPO_COMPRA_CHOICES = [
  { id: "directa", name: "Directa" },
  { id: "normal", name: "Normal" },
];

export const UNIDAD_MEDIDA_CHOICES = [
  { id: "UN", name: "Unidad" },
  { id: "KG", name: "Kilogramo" },
  { id: "LT", name: "Litro" },
  { id: "MT", name: "Metro" },
  { id: "M2", name: "Metro2" },
  { id: "M3", name: "Metro3" },
  { id: "CAJA", name: "Caja" },
  { id: "PAQUETE", name: "Paquete" },
];

export const VALIDATION_RULES = {
  DETALLE: {
    MIN_ITEMS: 1,
    MIN_CANTIDAD: 0,
    MAX_DESCRIPCION_LENGTH: 500,
  },
  GENERAL: {
    MAX_OBSERVACIONES_LENGTH: 1000,
  },
} as const;

export const PROVEEDORES_REFERENCE = {
  resource: "proveedores",
  labelField: "nombre",
  limit: 100,
  staleTime: 5 * 60 * 1000,
} as const;

export const ARTICULOS_REFERENCE = {
  resource: "articulos",
  labelField: "nombre",
  limit: 800,
  staleTime: 5 * 60 * 1000,
} as const;

export const PO_SOLICITUDES_REFERENCE = {
  resource: "po-solicitudes",
  labelField: "titulo",
  limit: 100,
  staleTime: 5 * 60 * 1000,
} as const;

export const USERS_REFERENCE = {
  resource: "users",
  labelField: "nombre",
} as const;

export const METODOS_PAGO_REFERENCE = {
  resource: "metodos-pago",
  labelField: "nombre",
  limit: 100,
  staleTime: 5 * 60 * 1000,
} as const;

export const CENTROS_COSTO_REFERENCE = {
  resource: "centros-costo",
  labelField: "nombre",
  limit: 100,
  staleTime: 5 * 60 * 1000,
  filter: { activo: true },
} as const;

export const DEPARTAMENTOS_REFERENCE = {
  resource: "departamentos",
  labelField: "nombre",
  limit: 50,
  staleTime: 10 * 60 * 1000,
} as const;

export const TIPOS_SOLICITUD_REFERENCE = {
  resource: "tipos-solicitud",
  labelField: "nombre",
  limit: 50,
  staleTime: 10 * 60 * 1000,
} as const;

export type DetalleFormValues = {
  articulo_id: string;
  po_solicitud_id: string;
  oportunidad_id: string;
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  porcentaje_descuento: number;
  importe_descuento: number;
  porcentaje_iva: number;
  importe_iva: number;
  total_linea: number;
  centro_costo_id: string;
};

export type PoOrdenCompraDetalle = {
  id?: number;
  tempId?: number;
  articulo_id?: number | null;
  po_solicitud_id?: number | null;
  oportunidad_id?: number | null;
  descripcion: string;
  unidad_medida?: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  porcentaje_descuento?: number | null;
  importe_descuento?: number | null;
  porcentaje_iva: number;
  importe_iva: number;
  total_linea: number;
  cantidad_recibida?: number;
  cantidad_facturada?: number;
  centro_costo_id?: number | null;
};

export type PoOrdenCompraWizardPayload = Partial<PoOrdenCompra> & {
  detalles?: PoOrdenCompraDetalle[];
};

export type PoOrdenCompra = {
  id?: number;
  titulo: string;
  estado: string;
  tipo_compra?: string | null;
  observaciones?: string | null;
  fecha?: string | null;
  fecha_estado?: string | null;
  subtotal: number;
  total_impuestos: number;
  total: number;
  proveedor_id: number;
  usuario_responsable_id: number;
  metodo_pago_id: number;
  centro_costo_id?: number | null;
  tipo_solicitud_id?: number | null;
  departamento_id?: number | null;
  detalles: PoOrdenCompraDetalle[];

  proveedor?: {
    id: number;
    nombre: string;
  };
  usuario_responsable?: {
    id: number;
    nombre: string;
  };
  metodo_pago?: {
    id: number;
    nombre: string;
  };
  centro_costo?: {
    id: number;
    nombre: string;
    tipo?: string;
    codigo_contable?: string;
  };
  tipo_solicitud?: {
    id: number;
    nombre: string;
  };
  departamento?: {
    id: number;
    nombre: string;
  };
};

export type PoOrdenCompraCabeceraFormValues = {
  titulo: string;
  estado: string;
  tipo_compra: string;
  fecha: string;
  fecha_estado: string;
  proveedor_id: string;
  usuario_responsable_id: string;
  metodo_pago_id: string;
  centro_costo_id: string;
  tipo_solicitud_id: string;
  departamento_id: string;
  observaciones: string;
};

export const poOrdenCompraDetalleSchema = createDetailSchema<
  DetalleFormValues,
  PoOrdenCompraDetalle
>({
  fields: {
    articulo_id: referenceField({
      resource: ARTICULOS_REFERENCE.resource,
      labelField: ARTICULOS_REFERENCE.labelField,
      required: true,
      defaultValue: "",
    }),
    po_solicitud_id: referenceField({
      resource: PO_SOLICITUDES_REFERENCE.resource,
      labelField: PO_SOLICITUDES_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
    oportunidad_id: referenceField({
      resource: "crm/oportunidades",
      labelField: "titulo",
      required: false,
      defaultValue: "",
    }),
    descripcion: stringField({
      required: true,
      trim: true,
      maxLength: VALIDATION_RULES.DETALLE.MAX_DESCRIPCION_LENGTH,
      defaultValue: "",
    }),
    unidad_medida: selectField({
      required: true,
      options: UNIDAD_MEDIDA_CHOICES,
      defaultValue: "UN",
    }),
    cantidad: numberField({
      required: true,
      min: VALIDATION_RULES.DETALLE.MIN_CANTIDAD + 1,
      defaultValue: 1,
    }),
    precio_unitario: numberField({
      required: true,
      min: 0,
      defaultValue: 0,
    }),
    subtotal: numberField({
      required: true,
      min: 0,
      defaultValue: 0,
    }),
    porcentaje_descuento: numberField({
      required: false,
      min: 0,
      max: 100,
      defaultValue: 0,
    }),
    importe_descuento: numberField({
      required: false,
      min: 0,
      defaultValue: 0,
    }),
    porcentaje_iva: numberField({
      required: true,
      min: 0,
      max: 100,
      defaultValue: 0,
    }),
    importe_iva: numberField({
      required: true,
      min: 0,
      defaultValue: 0,
    }),
    total_linea: numberField({
      required: true,
      min: 0,
      defaultValue: 0,
    }),
    centro_costo_id: referenceField({
      resource: CENTROS_COSTO_REFERENCE.resource,
      labelField: CENTROS_COSTO_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
  },
});

export const poOrdenCompraCabeceraSchema = createEntitySchema<
  PoOrdenCompraCabeceraFormValues,
  Pick<
    PoOrdenCompra,
    | "titulo"
    | "estado"
    | "tipo_compra"
    | "fecha"
    | "fecha_estado"
    | "proveedor_id"
    | "usuario_responsable_id"
    | "metodo_pago_id"
    | "centro_costo_id"
    | "tipo_solicitud_id"
    | "departamento_id"
    | "observaciones"
  >
>({
  fields: {
    titulo: stringField({
      required: true,
      trim: true,
      maxLength: 50,
      defaultValue: "",
    }),
    estado: selectField({
      required: true,
      options: ESTADO_CHOICES,
      defaultValue: "borrador",
    }),
    tipo_compra: selectField({
      required: true,
      options: TIPO_COMPRA_CHOICES,
      defaultValue: "normal",
    }),
    fecha: stringField({
      required: false,
      defaultValue: "",
    }),
    fecha_estado: stringField({
      required: false,
      defaultValue: "",
    }),
    proveedor_id: referenceField({
      resource: PROVEEDORES_REFERENCE.resource,
      labelField: PROVEEDORES_REFERENCE.labelField,
      required: true,
      defaultValue: "",
    }),
    usuario_responsable_id: referenceField({
      resource: USERS_REFERENCE.resource,
      labelField: USERS_REFERENCE.labelField,
      required: true,
      defaultValue: "",
    }),
    metodo_pago_id: referenceField({
      resource: METODOS_PAGO_REFERENCE.resource,
      labelField: METODOS_PAGO_REFERENCE.labelField,
      required: true,
      defaultValue: "1",
    }),
    centro_costo_id: referenceField({
      resource: CENTROS_COSTO_REFERENCE.resource,
      labelField: CENTROS_COSTO_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
    tipo_solicitud_id: referenceField({
      resource: TIPOS_SOLICITUD_REFERENCE.resource,
      labelField: TIPOS_SOLICITUD_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
    departamento_id: referenceField({
      resource: DEPARTAMENTOS_REFERENCE.resource,
      labelField: DEPARTAMENTOS_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
    observaciones: stringField({
      trim: true,
      maxLength: VALIDATION_RULES.GENERAL.MAX_OBSERVACIONES_LENGTH,
      defaultValue: "",
    }),
  },
});

export const PoOrdenCompraModel = {
  ESTADO_CHOICES,
  TIPO_COMPRA_CHOICES,
  UNIDAD_MEDIDA_CHOICES,
  VALIDATION_RULES,
  PROVEEDORES_REFERENCE,
  ARTICULOS_REFERENCE,
  PO_SOLICITUDES_REFERENCE,
  USERS_REFERENCE,
  METODOS_PAGO_REFERENCE,
  CENTROS_COSTO_REFERENCE,
  DEPARTAMENTOS_REFERENCE,
  TIPOS_SOLICITUD_REFERENCE,
  poOrdenCompraDetalleSchema,
  poOrdenCompraCabeceraSchema,
} as const;

export { getArticuloFilterByTipo };
