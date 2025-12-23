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
import type { CRMEvento } from "../crm-eventos/model";

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

export type GestionBucketKey = "today" | "overdue" | "tomorrow" | "week" | "next";

export type GestionItem = CRMEvento & {
  tipo_evento?: string | null;
  bucket: GestionBucketKey;
  is_completed: boolean;
  is_cancelled: boolean;
  oportunidad_estado?: string | null;
  oportunidad_titulo?: string | null;
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

export const canMoveGestionItem = (_item: GestionItem, _bucket: string) => true;

type CanonicalEstado = "1-pendiente" | "2-realizado" | "3-cancelado" | "4-reagendar";

const normalizeEstado = (raw?: string | null): CanonicalEstado => {
  if (!raw) return "1-pendiente";
  const lower = raw.toLowerCase();
  if (lower.includes("realizado") || lower.includes("hecho")) return "2-realizado";
  if (lower.includes("cancelado")) return "3-cancelado";
  if (lower.includes("reagendar")) return "4-reagendar";
  return "1-pendiente";
};

const startOfDay = (base: Date) => {
  const next = new Date(base);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (base: Date) => {
  const next = new Date(base);
  next.setHours(23, 59, 59, 999);
  return next;
};

export const calculateGestionBucketKey = (fechaEvento?: string | null): GestionBucketKey => {
  const now = new Date();
  const startToday = startOfDay(now);
  const endToday = endOfDay(now);
  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);
  const endTomorrow = endOfDay(startTomorrow);
  const startWeekWindow = new Date(startToday);
  startWeekWindow.setDate(startWeekWindow.getDate() + 2);
  const endWeekWindow = endOfDay(new Date(startToday.getFullYear(), startToday.getMonth(), startToday.getDate() + 7));

  if (!fechaEvento) return "next";
  const fecha = new Date(fechaEvento);
  if (Number.isNaN(fecha.getTime())) return "next";

  if (fecha < startToday) return "overdue";
  if (fecha <= endToday) return "today";
  if (fecha >= startTomorrow && fecha <= endTomorrow) return "tomorrow";
  if (fecha >= startWeekWindow && fecha <= endWeekWindow) return "week";
  return "next";
};

export const buildGestionItem = (evento: CRMEvento): GestionItem => {
  const estado = normalizeEstado(evento.estado_evento);
  const tipoEvento =
    (evento as CRMEvento & { tipo_evento?: string | null }).tipo_evento ??
    evento.tipo_catalogo?.codigo ??
    null;

  return {
    ...evento,
    tipo_evento: tipoEvento,
    bucket: calculateGestionBucketKey(evento.fecha_evento),
    is_completed: estado === "2-realizado",
    is_cancelled: estado === "3-cancelado",
    oportunidad_estado: evento.oportunidad?.estado ?? null,
    oportunidad_titulo: evento.oportunidad?.titulo ?? null,
  };
};

export const groupGestionItems = (items: GestionItem[]) => {
  const buckets: Record<GestionBucketKey, GestionItem[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    week: [],
    next: [],
  };

  items.forEach((item) => {
    const bucket = item.bucket;
    if (bucket === "overdue" && item.is_completed) return;
    buckets[bucket].push(item);
  });

  return buckets;
};

const moveDateForBucket = (
  bucket: GestionBucketKey,
  original?: string | null
): Date | null => {
  const now = new Date();
  const base = original ? new Date(original) : now;
  const startToday = startOfDay(now);
  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);
  const startWeekWindow = new Date(startToday);
  startWeekWindow.setDate(startWeekWindow.getDate() + 2);
  const endWeekWindow = endOfDay(new Date(startToday.getFullYear(), startToday.getMonth(), startToday.getDate() + 7));

  let target: Date | null = null;

  if (bucket === "today") {
    target = startToday;
  } else if (bucket === "overdue") {
    target = new Date(startToday);
    target.setDate(target.getDate() - 1);
  } else if (bucket === "tomorrow") {
    target = startTomorrow;
  } else if (bucket === "week") {
    target = new Date(base);
    if (target < startWeekWindow) target = startWeekWindow;
    if (target > endWeekWindow) target = endWeekWindow;
  } else if (bucket === "next") {
    target = new Date(startToday);
    target.setDate(target.getDate() + 8);
  }

  if (!target) return null;

  const timeSource = Number.isNaN(base.getTime()) ? now : base;
  target.setHours(
    timeSource.getHours(),
    timeSource.getMinutes(),
    timeSource.getSeconds(),
    timeSource.getMilliseconds()
  );

  return target;
};

export const prepareMoveGestionPayload = (
  item: GestionItem,
  bucket: GestionBucketKey
): { fecha_evento: string; estado_evento?: string } | null => {
  const targetDate = moveDateForBucket(bucket, item.fecha_evento);
  if (!targetDate) return null;

  const estado = normalizeEstado(item.estado_evento);
  const shouldForcePendiente = estado !== "2-realizado" && estado !== "3-cancelado";
  return {
    fecha_evento: targetDate.toISOString(),
    ...(shouldForcePendiente ? { estado_evento: "1-pendiente" } : {}),
  };
};
