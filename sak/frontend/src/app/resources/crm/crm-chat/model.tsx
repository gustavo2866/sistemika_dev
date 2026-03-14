"use client";

import type { CRMMensaje } from "../crm-mensajes/model";

export type CRMChatConversation = {
  id: string;
  contacto_id?: number | null;
  oportunidad_id?: number | null;
  oportunidad_titulo?: string | null;
  oportunidad_estado?: string | null;
  oportunidad_activo?: boolean | null;
  oportunidad_tipo_operacion_nombre?: string | null;
  oportunidad_tipo_operacion_codigo?: string | null;
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

const DEFAULT_TIMEZONE_OFFSET = "-03:00";

const parseMensajeDate = (
  value?: string | number | Date | null,
  options?: { assumeUtc?: boolean; assumeOffset?: string }
) => {
  if (value == null) return null;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  const hasTimeZone = /[zZ]|([+-]\d{2}:?\d{2})$/.test(raw);
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  if (!hasTimeZone) {
    if (options?.assumeUtc) {
      const utc = new Date(`${normalized}Z`);
      if (!Number.isNaN(utc.getTime())) return utc;
    }
    if (options?.assumeOffset) {
      const withOffset = new Date(`${normalized}${options.assumeOffset}`);
      if (!Number.isNaN(withOffset.getTime())) return withOffset;
    }
  }

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;

  const isoLike = new Date(normalized);
  if (!Number.isNaN(isoLike.getTime())) return isoLike;

  const slashMatch = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (slashMatch) {
    const [, dd, mm, yyyy, hh = "0", mi = "0", ss = "0"] = slashMatch;
    const date = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(mi),
      Number(ss)
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dashMatch = raw.match(
    /^(\d{1,2})-(\d{1,2})-(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (dashMatch) {
    const [, dd, mm, yyyy, hh = "0", mi = "0", ss = "0"] = dashMatch;
    const date = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(mi),
      Number(ss)
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

const resolveMensajeDate = (mensaje: CRMMensaje) => {
  const fechaMensaje = (mensaje as any).fecha_mensaje;
  const createdAt = (mensaje as any).created_at;
  const raw = fechaMensaje ?? createdAt;
  // El backend siempre envía fechas en UTC con formato ISO terminado en Z
  // parseMensajeDate las interpreta correctamente y toLocaleTimeString las convierte a hora local
  return parseMensajeDate(raw, {
    assumeUtc: false, // No asumir nada, confiar en el formato que viene
    assumeOffset: undefined, // No asumir offset
  });
};

export const getMensajeTimestamp = (mensaje: CRMMensaje) => {
  const date = resolveMensajeDate(mensaje);
  return date ? date.getTime() : 0;
};

export const formatMensajeTime = (mensaje: CRMMensaje) => {
  const date = resolveMensajeDate(mensaje);
  if (!date) return "";
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
};

export const formatMensajeDate = (mensaje: CRMMensaje) => {
  const date = resolveMensajeDate(mensaje);
  if (!date) return "";
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
};
