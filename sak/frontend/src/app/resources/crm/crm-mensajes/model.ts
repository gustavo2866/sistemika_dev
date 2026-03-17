"use client";

import { z } from "zod";

//#region Tipos del dominio

export type CRMMensajeTipo = "entrada" | "salida";
export type CRMMensajeCanal = "whatsapp" | "email" | "red_social" | "otro";
export type CRMMensajeEstado =
  | "nuevo"
  | "recibido"
  | "descartado"
  | "pendiente_envio"
  | "enviado"
  | "error_envio";
export type CRMMensajePrioridad = "alta" | "media" | "baja";

type CRMReference = {
  id: number;
  nombre?: string | null;
  nombre_completo?: string | null;
};

export type CRMMensaje = {
  id?: number | string;
  tipo?: CRMMensajeTipo | null;
  canal?: CRMMensajeCanal | null;
  contacto_id?: number | null;
  contacto?: CRMReference | null;
  contacto_referencia?: string | null;
  contacto_nombre_propuesto?: string | null;
  evento_id?: number | null;
  estado?: CRMMensajeEstado | null;
  prioridad?: CRMMensajePrioridad | null;
  asunto?: string | null;
  contenido?: string | null;
  fecha_mensaje?: string | null;
  fecha_estado?: string | null;
  adjuntos?: Array<Record<string, unknown>>;
  origen_externo_id?: string | null;
  metadata?: Record<string, unknown>;
  responsable_id?: number | null;
  responsable?: CRMReference | null;
  contacto_alias?: string | null;
  oportunidad_id?: number | null;
  oportunidad?: {
    id: number;
    estado?: string | null;
    descripcion_estado?: string | null;
    descripcion?: string | null;
    nombre?: string | null;
    contacto?: CRMReference | null;
    propiedad?: {
      id?: number | null;
      nombre?: string | null;
    } | null;
  } | null;
};

// Tipo específico para uso con React Admin que garantiza que id existe
export type CRMMensajeRecord = CRMMensaje & {
  id: number | string;
};

//#endregion Tipos del dominio

//#region Reglas de validacion

export const VALIDATION_RULES = {
  ASUNTO: { MAX_LENGTH: 255 },
  CONTENIDO: { MAX_LENGTH: 5000 },
  CONTACTO_REFERENCIA: { MAX_LENGTH: 255 },
  CONTACTO_NOMBRE_PROPUESTO: { MAX_LENGTH: 255 },
  ORIGEN_EXTERNO_ID: { MAX_LENGTH: 255 },
  MENSAJE_SALIDA_CONTACTO_NOMBRE: { MAX_LENGTH: 255 },
  MENSAJE_SALIDA_CONTACTO_TELEFONO: { MAX_LENGTH: 50 },
  MENSAJE_SALIDA_DESCRIPCION: { MAX_LENGTH: 5000 },
} as const;

//#endregion Reglas de validacion

//#region Choices del recurso

export const CRM_MENSAJE_TIPO_CHOICES: { id: string; name: string }[] = [
  { id: "entrada", name: "Entrada" },
  { id: "salida", name: "Salida" },
];

export const CRM_MENSAJE_CANAL_CHOICES: { id: string; name: string }[] = [
  { id: "whatsapp", name: "WhatsApp" },
  { id: "email", name: "Email" },
  { id: "red_social", name: "Red social" },
  { id: "otro", name: "Otro" },
];

export const CRM_MENSAJE_ESTADO_CHOICES: { id: string; name: string }[] = [
  { id: "nuevo", name: "Nuevo" },
  { id: "recibido", name: "Recibido" },
  { id: "descartado", name: "Descartado" },
  { id: "pendiente_envio", name: "Pendiente envio" },
  { id: "enviado", name: "Enviado" },
  { id: "error_envio", name: "Error envio" },
];

export const CRM_MENSAJE_PRIORIDAD_CHOICES: { id: string; name: string }[] = [
  { id: "alta", name: "Alta" },
  { id: "media", name: "Media" },
  { id: "baja", name: "Baja" },
];

export const ESTADOS_POR_TIPO: Record<CRMMensajeTipo, CRMMensajeEstado[]> = {
  entrada: ["nuevo", "recibido", "descartado"],
  salida: ["pendiente_envio", "enviado", "error_envio"],
};

//#endregion Choices del recurso

//#region Clases visuales

export const CRM_MENSAJE_ESTADO_BADGES: Record<CRMMensajeEstado, string> = {
  nuevo: "bg-blue-100 text-blue-800",
  recibido: "bg-emerald-100 text-emerald-800",
  descartado: "bg-slate-200 text-slate-800",
  pendiente_envio: "bg-amber-100 text-amber-800",
  enviado: "bg-indigo-100 text-indigo-800",
  error_envio: "bg-rose-100 text-rose-800",
};

export const CRM_MENSAJE_PRIORIDAD_BADGES: Record<CRMMensajePrioridad, string> = {
  alta: "bg-rose-100 text-rose-800",
  media: "bg-amber-100 text-amber-800",
  baja: "bg-emerald-100 text-emerald-800",
};

export const CRM_MENSAJE_TIPO_BADGES: Record<CRMMensajeTipo, string> = {
  entrada: "bg-slate-100 text-slate-800",
  salida: "bg-sky-100 text-sky-800",
};

//#endregion Clases visuales

//#region Normalizadores internos

// Convierte strings vacios o nulos en un valor opcional consistente.
const normalizeOptionalString = (value: unknown) =>
  value === "" || value === null ? undefined : value;

// Convierte valores numericos del formulario a enteros o undefined.
const normalizeOptionalId = (value: unknown) => {
  if (value == null || value === "") return undefined;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
};

// Normaliza textos obligatorios evitando espacios residuales.
const trimRequiredText = (value?: string | null) => (value ?? "").trim();

// Normaliza textos opcionales devolviendo undefined cuando quedan vacios.
const trimOptionalText = (value?: string | null) => {
  const normalizedValue = (value ?? "").trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
};

// Devuelve un estado valido segun el tipo de mensaje seleccionado.
const normalizeEstadoForTipo = (
  tipo?: CRMMensajeTipo,
  estado?: CRMMensajeEstado,
): CRMMensajeEstado => {
  if (tipo === "salida") {
    return estado && ESTADOS_POR_TIPO.salida.includes(estado)
      ? estado
      : "pendiente_envio";
  }

  return estado && ESTADOS_POR_TIPO.entrada.includes(estado)
    ? estado
    : "nuevo";
};

//#endregion Normalizadores internos

//#region Schemas auxiliares

const optionalStringSchema = z.preprocess(
  normalizeOptionalString,
  z.string().optional(),
);

const optionalIdSchema = z.preprocess(
  normalizeOptionalId,
  z.number().int().positive().optional(),
);

//#endregion Schemas auxiliares

//#region Contratos del formulario

export const crmMensajeSchema = z.object({
  tipo: z.enum(["entrada", "salida"]),
  canal: z.enum(["whatsapp", "email", "red_social", "otro"]),
  contacto_id: optionalIdSchema,
  contacto_referencia: optionalStringSchema.pipe(
    z.string().max(VALIDATION_RULES.CONTACTO_REFERENCIA.MAX_LENGTH).optional(),
  ),
  contacto_nombre_propuesto: optionalStringSchema.pipe(
    z
      .string()
      .max(VALIDATION_RULES.CONTACTO_NOMBRE_PROPUESTO.MAX_LENGTH)
      .optional(),
  ),
  evento_id: optionalIdSchema,
  estado: z.enum([
    "nuevo",
    "recibido",
    "descartado",
    "pendiente_envio",
    "enviado",
    "error_envio",
  ]),
  prioridad: z.enum(["alta", "media", "baja"]),
  asunto: optionalStringSchema.pipe(
    z.string().max(VALIDATION_RULES.ASUNTO.MAX_LENGTH).optional(),
  ),
  contenido: optionalStringSchema.pipe(
    z.string().max(VALIDATION_RULES.CONTENIDO.MAX_LENGTH).optional(),
  ),
  fecha_mensaje: optionalStringSchema.pipe(z.string().optional()),
  origen_externo_id: optionalStringSchema.pipe(
    z.string().max(VALIDATION_RULES.ORIGEN_EXTERNO_ID.MAX_LENGTH).optional(),
  ),
  responsable_id: optionalIdSchema,
  oportunidad_id: optionalIdSchema,
});

export const crmMensajeSalidaSchema = z.object({
  responsable_id: optionalIdSchema,
  contacto_id: optionalIdSchema,
  contacto_nombre: optionalStringSchema.pipe(
    z
      .string()
      .max(VALIDATION_RULES.MENSAJE_SALIDA_CONTACTO_NOMBRE.MAX_LENGTH)
      .optional(),
  ),
  contacto_telefono: optionalStringSchema.pipe(
    z
      .string()
      .max(VALIDATION_RULES.MENSAJE_SALIDA_CONTACTO_TELEFONO.MAX_LENGTH)
      .optional(),
  ),
  oportunidad_id: optionalIdSchema,
  descripcion: z
    .string()
    .min(1)
    .max(VALIDATION_RULES.MENSAJE_SALIDA_DESCRIPCION.MAX_LENGTH),
});

export type CRMMensajeFormValues = z.infer<typeof crmMensajeSchema>;
export type CRMMensajeSalidaFormValues = z.infer<typeof crmMensajeSalidaSchema>;

export const CRM_MENSAJE_DEFAULTS: CRMMensajeFormValues = {
  tipo: "entrada",
  canal: "whatsapp",
  contacto_id: undefined,
  contacto_referencia: "",
  contacto_nombre_propuesto: "",
  evento_id: undefined,
  estado: "nuevo",
  prioridad: "media",
  asunto: "",
  contenido: "",
  fecha_mensaje: "",
  origen_externo_id: "",
  responsable_id: undefined,
  oportunidad_id: undefined,
};

export const CRM_MENSAJE_SALIDA_DEFAULTS: CRMMensajeSalidaFormValues = {
  responsable_id: undefined,
  contacto_id: undefined,
  contacto_nombre: "",
  contacto_telefono: "",
  oportunidad_id: undefined,
  descripcion: "",
};

//#endregion Contratos del formulario

//#region Helpers publicos del recurso

export const formatMensajeEstado = (value?: CRMMensajeEstado | null) => {
  if (!value) return "Sin estado";
  const option = CRM_MENSAJE_ESTADO_CHOICES.find((choice) => choice.id === value);
  return option?.name ?? value;
};

export const formatMensajeTipo = (value?: CRMMensajeTipo | null) => {
  if (!value) return "Sin tipo";
  const option = CRM_MENSAJE_TIPO_CHOICES.find((choice) => choice.id === value);
  return option?.name ?? value;
};

export const formatMensajeCanal = (value?: CRMMensajeCanal | null) => {
  if (!value) return "Sin canal";
  const option = CRM_MENSAJE_CANAL_CHOICES.find((choice) => choice.id === value);
  return option?.name ?? value;
};

export const formatMensajePrioridad = (value?: CRMMensajePrioridad | null) => {
  if (!value) return "Sin prioridad";
  const option = CRM_MENSAJE_PRIORIDAD_CHOICES.find((choice) => choice.id === value);
  return option?.name ?? value;
};

export const getMensajeEstadoBadgeClass = (estado?: CRMMensajeEstado | null) =>
  estado ? CRM_MENSAJE_ESTADO_BADGES[estado] : "bg-slate-200 text-slate-800";

export const getMensajeTipoBadgeClass = (tipo?: CRMMensajeTipo | null) =>
  tipo ? CRM_MENSAJE_TIPO_BADGES[tipo] : "bg-slate-200 text-slate-800";

export const getMensajePrioridadBadgeClass = (
  prioridad?: CRMMensajePrioridad | null,
) =>
  prioridad
    ? CRM_MENSAJE_PRIORIDAD_BADGES[prioridad]
    : "bg-slate-200 text-slate-800";

export const getEstadosPorTipo = (tipo?: CRMMensajeTipo): CRMMensajeEstado[] => {
  if (!tipo) return [];
  return ESTADOS_POR_TIPO[tipo] ?? [];
};

export const isValidEstadoForTipo = (
  estado: CRMMensajeEstado,
  tipo: CRMMensajeTipo,
): boolean => {
  return ESTADOS_POR_TIPO[tipo]?.includes(estado) ?? false;
};

export type TipoToggleValue = "nuevos" | "entrada" | "salida";

export const getTipoEstadoFromToggle = (
  value: TipoToggleValue,
): { tipo: CRMMensajeTipo; estado?: CRMMensajeEstado } => {
  switch (value) {
    case "nuevos":
      return { tipo: "entrada", estado: "nuevo" };
    case "entrada":
      return { tipo: "entrada", estado: "recibido" };
    case "salida":
      return { tipo: "salida" };
  }
};

export const getToggleFromTipoEstado = (
  tipo?: CRMMensajeTipo,
  estado?: CRMMensajeEstado,
): TipoToggleValue | undefined => {
  if (tipo === "entrada" && estado === "nuevo") return "nuevos";
  if (tipo === "entrada" && estado === "recibido") return "entrada";
  if (tipo === "salida") return "salida";
  return undefined;
};

export const EVENT_TYPE_CHOICES = [
  { value: "llamada", label: "Llamada" },
  { value: "reunion", label: "Reunion" },
  { value: "visita", label: "Visita" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "nota", label: "Nota" },
];

export const DEFAULT_EVENT_STATE = "1-pendiente";

export const getDefaultDateTime = () => {
  const now = new Date();
  const offsetMinutes = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offsetMinutes * 60000);
  return local.toISOString().slice(0, 16);
};

// Normaliza el payload antes de enviarlo al backend en create/edit del CRUD.
export const normalizeMensajePayload = (
  data: Partial<CRMMensajeFormValues>,
): CRMMensajeFormValues => {
  const tipo = data.tipo ?? "entrada";
  const estado = normalizeEstadoForTipo(tipo, data.estado);

  return {
    tipo,
    canal: data.canal ?? "whatsapp",
    contacto_id: normalizeOptionalId(data.contacto_id),
    contacto_referencia: trimOptionalText(data.contacto_referencia),
    contacto_nombre_propuesto: trimOptionalText(data.contacto_nombre_propuesto),
    evento_id: normalizeOptionalId(data.evento_id),
    estado,
    prioridad: data.prioridad ?? "media",
    asunto: trimOptionalText(data.asunto),
    contenido: trimOptionalText(data.contenido),
    fecha_mensaje: trimOptionalText(data.fecha_mensaje),
    origen_externo_id: trimOptionalText(data.origen_externo_id),
    responsable_id: normalizeOptionalId(data.responsable_id),
    oportunidad_id: normalizeOptionalId(data.oportunidad_id),
  };
};

// Normaliza el payload de alta para el flujo de envio de mensajes.
export const normalizeMensajeSalidaPayload = (
  data: Partial<CRMMensajeSalidaFormValues>,
): CRMMensajeSalidaFormValues => ({
  responsable_id: normalizeOptionalId(data.responsable_id),
  contacto_id: normalizeOptionalId(data.contacto_id),
  contacto_nombre: trimOptionalText(data.contacto_nombre),
  contacto_telefono: trimOptionalText(data.contacto_telefono),
  oportunidad_id: normalizeOptionalId(data.oportunidad_id),
  descripcion: trimRequiredText(data.descripcion),
});

export interface TipoOperacionOption {
  id: string;
  label: string;
}

export const loadTiposOperacion = async (
  dataProvider: any,
): Promise<TipoOperacionOption[]> => {
  try {
    const { data } = await dataProvider.getList("crm/catalogos/tipos-operacion", {
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    });

    const normalize = (value?: string | null) => value?.toLowerCase() ?? "";
    const filtered = (data ?? []).filter((item: any) => {
      const text = `${normalize(item?.nombre)} ${normalize(item?.codigo)}`;
      return text.includes("venta") || text.includes("alquiler");
    });

    const base = (filtered.length ? filtered : data) ?? [];
    return base
      .filter((item: any) => item?.id != null)
      .map((item: any) => ({
        id: String(item.id),
        label: item.nombre ?? item.codigo ?? `#${item.id}`,
      }));
  } catch (error) {
    console.error("No se pudieron cargar los tipos de operacion:", error);
    return [];
  }
};

//#endregion Helpers publicos del recurso
