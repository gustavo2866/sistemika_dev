"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlarmClock,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Calendar,
  ChevronDown,
  ChevronUp,
  Plus,
} from "lucide-react";
import {
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRefresh,
} from "ra-core";
import { cn } from "@/lib/utils";
import {
  KanbanBucket,
  KanbanBucketHeader,
  KanbanBucketDraggableList,
  KanbanDragDropProvider,
  useKanbanCollapseState,
} from "@/components/kanban";
import { ListFiltersHeader } from "@/components/lists/ListFiltersHeader";
import { ListFilterTabs } from "@/components/lists/ListFilterTabs";
import { CardGestion } from "./card_gestion";
import { FormAgendarDialog } from "./form_agendar";
import { FormCompletarDialog } from "./form_completar";
import { FormCrearEventoDialog } from "./form_crear";
import {
  EVENTO_TIPO_TABS,
  GestionItem,
  GestionSummary,
  formatDate,
  formatDateInput,
  formatTimeInput,
  splitDateTime,
} from "./model";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
type GestionBucketKey = "today" | "overdue" | "tomorrow" | "week" | "next";

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("auth_token");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

type GestionHeaderSectionProps = {
  search: string;
  onSearchChange: (value: string) => void;
  ownerFilter: string;
  onOwnerChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  totalPendientes: number;
  summary: GestionSummary | null;
  error: string | null;
};

const GestionHeaderSection = ({
  search,
  onSearchChange,
  ownerFilter,
  onOwnerChange,
  typeFilter,
  onTypeFilterChange,
  totalPendientes,
  summary,
  error,
}: GestionHeaderSectionProps) => (
  <>
    <ListFiltersHeader
      title="CRM Gestion"
      subtitle="Agenda, seguimiento y organizacion de tareas"
      searchValue={search}
      onSearchChange={onSearchChange}
      ownerValue={ownerFilter}
      onOwnerChange={onOwnerChange}
    />

    <ListFilterTabs
      tabs={EVENTO_TIPO_TABS}
      activeTabId={typeFilter}
      onTabChange={onTypeFilterChange}
      getCount={(tabId) => {
        switch (tabId) {
          case "todos":
            return totalPendientes;
          case "llamada":
            return summary?.kpis?.llamadas_pendientes ?? 0;
          case "visita":
            return summary?.kpis?.visitas_hoy ?? 0;
          case "tarea":
            return summary?.kpis?.tareas_completadas ?? 0;
          case "evento":
            return summary?.kpis?.eventos_semana ?? 0;
          default:
            return null;
        }
      }}
    />

    {error ? (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    ) : null}
  </>
);

type GestionAgendaSectionProps = {
  agendaItems: GestionItem[];
  collapsed: boolean;
  onToggle: () => void;
  onCreate: () => void;
  renderBucketBody: (
    bucketKey: GestionBucketKey,
    emptyMessage: string,
    compact?: boolean,
    autoHeight?: boolean
  ) => React.ReactNode;
};

const GestionAgendaSection = ({
  agendaItems,
  collapsed,
  onToggle,
  onCreate,
  renderBucketBody,
}: GestionAgendaSectionProps) => (
  <KanbanBucket
    accentClass="from-white to-white"
    className={cn(
      "rounded-2xl border border-slate-200 bg-white p-4",
      collapsed ? "min-h-0 py-3" : ""
    )}
  >
    <KanbanBucketHeader
      title="Agenda"
      headerContent={
        <div className="flex items-center gap-2 sm:gap-3">
          <CalendarDays className="h-7 w-7 text-slate-600 sm:h-9 sm:w-9" />
          <span className="text-[10px] text-slate-500 sm:text-xs">
            Agenda del {formatDate(agendaItems[0]?.fecha_evento)}
          </span>
        </div>
      }
      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-slate-50 sm:px-3"
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
      collapsible
      collapsed={collapsed}
      onToggleCollapse={onToggle}
      collapseToggleVariant="icon"
      collapseToggleLabel="Expandir agenda"
      collapseToggleClassName="!rounded-md !border-slate-200 !bg-white !px-2 !py-1 !text-[10px] !text-slate-500 !shadow-none hover:!bg-slate-50 sm:!px-2.5 sm:!py-1.5 sm:!text-xs"
      collapseToggleContent={
        collapsed ? (
          <ChevronDown className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
        ) : (
          <ChevronUp className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
        )
      }
      collapseToggleStopPropagation
    >
      <button
        type="button"
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-500 px-2 py-1 text-[10px] font-semibold text-white shadow-sm sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs"
        onClick={(event) => {
          event.stopPropagation();
          onCreate();
        }}
      >
        <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        Nuevo
      </button>
    </KanbanBucketHeader>
    {collapsed ? null : (
      <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
        {renderBucketBody("today", "Sin eventos para hoy")}
      </div>
    )}
  </KanbanBucket>
);

type GestionPendientesSectionProps = {
  summary: GestionSummary | null;
  overdueCount: number;
  tomorrowCount: number;
  weekCount: number;
  nextCount: number;
  collapsedBuckets: Record<GestionBucketKey, boolean>;
  onToggle: (bucketKey: GestionBucketKey) => void;
  renderBucketBody: (
    bucketKey: GestionBucketKey,
    emptyMessage: string,
    compact?: boolean,
    autoHeight?: boolean
  ) => React.ReactNode;
};

const GestionPendientesSection = ({
  summary,
  overdueCount,
  tomorrowCount,
  weekCount,
  nextCount,
  collapsedBuckets,
  onToggle,
  renderBucketBody,
}: GestionPendientesSectionProps) => (
  <KanbanBucket accentClass="from-white to-white" className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Pendientes</h2>
        <p className="text-xs text-slate-500">
          {summary?.buckets?.overdue ?? 0} vencidas, {summary?.buckets?.tomorrow ?? 0} mañana,{" "}
          {summary?.buckets?.week ?? 0} semana, {summary?.buckets?.next ?? 0} proximas
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
        <AlarmClock className="h-3 w-3" />
        {summary?.buckets?.overdue ?? 0} vencidos
      </span>
    </div>

    <div className="mt-4 space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white">
        <KanbanBucketHeader
          title="Vencidos"
          headerContent={
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500 text-white sm:h-7 sm:w-7">
                <AlarmClock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold text-slate-900 sm:text-sm">Vencidos</p>
                <p className="text-[10px] text-slate-500 sm:text-xs">{overdueCount} pendientes</p>
              </div>
            </div>
          }
          onClick={() => onToggle("overdue")}
          className="flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-slate-50"
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onToggle("overdue");
            }
          }}
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold text-white sm:h-5 sm:min-w-[20px] sm:px-1.5 sm:text-[11px]">
              {overdueCount}
            </span>
            {collapsedBuckets.overdue ? (
              <ChevronDown className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
            ) : (
              <ChevronUp className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
            )}
          </div>
        </KanbanBucketHeader>
        <div className="px-4 pb-3">{renderBucketBody("overdue", "Sin vencidas", false, true)}</div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <KanbanBucketHeader
          title="Mañana"
          headerContent={
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500 text-white sm:h-7 sm:w-7">
                <CalendarRange className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold text-slate-900 sm:text-sm">Mañana</p>
                <p className="text-[10px] text-slate-500 sm:text-xs">{tomorrowCount} pendientes</p>
              </div>
            </div>
          }
          onClick={() => onToggle("tomorrow")}
          className="flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-slate-50"
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onToggle("tomorrow");
            }
          }}
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sky-500 px-1 text-[9px] font-semibold text-white sm:h-5 sm:min-w-[20px] sm:px-1.5 sm:text-[11px]">
              {tomorrowCount}
            </span>
            {collapsedBuckets.tomorrow ? (
              <ChevronDown className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
            ) : (
              <ChevronUp className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
            )}
          </div>
        </KanbanBucketHeader>
        <div className="px-4 pb-3">
          {renderBucketBody("tomorrow", "Sin pendientes para mañana", false, true)}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <KanbanBucketHeader
          title="Esta Semana"
          headerContent={
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500 text-white sm:h-7 sm:w-7">
                <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold text-slate-900 sm:text-sm">Esta Semana</p>
                <p className="text-[10px] text-slate-500 sm:text-xs">{weekCount} pendientes</p>
              </div>
            </div>
          }
          onClick={() => onToggle("week")}
          className="flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-slate-50"
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onToggle("week");
            }
          }}
        >
          {collapsedBuckets.week ? (
            <ChevronDown className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
          ) : (
            <ChevronUp className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
          )}
        </KanbanBucketHeader>
        <div className="px-4 pb-3">
          {renderBucketBody("week", "Sin eventos esta semana", false, true)}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <KanbanBucketHeader
          title="Proximos"
          headerContent={
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500 text-white sm:h-7 sm:w-7">
                <CalendarClock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold text-slate-900 sm:text-sm">Proximos</p>
                <p className="text-[10px] text-slate-500 sm:text-xs">{nextCount} pendientes</p>
              </div>
            </div>
          }
          onClick={() => onToggle("next")}
          className="flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-slate-50"
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onToggle("next");
            }
          }}
        >
          {collapsedBuckets.next ? (
            <ChevronDown className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
          ) : (
            <ChevronUp className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
          )}
        </KanbanBucketHeader>
        <div className="px-4 pb-3">
          {renderBucketBody("next", "Sin proximos eventos", false, true)}
        </div>
      </div>
    </div>
  </KanbanBucket>
);

export const ListGestion = () => {
  const { data: identity } = useGetIdentity();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [summary, setSummary] = useState<GestionSummary | null>(null);
  const [items, setItems] = useState<GestionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string>("todos");
  const [typeFilter, setTypeFilter] = useState<string>("todos");
  const [agendaDialogOpen, setAgendaDialogOpen] = useState(false);
  const [completarDialogOpen, setCompletarDialogOpen] = useState(false);
  const [crearDialogOpen, setCrearDialogOpen] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<GestionItem | null>(null);
  const [agendaDate, setAgendaDate] = useState("");
  const [agendaTime, setAgendaTime] = useState("");
  const [completarResultado, setCompletarResultado] = useState("");
  const [nuevoEstadoOportunidad, setNuevoEstadoOportunidad] = useState<string>("");
  const [motivoPerdidaId, setMotivoPerdidaId] = useState<string>("");
  const [motivoPerdidaError, setMotivoPerdidaError] = useState<string>("");
  const [formLoading, setFormLoading] = useState(false);
  const { collapsed: collapsedBuckets, toggle: toggleBucket } = useKanbanCollapseState<GestionBucketKey>({
    today: false,
    overdue: false,
    tomorrow: true,
    week: true,
    next: true,
  });


  const autoSelectedOwnerRef = useRef(false);
  useEffect(() => {
    if (identity?.id && ownerFilter === "todos" && !autoSelectedOwnerRef.current) {
      setOwnerFilter(String(identity.id));
      autoSelectedOwnerRef.current = true;
    }
  }, [identity, ownerFilter]);



  const ownerId = ownerFilter !== "todos" ? ownerFilter : undefined;

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/crm/gestion/summary${ownerId ? `?owner_id=${ownerId}` : ""}`,
        { headers: { ...getAuthHeaders() } }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as GestionSummary;
      setSummary(payload);
    } catch {
      setError("No se pudo cargar la informacion de gestion.");
    }
  }, [ownerId]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (ownerId) params.set("owner_id", ownerId);
      if (search.trim()) params.set("q", search.trim());
      if (typeFilter !== "todos") {
        params.set("tipo_evento", typeFilter);
      }
      const url = `${API_URL}/crm/gestion/items${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { headers: { ...getAuthHeaders() } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as { data: GestionItem[] };
      setItems(payload.data ?? []);
      setError(null);
    } catch {
      setError("No se pudo cargar la agenda.");
    } finally {
      setLoading(false);
    }
  }, [ownerId, search, typeFilter]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchItems();
    }, 250);
    return () => clearTimeout(timeout);
  }, [fetchItems]);

  const grouped = useMemo(() => {
    const result: Record<GestionBucketKey, GestionItem[]> = {
      today: [],
      overdue: [],
      tomorrow: [],
      week: [],
      next: [],
    };
    items.forEach((item) => {
      const key = (item.bucket as GestionBucketKey | undefined) || "next";
      if (key === "overdue" && item.is_completed) {
        return;
      }
      if (!result[key]) result[key] = [];
      result[key].push(item);
    });
    (Object.keys(result) as GestionBucketKey[]).forEach((key) => {
      result[key] = result[key].slice().sort((a, b) => {
        const timeA = a.fecha_evento ? new Date(a.fecha_evento).getTime() : Number.POSITIVE_INFINITY;
        const timeB = b.fecha_evento ? new Date(b.fecha_evento).getTime() : Number.POSITIVE_INFINITY;
        return timeA - timeB;
      });
    });
    return result;
  }, [items]);

  const moveItemToBucket = useCallback(
    async (item: GestionItem, bucket: string) => {
      try {
        const response = await fetch(`${API_URL}/crm/gestion/move`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ evento_id: item.id, to_bucket: bucket }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await fetchItems();
      } catch {
        setError("No se pudo mover el evento.");
      }
    },
    [fetchItems]
  );

  const openAgendaDialog = (item: GestionItem) => {
    setSelectedEvento(item);
    const initial = splitDateTime(item.fecha_evento);
    setAgendaDate(initial.date);
    setAgendaTime(initial.time);
    setAgendaDialogOpen(true);
  };

  const openCompletarDialog = (item: GestionItem) => {
    setSelectedEvento(item);
    setCompletarResultado("");
    const estadoActual =
      item.oportunidad_estado ?? item.oportunidad?.estado ?? "";
    setNuevoEstadoOportunidad(estadoActual || "");
    setMotivoPerdidaId("");
    setMotivoPerdidaError("");
    setCompletarDialogOpen(true);
  };

  const handleNuevoEstadoChange = (value: string) => {
    setNuevoEstadoOportunidad(value);
    if (value !== "6-perdida") {
      setMotivoPerdidaId("");
      setMotivoPerdidaError("");
    }
  };

  const handleMotivoPerdidaChange = (value: string) => {
    setMotivoPerdidaId(value);
    if (value) {
      setMotivoPerdidaError("");
    }
  };

  const openCrearDialog = () => {
    setCrearDialogOpen(true);
  };

  const defaultFechaEvento = useMemo(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return `${formatDateInput(now)}T${formatTimeInput(now)}`;
  }, []);

  const handleAgendaSubmit = useCallback(async () => {
    if (!selectedEvento || !agendaDate || !agendaTime) {
      notify("Selecciona fecha y hora", { type: "warning" });
      return;
    }
    setFormLoading(true);
    try {
      const fecha_evento = `${agendaDate}T${agendaTime}`;
      await dataProvider.update("crm/eventos", {
        id: selectedEvento.id,
        data: { fecha_evento },
        previousData: selectedEvento,
      });
      notify("Evento actualizado", { type: "success" });
      setAgendaDialogOpen(false);
      setSelectedEvento(null);
      refresh();
      fetchItems();
    } catch (error: any) {
      notify(error?.message ?? "No se pudo actualizar el evento", { type: "error" });
    } finally {
      setFormLoading(false);
    }
  }, [selectedEvento, agendaDate, agendaTime, dataProvider, notify, refresh, fetchItems]);

  const handleCompletarSubmit = useCallback(async () => {
    if (!selectedEvento) return;
    const isPerdida = nuevoEstadoOportunidad === "6-perdida";
    if (isPerdida && !motivoPerdidaId) {
      setMotivoPerdidaError("Selecciona un motivo de perdida");
      notify("Selecciona un motivo de perdida", { type: "warning" });
      return;
    }
    setFormLoading(true);
    try {
      await dataProvider.update("crm/eventos", {
        id: selectedEvento.id,
        data: {
          estado_evento: "2-realizado",
          resultado: completarResultado,
          fecha_estado: new Date().toISOString(),
        },
        previousData: selectedEvento,
      });
      const estadoActual =
        selectedEvento.oportunidad_estado ?? selectedEvento.oportunidad?.estado ?? "";
      const shouldUpdateOportunidad =
        Boolean(nuevoEstadoOportunidad) &&
        Boolean(selectedEvento.oportunidad?.id) &&
        nuevoEstadoOportunidad !== estadoActual;

      if (shouldUpdateOportunidad) {
        await dataProvider.update("crm/oportunidades", {
          id: selectedEvento.oportunidad?.id,
          data: {
            estado: nuevoEstadoOportunidad,
            motivo_perdida_id: isPerdida ? Number(motivoPerdidaId) || null : null,
            fecha_estado: new Date().toISOString(),
          },
          previousData: selectedEvento.oportunidad,
        });
      }

      notify("Evento completado", { type: "success" });
      setCompletarDialogOpen(false);
      setSelectedEvento(null);
      refresh();
      fetchItems();
    } catch (error: any) {
      notify(error?.message ?? "No se pudo completar el evento", { type: "error" });
    } finally {
      setFormLoading(false);
    }
  }, [
    selectedEvento,
    completarResultado,
    nuevoEstadoOportunidad,
    motivoPerdidaId,
    dataProvider,
    notify,
    refresh,
    fetchItems,
  ]);



  const agendaItems = grouped.today;
  const overdueCount = grouped.overdue?.length ?? 0;
  const tomorrowCount = grouped.tomorrow?.length ?? 0;
  const weekCount = grouped.week?.length ?? 0;
  const nextCount = grouped.next?.length ?? 0;
  const totalPendientes =
    (summary?.buckets?.overdue ?? 0) +
    (summary?.buckets?.tomorrow ?? 0) +
    (summary?.buckets?.week ?? 0) +
    (summary?.buckets?.next ?? 0);

  const renderBucketBody = (
    bucketKey: GestionBucketKey,
    emptyMessage: string,
    compact?: boolean,
    autoHeight?: boolean
  ) => {
    const heightClass = bucketKey === "today" ? "h-auto sm:h-[380px]" : "";
    const bucketItems = grouped[bucketKey] ?? [];
    if (collapsedBuckets[bucketKey]) {
      return null;
    }
    return (
      <KanbanBucketDraggableList<GestionItem, string>
        bucketKey={bucketKey}
        items={bucketItems}
        emptyMessage={emptyMessage}
        bodyClassName={cn(heightClass, autoHeight ? "h-auto min-h-[96px]" : "")}
        renderItem={(item) => (
          <CardGestion
            item={item}
            compact={compact || item.is_completed}
            onAgendar={openAgendaDialog}
            onQuickSchedule={moveItemToBucket}
            onCompletar={openCompletarDialog}
          />
        )}
      />
    );
  };

  return (
    <KanbanDragDropProvider<GestionItem, string>
      onItemDropped={moveItemToBucket}
      getItemId={(item) => item.id}
    >
      <div className="p-6 space-y-6">
        <GestionHeaderSection
          search={search}
          onSearchChange={setSearch}
          ownerFilter={ownerFilter}
          onOwnerChange={setOwnerFilter}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          totalPendientes={totalPendientes}
          summary={summary}
          error={error}
        />

        <GestionAgendaSection
          agendaItems={agendaItems}
          collapsed={collapsedBuckets.today}
          onToggle={() => toggleBucket("today")}
          onCreate={openCrearDialog}
          renderBucketBody={renderBucketBody}
        />

        <GestionPendientesSection
          summary={summary}
          overdueCount={overdueCount}
          tomorrowCount={tomorrowCount}
          weekCount={weekCount}
          nextCount={nextCount}
          collapsedBuckets={collapsedBuckets}
          onToggle={toggleBucket}
          renderBucketBody={renderBucketBody}
        />

        {loading ? (
          <div className="text-xs text-muted-foreground">Actualizando agenda...</div>
        ) : null}
        <FormAgendarDialog
          open={agendaDialogOpen}
          onOpenChange={setAgendaDialogOpen}
          agendaDate={agendaDate}
          agendaTime={agendaTime}
          onAgendaDateChange={setAgendaDate}
          onAgendaTimeChange={setAgendaTime}
          onSubmit={handleAgendaSubmit}
          loading={formLoading}
        />
        <FormCompletarDialog
          open={completarDialogOpen}
          onOpenChange={setCompletarDialogOpen}
          selectedEvento={selectedEvento}
          resultado={completarResultado}
          onResultadoChange={setCompletarResultado}
          nuevoEstadoOportunidad={nuevoEstadoOportunidad}
          onNuevoEstadoChange={handleNuevoEstadoChange}
          motivoPerdidaId={motivoPerdidaId}
          onMotivoPerdidaChange={handleMotivoPerdidaChange}
          motivoPerdidaError={motivoPerdidaError}
          onSubmit={handleCompletarSubmit}
          loading={formLoading}
        />
        <FormCrearEventoDialog
          open={crearDialogOpen}
          onOpenChange={setCrearDialogOpen}
          defaultFechaEvento={defaultFechaEvento}
          identityId={
            typeof identity?.id === "number"
              ? identity.id
              : identity?.id
              ? Number(identity.id)
              : null
          }
          onCreated={() => {
            notify("Evento creado", { type: "success" });
            setCrearDialogOpen(false);
            refresh();
            fetchItems();
          }}
          onError={(error: any) => {
            notify(error?.message ?? "No se pudo crear el evento", { type: "error" });
          }}
        />
      </div>
    </KanbanDragDropProvider>
  );
};

export default ListGestion;

