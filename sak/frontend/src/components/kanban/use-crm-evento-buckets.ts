"use client";

import { useMemo } from "react";
import type { CRMEvento } from "@/app/resources/crm-eventos/model";
import type { KanbanBucketDefinition } from "./kanban-buckets-grid";
import {
  getOwnerName,
  getOportunidadName,
  normalizeEstado,
  type BucketKey,
} from "./crm-evento-helpers";
import { formatDateRange, getNextWeekStart } from "./utils";

export type FocusFilter = "activos" | "todos";

export type BucketDefinition = KanbanBucketDefinition<BucketKey>;

export interface UseCrmEventoBucketsArgs {
  eventos: CRMEvento[];
  search: string;
  ownerFilter: string;
  focusFilter: FocusFilter;
}

export const useCrmEventoBuckets = ({
  eventos,
  search,
  ownerFilter,
  focusFilter,
}: UseCrmEventoBucketsArgs) => {
  const filteredEventos = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return eventos.filter((evento) => {
      const estado = normalizeEstado(evento.estado_evento);
      if (focusFilter === "activos" && (estado === "2-realizado" || estado === "3-cancelado")) {
        return false;
      }
      if (ownerFilter !== "todos") {
        const ownerId = evento.asignado_a?.id ?? evento.asignado_a_id;
        if (String(ownerId ?? "") !== ownerFilter) {
          return false;
        }
      }
      if (!searchTerm) return true;
      const hayCoincidencia =
        (evento.titulo ?? "").toLowerCase().includes(searchTerm) ||
        (evento.descripcion ?? "").toLowerCase().includes(searchTerm) ||
        getOwnerName(evento).toLowerCase().includes(searchTerm) ||
        getOportunidadName(evento).toLowerCase().includes(searchTerm) ||
        (evento.tipo_evento ?? "").toLowerCase().includes(searchTerm);
      return hayCoincidencia;
    });
  }, [eventos, search, ownerFilter, focusFilter]);

  const bucketedEventos = useMemo(() => {
    const buckets: Record<BucketKey, CRMEvento[]> = {
      overdue: [],
      today: [],
      week: [],
      next: [],
    };

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setHours(23, 59, 59, 999);
    const nextWeekStart = getNextWeekStart(startOfToday);
    const followingWeekStart = new Date(nextWeekStart);
    followingWeekStart.setDate(followingWeekStart.getDate() + 7);

    const isSameDay = (dateA: Date, dateB: Date) =>
      dateA.getFullYear() === dateB.getFullYear() &&
      dateA.getMonth() === dateB.getMonth() &&
      dateA.getDate() === dateB.getDate();

    filteredEventos.forEach((evento) => {
      if (!evento.fecha_evento) {
        buckets.next.push(evento);
        return;
      }
      const fechaEvento = new Date(evento.fecha_evento);
      if (Number.isNaN(fechaEvento.getTime())) {
        buckets.next.push(evento);
        return;
      }
      if (fechaEvento < startOfToday) {
        if (focusFilter === "todos") {
          const estadoEvento = normalizeEstado(evento.estado_evento);
          const fechaEstado = evento.fecha_estado ? new Date(evento.fecha_estado) : null;
          const fechaEstadoEsHoy = fechaEstado ? isSameDay(fechaEstado, now) : false;
          const allow =
            estadoEvento === "1-pendiente" ||
            ((estadoEvento === "2-realizado" || estadoEvento === "3-cancelado") && fechaEstadoEsHoy);
          if (!allow) {
            return;
          }
        }
        buckets.overdue.push(evento);
      } else if (fechaEvento <= endOfToday) {
        buckets.today.push(evento);
      } else if (fechaEvento >= nextWeekStart && fechaEvento < followingWeekStart) {
        buckets.week.push(evento);
      } else if (fechaEvento >= followingWeekStart) {
        buckets.next.push(evento);
      } else {
        buckets.next.push(evento);
      }
    });

    const sortByDate = (a: CRMEvento, b: CRMEvento) => {
      const aTime = a.fecha_evento ? new Date(a.fecha_evento).getTime() : 0;
      const bTime = b.fecha_evento ? new Date(b.fecha_evento).getTime() : 0;
      return aTime - bTime;
    };

    (Object.keys(buckets) as BucketKey[]).forEach((key) => {
      buckets[key].sort(sortByDate);
    });

    return buckets;
  }, [filteredEventos, focusFilter]);

  const bucketDefinitions = useMemo<BucketDefinition[]>(() => {
    const now = new Date();
    const todayHelper = now.toLocaleDateString("es-AR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });

    const weekStart = getNextWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const nextWeekStart = new Date(weekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);

    return [
      { key: "overdue", title: "Vencidos", helper: "Fecha anterior a hoy", accentClass: "from-rose-50 to-white" },
      { key: "today", title: "Hoy", helper: todayHelper, accentClass: "from-amber-50 to-white" },
      { key: "week", title: "Semana", helper: formatDateRange(weekStart, weekEnd), accentClass: "from-blue-50 to-white" },
      { key: "next", title: "Siguiente", helper: formatDateRange(nextWeekStart, nextWeekEnd), accentClass: "from-slate-50 to-white" },
    ];
  }, []);

  return { filteredEventos, bucketedEventos, bucketDefinitions };
};
