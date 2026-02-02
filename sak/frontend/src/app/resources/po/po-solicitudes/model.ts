/**
 * Modelo de dominio para Solicitudes.
 *
 * PATRON ESTANDAR PARA TODAS LAS ENTIDADES.
 *
 * Este archivo contiene SOLO logica de negocio y definiciones del modelo.
 * NO contiene componentes React ni logica de presentacion.
 *
 * Estructura:
 * 1. CONFIGURACION - Constantes y valores de dominio
 * 2. TIPOS - Interfaces y types del modelo
 * 3. VALORES DEFAULT - Estado inicial para formularios
 * 4. VALIDACIONES - Reglas de negocio para validar datos
 * 5. TRANSFORMACIONES - Conversiones entre formatos
 * 6. ESQUEMAS - Declarativos para formularios
 * 7. HELPERS - Utilidades especificas del dominio
 */

import {
  CURRENCY_FORMATTER,
  formatCurrency,
  formatImporteDisplay,
  roundCurrency,
} from "@/lib/formatters";
import {
  calculateImporte,
  calculateTotal,
  getArticuloFilterByTipo,
  normalizeId,
  normalizeNumber,
  normalizeOptionalNumber,
  parseNumberOrDefault,
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
//#region 

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

//#endregion

// ============================================
// 2. TIPOS
// ============================================
//#region 

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

export type WizardCreatePayload = {
  titulo: string;
  tipo_solicitud_id: number | null;
  departamento_id: number | null;
  centro_costo_id: number | null;
  tipo_compra: string | null;
  proveedor_id: number | null;
  solicitante_id: number | null;
  oportunidad_id: number | null;
  fecha_necesidad: string | null;
  comentario: string;
  total: number;
  detalles: Array<{
    articulo_id: number;
    descripcion: string;
    unidad_medida: string;
    cantidad: number;
    precio: number;
    importe: number;
  }>;
};

export type PoSolicitudPayload = {
  titulo: string;
  tipo_solicitud_id: number | string | null;
  departamento_id: number | string | null;
  centro_costo_id: number | string | null;
  tipo_compra: string | null;
  proveedor_id: number | string | null;
  solicitante_id: number | string | null;
  oportunidad_id: number | string | null;
  fecha_necesidad: string | null;
  comentario: string;
  total?: number | string | null;
  detalles: Array<{
    articulo_id: number | string | null;
    descripcion?: string;
    unidad_medida?: string;
    cantidad?: number | string | null;
    precio?: number | string | null;
    importe?: number | string | null;
  }>;
};

// Detalle persistido (modelo de base de datos)
export type PoSolicitudDetalle = {
  id: number;
  tempId: number;
  solicitud_id: number;
  articulo_id: number | null;
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio: number;
  importe: number;
};

// PoSolicitud completa (modelo principal)
export type PoSolicitud = {
  id: number;
  titulo: string;
  tipo_solicitud_id: number;        // ✅ NUEVO - FK a tipos_solicitud
  departamento_id: number;          // ✅ NUEVO - FK a departamentos
  centro_costo_id: number | null;
  estado: string;                   // ✅ NUEVO - enum EstadoSolicitud
  tipo_compra: string | null;
  total: number;                    // ✅ NUEVO - monto total
  fecha_necesidad: string | null;
  solicitante_id: number;
  comentario: string;
  oportunidad_id: number | null;
  proveedor_id: number | null;
  detalles: PoSolicitudDetalle[];
  
  // Relaciones expandidas
  solicitante: {
    id: number;
    nombre: string;
    email: string;
  };
  tipo_solicitud: {                // ✅ NUEVO
    id: number;
    nombre: string;
    tipo_articulo_filter_id: number | null;
    tipo_articulo_filter_rel: {
      id: number;
      nombre: string;
    };
    articulo_default_id: number;
  };
  departamento: {                  // ✅ NUEVO
    id: number;
    nombre: string;
  };
  centro_costo: {
    id: number;
    nombre: string;
    tipo: string;
    codigo_contable: string;
  };
  oportunidad: {
    id: number;
    titulo: string | null;
  };
  proveedor: {
    id: number;
    nombre: string;
  };
};

//#endregion

// ============================================
// 3. VALORES DEFAULT
// ============================================
// #region 

export type PoSolicitudCabeceraDefaults = {
  titulo?: string;
  tipo_solicitud_id?: string;
  departamento_id?: string;
  centro_costo_id?: string;
  estado?: string;
  tipo_compra?: string;
  fecha_necesidad?: string;
  solicitante_id?: string;
  comentario?: string;
  oportunidad_id?: number | string | null;
  proveedor_id?: string;
  [key: string]: unknown;
};

export const buildPoSolicitudDefaultValues = ({
  cabeceraDefaults,
  today,
  oportunidadIdFromLocation,
}: {
  cabeceraDefaults: PoSolicitudCabeceraDefaults;
  today: string;
  oportunidadIdFromLocation?: number | null;
}) => {
  const solicitanteDefault = parseOptionalNumber(cabeceraDefaults.solicitante_id);
  const centroCostoDefault = parseOptionalNumber(cabeceraDefaults.centro_costo_id);
  const oportunidadDefault = parseOptionalNumber(oportunidadIdFromLocation);

  return {
    ...cabeceraDefaults,
    fecha_necesidad: cabeceraDefaults.fecha_necesidad || today,
    solicitante_id: solicitanteDefault,
    centro_costo_id: centroCostoDefault,
    oportunidad_id: oportunidadDefault ?? cabeceraDefaults.oportunidad_id,
    total: 0,
    detalles: [] as PoSolicitudDetalle[],
  };
};

// #endregion


// ============================================
// 4. VALIDACIONES
// ============================================
// #region

type ValidationErrors<T> = Partial<Record<keyof T, string>>;

// Valida un detalle y registra errores en el formulario.
export function validateDetalle(
  data: {
    articulo_id: string;
    descripcion: string;
    unidad_medida: string;
    cantidad: number;
    precio: number;
    importe: number;
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

  if (!Number.isFinite(data.precio) || data.precio < 0) {
    errors.precio = "El precio debe ser mayor o igual a 0";
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

// #endregion

// ============================================
// 5. TRANSFORMACIONES
// ============================================
//#region

// Límites para truncar texto en la UI
export const TEXT_LIMITS = {
  ARTICLE_NAME: 30,
  DESCRIPTION: 90,
} as const;

// Trunca texto a un limite especifico.
export function truncateText(value: string, limit: number): string {
  if (!value) return "";
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
}

// Resuelve el tipo de compra segun la presencia de proveedor.
export const resolveTipoCompra = (proveedorId: number | null) =>
  proveedorId ? "directa" : "normal";

// Resuelve el centro de costo segun reglas de negocio.
export const resolveCentroCostoId = ({
  oportunidadId,
  departamentoNombre,
  departamentoCentroCostoId,
  solicitanteCentroCostoId,
}: {
  oportunidadId: string | null;
  departamentoNombre: string | null;
  departamentoCentroCostoId: number | null;
  solicitanteCentroCostoId: number | null;
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

// Arma subtitulo de cabecera combinando titulo y proveedor.
export const buildPoSolicitudCabeceraSubtitle = ({
  titulo,
  tipoSolicitudNombre,
}: {
  titulo?: string | null;
  tipoSolicitudNombre?: string | null;
}) => {
  const safeTitulo = titulo?.trim() ? titulo.trim() : "Sin titulo";
  const safeTipo = tipoSolicitudNombre?.trim()
    ? tipoSolicitudNombre.trim()
    : "Sin tipo";
  return `Titulo: ${safeTitulo} (${safeTipo})`;
};

export const buildPoSolicitudImputacionSubtitle = ({
  oportunidadTitulo,
  centroCostoNombre,
}: {
  oportunidadTitulo?: string | null;
  centroCostoNombre?: string | null;
}) => {
  const safeOportunidad = oportunidadTitulo?.trim();
  if (safeOportunidad) return `Oportunidad: ${safeOportunidad}`;
  const safeCentro = centroCostoNombre?.trim();
  if (safeCentro) return `Centro costo: ${safeCentro}`;
  return "Sin imputacion";
};

export const poSolicitudCabeceraSchema = createEntitySchema<
  {
    titulo: string;
    tipo_solicitud_id: string;
    departamento_id: string;
    centro_costo_id: string;
    estado: string;
    tipo_compra: string;
    fecha_necesidad: string;
    solicitante_id: string;
    comentario: string;
    oportunidad_id: string;
    proveedor_id: string;
  },
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
    fecha_necesidad: stringField({
      required: false,
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

export const poSolicitudDetalleSchema = createDetailSchema<
  {
    articulo_id: string;
    descripcion: string;
    unidad_medida: string;
    cantidad: number;
    precio: number;
    importe: number;
  },
  PoSolicitudDetalle
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

export const WIZARD_DEFAULTS = {
  titulo: "",
  fechaNecesidad: "",
  proveedorId: "",
  solicitanteId: "",
  oportunidadId: "",
  tipoSolicitudId: "",
  departamentoId: "",
  tipoCompra: "normal",
  articuloId: "",
  cantidad: 1,
  precio: 0,
  descripcion: "",
} as const;

type NormalizedDetallePayload = {
  articulo_id: number;
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio: number;
  importe: number;
};

export const buildPoSolicitudPayload = (payload: PoSolicitudPayload): WizardCreatePayload => {
  const normalizeIdValue = (value: number | string | null | undefined) => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    return normalizeId(value ?? null);
  };

  const normalizedProveedorId = normalizeIdValue(payload.proveedor_id);
  const normalizedSolicitanteId = normalizeIdValue(payload.solicitante_id);
  const normalizedTipoSolicitudId = normalizeIdValue(payload.tipo_solicitud_id);
  const normalizedDepartamentoId = normalizeIdValue(payload.departamento_id);
  const normalizedCentroCostoId = normalizeIdValue(payload.centro_costo_id);
  const normalizedOportunidadId = normalizeIdValue(payload.oportunidad_id);

  const hasTipoCompra =
    payload.tipo_compra && String(payload.tipo_compra).trim().length > 0;
  const resolvedTipoCompra =
    normalizedProveedorId != null
      ? resolveTipoCompra(normalizedProveedorId)
      : hasTipoCompra
        ? payload.tipo_compra
        : resolveTipoCompra(normalizedProveedorId);

  const resolvedFecha =
    payload.fecha_necesidad && String(payload.fecha_necesidad).trim().length > 0
      ? payload.fecha_necesidad
      : null;

  const detalles = (payload.detalles ?? [])
    .map((detalle) => {
      const normalizedArticuloId = normalizeIdValue(detalle.articulo_id);
      if (normalizedArticuloId == null) {
        return null;
      }
      const cantidad = normalizeOptionalNumber(detalle.cantidad ?? null);
      const precio = normalizeOptionalNumber(detalle.precio ?? null);
      const importe =
        cantidad != null && precio != null
          ? calculateImporte(cantidad, precio)
          : normalizeOptionalNumber(detalle.importe ?? null) ?? 0;

      return {
        articulo_id: normalizedArticuloId,
        descripcion: detalle.descripcion ?? "",
        unidad_medida: detalle.unidad_medida ?? "UN",
        cantidad: cantidad ?? 0,
        precio: precio ?? 0,
        importe,
      };
    })
    .filter((detalle): detalle is NormalizedDetallePayload => Boolean(detalle));

  const total = roundCurrency(calculateTotal(detalles));

  return {
    titulo: payload.titulo ?? "",
    tipo_solicitud_id: normalizedTipoSolicitudId,
    departamento_id: normalizedDepartamentoId,
    centro_costo_id: normalizedCentroCostoId,
    tipo_compra: resolvedTipoCompra,
    proveedor_id: normalizedProveedorId,
    solicitante_id: normalizedSolicitanteId,
    oportunidad_id: normalizedOportunidadId,
    fecha_necesidad: resolvedFecha,
    comentario: payload.comentario ?? "",
    total,
    detalles,
  };
};

export const buildWizardCreatePayload = ({
  values,
  proveedorId,
  solicitanteDepartamentoIdValue,
  departamentoData,
  solicitanteData,
  unidadMedida,
}: {
  values: {
    titulo: string;
    fechaNecesidad: string;
    proveedorId: string;
    solicitanteId: string;
    oportunidadId: string;
    tipoSolicitudId: string;
    departamentoId: string;
    tipoCompra: string;
    articuloId: string;
    cantidad: number;
    precio: number;
    descripcion: string;
  };
  proveedorId: number | null;
  solicitanteDepartamentoIdValue: number | null;
  departamentoData: { nombre?: string; centro_costo_id?: number | null } | null;
  solicitanteData: { centro_costo_id?: number | null } | null;
  unidadMedida: string;
}) => {
  const cantidad = normalizeNumber(values.cantidad);
  const precio = normalizeNumber(values.precio);
  const normalizedProveedorId = proveedorId ?? normalizeId(values.proveedorId);
  const normalizedSolicitanteId = normalizeId(values.solicitanteId);
  const normalizedTipoSolicitudId = normalizeId(values.tipoSolicitudId);
  const normalizedDepartamentoId = normalizeId(values.departamentoId);
  const normalizedArticuloId = normalizeId(values.articuloId);
  const normalizedOportunidadId = normalizeId(values.oportunidadId);
  const resolvedFecha =
    values.fechaNecesidad && String(values.fechaNecesidad).trim().length > 0
      ? values.fechaNecesidad
      : new Date().toISOString().slice(0, 10);
  const resolvedDepartamentoId =
    normalizedDepartamentoId ??
    (solicitanteDepartamentoIdValue != null
      ? Number(solicitanteDepartamentoIdValue)
      : null);
  const departamentoNombre = departamentoData?.nombre;
  const resolvedCentroCostoId =
    normalizedOportunidadId != null
      ? null
      : resolveCentroCostoId({
          oportunidadId: values.oportunidadId ?? null,
          departamentoNombre: departamentoNombre ?? null,
          departamentoCentroCostoId: departamentoData?.centro_costo_id ?? null,
          solicitanteCentroCostoId: solicitanteData?.centro_costo_id ?? null,
        });
  const resolvedTipoCompra = resolveTipoCompra(normalizedProveedorId);
  const resolvedCantidad = normalizedArticuloId ? normalizeOptionalNumber(cantidad) : null;
  const resolvedPrecio = normalizedArticuloId ? normalizeOptionalNumber(precio) : null;
  const detalleImporte =
    resolvedCantidad != null && resolvedPrecio != null
      ? calculateImporte(resolvedCantidad, resolvedPrecio)
      : 0;
  const total = roundCurrency(detalleImporte);

  return buildPoSolicitudPayload({
    proveedor_id: normalizedProveedorId,
    solicitante_id: normalizedSolicitanteId,
    tipo_solicitud_id: normalizedTipoSolicitudId,
    departamento_id: resolvedDepartamentoId,
    centro_costo_id: resolvedCentroCostoId,
    tipo_compra: resolvedTipoCompra,
    titulo: values.titulo,
    comentario: "",
    fecha_necesidad: resolvedFecha,
    oportunidad_id: normalizedOportunidadId,
    total,
    detalles: normalizedArticuloId
      ? [
          {
            articulo_id: normalizedArticuloId,
            descripcion: values.descripcion ?? "",
            unidad_medida: unidadMedida,
            cantidad: resolvedCantidad ?? 0,
            precio: resolvedPrecio ?? 0,
            importe: detalleImporte,
          },
        ]
      : [],
  });
};


// Formatea un valor numérico como moneda
export { CURRENCY_FORMATTER, formatCurrency, formatImporteDisplay, roundCurrency };
export {
  calculateImporte,
  calculateTotal,
  getArticuloFilterByTipo,
  normalizeId,
  normalizeNumber,
  normalizeOptionalNumber,
};

//#endregion

// ============================================
// 7. HELPERS
// ============================================
//#region 

// Obtiene etiqueta legible de un articulo.
export function getArticuloLabel(
  item: PoSolicitudDetalle,
  articuloOptions: Array<{ id: number; nombre: string }>
): string {
  return (
    (item as any).articulo_nombre ||
    articuloOptions.find((option) => option.id === item.articulo_id)?.nombre ||
    "Sin artículo"
  );
}

// Obtiene el departamento default segun el tipo de PoSolicitud.
export const getDepartamentoDefaultByTipo = (
  tipoSolicitudId: string | undefined,
  tiposSolicitud: Array<{ id: number; departamento_default_id?: number }> | undefined
): string | undefined => {
  if (!tipoSolicitudId || !tiposSolicitud) return undefined;
  
  const tipo = tiposSolicitud.find(t => t.id === parseInt(tipoSolicitudId));
  return tipo?.departamento_default_id?.toString();
};

// Obtiene el articulo default segun el tipo de PoSolicitud.
export const getArticuloDefaultByTipo = (
  tipoSolicitudId: string | undefined,
  tiposSolicitud: Array<{ id: number; articulo_default_id?: number }> | undefined
): string | undefined => {
  if (!tipoSolicitudId || !tiposSolicitud) return undefined;
  
  const tipo = tiposSolicitud.find(t => t.id === parseInt(tipoSolicitudId));
  return tipo?.articulo_default_id?.toString();
};

//#endregion
