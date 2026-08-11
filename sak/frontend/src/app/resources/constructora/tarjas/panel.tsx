"use client";

import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useGetList, useListContext, useNotify, useRefresh } from "ra-core";
import {
  ArrowLeft,
  ClipboardCheck,
  List as ListIcon,
  Loader2,
  Plus,
} from "lucide-react";

import { Confirm } from "@/components/confirm";
import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { FilterForm, StyledFilterDiv } from "@/components/filter-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildListFilters } from "@/components/forms/form_order";
import { apiUrl } from "@/lib/dataProvider";
import {
  QuincenaNavigator,
  getQuincenaRange,
  moveQuincena,
  parseDateOnly,
  toISODate,
} from "@/components/forms/quincena-navigator";
import { cn } from "@/lib/utils";
import type { ProyectoRecord } from "../proyectos/model";
import type { ParteDiarioRecord } from "../parte-diario/model";
import { getEstadoTarjaBadgeClass, getEstadoTarjaLabel } from "./constants";
import type { TarjaRecord } from "./model";

type ParteDiarioStats = {
  confirmados: number;
  borradores: number;
  sinCargar: number;
};

type GenerateTarjaTarget = {
  id: number | string;
  nombre?: string | null;
};

type CloseTarjaTarget = {
  id: number | string;
  nombre?: string | null;
};

const ACTIVE_PROJECT_ESTADOS = ["01-plan", "02-ejecucion", "03-conclusion"];
const EXECUTION_PROJECT_ESTADO = "02-ejecucion";
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
        filter: { estado: EXECUTION_PROJECT_ESTADO },
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todas",
        className: "w-[150px] sm:w-[190px]",
      },
    },
  ],
  { keyPrefix: "tarja-panel" },
);

const getProjectColor = (idproyecto?: number | string | null) => {
  const id = Number(idproyecto ?? 0);
  return PROJECT_COLORS[Math.abs(id) % PROJECT_COLORS.length];
};

const isProjectActiveInRange = (
  project: ProyectoRecord,
  startIso: string,
  endIso: string,
) => {
  const projectStart = String(project.fecha_inicio ?? "").slice(0, 10);
  const projectEnd = String(project.fecha_final ?? "").slice(0, 10);
  if (projectStart && projectStart > endIso) return false;
  if (projectEnd && projectEnd < startIso) return false;
  return true;
};

const countProjectDaysInRange = (
  project: ProyectoRecord,
  startIso: string,
  endIso: string,
) => {
  const projectStart = String(project.fecha_inicio ?? "").slice(0, 10);
  const projectEnd = String(project.fecha_final ?? "").slice(0, 10);
  const effectiveStart = projectStart && projectStart > startIso ? projectStart : startIso;
  const effectiveEnd = projectEnd && projectEnd < endIso ? projectEnd : endIso;
  if (effectiveStart > effectiveEnd) return 0;
  const start = parseDateOnly(effectiveStart);
  const end = parseDateOnly(effectiveEnd);
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
};

const buildParteDiarioPanelUrl = (
  idproyecto: number | string,
  startIso: string,
) => {
  const params = new URLSearchParams({
    fecha: startIso,
    filter: JSON.stringify({ idproyecto: Number(idproyecto) }),
  });
  return `/parte-diario/panel?${params.toString()}`;
};

const buildAuthHeaders = () => {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });
  if (typeof window === "undefined") return headers;
  const token = window.localStorage.getItem("auth_token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
};

const getActionErrorMessage = async (response: Response) => {
  try {
    const payload = await response.json();
    if (typeof payload?.detail === "string") return payload.detail;
    if (typeof payload?.message === "string") return payload.message;
  } catch {
    // Keep the generic message below.
  }
  return "No se pudo completar la accion";
};

const postGenerateTarja = async ({
  idproyecto,
  fechainicio,
  fechafinal,
}: {
  idproyecto: number | string;
  fechainicio: string;
  fechafinal: string;
}) => {
  const response = await fetch(`${apiUrl}/tarjas/generar`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      idproyecto: Number(idproyecto),
      fechainicio,
      fechafinal,
    }),
  });
  if (!response.ok) {
    throw new Error(await getActionErrorMessage(response));
  }
  return response.json();
};

const patchCloseTarja = async (tarjaId: number | string) => {
  const response = await fetch(`${apiUrl}/tarjas/${tarjaId}`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ estado: "cerrado" }),
  });
  if (!response.ok) {
    throw new Error(await getActionErrorMessage(response));
  }
  return response.json();
};

const TarjaPanelToolbar = ({
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
  return (
    <div className="rounded-lg bg-muted/30 p-1 sm:p-2">
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

        <FilterForm
          filters={PANEL_FILTERS}
          formComponent={StyledFilterDiv}
          className="list-filters pointer-events-auto flex min-w-0 flex-wrap items-end gap-2 [&_.filter-field]:items-end"
        />
      </div>
    </div>
  );
};

const TarjaCard = ({
  tarja,
  projectName,
  onOpen,
  generating,
  onGenerate,
  closing,
  onClose,
}: {
  tarja: TarjaRecord;
  projectName: string;
  onOpen: () => void;
  generating?: boolean;
  onGenerate?: () => void;
  closing?: boolean;
  onClose?: () => void;
}) => {
  const detalles = Array.isArray(tarja.detalles) ? tarja.detalles : [];
  const totalHoras = detalles.reduce((total, detalle) => {
    const horas = Number(detalle.horas ?? 0);
    return total + (Number.isFinite(horas) ? horas : 0);
  }, 0);

  return (
    <div className="relative w-full rounded-md border border-slate-200 bg-white pl-3 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/40">
      <span
        className="absolute left-0 top-0 h-full w-1 rounded-l-md"
        style={{ backgroundColor: getProjectColor(tarja.idproyecto) }}
      />
      <button
        type="button"
        className="w-full px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        onClick={onOpen}
      >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1">
        <span className="truncate text-[10px] font-semibold leading-tight text-slate-800">
          {projectName}
        </span>
        <Badge
          variant="secondary"
          className={cn(
            "h-4 shrink-0 px-1 py-0 text-[7px] leading-none",
            getEstadoTarjaBadgeClass(tarja.estado),
          )}
        >
          {getEstadoTarjaLabel(tarja.estado)}
        </Badge>
      </div>
      <div className="mt-0.5 text-[8px] leading-tight text-slate-500">
        {detalles.length} registros ·{" "}
        {totalHoras.toLocaleString("es-AR", { maximumFractionDigits: 2 })} hs
      </div>
      {tarja.descripcion ? (
        <div className="mt-0.5 truncate text-[8px] text-slate-400">
          {tarja.descripcion}
        </div>
      ) : null}
      </button>
      {onGenerate || onClose ? (
        <div className="flex justify-end gap-1 px-2 pb-1">
          {onClose ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={closing}
              className="h-4 rounded px-1 text-[6px] has-[>svg]:px-1"
              title="Cerrar tarja"
              onClick={onClose}
            >
              {closing ? <Loader2 className="size-2.5 animate-spin" /> : "Cerrar"}
            </Button>
          ) : null}
          {onGenerate ? (
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={generating}
            className="h-4 rounded bg-blue-600 px-1 text-[6px] text-white shadow-sm hover:bg-blue-700 has-[>svg]:px-1"
            title="Recalcular tarja"
            onClick={onGenerate}
          >
            {generating ? <Loader2 className="size-2.5 animate-spin" /> : "Generar"}
          </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const PendingTarjaRow = ({
  project,
  startIso,
  stats,
  generating,
  onGenerate,
}: {
  project: ProyectoRecord;
  startIso: string;
  stats: ParteDiarioStats;
  generating?: boolean;
  onGenerate: () => void;
}) => (
  <div className="flex min-h-5 w-full items-center gap-1 rounded px-1 py-0 text-left text-[8px] leading-[0.8rem] text-slate-500 transition hover:bg-slate-50">
    <span
      className="size-1 shrink-0 rounded-full"
      style={{ backgroundColor: getProjectColor(project.id) }}
    />
    <span
      className="w-[88px] min-w-0 shrink-0 truncate sm:w-[104px]"
      title={project.nombre ?? `Obra #${project.id}`}
    >
      {project.nombre ?? `Obra #${project.id}`}
    </span>
    <span className="flex min-w-0 flex-1 items-center gap-1 text-[7px] font-medium">
      <span className="text-emerald-600" title="Partes diarios confirmados">
        C: {stats.confirmados}
      </span>
      <span className="text-amber-600" title="Partes diarios en borrador">
        B: {stats.borradores}
      </span>
      <span className="text-slate-400" title="Partes diarios sin cargar">
        S: {stats.sinCargar}
      </span>
    </span>
    <Button
      type="button"
      variant="default"
      size="sm"
      disabled={generating}
      className="h-4 shrink-0 rounded bg-blue-600 px-1 text-[6px] text-white shadow-sm hover:bg-blue-700 has-[>svg]:px-1"
      title="Generar tarja"
      onClick={onGenerate}
    >
      {generating ? <Loader2 className="size-2.5 animate-spin" /> : "Generar"}
    </Button>
    <Button
      asChild
      variant="outline"
      size="sm"
      className="h-4 shrink-0 rounded px-1 text-[6px] has-[>svg]:px-1"
    >
      <Link to={buildParteDiarioPanelUrl(project.id, startIso)}>Partes</Link>
    </Button>
  </div>
);

const TarjaStatusColumn = ({
  title,
  count,
  tone,
  emptyLabel,
  compact = false,
  children,
}: {
  title: string;
  count: number;
  tone: "amber" | "blue" | "emerald";
  emptyLabel: string;
  compact?: boolean;
  children: React.ReactNode;
}) => {
  const toneClass = {
    amber: "border-amber-200 bg-amber-50/70 text-amber-700",
    blue: "border-blue-200 bg-blue-50/70 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50/70 text-emerald-700",
  }[tone];

  return (
    <section className="flex min-h-[480px] flex-col bg-white">
      <div className={cn("flex items-center justify-between border-b px-3 py-2", toneClass)}>
        <span className="text-[11px] font-semibold">{title}</span>
        <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[8px] font-semibold">
          {count}
        </span>
      </div>
      <div
        className={cn(
          "flex-1 overflow-y-auto p-2",
          compact ? "space-y-0" : "space-y-1.5",
        )}
      >
        {count ? (
          children
        ) : (
          <div className="rounded-md border border-dashed border-slate-200 px-2 py-4 text-center text-[10px] text-slate-400">
            {emptyLabel}
          </div>
        )}
      </div>
    </section>
  );
};

const TarjaPanelActions = ({
  startIso,
  endIso,
  returnTo,
}: {
  startIso: string;
  endIso: string;
  returnTo: string;
}) => (
  <div className="flex items-center gap-2">
    <Button asChild variant="outline" size="sm" className={actionButtonClass}>
      <Link to="/tarjas">
        <ListIcon className="size-3.5" />
        Lista
      </Link>
    </Button>
    <Button asChild size="sm" className={actionButtonClass}>
      <Link
        to={`/tarjas/create?fechainicio=${startIso}&fechafinal=${endIso}&returnTo=${encodeURIComponent(returnTo)}`}
      >
        <Plus className="size-3.5" />
        Crear
      </Link>
    </Button>
  </div>
);

const TarjaPanelTitle = ({ onBack }: { onBack: () => void }) => (
  <>
    <div className="sm:hidden">
      <Button
        type="button"
        variant="ghost"
        className="h-7 px-1.5 text-[11px] font-medium text-primary"
        onClick={onBack}
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        Volver
      </Button>
      <div className="-mt-0.5 flex items-center justify-center gap-2">
        <ClipboardCheck className="size-5" />
        <span>Tarjas - Quincena</span>
      </div>
    </div>
    <span className="hidden items-center gap-3 sm:inline-flex">
      <Button
        type="button"
        variant="ghost"
        className="h-8 px-2 text-sm font-medium text-primary"
        onClick={onBack}
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        Volver
      </Button>
      <ClipboardCheck className="size-5" />
      <span>Tarjas - Quincena</span>
    </span>
  </>
);

const TarjaPanelBody = ({
  startIso,
  endIso,
  returnTo,
}: {
  startIso: string;
  endIso: string;
  returnTo: string;
}) => {
  const navigate = useNavigate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [generateProject, setGenerateProject] = useState<GenerateTarjaTarget | null>(null);
  const [closeTarja, setCloseTarja] = useState<CloseTarjaTarget | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const { data = [], filterValues, isLoading, isFetching, error } =
    useListContext<TarjaRecord>();
  const projectFilter = filterValues?.idproyecto;
  const projectFilterPayload = useMemo(() => {
    const payload: Record<string, unknown> = {
      estado: { in: ACTIVE_PROJECT_ESTADOS },
    };
    if (projectFilter) payload.id = Number(projectFilter);
    return payload;
  }, [projectFilter]);

  const { data: projectData = [], isLoading: projectsLoading } =
    useGetList<ProyectoRecord>("proyectos", {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "nombre", order: "ASC" },
      filter: projectFilterPayload,
    });
  const parteFilter = useMemo(() => {
    const filter: Record<string, unknown> = {
      fecha: { gte: startIso, lte: endIso },
    };
    if (projectFilter) filter.idproyecto = Number(projectFilter);
    return filter;
  }, [endIso, projectFilter, startIso]);
  const {
    data: parteData = [],
    isLoading: partesLoading,
    isFetching: partesFetching,
    error: partesError,
  } = useGetList<ParteDiarioRecord>("parte-diario", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "fecha", order: "ASC" },
    filter: parteFilter,
  });

  const tarjas = data as TarjaRecord[];
  const projects = projectData as ProyectoRecord[];
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [String(project.id), project])),
    [projects],
  );
  const generatedProjectIds = useMemo(
    () => new Set(tarjas.map((tarja) => String(tarja.idproyecto ?? ""))),
    [tarjas],
  );
  const pendingProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          project.estado === EXECUTION_PROJECT_ESTADO &&
          isProjectActiveInRange(project, startIso, endIso) &&
          !generatedProjectIds.has(String(project.id)),
      ),
    [endIso, generatedProjectIds, projects, startIso],
  );
  const parteStatsByProject = useMemo(() => {
    const grouped = new Map<
      string,
      { confirmados: number; borradores: number; loadedDates: Set<string> }
    >();
    (parteData as ParteDiarioRecord[]).forEach((parte) => {
      const projectId = String(parte.idproyecto ?? "");
      const dateKey = String(parte.fecha ?? "").slice(0, 10);
      if (!projectId || !dateKey) return;
      const stats = grouped.get(projectId) ?? {
        confirmados: 0,
        borradores: 0,
        loadedDates: new Set<string>(),
      };
      if (parte.estado === "confirmado") {
        stats.confirmados += 1;
      } else {
        stats.borradores += 1;
      }
      stats.loadedDates.add(dateKey);
      grouped.set(projectId, stats);
    });

    return new Map(
      pendingProjects.map((project) => {
        const stats = grouped.get(String(project.id));
        const expectedDays = countProjectDaysInRange(project, startIso, endIso);
        return [
          String(project.id),
          {
            confirmados: stats?.confirmados ?? 0,
            borradores: stats?.borradores ?? 0,
            sinCargar: Math.max(0, expectedDays - (stats?.loadedDates.size ?? 0)),
          } satisfies ParteDiarioStats,
        ];
      }),
    );
  }, [endIso, parteData, pendingProjects, startIso]);
  const draftTarjas = tarjas.filter((tarja) => tarja.estado === "borrador");
  const closedTarjas = tarjas.filter((tarja) => tarja.estado === "cerrado");
  const loading =
    isLoading ||
    isFetching ||
    projectsLoading ||
    partesLoading ||
    partesFetching;

  const openTarja = (tarja: TarjaRecord) => {
    navigate(`/tarjas/${tarja.id}/detalle?returnTo=${encodeURIComponent(returnTo)}`, {
      state: { returnTo },
    });
  };

  const handleGenerateTarja = async () => {
    if (!generateProject?.id) return;
    setActionLoading(true);
    try {
      await postGenerateTarja({
        idproyecto: generateProject.id,
        fechainicio: startIso,
        fechafinal: endIso,
      });
      notify("Tarja generada en borrador", { type: "info" });
      setGenerateProject(null);
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo generar la tarja", {
        type: "warning",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseTarja = async () => {
    if (!closeTarja?.id) return;
    setActionLoading(true);
    try {
      await patchCloseTarja(closeTarja.id);
      notify("Tarja cerrada", { type: "info" });
      setCloseTarja(null);
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo cerrar la tarja", {
        type: "warning",
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      {error || partesError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
          No se pudo cargar el panel de tarjas.
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm">
              <Loader2 className="size-3.5 animate-spin" />
              Cargando quincena
            </span>
          </div>
        ) : null}
        <div className="grid grid-flow-col auto-cols-[280px] overflow-x-auto md:grid-flow-row md:grid-cols-3 md:divide-x md:divide-slate-200 md:overflow-x-hidden">
          <TarjaStatusColumn
            title="Pendientes"
            count={pendingProjects.length}
            tone="amber"
            emptyLabel="Todas las tarjas fueron generadas"
            compact
          >
            {pendingProjects.map((project) => (
              <PendingTarjaRow
                key={project.id}
                project={project}
                startIso={startIso}
                stats={
                  parteStatsByProject.get(String(project.id)) ?? {
                    confirmados: 0,
                    borradores: 0,
                    sinCargar: 0,
                  }
                }
                generating={actionLoading && generateProject?.id === project.id}
                onGenerate={() => setGenerateProject(project)}
              />
            ))}
          </TarjaStatusColumn>

          <TarjaStatusColumn
            title="Borrador"
            count={draftTarjas.length}
            tone="blue"
            emptyLabel="Sin tarjas en borrador"
          >
            {draftTarjas.map((tarja) => (
              <TarjaCard
                key={tarja.id}
                tarja={tarja}
                projectName={
                  projectsById.get(String(tarja.idproyecto ?? ""))?.nombre ??
                  `Obra #${tarja.idproyecto}`
                }
                onOpen={() => openTarja(tarja)}
                generating={actionLoading && generateProject?.id === tarja.idproyecto}
                closing={actionLoading && closeTarja?.id === tarja.id}
                onGenerate={() =>
                  setGenerateProject({
                    id: tarja.idproyecto ?? "",
                    nombre:
                      projectsById.get(String(tarja.idproyecto ?? ""))?.nombre ??
                      `Obra #${tarja.idproyecto}`,
                  })
                }
                onClose={() =>
                  setCloseTarja({
                    id: tarja.id,
                    nombre:
                      projectsById.get(String(tarja.idproyecto ?? ""))?.nombre ??
                      `Obra #${tarja.idproyecto}`,
                  })
                }
              />
            ))}
          </TarjaStatusColumn>

          <TarjaStatusColumn
            title="Cerradas"
            count={closedTarjas.length}
            tone="emerald"
            emptyLabel="Sin tarjas cerradas"
          >
            {closedTarjas.map((tarja) => (
              <TarjaCard
                key={tarja.id}
                tarja={tarja}
                projectName={
                  projectsById.get(String(tarja.idproyecto ?? ""))?.nombre ??
                  `Obra #${tarja.idproyecto}`
                }
                onOpen={() => openTarja(tarja)}
              />
            ))}
          </TarjaStatusColumn>
        </div>
      </div>
      <Confirm
        isOpen={Boolean(generateProject)}
        loading={actionLoading}
        title="Generar tarja"
        content={`Se limpiara la tarja generada anteriormente para ${
          generateProject?.nombre ?? "esta obra"
        } y se volveran a crear los detalles de la quincena.`}
        confirm="Generar"
        onClose={() => {
          if (!actionLoading) setGenerateProject(null);
        }}
        onConfirm={() => {
          void handleGenerateTarja();
        }}
      />
      <Confirm
        isOpen={Boolean(closeTarja)}
        loading={actionLoading}
        title="Cerrar tarja"
        content={`Se cerrara la tarja de ${closeTarja?.nombre ?? "esta obra"}. Una vez cerrada quedara fuera de la columna de borradores.`}
        confirm="Cerrar"
        onClose={() => {
          if (!actionLoading) setCloseTarja(null);
        }}
        onConfirm={() => {
          void handleCloseTarja();
        }}
      />
    </>
  );
};

export const TarjaPanel = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const todayIso = useMemo(() => toISODate(new Date()), []);
  const initialDate = searchParams.get("fecha") ?? todayIso;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [range, setRange] = useState(() => getQuincenaRange(parseDateOnly(initialDate)));
  const startIso = useMemo(() => toISODate(range.start), [range.start]);
  const endIso = useMemo(() => toISODate(range.end), [range.end]);
  const returnTo = `${location.pathname}${location.search}`;

  const setQuincenaFromDate = useCallback(
    (value: string) => {
      const date = parseDateOnly(value);
      const nextIso = toISODate(date);
      setSelectedDate(nextIso);
      setRange(getQuincenaRange(date));
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

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/tarjas");
  };

  return (
    <List
      resource="tarjas"
      title={<TarjaPanelTitle onBack={handleBack} />}
      filters={PANEL_FILTERS}
      actions={
        <TarjaPanelActions
          startIso={startIso}
          endIso={endIso}
          returnTo={returnTo}
        />
      }
      perPage={500}
      pagination={false}
      sort={{ field: "idproyecto", order: "ASC" }}
      filter={{
        fechainicio: { lte: endIso },
        fechafinal: { gte: startIso },
      }}
      containerClassName={LIST_CONTAINER_WIDE}
      showFilters={false}
      topContent={
        <TarjaPanelToolbar
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
      <TarjaPanelBody startIso={startIso} endIso={endIso} returnTo={returnTo} />
    </List>
  );
};

export default TarjaPanel;
