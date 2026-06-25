"use client";

import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useGetList, useListContext } from "ra-core";
import {
  CalendarDays,
  List as ListIcon,
  Loader2,
  Plus,
  SlidersHorizontal,
} from "lucide-react";

import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { FilterForm, StyledFilterDiv } from "@/components/filter-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildListFilters,
} from "@/components/forms/form_order";
import {
  QuincenaNavigator,
  getQuincenaRange,
  moveQuincena,
  parseDateOnly,
  toISODate,
} from "@/components/forms/quincena-navigator";
import type { ProyectoRecord } from "../proyectos/model";
import { estadoParteChoices, getEstadoParteBadgeClass, getEstadoParteLabel } from "./constants";
import type { ParteDiarioDetalle, ParteDiarioRecord } from "./model";

type ParteDiarioPanelParte = ParteDiarioRecord & {
  detalles?: ParteDiarioDetalle[];
};

type PanelDay = {
  date: Date;
  iso: string;
};

const PROJECT_COLORS = [
  "#2563eb",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#65a30d",
  "#be123c",
];

const ACTIVE_PROJECT_ESTADOS = ["01-plan", "02-ejecucion", "03-conclusion"];
const DAY_LABELS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
const MISSING_LIMIT = 5;
const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const PANEL_FILTERS = buildListFilters(
  [
    {
      type: "reference",
      referenceProps: {
        source: "idproyecto",
        reference: "proyectos",
        label: "Obra",
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todas",
        className: "w-[150px] sm:w-[190px]",
      },
    },
    {
      type: "select",
      props: {
        source: "estado",
        label: "Estado",
        choices: estadoParteChoices,
        emptyText: "Todos",
        alwaysOn: true,
        className: "w-[105px] sm:w-[120px]",
      },
    },
  ],
  { keyPrefix: "parte-diario-panel" },
);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatShortDate = (date: Date) =>
  date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

const getProjectColor = (idproyecto?: number | string | null) => {
  const id = Number(idproyecto ?? 0);
  return PROJECT_COLORS[Math.abs(id) % PROJECT_COLORS.length];
};

const getProjectName = (
  idproyecto: number | string | null | undefined,
  projectsById: Map<string, ProyectoRecord>,
) =>
  projectsById.get(String(idproyecto ?? ""))?.nombre ??
  (idproyecto ? `Obra #${idproyecto}` : "Sin obra");

const getParteDateKey = (parte: ParteDiarioPanelParte) =>
  String(parte.fecha ?? "").slice(0, 10);

const getDetalleCount = (parte: ParteDiarioPanelParte) =>
  Array.isArray(parte.detalles) ? parte.detalles.length : 0;

const getTotalHoras = (parte: ParteDiarioPanelParte) =>
  (parte.detalles ?? []).reduce((total, detalle) => {
    const horas = Number(detalle.horas ?? 0);
    return total + (Number.isFinite(horas) ? horas : 0);
  }, 0);

const isProjectActiveOnDate = (project: ProyectoRecord, dateIso: string) => {
  const start = String(project.fecha_inicio ?? "").slice(0, 10);
  const end = String(project.fecha_final ?? "").slice(0, 10);
  if (start && dateIso < start) return false;
  if (end && dateIso > end) return false;
  return true;
};

const buildCreateUrl = (
  idproyecto: number | string,
  fecha: string,
  returnTo: string,
) => {
  const params = new URLSearchParams({
    idproyecto: String(idproyecto),
    fecha,
    returnTo,
  });
  return `/parte-diario/create?${params.toString()}`;
};

const ParteDiarioPanelToolbar = ({
  rangeStart,
  rangeEnd,
  quincenaNumber,
  selectedDate,
  onPrevious,
  onNext,
  onSelectedDateChange,
}: {
  rangeStart: Date;
  rangeEnd: Date;
  quincenaNumber: number;
  selectedDate: string;
  onPrevious: () => void;
  onNext: () => void;
  onSelectedDateChange: (value: string) => void;
}) => {
  const { filterValues } = useListContext();
  const projectId = filterValues?.idproyecto;
  const status = filterValues?.estado;
  const hasActiveFilters = Boolean(projectId || status);
  const [showPanelFilters, setShowPanelFilters] = useState(hasActiveFilters);

  return (
    <div className="bg-muted/30 rounded-lg p-1 sm:p-2">
      <div className="flex flex-wrap items-center gap-2">
        <QuincenaNavigator
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          quincenaNumber={quincenaNumber}
          selectedDate={selectedDate}
          onPrevious={onPrevious}
          onNext={onNext}
          onSelectedDateChange={onSelectedDateChange}
        />

        <Button
          type="button"
          variant={hasActiveFilters || showPanelFilters ? "secondary" : "outline"}
          size="sm"
          className="h-6 shrink-0 px-2 text-[10px]"
          aria-expanded={showPanelFilters}
          onClick={() => setShowPanelFilters((current) => !current)}
        >
          <SlidersHorizontal className="h-3 w-3" />
          Filtros
        </Button>

        {showPanelFilters ? (
          <FilterForm
            filters={PANEL_FILTERS}
            formComponent={StyledFilterDiv}
            className="list-filters pointer-events-auto flex min-w-0 flex-wrap items-end gap-2 [&_.filter-field]:items-end"
          />
        ) : null}
      </div>
    </div>
  );
};

const ParteDiarioCard = ({
  parte,
  projectName,
  onOpen,
}: {
  parte: ParteDiarioPanelParte;
  projectName: string;
  onOpen: () => void;
}) => {
  const registros = getDetalleCount(parte);
  const totalHoras = getTotalHoras(parte);
  const projectColor = getProjectColor(parte.idproyecto);

  return (
    <button
      type="button"
      className="relative w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 pl-2.5 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      onClick={onOpen}
    >
      <span
        className="absolute left-0 top-0 h-full w-1 rounded-l-md"
        style={{ backgroundColor: projectColor }}
      />
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-1 leading-none">
        <span className="min-w-0 truncate text-[9px] font-semibold leading-none text-slate-800">
          {projectName}
        </span>
        <Badge
          variant="secondary"
          className={cn("ml-auto h-3 shrink-0 px-0.5 py-0 text-[6px] leading-none", getEstadoParteBadgeClass(parte.estado))}
        >
          {getEstadoParteLabel(parte.estado)}
        </Badge>
      </div>
      <div className="mt-0 text-[7px] leading-none text-slate-500">
        {registros} registros -{" "}
        {totalHoras.toLocaleString("es-AR", { maximumFractionDigits: 2 })} hs
      </div>
    </button>
  );
};

const ParteDiarioMissingProjectRow = ({
  project,
  dateIso,
  returnTo,
}: {
  project: ProyectoRecord;
  dateIso: string;
  returnTo: string;
}) => (
  <Link
    to={buildCreateUrl(project.id, dateIso, returnTo)}
    className="flex min-h-3 w-full items-center gap-1 rounded px-1 py-0 text-left text-[8px] leading-[0.7rem] text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
  >
    <span
      className="h-1 w-1 shrink-0 rounded-full"
      style={{ backgroundColor: getProjectColor(project.id) }}
    />
    <span className="truncate">{project.nombre ?? `Obra #${project.id}`}</span>
  </Link>
);

const ParteDiarioDayColumn = ({
  day,
  partes,
  missingProjects,
  projectsById,
  isToday,
  showMissing,
  expanded,
  returnTo,
  onToggleMissing,
  onOpenParte,
}: {
  day: PanelDay;
  partes: ParteDiarioPanelParte[];
  missingProjects: ProyectoRecord[];
  projectsById: Map<string, ProyectoRecord>;
  isToday: boolean;
  showMissing: boolean;
  expanded: boolean;
  returnTo: string;
  onToggleMissing: () => void;
  onOpenParte: (parte: ParteDiarioPanelParte) => void;
}) => {
  const visibleMissing = expanded
    ? missingProjects
    : missingProjects.slice(0, MISSING_LIMIT);
  const hiddenMissing = Math.max(0, missingProjects.length - visibleMissing.length);

  return (
    <section className="flex min-h-[520px] flex-col bg-white">
      <div
        className={cn(
          "border-b border-slate-200 bg-slate-50/80 px-3 py-2",
          isToday && "bg-blue-50/70",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-700">
            {DAY_LABELS[day.date.getDay()]}
          </span>
          {isToday ? (
            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-blue-700">
              Hoy
            </span>
          ) : null}
        </div>
        <div className="text-[10px] text-slate-500">{formatShortDate(day.date)}</div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {partes.length ? (
          partes.map((parte) => (
            <ParteDiarioCard
              key={parte.id}
              parte={parte}
              projectName={getProjectName(parte.idproyecto, projectsById)}
              onOpen={() => onOpenParte(parte)}
            />
          ))
        ) : (
          <div className="rounded-md border border-dashed border-slate-200 px-2 py-3 text-center text-[10px] text-slate-400">
            Sin partes
          </div>
        )}

        {showMissing ? (
          <div className="mt-1.5 border-t border-dashed border-slate-200 pt-1">
            <div className="mb-px flex items-center justify-between gap-2 text-[7px] font-semibold uppercase leading-[0.65rem] text-slate-400">
              <span>Sin reportar</span>
              <span>{missingProjects.length}</span>
            </div>
            {missingProjects.length ? (
              <div className="space-y-0">
                {visibleMissing.map((project) => (
                  <ParteDiarioMissingProjectRow
                    key={project.id}
                    project={project}
                    dateIso={day.iso}
                    returnTo={returnTo}
                  />
                ))}
                {hiddenMissing > 0 ? (
                  <button
                    type="button"
                    className="w-full rounded px-1 py-0 text-left text-[8px] font-medium leading-[0.7rem] text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                    onClick={onToggleMissing}
                  >
                    + {hiddenMissing} obras sin reportar
                  </button>
                ) : expanded && missingProjects.length > MISSING_LIMIT ? (
                  <button
                    type="button"
                    className="w-full rounded px-1 py-0 text-left text-[8px] font-medium leading-[0.7rem] text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                    onClick={onToggleMissing}
                  >
                    Ver menos
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="rounded px-1 py-0 text-[8px] leading-[0.7rem] text-slate-400">
                Todas reportadas
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
};

const ParteDiarioPanelActions = () => {
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;

  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" size="sm" className={actionButtonClass}>
        <Link to="/parte-diario">
          <ListIcon className="h-3.5 w-3.5" />
          Lista
        </Link>
      </Button>
      <Button asChild size="sm" className={actionButtonClass}>
        <Link to={`/parte-diario/create?returnTo=${encodeURIComponent(returnTo)}`}>
          <Plus className="h-3.5 w-3.5" />
          Crear
        </Link>
      </Button>
    </div>
  );
};

const ParteDiarioPanelBody = ({
  days,
  todayIso,
  returnTo,
}: {
  days: PanelDay[];
  todayIso: string;
  returnTo: string;
}) => {
  const navigate = useNavigate();
  const [expandedMissing, setExpandedMissing] = useState<Set<string>>(() => new Set());
  const {
    data = [],
    filterValues,
    isLoading,
    isFetching,
    error,
  } = useListContext<ParteDiarioPanelParte>();
  const projectFilter = filterValues?.idproyecto;
  const statusFilter = filterValues?.estado;

  const projectFilterPayload = useMemo(() => {
    const payload: Record<string, unknown> = {
      estado: { in: ACTIVE_PROJECT_ESTADOS },
    };
    if (projectFilter) payload.id = Number(projectFilter);
    return payload;
  }, [projectFilter]);

  const { data: projectData = [], isLoading: projectsLoading } = useGetList<ProyectoRecord>(
    "proyectos",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "nombre", order: "ASC" },
      filter: projectFilterPayload,
    },
  );

  const partes = data as ParteDiarioPanelParte[];
  const projects = projectData as ProyectoRecord[];
  const loading = isLoading || isFetching || projectsLoading;

  const projectsById = useMemo(
    () => new Map(projects.map((project) => [String(project.id), project])),
    [projects],
  );

  const partesByDate = useMemo(() => {
    const grouped = new Map<string, ParteDiarioPanelParte[]>();
    partes.forEach((parte) => {
      const dateKey = getParteDateKey(parte);
      if (!dateKey) return;
      const current = grouped.get(dateKey) ?? [];
      current.push(parte);
      grouped.set(dateKey, current);
    });
    return grouped;
  }, [partes]);

  const reportedProjectIdsByDate = useMemo(() => {
    const grouped = new Map<string, Set<string>>();
    partes.forEach((parte) => {
      const dateKey = getParteDateKey(parte);
      const id = String(parte.idproyecto ?? "");
      if (!dateKey || !id) return;
      const current = grouped.get(dateKey) ?? new Set<string>();
      current.add(id);
      grouped.set(dateKey, current);
    });
    return grouped;
  }, [partes]);

  const missingProjectsByDate = useMemo(() => {
    const grouped = new Map<string, ProyectoRecord[]>();
    days.forEach((day) => {
      const reported = reportedProjectIdsByDate.get(day.iso) ?? new Set<string>();
      grouped.set(
        day.iso,
        projects.filter(
          (project) =>
            isProjectActiveOnDate(project, day.iso) &&
            !reported.has(String(project.id)),
        ),
      );
    });
    return grouped;
  }, [days, projects, reportedProjectIdsByDate]);

  const toggleMissing = (dateIso: string) => {
    setExpandedMissing((current) => {
      const next = new Set(current);
      if (next.has(dateIso)) {
        next.delete(dateIso);
      } else {
        next.add(dateIso);
      }
      return next;
    });
  };

  const handleOpenParte = (parte: ParteDiarioPanelParte) => {
    if (!parte.id) return;
    navigate(
      `/parte-diario/${parte.id}?returnTo=${encodeURIComponent(returnTo)}`,
      { state: { returnTo } },
    );
  };

  const showMissing = !statusFilter;

  return (
    <>
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
          No se pudo cargar el panel de partes diarios.
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Cargando quincena
            </span>
          </div>
        ) : null}
        <div className="grid grid-flow-col auto-cols-[220px] divide-x divide-slate-200 overflow-x-auto sm:auto-cols-[190px]">
          {days.map((day) => (
            <ParteDiarioDayColumn
              key={day.iso}
              day={day}
              partes={partesByDate.get(day.iso) ?? []}
              missingProjects={missingProjectsByDate.get(day.iso) ?? []}
              projectsById={projectsById}
              isToday={day.iso === todayIso}
              showMissing={showMissing}
              expanded={expandedMissing.has(day.iso)}
              returnTo={returnTo}
              onToggleMissing={() => toggleMissing(day.iso)}
              onOpenParte={handleOpenParte}
            />
          ))}
        </div>
      </div>
    </>
  );
};

export const ParteDiarioPanel = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const todayIso = useMemo(() => toISODate(new Date()), []);
  const initialDate = searchParams.get("fecha") ?? todayIso;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [range, setRange] = useState(() =>
    getQuincenaRange(parseDateOnly(initialDate)),
  );

  const rangeStartIso = useMemo(() => toISODate(range.start), [range.start]);
  const rangeEndIso = useMemo(() => toISODate(range.end), [range.end]);
  const returnTo = useMemo(() => {
    const query = searchParams.toString();
    return `/parte-diario/panel${query ? `?${query}` : ""}`;
  }, [searchParams]);

  const days = useMemo<PanelDay[]>(
    () => {
      const length =
        Math.floor((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1;
      return Array.from({ length }, (_, index) => {
        const date = addDays(range.start, index);
        return { date, iso: toISODate(date) };
      });
    },
    [range.end, range.start],
  );

  const setQuincenaFromDate = useCallback(
    (value: string) => {
      const nextDate = parseDateOnly(value);
      const nextIso = toISODate(nextDate);
      setSelectedDate(nextIso);
      setRange(getQuincenaRange(nextDate));
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set("fecha", nextIso);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const moveTo = (direction: -1 | 1) => {
    setQuincenaFromDate(toISODate(moveQuincena(range.start, direction)));
  };

  return (
    <List
      resource="parte-diario"
      title={
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Parte Diario - Quincena
        </span>
      }
      filters={PANEL_FILTERS}
      actions={<ParteDiarioPanelActions />}
      perPage={1000}
      pagination={false}
      sort={{ field: "fecha", order: "ASC" }}
      filter={{ fecha: { gte: rangeStartIso, lte: rangeEndIso } }}
      containerClassName={LIST_CONTAINER_WIDE}
      showFilters={false}
      topContent={
        <ParteDiarioPanelToolbar
          rangeStart={range.start}
          rangeEnd={range.end}
          quincenaNumber={range.number}
          selectedDate={selectedDate}
          onPrevious={() => moveTo(-1)}
          onNext={() => moveTo(1)}
          onSelectedDateChange={setQuincenaFromDate}
        />
      }
      filterDebounce={300}
    >
      <ParteDiarioPanelBody
        days={days}
        todayIso={todayIso}
        returnTo={returnTo}
      />
    </List>
  );
};

export default ParteDiarioPanel;
