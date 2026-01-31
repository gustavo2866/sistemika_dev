/**
 * Modelo de dominio para Solicitudes
 * 
 * PATRÓN ESTÁNDAR PARA TODAS LAS ENTIDADES
 * 
 * Este archivo debe contener SOLO lógica de negocio y definiciones del modelo.
 * NO debe contener componentes React ni lógica de presentación.
 * 
 * Estructura obligatoria:
 * 1. CONFIGURACIÓN - Constantes y valores de dominio
 * 2. TIPOS - Interfaces y types del modelo
 * 3. VALORES DEFAULT - Estado inicial para formularios
 * 4. VALIDACIONES - Reglas de negocio para validar datos
 * 5. TRANSFORMACIONES - Conversiones entre formatos
 * 6. HELPERS - Utilidades específicas del dominio
 */

import { UseFormReturn } from "react-hook-form";
import {
  createDetailSchema,
  createEntitySchema,
  numberField,
  referenceField,
  selectField,
  stringField,
} from "@/lib/form-detail-schema";
import {
  CURRENCY_FORMATTER,
  formatCurrency,
  formatImporteDisplay,
  roundCurrency,
} from "@/lib/formatters";

// ============================================
// 1. CONFIGURACIÓN
// ============================================


// Estados posibles de una PoSolicitud
export const ESTADO_CHOICES = [
  { id: "borrador", name: "Borrador" },
  { id: "emitida", name: "Emitida" },
  { id: "aprobada", name: "Aprobada" },
  { id: "rechazada", name: "Rechazada" },
  { id: "en_proceso", name: "En Proceso" },
  { id: "finalizada", name: "Finalizada" },
];

// Tipos de compra permitidos
export const TIPO_COMPRA_CHOICES = [
  { id: "directa", name: "Directa" },
  { id: "normal", name: "Normal" },
];

// Clases de badge asociadas a cada estado
export const ESTADO_BADGES: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-800",
  emitida: "bg-sky-100 text-sky-800",
  aprobada: "bg-emerald-100 text-emerald-800",
  rechazada: "bg-rose-100 text-rose-800",
  en_proceso: "bg-sky-100 text-sky-800",
  finalizada: "bg-indigo-100 text-indigo-800",
};

// Unidades de medida permitidas
export const UNIDAD_MEDIDA_CHOICES = [
  { id: "UN", name: "Unidad" },
  { id: "KG", name: "Kilogramo" },
  { id: "LT", name: "Litro" },
  { id: "MT", name: "Metro" },
  { id: "M2", name: "Metro²" },
  { id: "M3", name: "Metro³" },
  { id: "CAJA", name: "Caja" },
  { id: "PAQUETE", name: "Paquete" },
];

 
// Reglas de validación del dominio
export const VALIDATION_RULES = {
  DETALLE: {
    MIN_ITEMS: 1,
    MIN_CANTIDAD: 0,
    MAX_DESCRIPCION_LENGTH: 500,
  },
  GENERAL: {
    MAX_COMENTARIO_LENGTH: 1000,
  },
} as const;

/**
 * Configuración para referencias a tablas (Escenario 2)
 * Define CÓMO y QUÉ cargar desde la base de datos
 */

// Referencia a artículos
export const ARTICULOS_REFERENCE = {
  resource: "articulos",
  labelField: "nombre",
  limit: 800,
  staleTime: 5 * 60 * 1000, // 5 minutos - los artículos cambian poco
} as const;

// Referencia a tipos de solicitud
export const TIPOS_SOLICITUD_REFERENCE = {
  resource: "tipos-solicitud",
  labelField: "nombre",
  limit: 50,
  staleTime: 10 * 60 * 1000, // 10 minutos - los tipos cambian poco
} as const;

// Referencia a departamentos
export const DEPARTAMENTOS_REFERENCE = {
  resource: "departamentos",
  labelField: "nombre",
  limit: 50,
  staleTime: 10 * 60 * 1000,
} as const;

// Referencia a usuarios
export const USERS_REFERENCE = {
  resource: "users",
  labelField: "nombre",
} as const;

// Referencia a centros de costo
export const CENTROS_COSTO_REFERENCE = {
  resource: "centros-costo",
  labelField: "nombre",
  limit: 100,
  staleTime: 5 * 60 * 1000,
  filter: { activo: true },
} as const;

// Referencia a oportunidades
export const OPORTUNIDADES_REFERENCE = {
  resource: "crm/oportunidades",
  labelField: "titulo",
  limit: 200,
  staleTime: 5 * 60 * 1000,
  filter: { activo: true },
} as const;

// Referencia a proveedores
export const PROVEEDORES_REFERENCE = {
  resource: "proveedores",
  labelField: "nombre",
  limit: 100,
  staleTime: 5 * 60 * 1000,
} as const;

// ============================================
// 2. TIPOS
// ============================================

/**
 * Detalle en formato de formulario (valores temporales)
 * 
 * NOTA: Los IDs de referencias son strings para compatibilidad con Combobox
 */
export type DetalleFormValues = {
  articulo_id: string;      // string temporalmente
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio: number;
  importe: number;
};

export type WizardPayload = {
  proveedorId: number | null;
  tipoSolicitudId: number | null;
  departamentoId: number | null;
  centroCostoId: number | null;
  tipoCompra: string | null;
  articuloId: number | null;
  titulo: string;
  descripcion: string;
  fechaNecesidad: string | null;
  oportunidadId: number | null;
  cantidad: number | null;
  precio: number | null;
  unidadMedida: string | null;
};

// Detalle persistido (modelo de base de datos)
export type PoSolicitudDetalle = {
  id?: number;
  tempId?: number;
  solicitud_id?: number;
  articulo_id: number | null;
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio: number;
  importe: number;
};


// PoSolicitud completa (modelo principal)
export type PoSolicitud = {
  id?: number;
  titulo: string;
  tipo_solicitud_id: number;        // ✅ NUEVO - FK a tipos_solicitud
  departamento_id: number;          // ✅ NUEVO - FK a departamentos
  centro_costo_id: number;
  estado: string;                   // ✅ NUEVO - enum EstadoSolicitud
  tipo_compra?: string | null;
  total: number;                    // ✅ NUEVO - monto total
  fecha_necesidad: string;
  solicitante_id: number;
  comentario?: string;
  oportunidad_id?: number | null;
  proveedor_id?: number | null;
  detalles: PoSolicitudDetalle[];
  
  // Relaciones expandidas
  solicitante?: {
    id: number;
    nombre: string;
    email: string;
  };
  tipo_solicitud?: {                // ✅ NUEVO
    id: number;
    nombre: string;
    tipo_articulo_filter_id?: number | null;
    tipo_articulo_filter_rel?: {
      id: number;
      nombre: string;
    };
    articulo_default_id?: number;
  };
  departamento?: {                  // ✅ NUEVO
    id: number;
    nombre: string;
  };
  centro_costo?: {
    id: number;
    nombre: string;
    tipo?: string;
    codigo_contable?: string;
  };
  oportunidad?: {
    id: number;
    titulo?: string | null;
  };
  proveedor?: {
    id: number;
    nombre: string;
  };
};

// 
export type PoSolicitudCabeceraFormValues = {
  titulo: string;
  tipo_solicitud_id: string;        // ✅ CAMBIO: antes era "tipo" string local
  departamento_id: string;          // ✅ NUEVO
  centro_costo_id: string;
  estado: string;                   // ✅ NUEVO
  tipo_compra: string;
  fecha_necesidad: string;
  solicitante_id: string;
  comentario: string;
  oportunidad_id: string;
  proveedor_id: string;
};

// ============================================
// 3. VALORES DEFAULT
// ============================================

// ============================================
// 4. VALIDACIONES
// ============================================

// Tipo para errores de validación por campo
type ValidationErrors<T> = Partial<Record<keyof T, string>>;

// Valida un detalle de solicitud
export function validateDetalle(
  data: DetalleFormValues,
  form: UseFormReturn<DetalleFormValues>
): boolean {
  const errors: ValidationErrors<DetalleFormValues> = {};

  // Validar articulo_id
  if (!data.articulo_id) {
    errors.articulo_id = "Selecciona un articulo";
  }

  // Validar descripcion (opcional, con tope de caracteres)
  if (data.descripcion && data.descripcion.length > VALIDATION_RULES.DETALLE.MAX_DESCRIPCION_LENGTH) {
    errors.descripcion = `Máximo ${VALIDATION_RULES.DETALLE.MAX_DESCRIPCION_LENGTH} caracteres`;
  }

  // Validar unidad_medida
  if (!data.unidad_medida.trim()) {
    errors.unidad_medida = "La unidad de medida es requerida";
  }

  // Validar cantidad
  if (!Number.isFinite(data.cantidad) || data.cantidad <= VALIDATION_RULES.DETALLE.MIN_CANTIDAD) {
    errors.cantidad = "La cantidad debe ser mayor a 0";
  }

  if (!Number.isFinite(data.precio) || data.precio < 0) {
    errors.precio = "El precio debe ser mayor o igual a 0";
  }

  // Establecer errores en el formulario si existen
  if (Object.keys(errors).length > 0) {
    Object.entries(errors).forEach(([field, message]) => {
      form.setError(field as keyof DetalleFormValues, {
        type: "manual",
        message,
      });
    });
    return true; // Hay errores
  }

  return false; // Sin errores
}

// ============================================
// 5. TRANSFORMACIONES
// ============================================


// Límites para truncar texto en la UI
export const TEXT_LIMITS = {
  ARTICLE_NAME: 30,
  DESCRIPTION: 90,
} as const;

// Trunca texto a un límite específico
export function truncateText(value: string, limit: number): string {
  if (!value) return "";
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
}

// Calcula el importe de un detalle (cantidad * precio)
export function calculateImporte(cantidad: number, precio: number): number {
  const result = (cantidad || 0) * (precio || 0);
  return Number(result.toFixed(2));
}

// Calcula el total de una solicitud sumando los importes de los detalles
export function calculateTotal(detalles: PoSolicitudDetalle[]): number {
  if (!Array.isArray(detalles)) return 0;
  
  const total = detalles.reduce((acc, detalle) => {
    if (!detalle) return acc;
    const importe = typeof detalle.importe === "number"
      ? detalle.importe
      : calculateImporte(detalle.cantidad, detalle.precio);
    
    return Number.isFinite(importe) ? acc + importe : acc;
  }, 0);
  
  return Number(total.toFixed(2));
}

// Normaliza un ID de string a number o null
export const normalizeId = (value: string | null | undefined): number | null => {
  if (!value || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// Normaliza un valor a número, retornando 0 si no es válido
export const normalizeNumber = (value: unknown): number => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

// Normaliza un valor a número opcional, retornando null si no es válido
export const normalizeOptionalNumber = (value: unknown): number | null => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : null;
};

// Resuelve el tipo de compra según la presencia de proveedor
export const resolveTipoCompra = (proveedorId: number | null) =>
  proveedorId ? "directa" : "normal";

// Resuelve el centro de costo según reglas de negocio
export const resolveCentroCostoId = ({
  oportunidadId,
  departamentoNombre,
  departamentoCentroCostoId,
  solicitanteCentroCostoId,
}: {
  oportunidadId: string | null;
  departamentoNombre?: string | null;
  departamentoCentroCostoId?: number | null;
  solicitanteCentroCostoId?: number | null;
}): number | null => {
  if (oportunidadId) return null;
  const isDirector =
    typeof departamentoNombre === "string" &&
    departamentoNombre.toLowerCase().includes("director");
  const defaultCentroCostoId = Number(departamentoCentroCostoId ?? 0);
  const solicitanteCentroCosto = Number(solicitanteCentroCostoId ?? 0);
  if (isDirector) {
    return Number.isFinite(solicitanteCentroCosto) && solicitanteCentroCosto > 0
      ? solicitanteCentroCosto
      : null;
  }
  return Number.isFinite(defaultCentroCostoId) && defaultCentroCostoId > 0
    ? defaultCentroCostoId
    : null;
};



// Formatea un valor numérico como moneda
export { CURRENCY_FORMATTER, formatCurrency, formatImporteDisplay, roundCurrency };


// ============================================
// 6. ESQUEMA DECLARATIVO PARA DETALLES
// ============================================


// Esquema de formulario para detalles de PoSolicitud
export const poSolicitudDetalleSchema = createDetailSchema< DetalleFormValues,  PoSolicitudDetalle
>({
  fields: {
    articulo_id: referenceField({
      resource: ARTICULOS_REFERENCE.resource,
      labelField: ARTICULOS_REFERENCE.labelField,
      perPage: ARTICULOS_REFERENCE.limit,
      sortField: ARTICULOS_REFERENCE.labelField,
      sortOrder: "ASC",
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
    precio: numberField({
      required: true,
      min: 0,
      defaultValue: 0,
    }),
    importe: numberField({
      required: true,
      min: 0,
      defaultValue: 0,
    }),
  },
});

// Esquema de formulario para cabecera de PoSolicitud
export const poSolicitudCabeceraSchema = createEntitySchema<
  PoSolicitudCabeceraFormValues,
  Pick<
    PoSolicitud,
    | "titulo"
    | "tipo_solicitud_id"
    | "departamento_id"
    | "centro_costo_id"
    | "estado"
    | "tipo_compra"
    | "fecha_necesidad"
    | "solicitante_id"
    | "comentario"
    | "oportunidad_id"
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
      required: true,
      defaultValue: "1",
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
    fecha_necesidad: stringField({
      required: true,
      defaultValue: "",
    }),
    solicitante_id: referenceField({
      resource: USERS_REFERENCE.resource,
      labelField: USERS_REFERENCE.labelField,
      required: true,
      defaultValue: "",
    }),
    comentario: stringField({
      trim: true,
      maxLength: VALIDATION_RULES.GENERAL.MAX_COMENTARIO_LENGTH,
      defaultValue: "",
    }),
    oportunidad_id: referenceField({
      resource: OPORTUNIDADES_REFERENCE.resource,
      labelField: OPORTUNIDADES_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
    proveedor_id: referenceField({
      resource: PROVEEDORES_REFERENCE.resource,
      labelField: PROVEEDORES_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
  },
});

// ============================================
// 6. HELPERS DE PRESENTACIÓN
// ============================================

// Obtiene etiqueta legible de un artículo
export function getArticuloLabel(
  item: PoSolicitudDetalle,
  articuloOptions: Array<{ id: number; nombre: string }>
): string {
  return (
    (item as any).articulo_nombre ||
    articuloOptions.find((option) => option.id === item.articulo_id)?.nombre ||
    "Sin articulo"
  );
}

// Obtiene el filtro de artículos según el tipo de PoSolicitud seleccionado
export const getArticuloFilterByTipo = (
  tipoSolicitudId: string | undefined,
  tiposSolicitud: Array<{ id: number; tipo_articulo_filter_id?: number | null }> | undefined,
  _tiposArticulo?: Array<{ id: number; nombre: string }> | undefined
): number | undefined => {
  if (!tipoSolicitudId || !tiposSolicitud) return undefined;
  const tipo = tiposSolicitud.find((item) => item.id === Number(tipoSolicitudId));
  return tipo?.tipo_articulo_filter_id ?? undefined;
};

//  Obtiene el departamento default según el tipo de PoSolicitud
export const getDepartamentoDefaultByTipo = (
  tipoSolicitudId: string | undefined,
  tiposSolicitud: Array<{ id: number; departamento_default_id?: number }> | undefined
): string | undefined => {
  if (!tipoSolicitudId || !tiposSolicitud) return undefined;
  
  const tipo = tiposSolicitud.find(t => t.id === parseInt(tipoSolicitudId));
  return tipo?.departamento_default_id?.toString();
};

// Obtiene el artículo default según el tipo de PoSolicitud
export const getArticuloDefaultByTipo = (
  tipoSolicitudId: string | undefined,
  tiposSolicitud: Array<{ id: number; articulo_default_id?: number }> | undefined
): string | undefined => {
  if (!tipoSolicitudId || !tiposSolicitud) return undefined;
  
  const tipo = tiposSolicitud.find(t => t.id === parseInt(tipoSolicitudId));
  return tipo?.articulo_default_id?.toString();
};

// ============================================
// EXPORTS CONSOLIDADOS (para facilitar imports)
// ============================================

// Modelo completo de PoSolicitud
export const PoSolicitudModel = {
  // Configuración
  ESTADO_CHOICES,
  UNIDAD_MEDIDA_CHOICES,
  VALIDATION_RULES,
  ARTICULOS_REFERENCE,
  TIPOS_SOLICITUD_REFERENCE,
  DEPARTAMENTOS_REFERENCE,
  CENTROS_COSTO_REFERENCE,
  OPORTUNIDADES_REFERENCE,
  PROVEEDORES_REFERENCE,
  CURRENCY_FORMATTER,
  TEXT_LIMITS,
  // Funciones
  validateDetalle,
  getArticuloLabel,
  getArticuloFilterByTipo,
  getDepartamentoDefaultByTipo,
  getArticuloDefaultByTipo,
  truncateText,
  calculateImporte,
  calculateTotal,
  formatCurrency,
  formatImporteDisplay,
  poSolicitudDetalleSchema,
  poSolicitudCabeceraSchema,
} as const;




