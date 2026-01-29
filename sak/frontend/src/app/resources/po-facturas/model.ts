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
  TOTAL: {
    MAX_DESCRIPCION_LENGTH: 50,
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

export const TIPOS_COMPROBANTE_REFERENCE = {
  resource: "tipos-comprobante",
  labelField: "name",
  limit: 100,
  staleTime: 10 * 60 * 1000,
} as const;

export const ADM_CONCEPTOS_REFERENCE = {
  resource: "api/v1/adm/conceptos",
  labelField: "nombre",
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
  orden: number;
  centro_costo_id: string;
};

export type TotalFormValues = {
  concepto_id: string;
  centro_costo_id: string;
  descripcion: string;
  importe: number;
};

export type PoFacturaDetalle = {
  id?: number;
  tempId?: number;
  articulo_id?: number | null;
  codigo_producto?: string | null;
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
  orden: number;
  centro_costo_id?: number | null;
};

export type PoFacturaTotal = {
  id?: number;
  tempId?: number;
  concepto_id: number;
  centro_costo_id?: number | null;
  tipo: "subtotal" | "impuesto";
  descripcion?: string | null;
  importe: number;
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
  tipo_compra?: string | null;
  observaciones?: string | null;
  nombre_archivo_pdf?: string | null;
  ruta_archivo_pdf?: string | null;
  comprobante_id?: number | null;
  proveedor_id: number;
  usuario_responsable_id: number;
  metodo_pago_id: number;
  centro_costo_id?: number | null;
  tipo_solicitud_id?: number | null;
  departamento_id?: number | null;
  detalles: PoFacturaDetalle[];
  totales: PoFacturaTotal[];

  proveedor?: { id: number; nombre: string };
  usuario_responsable?: { id: number; nombre: string };
  metodo_pago?: { id: number; nombre: string };
  centro_costo?: { id: number; nombre: string };
  tipo_solicitud?: { id: number; nombre: string };
  departamento?: { id: number; nombre: string };
};

export type PoFacturaCabeceraFormValues = {
  numero: string;
  punto_venta: string;
  id_tipocomprobante: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: string;
  tipo_compra: string;
  proveedor_id: string;
  usuario_responsable_id: string;
  metodo_pago_id: string;
  centro_costo_id: string;
  oportunidad_id: string;
  tipo_solicitud_id: string;
  departamento_id: string;
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
    oportunidad_id: referenceField({
      resource: "crm/oportunidades",
      labelField: "titulo",
      required: false,
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

export const poFacturaTotalSchema = createDetailSchema<
  TotalFormValues,
  PoFacturaTotal
>({
  fields: {
    concepto_id: referenceField({
      resource: ADM_CONCEPTOS_REFERENCE.resource,
      labelField: ADM_CONCEPTOS_REFERENCE.labelField,
      required: true,
      defaultValue: "",
    }),
    centro_costo_id: referenceField({
      resource: CENTROS_COSTO_REFERENCE.resource,
      labelField: CENTROS_COSTO_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
    descripcion: stringField({
      required: false,
      trim: true,
      maxLength: VALIDATION_RULES.TOTAL.MAX_DESCRIPCION_LENGTH,
      defaultValue: "",
    }),
    importe: numberField({
      required: true,
      min: 0,
      defaultValue: 0,
    }),
  },
  toForm: (detalle) => ({
    concepto_id: detalle.concepto_id?.toString() ?? "",
    centro_costo_id: detalle.centro_costo_id?.toString() ?? "",
    descripcion: detalle.descripcion ?? "",
    importe: detalle.importe ?? 0,
  }),
  toModel: (values) => {
    const errors: Record<string, string> = {};
    const conceptoId = Number(values.concepto_id ?? 0);
    const centroCostoId = String(values.centro_costo_id ?? "").trim();
    const descripcion = String(values.descripcion ?? "").trim();
    const importe = Number(values.importe ?? 0);

    if (!Number.isFinite(conceptoId) || conceptoId <= 0) {
      errors.concepto_id = "Campo requerido";
    }
    if (!Number.isFinite(importe) || importe < 0) {
      errors.importe = "Debe ser un numero valido";
    }

    if (Object.keys(errors).length > 0) {
      throw { errors };
    }

    return {
      concepto_id: conceptoId,
      centro_costo_id: centroCostoId ? Number(centroCostoId) : null,
      descripcion: descripcion || null,
      importe,
      tipo: "impuesto",
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
    | "tipo_compra"
    | "proveedor_id"
    | "usuario_responsable_id"
    | "metodo_pago_id"
    | "centro_costo_id"
    | "oportunidad_id"
    | "tipo_solicitud_id"
    | "departamento_id"
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
    tipo_compra: selectField({
      required: true,
      options: TIPO_COMPRA_CHOICES,
      defaultValue: "normal",
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
    oportunidad_id: referenceField({
      resource: "crm/oportunidades",
      labelField: "titulo",
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
  TIPO_COMPRA_CHOICES,
  UNIDAD_MEDIDA_CHOICES,
  VALIDATION_RULES,
  PROVEEDORES_REFERENCE,
  ARTICULOS_REFERENCE,
  USERS_REFERENCE,
  METODOS_PAGO_REFERENCE,
  CENTROS_COSTO_REFERENCE,
  DEPARTAMENTOS_REFERENCE,
  TIPOS_SOLICITUD_REFERENCE,
  TIPOS_COMPROBANTE_REFERENCE,
  COMPROBANTES_REFERENCE,
  ADM_CONCEPTOS_REFERENCE,
  poFacturaDetalleSchema,
  poFacturaTotalSchema,
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
