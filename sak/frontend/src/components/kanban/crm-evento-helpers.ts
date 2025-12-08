"use client";

import type { CRMEvento } from "@/app/resources/crm-eventos/model";

export type CanonicalEstado = "1-pendiente" | "2-realizado" | "3-cancelado" | "4-reagendar";

export type BucketKey = "overdue" | "today" | "week" | "next";

export const normalizeEstado = (raw?: string): CanonicalEstado => {
  if (!raw) return "1-pendiente";
  const lower = raw.toLowerCase();
  if (lower.includes("pendiente")) return "1-pendiente";
  if (lower.includes("realizado") || lower.includes("hecho")) return "2-realizado";
  if (lower.includes("cancelado")) return "3-cancelado";
  if (lower.includes("reagendar")) return "4-reagendar";
  return "1-pendiente";
};

export const formatEstadoLabel = (estado: CanonicalEstado): string => {
  switch (estado) {
    case "1-pendiente":
      return "Pendiente";
    case "2-realizado":
      return "Realizado";
    case "3-cancelado":
      return "Cancelado";
    case "4-reagendar":
      return "Reagendar";
    default:
      return "Pendiente";
  }
};

export const formatEventoTitulo = (evento: CRMEvento): string => {
  const titulo = evento.titulo?.trim() ?? "";
  if (!titulo) return "Sin titulo";
  return titulo.replace(/^ATRASADO:\s*/i, "") || "Sin titulo";
};

const cardToneClasses: Record<CanonicalEstado, string> = {
  "1-pendiente": "border-sky-100 bg-white/95 shadow-[0_10px_25px_rgba(14,165,233,0.12)]",
  "2-realizado": "border-emerald-100 bg-emerald-50 shadow-[0_10px_25px_rgba(16,185,129,0.18)]",
  "3-cancelado": "border-rose-200 bg-rose-100 shadow-[0_10px_25px_rgba(244,63,94,0.20)]",
  "4-reagendar": "border-indigo-100 bg-white/95 shadow-[0_10px_25px_rgba(99,102,241,0.12)]",
};

export const getCardStyle = (estado: CanonicalEstado) =>
  cardToneClasses[estado] ?? "border-slate-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.08)]";

export const formatHeaderTimestamp = (dateStr?: string): string => {
  if (!dateStr) return "Sin fecha";
  try {
    const dt = new Date(dateStr);
    const day = String(dt.getDate()).padStart(2, "0");
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const year = dt.getFullYear();
    const hours = String(dt.getHours()).padStart(2, "0");
    const minutes = String(dt.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return "Fecha inválida";
  }
};

export const getOportunidadName = (evento: CRMEvento) => {
  const titulo = evento.oportunidad?.titulo || "";
  if (evento.oportunidad_id) {
    return `#${evento.oportunidad_id}${titulo ? ` ${titulo}` : ""}`.trim();
  }
  return titulo || "Sin oportunidad";
};

export const getContactoName = (evento: CRMEvento) => {
  const contacto = evento.oportunidad?.contacto;
  const contactoNombreManual = (evento.oportunidad as { contacto_nombre?: string } | undefined)?.contacto_nombre?.trim();
  const nombre =
    contacto?.nombre?.trim() ||
    contacto?.nombre_completo?.trim() ||
    contactoNombreManual;
  if (nombre) {
    return nombre;
  }
  const contactoId = evento.oportunidad?.contacto_id;
  return contactoId ? `Contacto #${contactoId}` : "Sin contacto";
};

export const getEstadoBadgeClass = (estado: CanonicalEstado) => {
  switch (estado) {
    case "1-pendiente":
      return "bg-amber-100 text-amber-900 border-transparent";
    case "2-realizado":
      return "bg-emerald-100 text-emerald-900 border-transparent";
    case "3-cancelado":
      return "bg-rose-100 text-rose-900 border-transparent";
    case "4-reagendar":
      return "bg-blue-100 text-blue-900 border-transparent";
    default:
      return "bg-slate-100 text-slate-800 border-transparent";
  }
};

export const getOwnerName = (evento: CRMEvento) => {
  return evento.asignado_a?.nombre || (evento.asignado_a_id ? `Usuario #${evento.asignado_a_id}` : "Sin asignar");
};

const getOwnerInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const getOwnerAvatarInfo = (evento: CRMEvento) => {
  const name = getOwnerName(evento);
  const avatarUrl =
    (evento.asignado_a as { url_foto?: string; avatar?: string } | undefined)?.url_foto ||
    (evento.asignado_a as { avatar?: string } | undefined)?.avatar ||
    null;
  return { name, avatarUrl, initials: getOwnerInitials(name) };
};
