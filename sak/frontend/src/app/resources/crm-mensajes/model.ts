"use client";

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
  id: number;
  tipo: CRMMensajeTipo;
  canal: CRMMensajeCanal;
  contacto_id?: number | null;
  contacto?: CRMReference | null;
  contacto_referencia?: string | null;
  contacto_nombre_propuesto?: string | null;
  evento_id?: number | null;
  estado: CRMMensajeEstado;
  prioridad: CRMMensajePrioridad;
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

export const ESTADOS_POR_TIPO: Record<CRMMensajeTipo, CRMMensajeEstado[]> = {
  entrada: ["nuevo", "recibido", "descartado"],
  salida: ["pendiente_envio", "enviado", "error_envio"],
};

export const CRM_MENSAJE_PRIORIDAD_CHOICES: { id: string; name: string }[] = [
  { id: "alta", name: "Alta" },
  { id: "media", name: "Media" },
  { id: "baja", name: "Baja" },
];

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

// Domain logic: Filter helpers
export const getEstadosPorTipo = (tipo?: CRMMensajeTipo): CRMMensajeEstado[] => {
  if (!tipo) return [];
  return ESTADOS_POR_TIPO[tipo] ?? [];
};

export const isValidEstadoForTipo = (estado: CRMMensajeEstado, tipo: CRMMensajeTipo): boolean => {
  return ESTADOS_POR_TIPO[tipo]?.includes(estado) ?? false;
};

export type TipoToggleValue = "nuevos" | "entrada" | "salida";

export const getTipoEstadoFromToggle = (value: TipoToggleValue): { tipo: CRMMensajeTipo; estado?: CRMMensajeEstado } => {
  switch (value) {
    case "nuevos":
      return { tipo: "entrada", estado: "nuevo" };
    case "entrada":
      return { tipo: "entrada", estado: "recibido" };
    case "salida":
      return { tipo: "salida" };
  }
};

export const getToggleFromTipoEstado = (tipo?: CRMMensajeTipo, estado?: CRMMensajeEstado): TipoToggleValue | undefined => {
  if (tipo === "entrada" && estado === "nuevo") return "nuevos";
  if (tipo === "entrada" && estado === "recibido") return "entrada";
  if (tipo === "salida") return "salida";
  return undefined;
};

// Constantes para eventos
export const EVENT_TYPE_CHOICES = [
  { value: "llamada", label: "Llamada" },
  { value: "reunion", label: "Reunión" },
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

// Domain logic: Tipo operación filter
export interface TipoOperacionOption {
  id: string;
  label: string;
}

export const loadTiposOperacion = async (
  dataProvider: any
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
    console.error("No se pudieron cargar los tipos de operación:", error);
    return [];
  }
};
