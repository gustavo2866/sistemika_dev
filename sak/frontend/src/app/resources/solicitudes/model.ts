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

// ============================================
// 1. CONFIGURACIÓN
// ============================================

/**
 * Estados posibles de una solicitud
 */
export const ESTADO_CHOICES = [
  { id: "pendiente", name: "Pendiente" },
  { id: "aprobada", name: "Aprobada" },
  { id: "rechazada", name: "Rechazada" },
  { id: "en_proceso", name: "En Proceso" },
  { id: "finalizada", name: "Finalizada" },
];

/**
 * Unidades de medida permitidas
 * Usado en: Select del sub-formulario de detalles
 */
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

/**
 * Reglas de validación del dominio
 */
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
export const ARTICULOS_REFERENCE = {
  resource: "articulos",
  labelField: "nombre",
  limit: 100,
  staleTime: 5 * 60 * 1000, // 5 minutos - los artículos cambian poco
} as const;

export const TIPOS_SOLICITUD_REFERENCE = {
  resource: "tipos-solicitud",
  labelField: "nombre",
  limit: 50,
  staleTime: 10 * 60 * 1000, // 10 minutos - los tipos cambian poco
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
};

/**
 * Detalle persistido (modelo de base de datos)
 */
export type SolicitudDetalle = {
  id?: number;
  tempId?: number;
  articulo_id: number | null;     // number en BD
  articulo_nombre?: string;       // campo enriquecido
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
};

/**
 * Solicitud completa (modelo principal)
 */
export type Solicitud = {
  id?: number;
  tipo_solicitud_id: number;        // ✅ NUEVO - FK a tipos_solicitud
  departamento_id: number;          // ✅ NUEVO - FK a departamentos
  estado: string;                   // ✅ NUEVO - enum EstadoSolicitud
  total: number;                    // ✅ NUEVO - monto total
  fecha_necesidad: string;
  solicitante_id: number;
  comentario?: string;
  detalles: SolicitudDetalle[];
  
  // Relaciones expandidas
  solicitante?: {
    id: number;
    nombre: string;
    email: string;
  };
  tipo_solicitud?: {                // ✅ NUEVO
    id: number;
    nombre: string;
    tipo_articulo_filter?: string;
    articulo_default_id?: number;
  };
  departamento?: {                  // ✅ NUEVO
    id: number;
    nombre: string;
  };
};

export type SolicitudCabeceraFormValues = {
  tipo_solicitud_id: string;        // ✅ CAMBIO: antes era "tipo" string local
  departamento_id: string;          // ✅ NUEVO
  estado: string;                   // ✅ NUEVO
  fecha_necesidad: string;
  solicitante_id: string;
  comentario: string;
};

// ============================================
// 3. VALORES DEFAULT
// ============================================

// ============================================
// 4. VALIDACIONES
// ============================================

/**
 * Tipo para colección de errores de validación
 */
type ValidationErrors<T> = Partial<Record<keyof T, string>>;

/**
 * Valida datos del formulario de detalle
 * 
 * @param data - Datos a validar
 * @param form - Formulario donde establecer errores
 * @returns true si hay errores, false si todo ok
 * 
 * @example
 * ```ts
 * const hasErrors = validateDetalle(formData, detalleForm);
 * if (hasErrors) return; // No continuar si hay errores
 * ```
 */
export function validateDetalle(
  data: DetalleFormValues,
  form: UseFormReturn<DetalleFormValues>
): boolean {
  const errors: ValidationErrors<DetalleFormValues> = {};

  // Validar articulo_id
  if (!data.articulo_id) {
    errors.articulo_id = "Selecciona un articulo";
  }

  // Validar descripcion
  if (!data.descripcion.trim()) {
    errors.descripcion = "La descripcion es requerida";
  } else if (data.descripcion.length > VALIDATION_RULES.DETALLE.MAX_DESCRIPCION_LENGTH) {
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

// ============================================


// ============================================

// 6. ESQUEMA DECLARATIVO PARA DETALLES

// ============================================



export const solicitudDetalleSchema = createDetailSchema<
  DetalleFormValues,
  SolicitudDetalle
>({
  fields: {
    articulo_id: referenceField({
      resource: ARTICULOS_REFERENCE.resource,
      labelField: ARTICULOS_REFERENCE.labelField,
      persistLabelAs: "articulo_nombre",
      perPage: ARTICULOS_REFERENCE.limit,
      sortField: ARTICULOS_REFERENCE.labelField,
      sortOrder: "ASC",
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
  },
});

export const solicitudCabeceraSchema = createEntitySchema<
  SolicitudCabeceraFormValues,
  Pick<Solicitud, "tipo_solicitud_id" | "departamento_id" | "estado" | "fecha_necesidad" | "solicitante_id" | "comentario">
>({
  fields: {
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
    estado: selectField({
      required: false,
      options: ESTADO_CHOICES,
      defaultValue: "pendiente",
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
  },
});


// 6. HELPERS DE PRESENTACIÓN
// ============================================

/**
 * Obtiene etiqueta legible de un artículo
 * 
 * Prioridad: campo enriquecido > buscar en opciones > fallback
 * 
 * @param item - Detalle con artículo
 * @param articuloOptions - Referencias disponibles
 * @returns Etiqueta para mostrar en UI
 */
export function getArticuloLabel(
  item: SolicitudDetalle,
  articuloOptions: Array<{ id: number; nombre: string }>
): string {
  return (
    item.articulo_nombre ||
    articuloOptions.find((option) => option.id === item.articulo_id)?.nombre ||
    "Sin articulo"
  );
}

/**
 * Obtiene el filtro de artículos según el tipo de solicitud seleccionado
 */
export const getArticuloFilterByTipo = (
  tipoSolicitudId: string | undefined,
  tiposSolicitud: Array<{ id: number; tipo_articulo_filter?: string | null }> | undefined
): string | undefined => {
  if (!tipoSolicitudId || !tiposSolicitud) return undefined;
  
  const tipo = tiposSolicitud.find(t => t.id === parseInt(tipoSolicitudId));
  const filter = tipo?.tipo_articulo_filter;
  return typeof filter === "string" ? filter : undefined;
};

/**
 * Obtiene el departamento default según el tipo de solicitud
 */
export const getDepartamentoDefaultByTipo = (
  tipoSolicitudId: string | undefined,
  tiposSolicitud: Array<{ id: number; departamento_default_id?: number }> | undefined
): string | undefined => {
  if (!tipoSolicitudId || !tiposSolicitud) return undefined;
  
  const tipo = tiposSolicitud.find(t => t.id === parseInt(tipoSolicitudId));
  return tipo?.departamento_default_id?.toString();
};

/**
 * Obtiene el artículo default según el tipo de solicitud
 */
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

/**
 * Configuración completa del modelo
 * Útil para importar todo de una vez
 */
export const SolicitudModel = {
  // Configuración
  ESTADO_CHOICES,
  UNIDAD_MEDIDA_CHOICES,
  VALIDATION_RULES,
  ARTICULOS_REFERENCE,
  TIPOS_SOLICITUD_REFERENCE,
  DEPARTAMENTOS_REFERENCE,
  // Funciones
  validateDetalle,
  getArticuloLabel,
  getArticuloFilterByTipo,
  getDepartamentoDefaultByTipo,
  getArticuloDefaultByTipo,
  solicitudDetalleSchema,
  solicitudCabeceraSchema,
} as const;

