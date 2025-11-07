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

// ============================================
// 1. CONFIGURACIÓN
// ============================================

/**
 * Tipos de solicitud permitidos
 * Usado en: SelectInput del formulario
 */
export const TIPO_CHOICES = [
  { id: "normal", name: "Normal" },
  { id: "directa", name: "Compra Directa" },
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
 * Configuración de campos
 */
export const FIELD_CONFIG = {
  COMENTARIO_SNIPPET_LENGTH: 25,
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
  tipo: "normal" | "directa";
  fecha_necesidad: string;
  solicitante_id: number;
  comentario?: string;
  detalles: SolicitudDetalle[];
};

// ============================================
// 3. VALORES DEFAULT
// ============================================

/**
 * Estado inicial para nuevo detalle
 */
export const DETALLE_DEFAULT_VALUES: DetalleFormValues = {
  articulo_id: "",
  descripcion: "",
  unidad_medida: "UN",
  cantidad: 1,
};

/**
 * Estado inicial para nueva solicitud
 */
export const SOLICITUD_DEFAULT_VALUES: Partial<Solicitud> = {
  tipo: "normal",
  fecha_necesidad: new Date().toISOString().split("T")[0],
  detalles: [],
};

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

/**
 * Interfaz genérica para opciones de referencias
 */
export interface ReferenceOption {
  id: number;
  nombre: string;
}

/**
 * Convierte detalle de BD a formato de formulario
 * 
 * Transformaciones aplicadas:
 * - number → string para IDs (compatibilidad Combobox)
 * 
 * @param detalle - Detalle desde BD
 * @returns Valores para edición en formulario
 * 
 * @example
 * ```ts
 * const formValues = transformToForm(detalle);
 * detalleForm.reset(formValues);
 * ```
 */
export function transformToForm(
  detalle: SolicitudDetalle
): DetalleFormValues {
  return {
    articulo_id: detalle.articulo_id != null ? String(detalle.articulo_id) : "",
    descripcion: detalle.descripcion,
    unidad_medida: detalle.unidad_medida,
    cantidad: detalle.cantidad,
  };
}

/**
 * Convierte datos de formulario a detalle para BD
 * 
 * Transformaciones aplicadas:
 * - string → number para IDs
 * - trim() en campos de texto
 * - Enriquecimiento con nombre del artículo
 * 
 * @param data - Datos del formulario
 * @param articuloOptions - Referencias disponibles
 * @returns Detalle normalizado para persistir
 * 
 * @example
 * ```ts
 * const detalle = transformToPersist(formData, articuloOptions);
 * handleSubmit(detalle);
 * ```
 */
export function transformToPersist(
  data: DetalleFormValues,
  articuloOptions: ReferenceOption[]
): SolicitudDetalle {
  const selectedArticulo = articuloOptions.find(
    (option) => String(option.id) === data.articulo_id
  );

  return {
    articulo_id: selectedArticulo ? selectedArticulo.id : null,
    articulo_nombre: selectedArticulo?.nombre ?? "",
    descripcion: data.descripcion.trim(),
    unidad_medida: data.unidad_medida.trim(),
    cantidad: data.cantidad,
  };
}

// ============================================
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
  articuloOptions: ReferenceOption[]
): string {
  return (
    item.articulo_nombre ||
    articuloOptions.find((option) => option.id === item.articulo_id)?.nombre ||
    "Sin articulo"
  );
}

/**
 * Genera subtítulo para sección de datos generales
 * 
 * Formato: "ID - Tipo - Comentario (primeros 25 chars)"
 * 
 * @param id - ID de la solicitud
 * @param tipo - Tipo de solicitud
 * @param comentario - Comentario completo
 * @returns Subtítulo formateado o "Sin datos"
 */
export function buildGeneralSubtitle(
  id: number | undefined,
  tipo: string | undefined,
  comentario: string | undefined
): string {
  const snippet = comentario 
    ? comentario.slice(0, FIELD_CONFIG.COMENTARIO_SNIPPET_LENGTH) 
    : "";
  return [id, tipo, snippet].filter(Boolean).join(" - ") || "Sin datos";
}

// ============================================
// EXPORTS CONSOLIDADOS (para facilitar imports)
// ============================================

/**
 * Configuración completa del modelo
 * Útil para importar todo de una vez
 */
export const SolicitudModel = {
  // Configuración
  TIPO_CHOICES,
  UNIDAD_MEDIDA_CHOICES,
  VALIDATION_RULES,
  FIELD_CONFIG,
  ARTICULOS_REFERENCE,
  
  // Valores default
  DETALLE_DEFAULT_VALUES,
  SOLICITUD_DEFAULT_VALUES,
  
  // Funciones
  validateDetalle,
  transformToForm,
  transformToPersist,
  getArticuloLabel,
  buildGeneralSubtitle,
} as const;
