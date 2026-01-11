import {
  createDetailSchema,
  createEntitySchema,
  numberField,
  referenceField,
  selectField,
  stringField,
} from "@/lib/form-detail-schema";

export const ESTADO_CHOICES = [
  { id: "pendiente", name: "Pendiente" },
  { id: "procesada", name: "Procesada" },
  { id: "aprobada", name: "Aprobada" },
  { id: "rechazada", name: "Rechazada" },
  { id: "pagada", name: "Pagada" },
  { id: "anulada", name: "Anulada" },
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
  IMPUESTO: {
    MAX_DESCRIPCION_LENGTH: 255,
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

export const TIPOS_SOLICITUD_REFERENCE = {
  resource: "tipos-solicitud",
  labelField: "nombre",
  limit: 50,
  staleTime: 10 * 60 * 1000,
} as const;

export const TIPOS_COMPROBANTE_REFERENCE = {
  resource: "tipos-comprobante",
  labelField: "name",
  limit: 100,
  staleTime: 10 * 60 * 1000,
} as const;

export const COMPROBANTES_REFERENCE = {
  resource: "comprobantes",
  labelField: "numero",
  limit: 200,
  staleTime: 10 * 60 * 1000,
} as const;

export type DetalleFormValues = {
  articulo_id: string;
  codigo_producto: string;
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
  orden: number;
  centro_costo_id: string;
};

export type ImpuestoFormValues = {
  tipo_impuesto: string;
  descripcion: string;
  base_imponible: number;
  porcentaje: number;
  importe: number;
  es_retencion: string;
  es_percepcion: string;
  codigo_afip: string;
  numero_certificado: string;
};

export type PoFacturaDetalle = {
  id?: number;
  tempId?: number;
  articulo_id?: number | null;
  codigo_producto?: string | null;
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
  orden: number;
  centro_costo_id?: number | null;
};

export type PoFacturaImpuesto = {
  id?: number;
  tempId?: number;
  tipo_impuesto: string;
  descripcion: string;
  base_imponible: number;
  porcentaje: number;
  importe: number;
  es_retencion: boolean;
  es_percepcion: boolean;
  codigo_afip?: string | null;
  numero_certificado?: string | null;
};

export type PoFactura = {
  id?: number;
  numero: string;
  punto_venta: string;
  id_tipocomprobante: number;
  fecha_emision: string;
  fecha_vencimiento?: string | null;
  subtotal: number;
  total_impuestos: number;
  total: number;
  estado: string;
  observaciones?: string | null;
  nombre_archivo_pdf?: string | null;
  ruta_archivo_pdf?: string | null;
  comprobante_id?: number | null;
  proveedor_id: number;
  usuario_responsable_id: number;
  metodo_pago_id: number;
  centro_costo_id?: number | null;
  tipo_solicitud_id?: number | null;
  detalles: PoFacturaDetalle[];
  impuestos: PoFacturaImpuesto[];

  proveedor?: { id: number; nombre: string };
  usuario_responsable?: { id: number; nombre: string };
  metodo_pago?: { id: number; nombre: string };
  centro_costo?: { id: number; nombre: string };
  tipo_solicitud?: { id: number; nombre: string };
};

export type PoFacturaCabeceraFormValues = {
  numero: string;
  punto_venta: string;
  id_tipocomprobante: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: string;
  proveedor_id: string;
  usuario_responsable_id: string;
  metodo_pago_id: string;
  centro_costo_id: string;
  tipo_solicitud_id: string;
  comprobante_id: string;
  observaciones: string;
  nombre_archivo_pdf: string;
  ruta_archivo_pdf: string;
};

export const poFacturaDetalleSchema = createDetailSchema<
  DetalleFormValues,
  PoFacturaDetalle
>({
  fields: {
    articulo_id: referenceField({
      resource: ARTICULOS_REFERENCE.resource,
      labelField: ARTICULOS_REFERENCE.labelField,
      required: true,
      defaultValue: "",
    }),
    codigo_producto: stringField({
      maxLength: 50,
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
    orden: numberField({
      required: true,
      min: 1,
      defaultValue: 1,
    }),
    centro_costo_id: referenceField({
      resource: CENTROS_COSTO_REFERENCE.resource,
      labelField: CENTROS_COSTO_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
  },
});

export const poFacturaImpuestoSchema = createDetailSchema<
  ImpuestoFormValues,
  PoFacturaImpuesto
>({
  fields: {
    tipo_impuesto: stringField({
      required: true,
      trim: true,
      maxLength: 50,
      defaultValue: "",
    }),
    descripcion: stringField({
      required: true,
      trim: true,
      maxLength: VALIDATION_RULES.IMPUESTO.MAX_DESCRIPCION_LENGTH,
      defaultValue: "",
    }),
    base_imponible: numberField({
      required: true,
      min: 0,
      defaultValue: 0,
    }),
    porcentaje: numberField({
      required: true,
      min: 0,
      max: 100,
      defaultValue: 0,
    }),
    importe: numberField({
      required: true,
      min: 0,
      defaultValue: 0,
    }),
    es_retencion: selectField({
      required: false,
      options: [
        { id: "true", name: "Si" },
        { id: "false", name: "No" },
      ],
      defaultValue: "false",
    }),
    es_percepcion: selectField({
      required: false,
      options: [
        { id: "true", name: "Si" },
        { id: "false", name: "No" },
      ],
      defaultValue: "false",
    }),
    codigo_afip: stringField({
      required: false,
      maxLength: 20,
      defaultValue: "",
    }),
    numero_certificado: stringField({
      required: false,
      maxLength: 50,
      defaultValue: "",
    }),
  },
  toForm: (detalle) => ({
    tipo_impuesto: detalle.tipo_impuesto ?? "",
    descripcion: detalle.descripcion ?? "",
    base_imponible: detalle.base_imponible ?? 0,
    porcentaje: detalle.porcentaje ?? 0,
    importe: detalle.importe ?? 0,
    es_retencion: detalle.es_retencion ? "true" : "false",
    es_percepcion: detalle.es_percepcion ? "true" : "false",
    codigo_afip: detalle.codigo_afip ?? "",
    numero_certificado: detalle.numero_certificado ?? "",
  }),
  toModel: (values) => {
    const errors: Record<string, string> = {};
    const tipoImpuesto = String(values.tipo_impuesto ?? "").trim();
    const descripcion = String(values.descripcion ?? "").trim();
    const baseImponible = Number(values.base_imponible ?? 0);
    const porcentaje = Number(values.porcentaje ?? 0);
    const importe = Number(values.importe ?? 0);

    if (!tipoImpuesto) {
      errors.tipo_impuesto = "Campo requerido";
    }
    if (!descripcion) {
      errors.descripcion = "Campo requerido";
    }
    if (!Number.isFinite(baseImponible) || baseImponible < 0) {
      errors.base_imponible = "Debe ser un numero valido";
    }
    if (!Number.isFinite(porcentaje) || porcentaje < 0) {
      errors.porcentaje = "Debe ser un numero valido";
    }
    if (!Number.isFinite(importe) || importe < 0) {
      errors.importe = "Debe ser un numero valido";
    }

    if (Object.keys(errors).length > 0) {
      throw { errors };
    }

    return {
      tipo_impuesto: tipoImpuesto,
      descripcion,
      base_imponible: baseImponible,
      porcentaje,
      importe,
      es_retencion: String(values.es_retencion ?? "false") === "true",
      es_percepcion: String(values.es_percepcion ?? "false") === "true",
      codigo_afip: values.codigo_afip ? String(values.codigo_afip) : null,
      numero_certificado: values.numero_certificado
        ? String(values.numero_certificado)
        : null,
    };
  },
});

export const poFacturaCabeceraSchema = createEntitySchema<
  PoFacturaCabeceraFormValues,
  Pick<
    PoFactura,
    | "numero"
    | "punto_venta"
    | "id_tipocomprobante"
    | "fecha_emision"
    | "fecha_vencimiento"
    | "estado"
    | "proveedor_id"
    | "usuario_responsable_id"
    | "metodo_pago_id"
    | "centro_costo_id"
    | "tipo_solicitud_id"
    | "comprobante_id"
    | "observaciones"
    | "nombre_archivo_pdf"
    | "ruta_archivo_pdf"
  >
>({
  fields: {
    numero: stringField({
      required: true,
      trim: true,
      maxLength: 50,
      defaultValue: "",
    }),
    punto_venta: stringField({
      required: true,
      trim: true,
      maxLength: 10,
      defaultValue: "",
    }),
    id_tipocomprobante: referenceField({
      resource: TIPOS_COMPROBANTE_REFERENCE.resource,
      labelField: TIPOS_COMPROBANTE_REFERENCE.labelField,
      required: true,
      defaultValue: "",
    }),
    fecha_emision: stringField({
      required: true,
      defaultValue: "",
    }),
    fecha_vencimiento: stringField({
      required: false,
      defaultValue: "",
    }),
    estado: selectField({
      required: false,
      options: ESTADO_CHOICES,
      defaultValue: "pendiente",
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
    comprobante_id: referenceField({
      resource: COMPROBANTES_REFERENCE.resource,
      labelField: COMPROBANTES_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
    observaciones: stringField({
      trim: true,
      maxLength: VALIDATION_RULES.GENERAL.MAX_OBSERVACIONES_LENGTH,
      defaultValue: "",
    }),
    nombre_archivo_pdf: stringField({
      required: false,
      maxLength: 500,
      defaultValue: "",
    }),
    ruta_archivo_pdf: stringField({
      required: false,
      maxLength: 1000,
      defaultValue: "",
    }),
  },
});

export const PoFacturaModel = {
  ESTADO_CHOICES,
  UNIDAD_MEDIDA_CHOICES,
  VALIDATION_RULES,
  PROVEEDORES_REFERENCE,
  ARTICULOS_REFERENCE,
  USERS_REFERENCE,
  METODOS_PAGO_REFERENCE,
  CENTROS_COSTO_REFERENCE,
  TIPOS_SOLICITUD_REFERENCE,
  TIPOS_COMPROBANTE_REFERENCE,
  COMPROBANTES_REFERENCE,
  poFacturaDetalleSchema,
  poFacturaImpuestoSchema,
  poFacturaCabeceraSchema,
} as const;

export const getArticuloFilterByTipo = (
  tipoSolicitudId: string | undefined,
  tiposSolicitud: Array<{ id: number; tipo_articulo_filter_id?: number | null }> | undefined,
  _tiposArticulo?: Array<{ id: number; nombre: string }> | undefined
): number | undefined => {
  if (!tipoSolicitudId || !tiposSolicitud) return undefined;
  const tipo = tiposSolicitud.find((item) => item.id === Number(tipoSolicitudId));
  return tipo?.tipo_articulo_filter_id ?? undefined;
};
