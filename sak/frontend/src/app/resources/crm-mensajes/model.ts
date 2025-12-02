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
  oportunidad_generar?: boolean;
  evento_id?: number | null;
  estado: CRMMensajeEstado;
  prioridad: CRMMensajePrioridad;
  asunto?: string | null;
  contenido?: string | null;
  fecha_mensaje?: string | null;
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
