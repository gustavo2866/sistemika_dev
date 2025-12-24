"use client";

import type { CRMMensaje } from "../crm-mensajes/model";

export type CRMChatConversation = {
  id: string;
  contacto_id?: number | null;
  oportunidad_id?: number | null;
  contacto_referencia?: string | null;
  contacto_nombre?: string | null;
  ultimo_mensaje?: CRMMensaje | null;
  fecha?: string | null;
  unread_count?: number;
};

export const buildConversationId = (mensaje: CRMMensaje) => {
  if (mensaje.oportunidad_id) {
    return `op-${mensaje.oportunidad_id}`;
  }
  if (mensaje.contacto_id) {
    return `co-${mensaje.contacto_id}`;
  }
  if (mensaje.contacto_referencia) {
    return `ref-${encodeURIComponent(mensaje.contacto_referencia)}`;
  }
  return `msg-${mensaje.id}`;
};

export const getConversationDisplayName = (mensaje: CRMMensaje) =>
  mensaje.contacto?.nombre_completo ??
  mensaje.contacto?.nombre ??
  mensaje.contacto_nombre_propuesto ??
  mensaje.contacto_referencia ??
  `Mensaje #${mensaje.id}`;

export const getMensajeTimestamp = (mensaje: CRMMensaje) => {
  const raw = (mensaje as any).fecha_mensaje ?? (mensaje as any).created_at;
  if (!raw) return 0;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

export const formatMensajeTime = (mensaje: CRMMensaje) => {
  const raw = (mensaje as any).fecha_mensaje ?? (mensaje as any).created_at;
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
};

export const formatMensajeDate = (mensaje: CRMMensaje) => {
  const raw = (mensaje as any).fecha_mensaje ?? (mensaje as any).created_at;
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
};
