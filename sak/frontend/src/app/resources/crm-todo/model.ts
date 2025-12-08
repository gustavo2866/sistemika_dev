/**
 * Capa de dominio para eventos CRM.
 * Contiene lógica de negocio pura sin dependencias de UI o React-Admin.
 */

import type { CRMEvento } from "../crm-eventos/model";
import type { BucketKey } from "@/components/kanban";
import { getNextWeekStart } from "@/components/kanban/utils";

/**
 * Calcula a qué bucket pertenece un evento basándose en su fecha.
 * 
 * @param evento - Evento a evaluar
 * @returns BucketKey correspondiente
 */
export const calculateEventoBucketKey = (evento: CRMEvento): BucketKey => {
  if (!evento.fecha_evento) {
    return "next";
  }

  const fechaEvento = new Date(evento.fecha_evento);
  if (Number.isNaN(fechaEvento.getTime())) {
    return "next";
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setHours(23, 59, 59, 999);
  
  const nextWeekStart = getNextWeekStart(startOfToday);
  const followingWeekStart = new Date(nextWeekStart);
  followingWeekStart.setDate(followingWeekStart.getDate() + 7);

  if (fechaEvento < startOfToday) {
    return "overdue";
  } else if (fechaEvento <= endOfToday) {
    return "today";
  } else if (fechaEvento >= nextWeekStart && fechaEvento < followingWeekStart) {
    return "week";
  } else {
    return "next";
  }
};

/**
 * Calcula la fecha objetivo para un bucket específico.
 * Preserva la hora original del evento si existe, o usa la hora actual.
 * 
 * @param bucket - Bucket de destino (today, week, next)
 * @param originalDate - Fecha original del evento (opcional)
 * @returns Fecha calculada con hora preservada, o null si el bucket no es válido
 */
export const calculateBucketDate = (
  bucket: BucketKey,
  originalDate?: string | null
): Date | null => {
  const now = new Date();
  const original = originalDate ? new Date(originalDate) : null;

  // Función auxiliar para copiar la hora de la fecha original
  const copyTime = (target: Date) => {
    if (original && !Number.isNaN(original.getTime())) {
      target.setHours(
        original.getHours(),
        original.getMinutes(),
        original.getSeconds(),
        original.getMilliseconds()
      );
    } else {
      target.setHours(
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds()
      );
    }
  };

  const weekStart = getNextWeekStart(now);

  let targetDate: Date | null = null;

  if (bucket === "today") {
    targetDate = new Date();
  } else if (bucket === "week") {
    targetDate = new Date(weekStart);
  } else if (bucket === "next") {
    targetDate = new Date(weekStart);
    targetDate.setDate(targetDate.getDate() + 7);
  }

  if (targetDate) {
    copyTime(targetDate);
  }

  return targetDate;
};

/**
 * Obtiene el label descriptivo de un bucket.
 * 
 * @param bucket - Bucket key
 * @returns Label en español
 */
export const getBucketLabel = (bucket: BucketKey): string => {
  switch (bucket) {
    case "today":
      return "hoy";
    case "week":
      return "esta semana";
    case "next":
      return "próxima semana";
    case "overdue":
      return "atrasados";
    default:
      return "desconocido";
  }
};

/**
 * Prepara el payload para mover un evento a un bucket específico.
 * 
 * @param evento - Evento a mover
 * @param bucket - Bucket de destino
 * @returns Payload con fecha_evento y estado_evento, o null si la fecha no es válida
 */
export const prepareMoveEventoPayload = (
  evento: CRMEvento,
  bucket: BucketKey
): { fecha_evento: string; estado_evento: string } | null => {
  const targetDate = calculateBucketDate(bucket, evento.fecha_evento);

  if (!targetDate) {
    return null;
  }

  return {
    fecha_evento: targetDate.toISOString(),
    estado_evento: "1-pendiente",
  };
};
