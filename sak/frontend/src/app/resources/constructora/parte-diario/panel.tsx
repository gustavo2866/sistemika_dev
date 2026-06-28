"use client";

import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useGetList, useListContext, useNotify, useRefresh } from "ra-core";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Edit3,
  FilePlus2,
  List as ListIcon,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

import { Confirm } from "@/components/confirm";
import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { FilterForm, StyledFilterDiv } from "@/components/filter-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiUrl } from "@/lib/dataProvider";
import { cn } from "@/lib/utils";
import {
  buildListFilters,
} from "@/components/forms/form_order";
import {
  parseDateOnly,
  toISODate,
} from "@/components/forms/quincena-navigator";
import type { ProyectoRecord } from "../proyectos/model";
import type { ProyectoEncargado } from "../proyecto-encargados";
import type { TarjaRecord } from "../tarjas/model";
import { estadoParteChoices, getEstadoParteBadgeClass, getEstadoParteLabel } from "./constants";
import type { ParteDiarioDetalle, ParteDiarioRecord } from "./model";

type ParteDiarioPanelParte = ParteDiarioRecord & {
  detalles?: ParteDiarioDetalle[];
};

type PanelDay = {
  date: Date;
  iso: string;
};

type ExpectedParteAssignment = {
  key: string;
  project: ProyectoRecord;
  contactoId: number | string | null;
  encargadoNombre: string;
  source?: ProyectoEncargado;
};

type NominaPanelRecord = {
  id: number | string;
  idproyecto?: number | string | null;
  encargado_contacto_id?: number | string | null;
  encargado_contacto?: { id?: number | string | null; nombre_completo?: string | null } | null;
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
const REGISTERED_LIMIT = 5;
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

const getWeekRange = (date: Date) => {
  const start = new Date(date);
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + offset);
  return {
    start,
    end: addDays(start, 6),
  };
};

const formatWeekRange = (start: Date, end: Date) =>
  `${start.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} - ${end.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}`;

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

const getParteAssignmentKey = (
  idproyecto: number | string | null | undefined,
  contactoId: number | string | null | undefined,
) => `${String(idproyecto ?? "")}:${String(contactoId ?? "")}`;

const getTarjaLookupKey = (
  idproyecto: number | string | null | undefined,
  contactoId: number | string | null | undefined,
  quincenaInicio: string | null | undefined,
) => `${String(idproyecto ?? "")}:${String(contactoId ?? "")}:${String(quincenaInicio ?? "").slice(0, 10)}`;

const getQuincenaStartIso = (fecha: string | null | undefined) => {
  const iso = String(fecha ?? "").slice(0, 10);
  if (!iso) return "";
  const date = parseDateOnly(iso);
  date.setDate(date.getDate() <= 15 ? 1 : 16);
  return toISODate(date);
};

const getParteTarjaLookupKey = (parte: ParteDiarioPanelParte) =>
  getTarjaLookupKey(
    parte.idproyecto,
    parte.contacto_id,
    getQuincenaStartIso(parte.fecha),
  );

const getParteDailyTarjaLookupKey = (parte: ParteDiarioPanelParte) =>
  getTarjaLookupKey(parte.idproyecto, parte.contacto_id, parte.fecha);

const findTarjaForParte = (
  parte: ParteDiarioPanelParte,
  tarjasByKey: Map<string, TarjaRecord>,
) =>
  tarjasByKey.get(getParteTarjaLookupKey(parte)) ??
  tarjasByKey.get(getParteDailyTarjaLookupKey(parte));

const getShortContactName = (value?: string | null) =>
  String(value ?? "").trim().slice(0, 15);

const getEncargadoName = (
  idproyecto: number | string | null | undefined,
  contactoId: number | string | null | undefined,
  assignmentsByKey: Map<string, ExpectedParteAssignment>,
  fallback?: string | null,
) =>
  assignmentsByKey.get(getParteAssignmentKey(idproyecto, contactoId))?.encargadoNombre ??
  fallback ??
  "";

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

const isAssignmentActiveOnDate = (assignment: ProyectoEncargado, dateIso: string) => {
  if (assignment.activo === false) return false;
  const start = String(assignment.desde ?? "").slice(0, 10);
  const end = String(assignment.hasta ?? "").slice(0, 10);
  if (start && dateIso < start) return false;
  if (end && dateIso > end) return false;
  return true;
};

const buildCreateUrl = (
  idproyecto: number | string,
  fecha: string,
  returnTo: string,
  contactoId?: number | string | null,
) => {
  const params = new URLSearchParams({
    idproyecto: String(idproyecto),
    fecha,
    returnTo,
  });
  if (contactoId != null && contactoId !== "") {
    params.set("contacto_id", String(contactoId));
  }
  return `/parte-diario/create?${params.toString()}`;
};

const buildAuthHeaders = () => {
  const headers = new Headers({ Accept: "application/json" });
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

const postParteAction = async (
  parteId: number | string,
  action: "abrir" | "cerrar" | "registrar-tarja",
) => {
  const response = await fetch(`${apiUrl}/parte-diario/${parteId}/${action}`, {
    method: "POST",
    headers: buildAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(await getActionErrorMessage(response));
  }
  return response.json();
};

const ParteDiarioPanelToolbar = ({
  rangeStart,
  rangeEnd,
  selectedDate,
  onPrevious,
  onNext,
  onSelectedDateChange,
}: {
  rangeStart: Date;
  rangeEnd: Date;
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
        <div className="flex items-center rounded-md border border-slate-200 bg-white shadow-xs">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-r-none"
            onClick={onPrevious}
            aria-label="Semana anterior"
            title="Semana anterior"
          >
            <ChevronLeft className="size-3" />
          </Button>
          <div className="min-w-[118px] border-x border-slate-200 px-2 text-center">
            <div className="text-[10px] font-semibold text-slate-700">Semana</div>
            <div className="text-[8px] text-slate-500">{formatWeekRange(rangeStart, rangeEnd)}</div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-l-none"
            onClick={onNext}
            aria-label="Semana siguiente"
            title="Semana siguiente"
          >
            <ChevronRight className="size-3" />
          </Button>
        </div>

        <input
          type="date"
          aria-label="Fecha de la semana"
          value={selectedDate}
          onChange={(event) => onSelectedDateChange(event.target.value)}
          className="h-6 w-[116px] rounded-md border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-700 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
  encargadoName,
  onEdit,
  onOpenParte,
  onCloseParte,
  onOpenTarja,
  onRequestRegister,
}: {
  parte: ParteDiarioPanelParte;
  projectName: string;
  encargadoName: string;
  onEdit: () => void;
  onOpenParte: () => void;
  onCloseParte: () => void;
  onOpenTarja?: () => void;
  onRequestRegister: () => void;
}) => {
  const registros = getDetalleCount(parte);
  const totalHoras = getTotalHoras(parte);
  const projectColor = getProjectColor(parte.idproyecto);
  const actionMenu = (
    <ParteDiarioActionMenu
      parte={parte}
      onEdit={onEdit}
      onOpenParte={onOpenParte}
      onCloseParte={onCloseParte}
      onOpenTarja={onOpenTarja}
      onRequestRegister={onRequestRegister}
    />
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 pl-2.5 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <span
            className="absolute left-0 top-0 h-full w-1 rounded-l-md"
            style={{ backgroundColor: projectColor }}
          />
          <div className="min-w-0 leading-none">
            <span className="block min-w-0 truncate text-[9px] font-semibold leading-none text-slate-800">
              {projectName}
            </span>
            {encargadoName ? (
              <span className="block min-w-0 truncate text-[7px] font-medium leading-none text-slate-400">
                {getShortContactName(encargadoName)}
              </span>
            ) : null}
          </div>
          <div className="mt-0 flex min-w-0 items-center justify-between gap-1 text-[7px] leading-none text-slate-500">
            <span className="min-w-0 truncate">
              {registros} registros -{" "}
              {totalHoras.toLocaleString("es-AR", { maximumFractionDigits: 2 })} hs
            </span>
            <Badge
              variant="secondary"
              className={cn("ml-auto h-3 shrink-0 px-0.5 py-0 text-[6px] leading-none", getEstadoParteBadgeClass(parte.estado))}
            >
              {getEstadoParteLabel(parte.estado)}
            </Badge>
          </div>
        </button>
      </DropdownMenuTrigger>
      {actionMenu}
    </DropdownMenu>
  );
};

const ParteDiarioActionMenu = ({
  parte,
  onEdit,
  onOpenParte,
  onCloseParte,
  onOpenTarja,
  onRequestRegister,
}: {
  parte: ParteDiarioPanelParte;
  onEdit: () => void;
  onOpenParte: () => void;
  onCloseParte: () => void;
  onOpenTarja?: () => void;
  onRequestRegister: () => void;
}) => {
  const isClosed = parte.estado === "cerrado";
  const isDraft = parte.estado === "borrador";
  const canOpenParte = parte.estado === "cerrado" || parte.estado === "registrado";
  const isRegistered = parte.estado === "registrado";

  return (
    <DropdownMenuContent align="start" className="min-w-36">
      <DropdownMenuItem onClick={onEdit}>
        <Edit3 className="h-3.5 w-3.5" />
        Editar
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!canOpenParte} onClick={onOpenParte}>
        <RotateCcw className="h-3.5 w-3.5" />
        Abrir
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!isDraft} onClick={onCloseParte}>
        <Lock className="h-3.5 w-3.5" />
        Cerrar
      </DropdownMenuItem>
      {isRegistered ? (
        <DropdownMenuItem disabled={!onOpenTarja} onClick={onOpenTarja}>
          <ClipboardCheck className="h-3.5 w-3.5" />
          Tarja
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={!isClosed} onClick={onRequestRegister}>
        <FilePlus2 className="h-3.5 w-3.5" />
        Registrar
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
};

const ParteDiarioRegisteredRow = ({
  parte,
  projectName,
  encargadoName,
  onEdit,
  onOpenParte,
  onCloseParte,
  onOpenTarja,
  onRequestRegister,
}: {
  parte: ParteDiarioPanelParte;
  projectName: string;
  encargadoName: string;
  onEdit: () => void;
  onOpenParte: () => void;
  onCloseParte: () => void;
  onOpenTarja?: () => void;
  onRequestRegister: () => void;
}) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        className="flex min-h-3 w-full items-center gap-1 rounded px-1 py-0 text-left text-[8px] leading-[0.7rem] text-blue-500 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
      >
        <span
          className="h-1 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: getProjectColor(parte.idproyecto) }}
        />
        <span className="min-w-0 leading-none">
          <span className="block truncate">{projectName}</span>
          {encargadoName ? (
            <span className="block truncate text-[7px] leading-none text-blue-300">
              {getShortContactName(encargadoName)}
            </span>
          ) : null}
        </span>
      </button>
    </DropdownMenuTrigger>
    <ParteDiarioActionMenu
      parte={parte}
      onEdit={onEdit}
      onOpenParte={onOpenParte}
      onCloseParte={onCloseParte}
      onOpenTarja={onOpenTarja}
      onRequestRegister={onRequestRegister}
    />
  </DropdownMenu>
);

const ParteDiarioMissingProjectRow = ({
  assignment,
  dateIso,
  returnTo,
}: {
  assignment: ExpectedParteAssignment;
  dateIso: string;
  returnTo: string;
}) => (
  <Link
    to={buildCreateUrl(assignment.project.id, dateIso, returnTo, assignment.contactoId)}
    className="flex min-h-3 w-full items-center gap-1 rounded px-1 py-0 text-left text-[8px] leading-[0.7rem] text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
  >
    <span
      className="h-1 w-1 shrink-0 rounded-full"
      style={{ backgroundColor: getProjectColor(assignment.project.id) }}
    />
    <span className="min-w-0 leading-none">
      <span className="block truncate">{assignment.project.nombre ?? `Obra #${assignment.project.id}`}</span>
      {assignment.encargadoNombre ? (
        <span className="block truncate text-[7px] leading-none text-slate-400">
          {getShortContactName(assignment.encargadoNombre)}
        </span>
      ) : null}
    </span>
  </Link>
);

const ParteDiarioDayColumn = ({
  day,
  partes,
  missingAssignments,
  tarjasByKey,
  projectsById,
  assignmentsByKey,
  isToday,
  showMissing,
  showRegistered,
  expanded,
  registeredExpanded,
  collapsed,
  registeredCollapsed,
  returnTo,
  onToggleMissing,
  onToggleMissingBlock,
  onToggleRegistered,
  onToggleRegisteredBlock,
  onEditParte,
  onOpenParte,
  onCloseParte,
  onOpenTarja,
  onRequestRegister,
}: {
  day: PanelDay;
  partes: ParteDiarioPanelParte[];
  missingAssignments: ExpectedParteAssignment[];
  tarjasByKey: Map<string, TarjaRecord>;
  projectsById: Map<string, ProyectoRecord>;
  assignmentsByKey: Map<string, ExpectedParteAssignment>;
  isToday: boolean;
  showMissing: boolean;
  showRegistered: boolean;
  expanded: boolean;
  registeredExpanded: boolean;
  collapsed: boolean;
  registeredCollapsed: boolean;
  returnTo: string;
  onToggleMissing: () => void;
  onToggleMissingBlock: () => void;
  onToggleRegistered: () => void;
  onToggleRegisteredBlock: () => void;
  onEditParte: (parte: ParteDiarioPanelParte) => void;
  onOpenParte: (parte: ParteDiarioPanelParte) => void;
  onCloseParte: (parte: ParteDiarioPanelParte) => void;
  onOpenTarja: (tarja: TarjaRecord) => void;
  onRequestRegister: (parte: ParteDiarioPanelParte) => void;
}) => {
  const activePartes = partes.filter((parte) => parte.estado !== "registrado");
  const registeredPartes = partes.filter((parte) => parte.estado === "registrado");
  const visibleMissing = expanded
    ? missingAssignments
    : missingAssignments.slice(0, MISSING_LIMIT);
  const hiddenMissing = Math.max(0, missingAssignments.length - visibleMissing.length);
  const visibleRegistered = registeredExpanded
    ? registeredPartes
    : registeredPartes.slice(0, REGISTERED_LIMIT);
  const hiddenRegistered = Math.max(0, registeredPartes.length - visibleRegistered.length);

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
        {activePartes.length ? (
          activePartes.map((parte) => (
            <ParteDiarioCard
              key={parte.id}
              parte={parte}
              projectName={getProjectName(parte.idproyecto, projectsById)}
              encargadoName={getEncargadoName(
                parte.idproyecto,
                parte.contacto_id,
                assignmentsByKey,
                parte.contacto?.nombre_completo,
              )}
              onEdit={() => onEditParte(parte)}
              onOpenParte={() => onOpenParte(parte)}
              onCloseParte={() => onCloseParte(parte)}
              onOpenTarja={() => {
                const tarja = findTarjaForParte(parte, tarjasByKey);
                if (tarja) onOpenTarja(tarja);
              }}
              onRequestRegister={() => onRequestRegister(parte)}
            />
          ))
        ) : (
          !showRegistered || !registeredPartes.length ? (
            <div className="rounded-md border border-dashed border-slate-200 px-2 py-3 text-center text-[10px] text-slate-400">
            Sin partes
            </div>
          ) : null
        )}

        {showRegistered && registeredPartes.length ? (
          <div className="mt-1.5 border-t border-dashed border-blue-100 pt-1">
            <button
              type="button"
              className="mb-px flex w-full items-center justify-between gap-2 rounded px-1 py-0 text-left text-[7px] font-semibold uppercase leading-[0.65rem] text-blue-500 hover:bg-blue-50 hover:text-blue-700"
              aria-expanded={!registeredCollapsed}
              onClick={onToggleRegisteredBlock}
            >
              <span>Registrados</span>
              <span>{registeredPartes.length}</span>
            </button>
            {!registeredCollapsed ? (
              <div className="space-y-0">
                {visibleRegistered.map((parte) => (
                  (() => {
                    const tarja = findTarjaForParte(parte, tarjasByKey);
                    return (
                      <ParteDiarioRegisteredRow
                        key={parte.id}
                        parte={parte}
                        projectName={getProjectName(parte.idproyecto, projectsById)}
                        encargadoName={getEncargadoName(
                          parte.idproyecto,
                          parte.contacto_id,
                          assignmentsByKey,
                          parte.contacto?.nombre_completo,
                        )}
                        onEdit={() => onEditParte(parte)}
                        onOpenParte={() => onOpenParte(parte)}
                        onCloseParte={() => onCloseParte(parte)}
                        onOpenTarja={tarja ? () => onOpenTarja(tarja) : undefined}
                        onRequestRegister={() => onRequestRegister(parte)}
                      />
                    );
                  })()
                ))}
                {hiddenRegistered > 0 ? (
                  <button
                    type="button"
                    className="w-full rounded px-1 py-0 text-left text-[8px] font-medium leading-[0.7rem] text-blue-400 hover:bg-blue-50 hover:text-blue-600"
                    onClick={onToggleRegistered}
                  >
                    + {hiddenRegistered} registrados
                  </button>
                ) : registeredExpanded && registeredPartes.length > REGISTERED_LIMIT ? (
                  <button
                    type="button"
                    className="w-full rounded px-1 py-0 text-left text-[8px] font-medium leading-[0.7rem] text-blue-400 hover:bg-blue-50 hover:text-blue-600"
                    onClick={onToggleRegistered}
                  >
                    Ver menos
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {showMissing ? (
          <div className="mt-1.5 border-t border-dashed border-slate-200 pt-1">
            <button
              type="button"
              className="mb-px flex w-full items-center justify-between gap-2 rounded px-1 py-0 text-left text-[7px] font-semibold uppercase leading-[0.65rem] text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              aria-expanded={!collapsed}
              onClick={onToggleMissingBlock}
            >
              <span>Sin registrar</span>
              <span>{missingAssignments.length}</span>
            </button>
            {!collapsed && missingAssignments.length ? (
              <div className="space-y-0">
                {visibleMissing.map((assignment) => (
                  <ParteDiarioMissingProjectRow
                    key={assignment.key}
                    assignment={assignment}
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
                ) : expanded && missingAssignments.length > MISSING_LIMIT ? (
                  <button
                    type="button"
                    className="w-full rounded px-1 py-0 text-left text-[8px] font-medium leading-[0.7rem] text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                    onClick={onToggleMissing}
                  >
                    Ver menos
                  </button>
                ) : null}
              </div>
            ) : !collapsed ? (
              <div className="rounded px-1 py-0 text-[8px] leading-[0.7rem] text-slate-400">
                Todas reportadas
              </div>
            ) : null}
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
  const notify = useNotify();
  const refresh = useRefresh();
  const [expandedMissing, setExpandedMissing] = useState<Set<string>>(() => new Set());
  const [collapsedMissing, setCollapsedMissing] = useState<Set<string>>(() => new Set());
  const [expandedRegistered, setExpandedRegistered] = useState<Set<string>>(() => new Set());
  const [collapsedRegistered, setCollapsedRegistered] = useState<Set<string>>(() => new Set());
  const [registerParte, setRegisterParte] = useState<ParteDiarioPanelParte | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const {
    data = [],
    filterValues,
    isLoading,
    isFetching,
    error,
  } = useListContext<ParteDiarioPanelParte>();
  const projectFilter = filterValues?.idproyecto;
  const statusFilter = filterValues?.estado;
  const weekStartIso = days[0]?.iso;
  const weekEndIso = days[days.length - 1]?.iso;

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

  const assignmentFilterPayload = useMemo(() => {
    const payload: Record<string, unknown> = { activo: true };
    if (projectFilter) payload.proyecto_id = Number(projectFilter);
    return payload;
  }, [projectFilter]);

  const { data: assignmentData = [], isLoading: assignmentsLoading } = useGetList<ProyectoEncargado>(
    "proyecto-encargados",
    {
      pagination: { page: 1, perPage: 2000 },
      sort: { field: "id", order: "ASC" },
      filter: assignmentFilterPayload,
    },
  );

  const nominaFilterPayload = useMemo(() => {
    const payload: Record<string, unknown> = {
      activo: true,
    };
    if (projectFilter) payload.idproyecto = Number(projectFilter);
    return payload;
  }, [projectFilter]);

  const { data: nominaData = [], isLoading: nominasLoading } = useGetList<NominaPanelRecord>(
    "nominas",
    {
      pagination: { page: 1, perPage: 2000 },
      sort: { field: "id", order: "ASC" },
      filter: nominaFilterPayload,
    },
  );

  const tarjaFilterPayload = useMemo(() => {
    const payload: Record<string, unknown> = {
      fechainicio: { lte: weekEndIso },
      fechafinal: { gte: weekStartIso },
    };
    if (projectFilter) payload.idproyecto = Number(projectFilter);
    return payload;
  }, [projectFilter, weekEndIso, weekStartIso]);

  const { data: tarjaData = [], isLoading: tarjasLoading } = useGetList<TarjaRecord>(
    "tarjas",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "fechainicio", order: "ASC" },
      filter: tarjaFilterPayload,
    },
    { enabled: Boolean(weekStartIso && weekEndIso) },
  );

  const partes = data as ParteDiarioPanelParte[];
  const projects = projectData as ProyectoRecord[];
  const assignments = assignmentData as ProyectoEncargado[];
  const nominas = nominaData as NominaPanelRecord[];
  const tarjas = tarjaData as TarjaRecord[];
  const loading = isLoading || isFetching || projectsLoading || assignmentsLoading || nominasLoading || tarjasLoading;

  const projectsById = useMemo(
    () => new Map(projects.map((project) => [String(project.id), project])),
    [projects],
  );

  const expectedAssignments = useMemo<ExpectedParteAssignment[]>(() => {
    const byProject = new Map<string, ProyectoEncargado[]>();
    assignments.forEach((assignment) => {
      const projectId = String(assignment.proyecto_id ?? "");
      if (!projectId) return;
      const current = byProject.get(projectId) ?? [];
      current.push(assignment);
      byProject.set(projectId, current);
    });

    const nominaContactsByProject = new Map<string, Map<string, NominaPanelRecord>>();
    nominas.forEach((nomina) => {
      const projectId = String(nomina.idproyecto ?? "");
      const contactoId = String(nomina.encargado_contacto_id ?? "");
      if (!projectId || !contactoId) return;
      const current = nominaContactsByProject.get(projectId) ?? new Map<string, NominaPanelRecord>();
      if (!current.has(contactoId)) {
        current.set(contactoId, nomina);
      }
      nominaContactsByProject.set(projectId, current);
    });

    return projects.flatMap((project): ExpectedParteAssignment[] => {
      const projectAssignments = byProject.get(String(project.id)) ?? [];
      const assignmentsForProject = projectAssignments.map((assignment) => ({
        key: getParteAssignmentKey(project.id, assignment.contacto_id),
        project,
        contactoId: assignment.contacto_id ?? null,
        encargadoNombre: assignment.contacto?.nombre_completo ?? "",
        source: assignment,
      }));
      const assignmentContactKeys = new Set(assignmentsForProject.map((assignment) => assignment.key));
      const nominaAssignments = Array.from(
        nominaContactsByProject.get(String(project.id))?.values() ?? [],
      )
        .map((nomina) => ({
          key: getParteAssignmentKey(project.id, nomina.encargado_contacto_id),
          project,
          contactoId: nomina.encargado_contacto_id ?? null,
          encargadoNombre: nomina.encargado_contacto?.nombre_completo ?? "",
        }))
        .filter((assignment) => !assignmentContactKeys.has(assignment.key));
      const combinedAssignments = [...assignmentsForProject, ...nominaAssignments];

      if (!combinedAssignments.length) {
        return [{
          key: getParteAssignmentKey(project.id, null),
          project,
          contactoId: null,
          encargadoNombre: "",
        }];
      }

      return combinedAssignments;
    });
  }, [assignments, nominas, projects]);

  const assignmentsByKey = useMemo(
    () => new Map(expectedAssignments.map((assignment) => [assignment.key, assignment])),
    [expectedAssignments],
  );

  const tarjasByKey = useMemo(
    () =>
      new Map(
        tarjas.map((tarja) => [
          getTarjaLookupKey(tarja.idproyecto, tarja.contacto_id, tarja.fechainicio),
          tarja,
        ]),
      ),
    [tarjas],
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

  const reportedAssignmentKeysByDate = useMemo(() => {
    const grouped = new Map<string, Set<string>>();
    partes.forEach((parte) => {
      const dateKey = getParteDateKey(parte);
      const id = String(parte.idproyecto ?? "");
      if (!dateKey || !id) return;
      const current = grouped.get(dateKey) ?? new Set<string>();
      current.add(getParteAssignmentKey(parte.idproyecto, parte.contacto_id));
      grouped.set(dateKey, current);
    });
    return grouped;
  }, [partes]);

  const missingAssignmentsByDate = useMemo(() => {
    const grouped = new Map<string, ExpectedParteAssignment[]>();
    days.forEach((day) => {
      const reported = reportedAssignmentKeysByDate.get(day.iso) ?? new Set<string>();
      grouped.set(
        day.iso,
        expectedAssignments.filter(
          (assignment) =>
            isProjectActiveOnDate(assignment.project, day.iso) &&
            (
              assignment.contactoId == null ||
              (assignment.source ? isAssignmentActiveOnDate(assignment.source, day.iso) : true)
            ) &&
            !reported.has(assignment.key),
        ),
      );
    });
    return grouped;
  }, [days, expectedAssignments, reportedAssignmentKeysByDate]);

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

  const toggleMissingBlock = (dateIso: string) => {
    setCollapsedMissing((current) => {
      const next = new Set(current);
      if (next.has(dateIso)) {
        next.delete(dateIso);
      } else {
        next.add(dateIso);
      }
      return next;
    });
  };

  const toggleRegistered = (dateIso: string) => {
    setExpandedRegistered((current) => {
      const next = new Set(current);
      if (next.has(dateIso)) {
        next.delete(dateIso);
      } else {
        next.add(dateIso);
      }
      return next;
    });
  };

  const toggleRegisteredBlock = (dateIso: string) => {
    setCollapsedRegistered((current) => {
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

  const handleOpenTarja = (tarja: TarjaRecord) => {
    if (!tarja.id) return;
    navigate(`/tarjas/${tarja.id}?returnTo=${encodeURIComponent(returnTo)}`, {
      state: { returnTo },
    });
  };

  const handleAbrirParte = async (parte: ParteDiarioPanelParte) => {
    if (!parte.id) return;
    setActionLoading(true);
    try {
      await postParteAction(parte.id, "abrir");
      notify("Parte diario abierto como borrador", { type: "info" });
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo abrir el parte diario", {
        type: "warning",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCerrarParte = async (parte: ParteDiarioPanelParte) => {
    if (!parte.id) return;
    setActionLoading(true);
    try {
      await postParteAction(parte.id, "cerrar");
      notify("Parte diario cerrado", { type: "info" });
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo cerrar el parte diario", {
        type: "warning",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegisterParte = async () => {
    if (!registerParte?.id) return;
    setActionLoading(true);
    try {
      await postParteAction(registerParte.id, "registrar-tarja");
      notify("Tarja generada en borrador", { type: "info" });
      setRegisterParte(null);
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo registrar la tarja", {
        type: "warning",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const showMissing = !statusFilter;
  const showRegistered = !statusFilter || statusFilter === "registrado";

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
        <div className="grid grid-flow-col auto-cols-[150px] divide-x divide-slate-200 overflow-x-auto sm:auto-cols-[140px] lg:grid-flow-row lg:grid-cols-7 lg:auto-cols-auto lg:overflow-x-hidden">
          {days.map((day) => (
            <ParteDiarioDayColumn
              key={day.iso}
              day={day}
              partes={partesByDate.get(day.iso) ?? []}
              missingAssignments={missingAssignmentsByDate.get(day.iso) ?? []}
              tarjasByKey={tarjasByKey}
              projectsById={projectsById}
              assignmentsByKey={assignmentsByKey}
              isToday={day.iso === todayIso}
              showMissing={showMissing}
              showRegistered={showRegistered}
              expanded={expandedMissing.has(day.iso)}
              registeredExpanded={expandedRegistered.has(day.iso)}
              collapsed={!collapsedMissing.has(day.iso)}
              registeredCollapsed={!collapsedRegistered.has(day.iso)}
              returnTo={returnTo}
              onToggleMissing={() => toggleMissing(day.iso)}
              onToggleMissingBlock={() => toggleMissingBlock(day.iso)}
              onToggleRegistered={() => toggleRegistered(day.iso)}
              onToggleRegisteredBlock={() => toggleRegisteredBlock(day.iso)}
              onEditParte={handleOpenParte}
              onOpenParte={(parte) => void handleAbrirParte(parte)}
              onCloseParte={(parte) => void handleCerrarParte(parte)}
              onOpenTarja={handleOpenTarja}
              onRequestRegister={setRegisterParte}
            />
          ))}
        </div>
      </div>
      <Confirm
        isOpen={Boolean(registerParte)}
        loading={actionLoading}
        title="Registrar tarja"
        content="Se generara o actualizara una tarja en estado borrador para esta obra, encargado y fecha. Se copiaran las novedades del parte diario y se completara la nomina restante como PRESENTE con 9 horas."
        confirm="Registrar"
        onClose={() => {
          if (!actionLoading) setRegisterParte(null);
        }}
        onConfirm={() => {
          void handleRegisterParte();
        }}
      />
    </>
  );
};

export const ParteDiarioPanel = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const todayIso = useMemo(() => toISODate(new Date()), []);
  const initialDate = searchParams.get("fecha") ?? todayIso;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [range, setRange] = useState(() =>
    getWeekRange(parseDateOnly(initialDate)),
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

  const setWeekFromDate = useCallback(
    (value: string) => {
      const nextDate = parseDateOnly(value);
      const nextIso = toISODate(nextDate);
      setSelectedDate(nextIso);
      setRange(getWeekRange(nextDate));
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
    setWeekFromDate(toISODate(addDays(range.start, direction * 7)));
  };

  return (
    <List
      resource="parte-diario"
      title={
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Parte Diario - Semana
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
          selectedDate={selectedDate}
          onPrevious={() => moveTo(-1)}
          onNext={() => moveTo(1)}
          onSelectedDateChange={setWeekFromDate}
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
