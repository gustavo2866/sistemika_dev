/**
 * Modelo de dominio para Ordenes de Compra.
 *
 * Estructura:
 * 1. CONFIGURACION - Constantes y valores de dominio
 * 2. TIPOS - Interfaces y types del modelo
 * 3. VALORES DEFAULT - Estado inicial para formularios
 * 4. VALIDACIONES - Reglas de negocio para validar datos
 * 5. ESQUEMAS - Declarativos para formularios
 * 6. HELPERS - Utilidades especificas del dominio
 */

import {
  CURRENCY_FORMATTER,
  formatCurrency,
  formatImporteDisplay,
  roundCurrency,
} from "@/lib/formatters";
import {
  calculateImporte,
  getArticuloFilterByTipo,
  normalizeId,
  normalizeNumber,
  normalizeOptionalNumber,
  parseOptionalNumber,
} from "../shared/po-utils";
import {
  createDetailSchema,
  createEntitySchema,
  numberField,
  referenceField,
  selectField,
  stringField,
} from "@/lib/form-detail-schema";

// ============================================
// 1. CONFIGURACION
// ============================================

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

export const ESTADO_BADGES: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-800",
  emitida: "bg-sky-100 text-sky-800",
  aprobada: "bg-emerald-100 text-emerald-800",
  rechazada: "bg-rose-100 text-rose-800",
  recibida: "bg-amber-100 text-amber-800",
  cerrada: "bg-indigo-100 text-indigo-800",
  anulada: "bg-slate-200 text-slate-600",
};

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

export const ARTICULOS_REFERENCE = {
  resource: "articulos",
  labelField: "nombre",
  limit: 800,
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

export const USERS_REFERENCE = {
  resource: "users",
  labelField: "nombre",
} as const;

export const CENTROS_COSTO_REFERENCE = {
  resource: "centros-costo",
  labelField: "nombre",
  limit: 100,
  staleTime: 5 * 60 * 1000,
  filter: { activo: true },
} as const;

export const OPORTUNIDADES_REFERENCE = {
  resource: "crm/oportunidades",
  labelField: "titulo",
  limit: 200,
  staleTime: 5 * 60 * 1000,
  filter: { activo: true },
} as const;

export const PROVEEDORES_REFERENCE = {
  resource: "proveedores",
  labelField: "nombre",
  limit: 100,
  staleTime: 5 * 60 * 1000,
} as const;

export const METODOS_PAGO_REFERENCE = {
  resource: "metodos-pago",
  labelField: "nombre",
  limit: 100,
  staleTime: 5 * 60 * 1000,
} as const;

export const PO_SOLICITUDES_REFERENCE = {
  resource: "po-solicitudes",
  labelField: "titulo",
  limit: 100,
  staleTime: 5 * 60 * 1000,
} as const;

// ============================================
// 2. TIPOS
// ============================================

export type WizardPayload = {
  proveedorId: number | null;
  tipoSolicitudId: number | null;
  departamentoId: number | null;
  centroCostoId: number | null;
  solicitudIds: number[];
  detalles?: Array<{
    articulo_id: number;
    descripcion?: string;
    unidad_medida?: string;
    cantidad?: number | null;
    precio_unitario?: number | null;
    subtotal?: number | null;
    total_linea?: number | null;
    centro_costo_id?: number | null;
    oportunidad_id?: number | null;
    solicitud_detalle_id?: number | null;
  }>;
  tipoCompra: string | null;
  articuloId: number | null;
  titulo: string;
  descripcion: string;
  fecha: string | null;
  oportunidadId: number | null;
  cantidad: number | null;
  precio: number | null;
  unidadMedida: string | null;
  usuarioResponsableId: number | null;
  metodoPagoId: number | null;
};

export type WizardCreatePayload = {
  titulo: string;
  tipo_solicitud_id: number | null;
  departamento_id: number | null;
  centro_costo_id: number | null;
  solicitud_detalle_id?: number | null;
  tipo_compra: string | null;
  estado?: string | null;
  proveedor_id: number | null;
  usuario_responsable_id: number | null;
  metodo_pago_id: number | null;
  oportunidad_id: number | null;
  fecha: string | null;
  observaciones: string;
  subtotal: number;
  total_impuestos: number;
  total: number;
  detalles: Array<{
    articulo_id: number;
    descripcion: string;
    unidad_medida: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    total_linea: number;
    centro_costo_id: number | null;
    oportunidad_id: number | null;
    solicitud_detalle_id: number | null;
  }>;
};

export type PoOrdenCompraPayload = {
  titulo: string;
  tipo_solicitud_id: number | string | null;
  departamento_id: number | string | null;
  centro_costo_id: number | string | null;
  tipo_compra: string | null;
  estado?: string | null;
  proveedor_id: number | string | null;
  usuario_responsable_id: number | string | null;
  metodo_pago_id: number | string | null;
  oportunidad_id?: number | string | null;
  fecha: string | null;
  observaciones: string;
  subtotal?: number | string | null;
  total_impuestos?: number | string | null;
  total?: number | string | null;
  detalles: Array<{
    articulo_id: number | string | null;
    descripcion?: string;
    unidad_medida?: string;
    cantidad?: number | string | null;
    precio_unitario?: number | string | null;
    subtotal?: number | string | null;
    total_linea?: number | string | null;
    centro_costo_id?: number | string | null;
    oportunidad_id?: number | string | null;
    solicitud_detalle_id?: number | string | null;
  }>;
};

export type PoOrdenCompraDetalle = {
  id?: number;
  tempId?: number;
  orden_compra_id?: number;
  articulo_id?: number | null;
  solicitud_detalle_id?: number | null;
  oportunidad_id?: number | null;
  descripcion: string;
  unidad_medida?: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  total_linea: number;
  cantidad_recibida?: number;
  cantidad_facturada?: number;
  centro_costo_id?: number | null;
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

// ============================================
// 3. VALORES DEFAULT
// ============================================

export type PoOrdenCompraCabeceraDefaults = {
  titulo?: string;
  tipo_solicitud_id?: string;
  departamento_id?: string;
  centro_costo_id?: string;
  oportunidad_id?: string;
  estado?: string;
  tipo_compra?: string;
  fecha?: string;
  usuario_responsable_id?: string;
  metodo_pago_id?: string;
  observaciones?: string;
  proveedor_id?: string;
  [key: string]: unknown;
};

export const buildPoOrdenCompraDefaultValues = ({
  cabeceraDefaults,
  today,
}: {
  cabeceraDefaults: PoOrdenCompraCabeceraDefaults;
  today: string;
}) => {
  const centroCostoDefault = parseOptionalNumber(cabeceraDefaults.centro_costo_id);
  const oportunidadDefault = parseOptionalNumber(cabeceraDefaults.oportunidad_id);
  const responsableDefault = parseOptionalNumber(
    cabeceraDefaults.usuario_responsable_id
  );
  const metodoPagoDefault = parseOptionalNumber(cabeceraDefaults.metodo_pago_id);

  return {
    ...cabeceraDefaults,
    fecha: cabeceraDefaults.fecha || today,
    usuario_responsable_id: responsableDefault,
    metodo_pago_id: metodoPagoDefault,
    centro_costo_id: centroCostoDefault,
    oportunidad_id: oportunidadDefault,
    subtotal: 0,
    total_impuestos: 0,
    total: 0,
    detalles: [] as PoOrdenCompraDetalle[],
  };
};

// ============================================
// 4. VALIDACIONES
// ============================================

type ValidationErrors<T> = Partial<Record<keyof T, string>>;

export function validateDetalle(
  data: {
    articulo_id: string;
    descripcion: string;
    unidad_medida: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    total_linea: number;
  },
  form: { setError: (field: string, config: { type: string; message: string }) => void }
): boolean {
  const errors: ValidationErrors<typeof data> = {};

  if (!data.articulo_id) {
    errors.articulo_id = "Selecciona un articulo";
  }

  if (
    data.descripcion &&
    data.descripcion.length > VALIDATION_RULES.DETALLE.MAX_DESCRIPCION_LENGTH
  ) {
    errors.descripcion = `Maximo ${VALIDATION_RULES.DETALLE.MAX_DESCRIPCION_LENGTH} caracteres`;
  }

  if (!data.unidad_medida.trim()) {
    errors.unidad_medida = "La unidad de medida es requerida";
  }

  if (
    !Number.isFinite(data.cantidad) ||
    data.cantidad <= VALIDATION_RULES.DETALLE.MIN_CANTIDAD
  ) {
    errors.cantidad = "La cantidad debe ser mayor a 0";
  }

  if (!Number.isFinite(data.precio_unitario) || data.precio_unitario < 0) {
    errors.precio_unitario = "El precio debe ser mayor o igual a 0";
  }

  if (Object.keys(errors).length > 0) {
    Object.entries(errors).forEach(([field, message]) => {
      form.setError(field, {
        type: "manual",
        message,
      });
    });
    return true;
  }

  return false;
}

// ============================================
// 5. ESQUEMAS
// ============================================

export const poOrdenCompraCabeceraSchema = createEntitySchema<
  {
    titulo: string;
    tipo_solicitud_id: string;
    departamento_id: string;
    centro_costo_id: string;
    oportunidad_id: string;
    estado: string;
    tipo_compra: string;
    fecha: string;
    usuario_responsable_id: string;
    metodo_pago_id: string;
    observaciones: string;
    proveedor_id: string;
  },
  Pick<
    PoOrdenCompra,
    | "titulo"
    | "tipo_solicitud_id"
    | "departamento_id"
    | "centro_costo_id"
    | "estado"
    | "tipo_compra"
    | "fecha"
    | "usuario_responsable_id"
    | "metodo_pago_id"
    | "observaciones"
    | "proveedor_id"
  >
>({
  fields: {
    titulo: stringField({
      required: true,
      trim: true,
      maxLength: 200,
      defaultValue: "",
    }),
    tipo_solicitud_id: referenceField({
      resource: TIPOS_SOLICITUD_REFERENCE.resource,
      labelField: TIPOS_SOLICITUD_REFERENCE.labelField,
      required: true,
      defaultValue: "",
    }),
    departamento_id: referenceField({
      resource: DEPARTAMENTOS_REFERENCE.resource,
      labelField: DEPARTAMENTOS_REFERENCE.labelField,
      required: true,
      defaultValue: "",
    }),
    centro_costo_id: referenceField({
      resource: CENTROS_COSTO_REFERENCE.resource,
      labelField: CENTROS_COSTO_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
    oportunidad_id: referenceField({
      resource: OPORTUNIDADES_REFERENCE.resource,
      labelField: OPORTUNIDADES_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
    estado: selectField({
      required: false,
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
      defaultValue: "",
    }),
    observaciones: stringField({
      trim: true,
      maxLength: VALIDATION_RULES.GENERAL.MAX_OBSERVACIONES_LENGTH,
      defaultValue: "",
    }),
    proveedor_id: referenceField({
      resource: PROVEEDORES_REFERENCE.resource,
      labelField: PROVEEDORES_REFERENCE.labelField,
      required: true,
      defaultValue: "",
    }),
  },
});

export const poOrdenCompraDetalleSchema = createDetailSchema<
  {
    articulo_id: string;
    solicitud_detalle_id: string;
    oportunidad_id: string;
    descripcion: string;
    unidad_medida: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    total_linea: number;
    centro_costo_id: string;
  },
  PoOrdenCompraDetalle
>({
  fields: {
    articulo_id: referenceField({
      resource: ARTICULOS_REFERENCE.resource,
      labelField: ARTICULOS_REFERENCE.labelField,
      perPage: ARTICULOS_REFERENCE.limit,
      sortField: ARTICULOS_REFERENCE.labelField,
      sortOrder: "ASC",
      required: true,
      defaultValue: "",
    }),
    solicitud_detalle_id: referenceField({
      resource: "po-solicitud-detalles",
      labelField: "descripcion",
      required: false,
      defaultValue: "",
    }),
    oportunidad_id: referenceField({
      resource: OPORTUNIDADES_REFERENCE.resource,
      labelField: OPORTUNIDADES_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
    descripcion: stringField({
      required: false,
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

export const WIZARD_DEFAULTS = {
  titulo: "",
  fecha: "",
  proveedorId: "",
  tipoSolicitudId: "",
  centroCostoId: "",
  solicitudes: [{ id: "" }],
  oportunidadId: "",
  tipoCompra: "normal",
  articuloId: "",
  cantidad: 1,
  precio: 0,
  descripcion: "",
  usuarioResponsableId: "",
} as const;

// ============================================
// 6. HELPERS
// ============================================

export const calculateLineaTotal = (cantidad: number, precioUnitario: number) =>
  calculateImporte(cantidad, precioUnitario);

export const calculateTotal = <T extends { total_linea?: number; subtotal?: number; cantidad?: number; precio_unitario?: number }>(
  detalles: T[]
): number => {
  if (!Array.isArray(detalles)) return 0;
  const total = detalles.reduce((acc, detalle) => {
    if (!detalle) return acc;
    const totalLinea =
      typeof detalle.total_linea === "number"
        ? detalle.total_linea
        : typeof detalle.subtotal === "number"
          ? detalle.subtotal
          : calculateLineaTotal(
              Number(detalle.cantidad ?? 0),
              Number(detalle.precio_unitario ?? 0)
            );
    return Number.isFinite(totalLinea) ? acc + totalLinea : acc;
  }, 0);
  return roundCurrency(total);
};

export {
  CURRENCY_FORMATTER,
  formatCurrency,
  formatImporteDisplay,
  roundCurrency,
  getArticuloFilterByTipo,
  normalizeId,
  normalizeNumber,
  normalizeOptionalNumber,
};
