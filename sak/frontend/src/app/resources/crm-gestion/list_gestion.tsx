"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlarmClock,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Calendar,
} from "lucide-react";
import {
  ListBase,
  useDataProvider,
  useGetIdentity,
  useListContext,
  useNotify,
  useRefresh,
} from "ra-core";
import {
  KanbanBucket,
  KanbanBucketHeaderCard,
  KanbanBoardViewVertical,
} from "@/components/kanban";
import { Agenda } from "@/components/agenda";
import { ListFiltersHeader } from "@/components/lists/ListFiltersHeader";
import { ListFilterTabs } from "@/components/lists/ListFilterTabs";
import { CardGestion } from "./card_gestion";
import { FormAgendarDialog } from "./form_agendar";
import { FormCompletarDialog } from "./form_completar";
import { FormCrearEventoDialog } from "./form_crear";
import { apiUrl } from "@/lib/dataProvider";
import type { CRMEvento } from "../crm-eventos/model";
import {
  EVENTO_TIPO_TABS,
  GestionBucketKey,
  GestionItem,
  GestionSummary,
  buildGestionItem,
  canMoveGestionItem,
  formatDate,
  groupGestionItems,
  normalizeTipo,
  prepareMoveGestionPayload,
} from "./model";

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

type GestionPendientesSectionProps = {
  summary: GestionSummary | null;
  overdueCount: number;
  todayCount: number;
  tomorrowCount: number;
  weekCount: number;
  nextCount: number;
  bucketItems: Record<GestionBucketKey, GestionItem[]>;
  renderItem: (item: GestionItem, helpers: { onMove: (item: GestionItem, bucket: GestionBucketKey) => Promise<void> }) => React.ReactNode;
  initialCollapsedBuckets?: Record<GestionBucketKey, boolean>;
  onItemMove: (item: GestionItem, bucket: GestionBucketKey) => boolean | void | Promise<boolean | void>;
  canItemMove: (item: GestionItem, bucket: GestionBucketKey) => boolean | Promise<boolean>;
  onAfterMove: (item: GestionItem, bucket: GestionBucketKey) => void | Promise<void>;
  onMoveError: (error: unknown, item: GestionItem, bucket: GestionBucketKey) => void;
  getItemId: (item: GestionItem) => string | number | null | undefined;
};

type PendientesBucketConfig = {
  key: GestionBucketKey;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconWrapperClassName: string;
  badgeClassName?: string;
  countBadge?: number | null;
  emptyMessage: string;
  headerOverride?: (options: { collapsed: boolean; onToggle: () => void }) => React.ReactNode;
  rightSlot?: React.ReactNode;
};

const GestionPendientesSection = ({
  summary,
  overdueCount,
  todayCount,
  tomorrowCount,
  weekCount,
  nextCount,
  bucketItems,
  renderItem,
  initialCollapsedBuckets,
  onItemMove,
  canItemMove,
  onAfterMove,
  onMoveError,
  getItemId,
}: GestionPendientesSectionProps) => {
  const bucketConfigs: PendientesBucketConfig[] = [
    {
      key: "overdue",
      title: "Vencidos",
      subtitle: `${overdueCount} pendientes`,
      icon: AlarmClock,
      iconWrapperClassName: "bg-rose-500",
      badgeClassName: "bg-rose-500",
      countBadge: overdueCount,
      emptyMessage: "Sin vencidas",
    },
    {
      key: "today",
      title: "Hoy",
      subtitle: `${todayCount} pendientes`,
      icon: CalendarDays,
      iconWrapperClassName: "bg-emerald-500",
      badgeClassName: "bg-emerald-500",
      countBadge: todayCount,
      emptyMessage: "Sin eventos para hoy",
    },
    {
      key: "tomorrow",
      title: "Ma?ana",
      subtitle: `${tomorrowCount} pendientes`,
      icon: CalendarRange,
      iconWrapperClassName: "bg-sky-500",
      badgeClassName: "bg-sky-500",
      countBadge: tomorrowCount,
      emptyMessage: "Sin pendientes para ma?ana",
    },
    {
      key: "week",
      title: "Esta Semana",
      subtitle: `${weekCount} pendientes`,
      icon: Calendar,
      iconWrapperClassName: "bg-blue-500",
      countBadge: null,
      emptyMessage: "Sin eventos esta semana",
    },
    {
      key: "next",
      title: "Proximos",
      subtitle: `${nextCount} pendientes`,
      icon: CalendarClock,
      iconWrapperClassName: "bg-indigo-500",
      countBadge: null,
      emptyMessage: "Sin proximos eventos",
    },
  ];

  return (
    <KanbanBucket accentClass="from-white to-white" className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Pendientes</h2>
          <p className="text-xs text-slate-500">
            {summary?.buckets?.overdue ?? 0} vencidas, {summary?.buckets?.today ?? 0} hoy,{" "}
            {summary?.buckets?.tomorrow ?? 0} ma?ana, {summary?.buckets?.week ?? 0} semana,{" "}
            {summary?.buckets?.next ?? 0} proximas
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
          <AlarmClock className="h-3 w-3" />
          {summary?.buckets?.overdue ?? 0} vencidos
        </span>
      </div>

      <div className="mt-4">
        <KanbanBoardViewVertical<GestionItem, GestionBucketKey>
          initialCollapsedBuckets={initialCollapsedBuckets}
          buckets={bucketConfigs.map(({ key, emptyMessage }) => ({ key, emptyMessage }))}
          bucketItems={bucketItems}
          onItemMove={onItemMove}
          canItemMove={canItemMove}
          onAfterMove={onAfterMove}
          onMoveError={onMoveError}
          getItemId={getItemId}
          renderBucketHeader={(bucket, _count, collapsed, onToggle) => {
            const config = bucketConfigs.find((item) => item.key === bucket.key);
            if (!config) return null;
            if (config.headerOverride) {
              return config.headerOverride({ collapsed, onToggle });
            }
            return (
              <KanbanBucketHeaderCard
                title={config.title}
                subtitle={config.subtitle}
                icon={config.icon}
                iconWrapperClassName={config.iconWrapperClassName}
                badgeClassName={config.badgeClassName}
                countBadge={config.countBadge}
                collapsed={collapsed}
                onToggle={onToggle}
                rightSlot={config.rightSlot}
              />
            );
          }}
          getBucketBodyClassName={() => "h-auto min-h-[96px]"}
          renderItem={(item, _bucketKey, helpers) => renderItem(item, { onMove: helpers.onMove })}
        />
      </div>
    </KanbanBucket>
  );
};

type GestionListContentProps = {
  search: string;
  onSearchChange: (value: string) => void;
  ownerFilter: string;
  onOwnerChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  summary: GestionSummary | null;
  summaryLoading: boolean;
  error: string | null;
  setError: (value: string | null) => void;
  identity: any;
  onSummaryRefresh: () => void | Promise<void>;
};

const GestionListContent = ({
  search,
  onSearchChange,
  ownerFilter,
  onOwnerChange,
  typeFilter,
  onTypeFilterChange,
  summary,
  summaryLoading,
  error,
  setError,
  identity,
  onSummaryRefresh,
}: GestionListContentProps) => {
  const { data: eventos = [], isLoading } = useListContext<CRMEvento>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [agendaDialogOpen, setAgendaDialogOpen] = useState(false);
  const [completarDialogOpen, setCompletarDialogOpen] = useState(false);
  const [crearDialogOpen, setCrearDialogOpen] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<GestionItem | null>(null);
  const [agendaCollapsed, setAgendaCollapsed] = useState(false);

  const gestionItems = useMemo(() => eventos.map(buildGestionItem), [eventos]);
  const filteredItems = useMemo(() => {
    if (typeFilter === "todos") return gestionItems;
    return gestionItems.filter(
      (item) => normalizeTipo(item.tipo_evento) === typeFilter
    );
  }, [gestionItems, typeFilter]);
  const bucketItems = useMemo(() => groupGestionItems(filteredItems), [filteredItems]);

  const handleItemMove = useCallback(
    async (item: GestionItem, bucket: GestionBucketKey) => {
      const payload = prepareMoveGestionPayload(item, bucket);
      if (!payload) return false;
      await dataProvider.update("crm/eventos", {
        id: item.id,
        data: payload,
        previousData: item,
      });
      return true;
    },
    [dataProvider]
  );

  const handleAfterMove = useCallback(() => {
    setError(null);
    refresh();
    void onSummaryRefresh();
  }, [onSummaryRefresh, refresh, setError]);

  const handleMoveError = useCallback(() => {
    setError("No se pudo mover el evento.");
  }, [setError]);

  const openAgendaDialog = (item: GestionItem) => {
    setSelectedEvento(item);
    setAgendaDialogOpen(true);
  };

  const openCompletarDialog = (item: GestionItem) => {
    setSelectedEvento(item);
    setCompletarDialogOpen(true);
  };

  const openCrearDialog = () => {
    setCrearDialogOpen(true);
  };

  const agendaItems = bucketItems.today;
  const overdueCount = bucketItems.overdue?.length ?? 0;
  const todayCount = bucketItems.today?.length ?? 0;
  const tomorrowCount = bucketItems.tomorrow?.length ?? 0;
  const weekCount = bucketItems.week?.length ?? 0;
  const nextCount = bucketItems.next?.length ?? 0;
  const totalPendientes =
    (summary?.buckets?.overdue ?? 0) +
    (summary?.buckets?.today ?? 0) +
    (summary?.buckets?.tomorrow ?? 0) +
    (summary?.buckets?.week ?? 0) +
    (summary?.buckets?.next ?? 0);

  return (
    <div className="p-6 space-y-6">
      <GestionHeaderSection
        search={search}
        onSearchChange={onSearchChange}
        ownerFilter={ownerFilter}
        onOwnerChange={onOwnerChange}
        typeFilter={typeFilter}
        onTypeFilterChange={onTypeFilterChange}
        totalPendientes={totalPendientes}
        summary={summary}
        error={error}
      />
      <Agenda<GestionItem, GestionBucketKey>
        dateLabel={`Agenda del ${formatDate(agendaItems[0]?.fecha_evento)}`}
        collapsed={agendaCollapsed}
        onToggle={() => setAgendaCollapsed((prev) => !prev)}
        onCreate={openCrearDialog}
        items={agendaItems}
        emptyMessage="Sin eventos para hoy"
        onItemMove={handleItemMove}
        canItemMove={canMoveGestionItem}
        onAfterMove={handleAfterMove}
        onMoveError={handleMoveError}
        getItemId={(item) => item.id}
        renderItem={(item, helpers) => (
          <CardGestion
            item={item}
            compact={item.is_completed}
            onAgendar={openAgendaDialog}
            onQuickSchedule={(evento, bucket) => {
              void helpers.onMove(evento, bucket as GestionBucketKey);
            }}
            onCompletar={openCompletarDialog}
          />
        )}
      />

      <GestionPendientesSection
        summary={summary}
        overdueCount={overdueCount}
        todayCount={todayCount}
        tomorrowCount={tomorrowCount}
        weekCount={weekCount}
        nextCount={nextCount}
        bucketItems={bucketItems}
        initialCollapsedBuckets={{
          overdue: false,
          today: false,
          tomorrow: true,
          week: true,
          next: true,
        }}
        onItemMove={handleItemMove}
        canItemMove={canMoveGestionItem}
        onAfterMove={handleAfterMove}
        onMoveError={handleMoveError}
        getItemId={(item) => item.id}
        renderItem={(item, helpers) => (
          <CardGestion
            item={item}
            compact={item.is_completed}
            onAgendar={openAgendaDialog}
            onQuickSchedule={(evento, bucket) => {
              void helpers.onMove(evento, bucket as GestionBucketKey);
            }}
            onCompletar={openCompletarDialog}
          />
        )}
      />

      {summaryLoading || isLoading ? (
        <div className="text-xs text-muted-foreground">Actualizando agenda...</div>
      ) : null}
      <FormAgendarDialog
        open={agendaDialogOpen}
        onOpenChange={(open) => {
          setAgendaDialogOpen(open);
          if (!open) {
            setSelectedEvento(null);
          }
        }}
        selectedEvento={selectedEvento}
        onSuccess={() => {
          setSelectedEvento(null);
          void onSummaryRefresh();
        }}
        onError={() => {
          setSelectedEvento(null);
        }}
      />
      <FormCompletarDialog
        open={completarDialogOpen}
        onOpenChange={(open) => {
          setCompletarDialogOpen(open);
          if (!open) {
            setSelectedEvento(null);
          }
        }}
        selectedEvento={selectedEvento}
        onSuccess={() => {
          setSelectedEvento(null);
          void onSummaryRefresh();
        }}
        onError={() => {
          setSelectedEvento(null);
        }}
      />
      <FormCrearEventoDialog
        open={crearDialogOpen}
        onOpenChange={setCrearDialogOpen}
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
          void onSummaryRefresh();
        }}
        onError={(error: any) => {
          notify(error?.message ?? "No se pudo crear el evento", { type: "error" });
        }}
      />
    </div>
  );
};

export const ListGestion = () => {
  const { data: identity } = useGetIdentity();
  const [summary, setSummary] = useState<GestionSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string>("todos");
  const [typeFilter, setTypeFilter] = useState<string>("todos");

  const autoSelectedOwnerRef = useRef(false);
  useEffect(() => {
    if (identity?.id && ownerFilter === "todos" && !autoSelectedOwnerRef.current) {
      setOwnerFilter(String(identity.id));
      autoSelectedOwnerRef.current = true;
    }
  }, [identity, ownerFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  const ownerId = ownerFilter !== "todos" ? ownerFilter : undefined;
  const listFilters = useMemo(() => {
    const filters: Record<string, string | number> = {};
    if (ownerId) filters.asignado_a_id = Number(ownerId);
    if (debouncedSearch) filters.q = debouncedSearch;
    return filters;
  }, [debouncedSearch, ownerId]);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams();
      if (ownerId) params.set("owner_id", ownerId);
      const url = `${apiUrl}/crm/gestion/summary${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { headers: { ...getAuthHeaders() } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as GestionSummary;
      setSummary(payload);
      setError(null);
    } catch {
      setError("No se pudo cargar la agenda.");
    } finally {
      setSummaryLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <ListBase
      resource="crm/eventos"
      perPage={1000}
      sort={{ field: "fecha_evento", order: "ASC" }}
      filter={listFilters}
    >
      <GestionListContent
        search={search}
        onSearchChange={setSearch}
        ownerFilter={ownerFilter}
        onOwnerChange={setOwnerFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        summary={summary}
        summaryLoading={summaryLoading}
        error={error}
        setError={setError}
        identity={identity}
        onSummaryRefresh={fetchSummary}
      />
    </ListBase>
  );
};

export default ListGestion;

