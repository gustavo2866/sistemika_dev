"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDataProvider, useNotify } from "ra-core";
import {
  AlarmClock,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCcw,
  Search,
  TimerReset,
  XCircle,
} from "lucide-react";

import type { CRMEvento } from "../crm-eventos/model";
import { CRM_EVENTO_ESTADO_CHOICES } from "../crm-eventos/model";
import { Confirm } from "@/components/confirm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type CanonicalEstado = "1-pendiente" | "2-realizado" | "3-cancelado" | "4-reagendar" | "unknown";
type ColumnId = "overdue" | "today" | "week" | "upcoming";

type OwnerOption = { value: string; label: string };

const ESTADO_LABELS = new Map(CRM_EVENTO_ESTADO_CHOICES.map((choice) => [choice.id, choice.name]));

const ESTADO_NORMALIZER: Record<string, CanonicalEstado> = {
  pendiente: "1-pendiente",
  "1-pendiente": "1-pendiente",
  realizado: "2-realizado",
  hecho: "2-realizado",
  "2-realizado": "2-realizado",
  cancelado: "3-cancelado",
  "3-cancelado": "3-cancelado",
  reagendar: "4-reagendar",
  "4-reagendar": "4-reagendar",
};

const BOARD_COLUMNS: Array<{
  id: ColumnId;
  title: string;
  subtitle: string;
  accentClass: string;
}> = [
  { id: "overdue", title: "Atrasadas", subtitle: "Necesitan atencion inmediata", accentClass: "from-rose-50 to-white" },
  { id: "today", title: "Hoy", subtitle: "Prioridad del dia", accentClass: "from-amber-50 to-white" },
  { id: "week", title: "Esta semana", subtitle: "Revisa los compromisos cercanos", accentClass: "from-slate-50 to-white" },
  { id: "upcoming", title: "Proximas", subtitle: "Planifica los siguientes pasos", accentClass: "from-blue-50 to-white" },
];

const normalizeEstado = (value?: string | null): CanonicalEstado => {
  if (!value) return "unknown";
  const lower = value.toLowerCase();
  return ESTADO_NORMALIZER[lower] ?? (value.includes("-") ? (ESTADO_NORMALIZER[value.split("-")[1]] ?? "unknown") : "unknown");
};

const formatEstadoLabel = (estado: CanonicalEstado) => {
  if (estado === "unknown") return "Sin estado";
  return ESTADO_LABELS.get(estado) ?? estado.replace(/^\d-/, "").replace(/^\w/, (char) => char.toUpperCase());
};

const formatEventoTipo = (value?: string | null) => {
  if (!value) return "Evento";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfToday = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

const endOfToday = () => {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now;
};

const startOfCurrentWeek = () => {
  const today = startOfToday();
  const day = today.getDay(); // 0 domingo
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  return monday;
};

const endOfCurrentWeek = () => {
  const monday = startOfCurrentWeek();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
};

const formatDueLabel = (value?: string | null) => {
  const date = parseDate(value);
  if (!date) return "Sin fecha";
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const dayDiff = Math.round(diff / 86400000);
  const time = date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  if (date < startOfToday()) {
    if (dayDiff === -1) return `Ayer ${time}`;
    return `Vencido ${date.toLocaleDateString("es-AR")}`;
  }
  if (date <= endOfToday()) {
    return `Hoy ${time}`;
  }
  if (dayDiff === 1) {
    return `Manana ${time}`;
  }
  if (dayDiff <= 5) {
    return `En ${dayDiff} dias • ${time}`;
  }
  return date.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
};

const getOwnerName = (evento: CRMEvento) => {
  return evento.asignado_a?.nombre || (evento.asignado_a_id ? `Usuario #${evento.asignado_a_id}` : "Sin asignar");
};

const getOportunidadName = (evento: CRMEvento) => {
  if (evento.oportunidad?.descripcion_estado) {
    return evento.oportunidad.descripcion_estado;
  }
  if (evento.oportunidad_id) {
    return `Oportunidad #${evento.oportunidad_id}`;
  }
  return "Sin oportunidad";
};

const getEstadoBadgeClass = (estado: CanonicalEstado) => {
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

export const CRMToDoBoard = () => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const navigate = useNavigate();

  const [items, setItems] = useState<CRMEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("todos");
  const [focusFilter, setFocusFilter] = useState<"activos" | "todos">("activos");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "complete" | "cancel";
    evento: CRMEvento;
    resultado: string;
  } | null>(null);

  const loadEventos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await dataProvider.getList<CRMEvento>("crm/eventos", {
        filter: {},
        pagination: { page: 1, perPage: 80 },
        sort: { field: "fecha_evento", order: "ASC" },
      });
      setItems(response.data ?? []);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error("No se pudo cargar crm/eventos", err);
      setError(err?.message ?? "No se pudieron cargar los eventos");
    } finally {
      setLoading(false);
    }
  }, [dataProvider]);

  useEffect(() => {
    loadEventos();
  }, [loadEventos]);

  const ownerOptions = useMemo<OwnerOption[]>(() => {
    const entries = new Map<string, string>();
    items.forEach((evento) => {
      const id = evento.asignado_a?.id ?? evento.asignado_a_id;
      if (!id) return;
      const key = String(id);
      if (entries.has(key)) return;
      const label = evento.asignado_a?.nombre || `Usuario #${id}`;
      entries.set(key, label);
    });
    return [{ value: "todos", label: "Todos" }, ...Array.from(entries, ([value, label]) => ({ value, label }))];
  }, [items]);

  const filteredEventos = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return items.filter((evento) => {
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
  }, [items, focusFilter, ownerFilter, search]);

  const boardData = useMemo(() => {
    const base = {
      overdue: [] as CRMEvento[],
      today: [] as CRMEvento[],
      week: [] as CRMEvento[],
      upcoming: [] as CRMEvento[],
    };
    const todayStart = startOfToday();
    const todayEnd = endOfToday();
    const weekEnd = endOfCurrentWeek();

    filteredEventos.forEach((evento) => {
      const estado = normalizeEstado(evento.estado_evento);
      if (estado === "3-cancelado" || estado === "2-realizado") {
        return;
      }
      const fecha = parseDate(evento.fecha_evento);
      if (!fecha) {
        base.upcoming.push(evento);
        return;
      }
      if (fecha < todayStart) {
        base.overdue.push(evento);
        return;
      }
      if (fecha <= todayEnd) {
        base.today.push(evento);
        return;
      }
      if (fecha <= weekEnd) {
        base.week.push(evento);
        return;
      }
      base.upcoming.push(evento);
    });

    const sortAsc = (list: CRMEvento[]) =>
      list.sort((a, b) => {
        const fechaA = parseDate(a.fecha_evento)?.getTime() ?? 0;
        const fechaB = parseDate(b.fecha_evento)?.getTime() ?? 0;
        return fechaA - fechaB;
      });
    sortAsc(base.overdue);
    sortAsc(base.today);
    sortAsc(base.week);
    sortAsc(base.upcoming);
    return base;
  }, [filteredEventos]);

  const boardCounts = {
    overdue: boardData.overdue.length,
    today: boardData.today.length,
    week: boardData.week.length,
    upcoming: boardData.upcoming.length,
  };

  const pendingTotal = boardCounts.overdue + boardCounts.today + boardCounts.week + boardCounts.upcoming;
  const confirmEventoNombre = confirmAction?.evento
    ? confirmAction.evento.titulo?.trim() || `Evento #${confirmAction.evento.id}`
    : "este evento";
  const confirmTitle =
    confirmAction?.type === "cancel" ? "Confirmar cancelación" : "Confirmar completado";
  const confirmContent = confirmAction ? (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Evento</p>
        <p className="text-sm font-semibold text-foreground">{confirmEventoNombre}</p>
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Resultado
        </label>
        <Textarea
          value={confirmAction.resultado}
          onChange={(event) =>
            setConfirmAction((prev) => (prev ? { ...prev, resultado: event.target.value } : prev))
          }
          rows={4}
          placeholder="Describe el resultado de la interacción..."
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {confirmAction.type === "cancel"
          ? "Cancelar un evento lo quitará de tu lista activa."
          : "Al marcarlo como realizado se registrará el resultado ingresado."}
      </p>
    </div>
  ) : null;

  const statItems = [
    {
      id: "pending",
      label: "Pendientes",
      value: pendingTotal,
      helper: "Eventos activos",
      icon: AlarmClock,
    },
    {
      id: "overdue",
      label: "Atrasadas",
      value: boardCounts.overdue,
      helper: "Fuera de termino",
      icon: TimerReset,
    },
    {
      id: "today",
      label: "Hoy",
      value: boardCounts.today,
      helper: "Para resolver hoy",
      icon: CalendarClock,
    },
    {
      id: "week",
      label: "Esta semana",
      value: boardCounts.week,
      helper: "Antes del domingo",
      icon: CalendarPlus,
    },
  ];

  const updating = Boolean(updatingId);

  const requestConfirm = (type: "complete" | "cancel", evento: CRMEvento) => {
    setConfirmAction({
      type,
      evento,
      resultado: (evento.resultado ?? "").toString(),
    });
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    const evento = confirmAction.evento;
    const resultado = confirmAction.resultado?.trim() ?? "";
    if (confirmAction.type === "complete") {
      handleComplete(evento, resultado);
    } else {
      handleCancel(evento, resultado);
    }
    setConfirmAction(null);
  };

  const updateEvento = async (evento: CRMEvento, patch: Partial<CRMEvento>, successMessage: string) => {
    setUpdatingId(evento.id);
    try {
      await dataProvider.update<CRMEvento>("crm/eventos", {
        id: evento.id,
        data: patch,
        previousData: evento,
      });
      notify(successMessage, { type: "info" });
      await loadEventos();
    } catch (err: any) {
      console.error("No se pudo actualizar el evento", err);
      notify(err?.message ?? "No se pudo actualizar el evento", { type: "warning" });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleComplete = (evento: CRMEvento, resultado?: string) => {
    updateEvento(
      evento,
      { estado_evento: "2-realizado", resultado: resultado ?? evento.resultado ?? "" },
      "Evento marcado como realizado."
    );
  };

  const handleSnooze = (evento: CRMEvento, days: number) => {
    const current = parseDate(evento.fecha_evento) ?? new Date();
    current.setDate(current.getDate() + days);
    updateEvento(
      evento,
      { fecha_evento: current.toISOString(), estado_evento: "1-pendiente" },
      `Evento reprogramado para ${current.toLocaleString("es-AR")}.`
    );
  };

  const handleCancel = (evento: CRMEvento, resultado?: string) => {
    updateEvento(
      evento,
      { estado_evento: "3-cancelado", resultado: resultado ?? evento.resultado ?? "" },
      "Evento cancelado."
    );
  };

  const renderCard = (evento: CRMEvento) => {
    const estado = normalizeEstado(evento.estado_evento);
    const tipo = formatEventoTipo(evento.tipo_evento);
    const goToEdit = () => {
      if (evento.id) {
        navigate(`/crm/eventos/${evento.id}/edit`, { state: { fromTodo: true } });
      }
    };
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        goToEdit();
      }
    };
    return (
      <div
        key={evento.id}
        className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-sm transition hover:border-slate-300 cursor-pointer focus-within:ring-2 focus-within:ring-primary/40"
        onClick={goToEdit}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={`/crm/eventos/${evento.id}/show`}
              state={{ fromTodo: true }}
              className="text-sm font-semibold leading-tight text-foreground line-clamp-2 hover:text-primary"
              onClick={(event) => event.stopPropagation()}
            >
              {evento.titulo || "Sin titulo"}
            </Link>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{tipo}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className={cn("text-[10px] font-semibold uppercase tracking-wide", getEstadoBadgeClass(estado))}>
              {formatEstadoLabel(estado)}
            </Badge>
            <div className="flex items-center gap-1">
            {estado !== "2-realizado" ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                onClick={(event: ReactMouseEvent) => {
                  event.stopPropagation();
                  requestConfirm("complete", evento);
                }}
                disabled={updating}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span className="sr-only">Marcar como realizado</span>
                </Button>
              ) : null}
            {estado !== "3-cancelado" && estado !== "2-realizado" ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-rose-500 hover:text-rose-600"
                onClick={(event: ReactMouseEvent) => {
                  event.stopPropagation();
                  requestConfirm("cancel", evento);
                }}
                disabled={updating}
              >
                <XCircle className="h-4 w-4" />
                <span className="sr-only">Cancelar evento</span>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        {evento.descripcion ? (
          <p className="text-xs text-foreground/70 line-clamp-2 leading-snug">{evento.descripcion}</p>
        ) : null}
        <div className="space-y-1 rounded-xl bg-slate-50/70 px-3 py-2 text-[11px] text-slate-600">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
              <CalendarClock className="h-3.5 w-3.5 text-slate-500" />
              {formatDueLabel(evento.fecha_evento)}
            </span>
            {estado !== "2-realizado" ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-600"
                onClick={(event: ReactMouseEvent) => {
                  event.stopPropagation();
                  handleSnooze(evento, 1);
                }}
                disabled={updating}
              >
                <CalendarPlus className="h-4 w-4" />
                <span className="sr-only">Reprogramar +1 dia</span>
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
            <span className="truncate text-[11px]">{getOportunidadName(evento)}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
            <span className="truncate text-[11px]">{getOwnerName(evento)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">CRM Eventos</p>
          <h1 className="text-2xl font-semibold text-foreground">Panel To-Do</h1>
          <p className="text-xs text-muted-foreground">
            Organiza tus eventos pendientes con un tablero simple y accionable.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={loadEventos} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Actualizar
          </Button>
          <Button asChild size="sm" className="h-9">
            <Link to="/crm/eventos/create">
              <CalendarPlus className="mr-2 h-4 w-4" />
              Nuevo evento
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
        {statItems.map((stat) => (
          <div
            key={stat.id}
            className="group flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/95 px-3 py-2 shadow-sm transition hover:border-slate-300"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/90 text-white">
              <stat.icon className="h-5 w-5" />
            </span>
            <div className="flex flex-1 flex-col leading-tight">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>{stat.label}</span>
                <span className="font-semibold text-slate-500 group-hover:text-slate-700">{stat.helper}</span>
              </div>
              <p className="text-xl font-semibold text-foreground">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm md:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_auto] md:items-end">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Buscar</label>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-3 py-1.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Titulo, responsable, oportunidad..."
              className="border-none bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Responsable</label>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="h-10 rounded-2xl border-slate-200/80 bg-slate-50 text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              {ownerOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1 md:items-end">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Foco</span>
          <div className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50 p-1">
            {["activos", "todos"].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFocusFilter(option as "activos" | "todos")}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition",
                  focusFilter === option ? "bg-slate-900 text-white shadow" : "text-slate-600"
                )}
              >
                {option === "activos" ? "Activos" : "Todos"}
              </button>
            ))}
          </div>
          {lastUpdated && (
            <p className="text-[11px] text-muted-foreground">
              Actualizado {lastUpdated.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>

      {error ? (
        <Card className="border border-rose-200 bg-rose-50">
          <CardContent className="p-4 text-sm text-rose-800">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {BOARD_COLUMNS.map((column) => {
          const eventos = boardData[column.id];
          return (
            <Card
              key={column.id}
              className={cn(
                "flex h-full flex-col rounded-3xl border border-slate-200/80 bg-gradient-to-b shadow-sm",
                column.accentClass
              )}
            >
              <CardHeader className="flex flex-col gap-1 pb-3">
                <CardTitle className="flex items-center justify-between text-base font-semibold">
                  {column.title}
                  <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-xs">
                    {eventos.length}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">{column.subtitle}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-2 overflow-hidden p-4">
                {loading ? (
                  <div className="flex flex-1 flex-col gap-2">
                    {[0, 1, 2].map((item) => (
                      <div key={`${column.id}-skeleton-${item}`} className="h-[120px] animate-pulse rounded-2xl bg-white/70" />
                    ))}
                  </div>
                ) : eventos.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300/80 p-4 text-center text-sm text-muted-foreground">
                    <span>Sin eventos en esta columna.</span>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1 max-h-[520px]">
                    {eventos.map((evento) => renderCard(evento))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Confirm
        isOpen={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        title={confirmTitle ?? ""}
        content={confirmContent}
        confirm={confirmAction?.type === "cancel" ? "Cancelar evento" : "Marcar como hecho"}
        confirmColor={confirmAction?.type === "cancel" ? "warning" : "primary"}
        className="w-[92vw] max-w-md"
      />
    </div>
  );
};

export default CRMToDoBoard;
