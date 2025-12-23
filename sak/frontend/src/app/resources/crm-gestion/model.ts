"use client";

import type { ComponentType } from "react";
import {
  Calendar,
  CalendarCheck,
  CheckSquare2,
  Home,
  ListChecks,
  Phone,
} from "lucide-react";

export type GestionSummary = {
  kpis: {
    visitas_hoy: number;
    llamadas_pendientes: number;
    eventos_semana: number;
    tareas_completadas: number;
  };
  buckets: {
    overdue: number;
    today: number;
    tomorrow: number;
    week: number;
    next: number;
  };
};

export type GestionItem = {
  id: number;
  titulo?: string | null;
  descripcion?: string | null;
  fecha_evento?: string | null;
  estado_evento?: string | null;
  tipo_evento?: string | null;
  bucket: string;
  is_completed: boolean;
  is_cancelled: boolean;
  oportunidad_estado?: string | null;
  oportunidad_titulo?: string | null;
  oportunidad?: {
    id: number;
    titulo?: string | null;
    estado?: string | null;
    contacto?: {
      nombre?: string | null;
      nombre_completo?: string | null;
    } | null;
  } | null;
  asignado_a?: {
    id: number;
    nombre?: string | null;
  } | null;
};

export type EventoTipoTab = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export const EVENTO_TIPO_TABS: EventoTipoTab[] = [
  { id: "todos", label: "Todos", icon: ListChecks },
  { id: "llamada", label: "Llamadas", icon: Phone },
  { id: "visita", label: "Visitas", icon: Home },
  { id: "tarea", label: "Tareas", icon: CheckSquare2 },
  { id: "evento", label: "Eventos", icon: Calendar },
];

export const normalizeTipo = (tipo?: string | null) => {
  if (!tipo) return "";
  const value = tipo.trim().toLowerCase();
  if (value.startsWith("llamad")) return "llamada";
  if (value.startsWith("visita")) return "visita";
  if (value.startsWith("tarea")) return "tarea";
  if (value.startsWith("event")) return "evento";
  return value;
};

export const getTipoLabel = (tipo?: string | null) => {
  const normalized = normalizeTipo(tipo);
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const getTypeBadge = (tipo?: string | null) => {
  switch (normalizeTipo(tipo)) {
    case "llamada":
      return "bg-indigo-100 text-indigo-700 border-indigo-200";
    case "visita":
      return "bg-sky-100 text-sky-700 border-sky-200";
    case "evento":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "tarea":
      return "bg-amber-100 text-amber-700 border-amber-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

export const getTypeIcon = (tipo?: string | null) => {
  switch (normalizeTipo(tipo)) {
    case "llamada":
      return Phone;
    case "visita":
      return Home;
    case "evento":
      return Calendar;
    case "tarea":
      return CheckSquare2;
    default:
      return CalendarCheck;
  }
};

export const formatDateTime = (fecha?: string | null) => {
  if (!fecha) return "Sin fecha";
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  const datePart = date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  const timePart = date
    .toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })
    .replace(":", ";");
  return `${datePart} ${timePart}`;
};

export const formatDate = (fecha?: string | null) => {
  if (!fecha) return "Sin fecha";
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
};

export const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatTimeInput = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

export const splitDateTime = (fecha?: string | null) => {
  if (!fecha) return { date: "", time: "" };
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };
  return { date: formatDateInput(date), time: formatTimeInput(date) };
};

export const truncateTitle = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
};

export const getDisplayTitle = (item: GestionItem) => {
  const title = item.titulo?.trim() ?? "";
  const tipo = item.tipo_evento ? item.tipo_evento.trim() : "";
  if (!tipo) return title || "Sin titulo";
  const normalized = tipo.toLowerCase();
  if (title.toLowerCase().startsWith(normalized)) return title;
  const capitalized = tipo.charAt(0).toUpperCase() + tipo.slice(1);
  return title ? `${capitalized} - ${title}` : capitalized;
};

export const getContactName = (item: GestionItem) => {
  const contacto = item.oportunidad?.contacto;
  return contacto?.nombre_completo || contacto?.nombre || "Sin contacto";
};

export const getOpportunityIdLabel = (item: GestionItem) => {
  if (!item.oportunidad?.id) return "";
  return `(#${String(item.oportunidad.id).padStart(6, "0")})`;
};
