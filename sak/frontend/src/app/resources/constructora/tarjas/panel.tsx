"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useNotify } from "ra-core";
import {
  ArrowLeft,
  CheckCircle2,
  FileClock,
  FileQuestion,
  Loader2,
  Lock,
  LockOpen,
  MoreHorizontal,
  Download,
  RefreshCw,
  RotateCcw,
  Sparkles,
  TableProperties,
} from "lucide-react";

import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { Confirm } from "@/components/confirm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getQuincenaRange,
  moveQuincena,
  parseDateOnly,
  QuincenaNavigator,
  toISODate,
} from "@/components/forms/quincena-navigator";
import { apiUrl } from "@/lib/dataProvider";
import { cn } from "@/lib/utils";
import { PROYECTO_ESTADO_CHOICES } from "../proyectos/model";

type PanelDayStatus = "faltante" | "borrador" | "completo" | "cerrado" | "descanso";

type PanelDay = {
  fecha: string;
  dia: number;
  weekday: number;
  esperado: boolean;
  estado: PanelDayStatus;
  parte_ids: number[];
  partes: number;
};

type PanelTarja = {
  id: number;
  estado: "borrador" | "cerrado";
  panel_estado: "borrador" | "lista_cerrar" | "cerrado";
  fechainicio?: string | null;
  fechafinal?: string | null;
  registros: number;
  horas: number;
  novedades: number;
  adicional: number;
  premio: number;
};

type PanelRow = {
  id: string;
  proyecto_id: number;
  contacto_id?: number | null;
  proyecto_nombre: string;
  proyecto_estado?: string | null;
  encargado?: string | null;
  encargado_telefono?: string | null;
  encargado_principal?: boolean | null;
  fecha_inicio?: string | null;
  fecha_final?: string | null;
  dias: PanelDay[];
  parte_stats: {
    esperados: number;
    completos: number;
    borrador: number;
    faltantes: number;
    descanso: number;
  };
  tarja?: PanelTarja | null;
  puede_generar: boolean;
  puede_cerrar: boolean;
  puede_reabrir: boolean;
};

type TarjaPanelResponse = {
  range: {
    fechainicio: string;
    fechafinal: string;
  };
  totals: {
    obras: number;
    dias_esperados: number;
    partes_completos: number;
    partes_borrador: number;
    partes_faltantes: number;
    sin_tarja: number;
    tarjas_borrador: number;
    tarjas_listas: number;
    tarjas_cerradas: number;
  };
  rows: PanelRow[];
};

type TarjaDetalleCell = {
  fecha?: string | null;
  horas?: number | null;
  estado?: string | null;
  estado_nombre?: string | null;
  descripcion?: string | null;
};

type TarjaNovedadSummary = {
  horas_justificadas?: number | null;
  presentismo?: boolean | null;
  adicional_importe?: number | null;
  premio_importe?: number | null;
  observaciones?: string | null;
};

type DayKey =
  | "D01"
  | "D02"
  | "D03"
  | "D04"
  | "D05"
  | "D06"
  | "D07"
  | "D08"
  | "D09"
  | "D10"
  | "D11"
  | "D12"
  | "D13"
  | "D14"
  | "D15";

type TarjaDetalleExportRow = {
  id: string;
  proyecto_nombre: string;
  encargado?: string | null;
  empleado: string;
  dni?: string | null;
  categoria_codigo?: string | null;
  actividad_codigo?: string | null;
  novedad?: TarjaNovedadSummary | null;
} & Record<DayKey, TarjaDetalleCell>;

type ActionTarget = {
  row: PanelRow;
  action: "generar" | "cerrar" | "reabrir";
};

const EXECUTION_PROJECT_ESTADO = "02-ejecucion";
const dayKeys = Array.from(
  { length: 15 },
  (_, index) => `D${String(index + 1).padStart(2, "0")}` as DayKey,
);

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

const extractActionErrorMessage = async (response: Response) => {
  try {
    const payload = await response.json();
    const detail = payload?.detail;
    if (typeof detail === "string") return detail;
    if (typeof detail?.error?.message === "string") return detail.error.message;
    if (typeof payload?.message === "string") return payload.message;
  } catch {
    // Keep the generic message below.
  }
  return "No se pudo completar la accion";
};

const fetchTarjaPanel = async ({
  startIso,
  endIso,
  projectId,
  projectEstado,
  signal,
}: {
  startIso: string;
  endIso: string;
  projectId?: string | null;
  projectEstado?: string | null;
  signal?: AbortSignal;
}) => {
  const params = new URLSearchParams({
    fechainicio: startIso,
    fechafinal: endIso,
  });
  params.set("estado", projectEstado ?? "");
  if (projectId) params.set("idproyecto", projectId);

  const response = await fetch(`${apiUrl}/tarjas/panel?${params.toString()}`, {
    cache: "no-store",
    headers: buildAuthHeaders(),
    signal,
  });
  if (!response.ok) {
    throw new Error(await extractActionErrorMessage(response));
  }
  return (await response.json()) as TarjaPanelResponse;
};

const postGenerateTarja = async ({
  idproyecto,
  contacto_id,
  fechainicio,
  fechafinal,
}: {
  idproyecto: number;
  contacto_id?: number | null;
  fechainicio: string;
  fechafinal: string;
}) => {
  const response = await fetch(`${apiUrl}/tarjas/generar`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ idproyecto, contacto_id: contacto_id ?? null, fechainicio, fechafinal }),
  });
  if (!response.ok) {
    throw new Error(await extractActionErrorMessage(response));
  }
  return response.json();
};

const patchTarjaEstado = async (tarjaId: number, estado: "borrador" | "cerrado") => {
  const response = await fetch(`${apiUrl}/tarjas/${tarjaId}`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ estado }),
  });
  if (!response.ok) {
    throw new Error(await extractActionErrorMessage(response));
  }
  return response.json();
};

const postCloseTarja = async (tarjaId: number) => {
  const response = await fetch(`${apiUrl}/tarjas/${tarjaId}/cerrar`, {
    method: "POST",
    headers: buildAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(await extractActionErrorMessage(response));
  }
  return response.json();
};

const formatNumber = (value: number, maximumFractionDigits = 0) =>
  Number(value || 0).toLocaleString("es-AR", { maximumFractionDigits });

const formatHours = (value: number) =>
  value.toLocaleString("es-AR", { maximumFractionDigits: 1 });

const hasAmount = (value?: number | null) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount !== 0;
};

const escapeHtml = (value?: string | number | null) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const downloadBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const formatDayLabel = (cell?: TarjaDetalleCell, fallback?: string) => {
  const date = String(cell?.fecha ?? "").slice(0, 10);
  if (!date) return fallback ?? "";
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
};

const isNonWorkingDay = (dateValue?: string | null) => {
  const date = String(dateValue ?? "").slice(0, 10);
  if (!date) return false;
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0;
};

const shouldShowEstado = (estado?: string | null) => {
  const value = String(estado ?? "").trim().toUpperCase();
  return Boolean(value && value !== "P");
};

const getWorkedHours = (row: TarjaDetalleExportRow) =>
  dayKeys.reduce((total, key) => {
    const horas = Number(row[key]?.horas ?? 0);
    return total + (Number.isFinite(horas) ? horas : 0);
  }, 0);

const getTarjaDetalleExportCellText = (
  row: TarjaDetalleExportRow,
  columnKey:
    | DayKey
    | "proyecto"
    | "encargado"
    | "empleado"
    | "categoria"
    | "actividad"
    | "horas"
    | "presentismo"
    | "bonos"
    | "comentario",
) => {
  if (dayKeys.includes(columnKey as DayKey)) {
    const cell = row[columnKey as DayKey];
    const horas = cell?.horas == null ? "" : formatHours(Number(cell.horas));
    const estado = shouldShowEstado(cell?.estado) ? String(cell?.estado ?? "") : "";
    return [horas, estado].filter(Boolean).join(" ");
  }

  const workedHours = getWorkedHours(row);
  const justifiedHours = Number(row.novedad?.horas_justificadas ?? 0);
  const totalHours = workedHours + (Number.isFinite(justifiedHours) ? justifiedHours : 0);
  const totalBonus =
    Number(row.novedad?.adicional_importe ?? 0) + Number(row.novedad?.premio_importe ?? 0);

  switch (columnKey) {
    case "proyecto":
      return row.proyecto_nombre;
    case "encargado":
      return row.encargado ?? "Sin encargado";
    case "categoria":
      return row.categoria_codigo ?? "";
    case "actividad":
      return row.actividad_codigo ?? "";
    case "horas":
      return formatHours(totalHours);
    case "presentismo":
      return `${row.novedad?.presentismo ? "SI" : "NO"} trab:${formatHours(workedHours)}${
        justifiedHours ? ` just:${formatHours(justifiedHours)}` : ""
      }`;
    case "bonos":
      return formatNumber(totalBonus);
    case "comentario":
      return row.novedad?.observaciones ?? "";
    default:
      return [row.empleado, row.dni].filter(Boolean).join(" ");
  }
};

const downloadTarjaPanelExcel = (
  filename: string,
  title: string,
  rows: TarjaDetalleExportRow[],
) => {
  const headers = [
    "Proy",
    "Enc",
    "Emp",
    ...dayKeys.map((key) => formatDayLabel(rows[0]?.[key], key).slice(0, 2)),
    "Cat",
    "Act",
    "Hs",
    "Pres",
    "Bon",
    "Com",
  ];
  const columnKeys = [
    "proyecto",
    "encargado",
    "empleado",
    ...dayKeys,
    "categoria",
    "actividad",
    "horas",
    "presentismo",
    "bonos",
    "comentario",
  ] as const;
  const bodyRows = rows
    .map((row, rowIndex) => {
      const cells = columnKeys
        .map((columnKey) => {
          const isSunday =
            dayKeys.includes(columnKey as DayKey) &&
            isNonWorkingDay(rows[0]?.[columnKey as DayKey]?.fecha);
          const isDayColumn = dayKeys.includes(columnKey as DayKey);
          const style = [
            "border:1px solid #cbd5e1",
            "mso-number-format:\\@",
            isDayColumn ? "font-size:9px" : "font-size:10px",
            isDayColumn ? "padding:2px 1px" : "padding:3px",
            isDayColumn ? "text-align:center" : "",
            isSunday ? "background:#e5e7eb" : rowIndex % 2 ? "background:#fafafa" : "",
          ]
            .filter(Boolean)
            .join(";");
          return `<td style="${style}">${escapeHtml(getTarjaDetalleExportCellText(row, columnKey))}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; }
    h1 { font-size: 16px; margin: 0 0 12px 0; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th { border: 1px solid #cbd5e1; background: #000; color: #fff; font-size: 9px; padding: 3px 2px; }
    .date-col { width: 24px; }
    .project-col { width: 150px; }
    .person-col { width: 130px; }
    .small-col { width: 44px; }
    .comment-col { width: 90px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <table>
    <colgroup>
      <col class="project-col" />
      <col class="person-col" />
      <col class="person-col" />
      ${dayKeys.map(() => `<col class="date-col" />`).join("")}
      <col class="small-col" />
      <col class="small-col" />
      <col class="small-col" />
      <col class="small-col" />
      <col class="small-col" />
      <col class="comment-col" />
    </colgroup>
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;
  const blob = new Blob([`\uFEFF${html}`], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  downloadBlob(filename.replace(/\.(csv|xlsx?)$/i, ".xls"), blob);
};

const fetchTarjaDetalleRows = async (tarjaId: number): Promise<TarjaDetalleExportRow[]> => {
  const params = new URLSearchParams({
    filter: JSON.stringify({ tarja_id: tarjaId }),
    range: JSON.stringify([0, 9999]),
    sort: JSON.stringify(["empleado", "ASC"]),
  });
  const response = await fetch(`${apiUrl}/tarja-detalle?${params.toString()}`, {
    headers: buildAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(await extractActionErrorMessage(response));
  }
  return (await response.json()) as TarjaDetalleExportRow[];
};

const buildSafeFilename = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();

const buildParteDiarioDayUrl = (row: PanelRow, day: PanelDay, returnTo: string) => {
  const parteId = day.parte_ids[0];
  if (parteId) {
    return `/parte-diario/${parteId}?returnTo=${encodeURIComponent(returnTo)}`;
  }
  const params = new URLSearchParams({
    idproyecto: String(row.proyecto_id),
    fecha: day.fecha,
    returnTo,
  });
  if (row.contacto_id) {
    params.set("contacto_id", String(row.contacto_id));
  }
  return `/parte-diario/create?${params.toString()}`;
};

const buildAgentChatUrl = (row: PanelRow, returnTo: string) => {
  const params = new URLSearchParams({
    source: "parte-diario",
    message: `parte diario ${row.proyecto_nombre}`,
    from_phone: row.encargado_telefono ?? "",
    returnTo,
  });
  if (row.encargado?.trim()) params.set("from_name", row.encargado.trim());
  return `/agente-chat?${params.toString()}`;
};

const getTarjaStatusLabel = (row: PanelRow) => {
  if (!row.tarja) return "Sin tarja";
  if (row.tarja.panel_estado === "lista_cerrar") return "Lista para cerrar";
  if (row.tarja.estado === "cerrado") return "Cerrada";
  return "Borrador";
};

const getTarjaStatusClass = (row: PanelRow) => {
  if (!row.tarja) return "bg-slate-100 text-slate-700";
  if (row.tarja.panel_estado === "lista_cerrar") return "bg-blue-100 text-blue-700";
  if (row.tarja.estado === "cerrado") return "bg-emerald-100 text-emerald-700";
  return "bg-amber-100 text-amber-700";
};

const dayStatusConfig: Record<
  PanelDayStatus,
  { label: string; short: string; className: string; icon: React.ReactNode }
> = {
  completo: {
    label: "Parte completo",
    short: "C",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: <CheckCircle2 className="size-2.5" />,
  },
  cerrado: {
    label: "Parte cerrado",
    short: "T",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: <Lock className="size-2.5" />,
  },
  borrador: {
    label: "Parte en borrador",
    short: "B",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: <FileClock className="size-2.5" />,
  },
  faltante: {
    label: "Parte faltante",
    short: "F",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    icon: <FileQuestion className="size-2.5" />,
  },
  descanso: {
    label: "Dia no requerido",
    short: "-",
    className: "border-slate-200 bg-slate-50 text-slate-400",
    icon: null,
  },
};

const KpiTile = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "slate" | "emerald" | "amber" | "rose" | "blue";
}) => {
  const toneClass = {
    slate: "border-slate-200 bg-white text-slate-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  }[tone];

  return (
    <div className={cn("rounded-md border px-3 py-2", toneClass)}>
      <div className="text-[10px] font-medium text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold leading-none">{value}</div>
    </div>
  );
};

const DayStrip = ({ row, returnTo }: { row: PanelRow; returnTo: string }) => (
  <div
    className="grid w-max grid-flow-col auto-cols-[18px] gap-0.5"
    aria-label={`Partes diarios de ${row.proyecto_nombre}`}
  >
    {row.dias.map((day) => {
      const config = dayStatusConfig[day.estado];
      return (
        <Link
          key={day.fecha}
          to={buildParteDiarioDayUrl(row, day, returnTo)}
          className={cn(
            "flex h-7 w-[18px] flex-col items-center justify-center rounded border text-[7px] font-semibold leading-none",
            config.className,
          )}
          title={`${day.fecha} - ${config.label}${day.partes ? ` (${day.partes})` : ""}`}
        >
          <span className="mb-0.5 text-[6px] font-medium opacity-70">{day.dia}</span>
          {config.icon ?? <span>{config.short}</span>}
        </Link>
      );
    })}
  </div>
);

const ProgressCell = ({ row }: { row: PanelRow }) => {
  const expected = row.parte_stats.esperados || 0;
  const completed = row.parte_stats.completos || 0;
  const percent = expected ? Math.round((completed / expected) * 100) : 0;

  return (
    <div className="w-[96px]">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-semibold text-slate-700">{percent}%</span>
        <span className="text-slate-500">
          {completed}/{expected}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            "h-full rounded-full",
            percent === 100 ? "bg-emerald-500" : row.parte_stats.faltantes ? "bg-rose-500" : "bg-amber-500",
          )}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <div className="mt-1 grid grid-cols-3 gap-0.5 text-[7px] font-medium">
        <span className="text-emerald-700">C {row.parte_stats.completos}</span>
        <span className="text-amber-700">B {row.parte_stats.borrador}</span>
        <span className="text-rose-700">F {row.parte_stats.faltantes}</span>
      </div>
    </div>
  );
};

const TarjaCell = ({ row }: { row: PanelRow }) => {
  const tarja = row.tarja;
  return (
    <div className="w-[140px] space-y-1">
      <Badge variant="secondary" className={cn("h-5 px-2 text-[10px]", getTarjaStatusClass(row))}>
        {getTarjaStatusLabel(row)}
      </Badge>
      {tarja ? (
        <div className="text-[9px] leading-tight text-slate-500">
          <div>{formatNumber(tarja.registros)} registros</div>
          <div>{formatNumber(tarja.horas, 2)} hs</div>
        </div>
      ) : (
        <div className="text-[10px] text-slate-400">Pendiente de generar</div>
      )}
    </div>
  );
};

const BonosCell = ({ tarja }: { tarja?: PanelTarja | null }) => {
  if (!tarja) {
    return <span className="text-[10px] text-slate-400">-</span>;
  }
  const total = Number(tarja.adicional || 0) + Number(tarja.premio || 0);
  return (
    <div className="w-[118px] text-[9px] leading-tight tabular-nums text-slate-600">
      <div className="text-[12px] font-semibold leading-4 text-slate-900">
        {formatNumber(total, 2)}
      </div>
      {hasAmount(tarja.adicional) ? (
        <div className="text-[8px] font-medium text-slate-500">
          Adicional: {formatNumber(tarja.adicional, 2)}
        </div>
      ) : null}
      {hasAmount(tarja.premio) ? (
        <div className="text-[8px] font-medium text-slate-500">
          Premio: {formatNumber(tarja.premio, 2)}
        </div>
      ) : null}
    </div>
  );
};

const RowActions = ({
  row,
  returnTo,
  onAction,
}: {
  row: PanelRow;
  returnTo: string;
  onAction: (target: ActionTarget) => void;
}) => {
  const detailUrl = row.tarja
    ? `/tarjas/${row.tarja.id}/detalle?returnTo=${encodeURIComponent(returnTo)}`
    : null;
  const puedeGenerar = Boolean(
    row.puede_generar &&
      row.parte_stats.esperados > 0 &&
      row.parte_stats.faltantes === 0 &&
      row.parte_stats.borrador === 0,
  );

  const primary = (() => {
    if (!row.tarja && puedeGenerar) {
      return (
        <Button
          type="button"
          size="sm"
          className="h-7 whitespace-nowrap px-2 text-[10px]"
          onClick={() => onAction({ row, action: "generar" })}
        >
          <RefreshCw className="size-3" />
          Generar
        </Button>
      );
    }
    return null;
  })();
  const hasAgentPhone = Boolean(row.encargado_telefono?.trim());

  return (
    <div className="flex w-[112px] items-center justify-end gap-1">
      {primary}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Mas acciones">
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          {detailUrl ? (
            <DropdownMenuItem asChild>
              <Link to={detailUrl}>
                <TableProperties className="mr-2 size-3.5" />
                Tarja detalle
              </Link>
            </DropdownMenuItem>
          ) : null}
          {hasAgentPhone ? (
            <DropdownMenuItem asChild>
              <Link to={buildAgentChatUrl(row, returnTo)}>
                <Sparkles className="mr-2 size-3.5" />
                Agente
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled title="El contacto no tiene telefono">
              <Sparkles className="mr-2 size-3.5" />
              Agente
            </DropdownMenuItem>
          )}
          {puedeGenerar ? (
            <DropdownMenuItem onSelect={() => onAction({ row, action: "generar" })}>
              <RotateCcw className="mr-2 size-3.5" />
              {row.tarja ? "Regenerar" : "Generar"}
            </DropdownMenuItem>
          ) : null}
          {row.puede_cerrar ? (
            <DropdownMenuItem onSelect={() => onAction({ row, action: "cerrar" })}>
              <Lock className="mr-2 size-3.5" />
              Cerrar
            </DropdownMenuItem>
          ) : null}
          {row.puede_reabrir ? (
            <DropdownMenuItem onSelect={() => onAction({ row, action: "reabrir" })}>
              <LockOpen className="mr-2 size-3.5" />
              Reabrir
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const TarjaPanelTitle = ({ onBack }: { onBack: () => void }) => (
  <div className="flex min-w-0 items-center gap-3">
    <Button
      type="button"
      variant="ghost"
      className="h-8 px-2 text-sm font-medium text-primary"
      onClick={onBack}
    >
      <ArrowLeft className="mr-1 h-3.5 w-3.5" />
      Volver
    </Button>
    <TableProperties className="size-5 shrink-0" />
    <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">Tarjas - Control</h2>
  </div>
);

export const TarjaPanel = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useNotify();
  const [searchParams, setSearchParams] = useSearchParams();
  const todayIso = useMemo(() => toISODate(new Date()), []);
  const initialDate = searchParams.get("fecha") ?? todayIso;
  const [range, setRange] = useState(() => getQuincenaRange(parseDateOnly(initialDate)));
  const [panel, setPanel] = useState<TarjaPanelResponse | null>(null);
  const [optionsPanel, setOptionsPanel] = useState<TarjaPanelResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const startIso = useMemo(() => toISODate(range.start), [range.start]);
  const endIso = useMemo(() => toISODate(range.end), [range.end]);
  const selectedProject = searchParams.get("idproyecto");
  const selectedEncargado = searchParams.get("contacto_id");
  const selectedProjectEstado = searchParams.get("estado") ?? EXECUTION_PROJECT_ESTADO;
  const returnTo = `${location.pathname}${location.search}`;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchTarjaPanel({
      startIso,
      endIso,
      projectId: selectedProject,
      projectEstado: selectedProjectEstado,
      signal: controller.signal,
    })
      .then(setPanel)
      .catch((fetchError) => {
        if (fetchError?.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "No se pudo cargar el panel");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [endIso, refreshKey, selectedProject, selectedProjectEstado, startIso]);

  useEffect(() => {
    const controller = new AbortController();
    fetchTarjaPanel({
      startIso,
      endIso,
      projectId: null,
      projectEstado: selectedProjectEstado,
      signal: controller.signal,
    })
      .then(setOptionsPanel)
      .catch((fetchError) => {
        if (fetchError?.name !== "AbortError") {
          setOptionsPanel(null);
        }
      });

    return () => controller.abort();
  }, [endIso, refreshKey, selectedProjectEstado, startIso]);

  const handleProjectChange = (value: string) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) {
          next.set("idproyecto", value);
        } else {
          next.delete("idproyecto");
        }
        return next;
      },
      { replace: true },
    );
  };

  const handleProjectEstadoChange = (value: string) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("idproyecto");
        next.delete("contacto_id");
        if (value) {
          next.set("estado", value);
        } else {
          next.set("estado", "");
        }
        return next;
      },
      { replace: true },
    );
  };

  const handleEncargadoChange = (value: string) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("idproyecto");
        if (value) {
          next.set("contacto_id", value);
        } else {
          next.delete("contacto_id");
        }
        return next;
      },
      { replace: true },
    );
  };

  const setQuincenaDate = (date: Date) => {
    const nextRange = getQuincenaRange(date);
    const nextDate = toISODate(nextRange.start);
    setRange(nextRange);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("fecha", nextDate);
        return next;
      },
      { replace: true },
    );
  };

  const handlePreviousQuincena = () => {
    setQuincenaDate(moveQuincena(range.start, -1));
  };

  const handleNextQuincena = () => {
    setQuincenaDate(moveQuincena(range.start, 1));
  };

  const handleSelectedDateChange = (value: string) => {
    setQuincenaDate(parseDateOnly(value));
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/tarjas");
  };

  const rowsForEstado = useMemo(
    () =>
      (panel?.rows ?? []).filter(
        (row) => !selectedProjectEstado || row.proyecto_estado === selectedProjectEstado,
      ),
    [panel?.rows, selectedProjectEstado],
  );
  const visibleRows = useMemo(
    () =>
      rowsForEstado.filter((row) => {
        if (!selectedEncargado) return true;
        const rowEncargadoId = row.contacto_id ? String(row.contacto_id) : "sin-encargado";
        return rowEncargadoId === selectedEncargado;
      }),
    [rowsForEstado, selectedEncargado],
  );
  const projectOptions = useMemo(() => {
    const options = new Map<number, string>();
    const optionRows = optionsPanel?.rows ?? panel?.rows ?? [];
    optionRows.forEach((row) => {
      if (!options.has(row.proyecto_id)) {
        options.set(row.proyecto_id, row.proyecto_nombre);
      }
    });
    return Array.from(options.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [optionsPanel?.rows, panel?.rows]);
  const encargadoOptions = useMemo(() => {
    const options = new Map<string, string>();
    rowsForEstado.forEach((row) => {
      const id = row.contacto_id ? String(row.contacto_id) : "sin-encargado";
      if (!options.has(id)) {
        options.set(id, row.encargado ?? "Sin encargado");
      }
    });
    return Array.from(options.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [rowsForEstado]);
  const totals = useMemo<TarjaPanelResponse["totals"]>(
    () =>
      visibleRows.reduce(
        (acc, row) => {
          acc.obras += 1;
          acc.dias_esperados += row.parte_stats.esperados;
          acc.partes_completos += row.parte_stats.completos;
          acc.partes_borrador += row.parte_stats.borrador;
          acc.partes_faltantes += row.parte_stats.faltantes;
          if (!row.tarja) {
            acc.sin_tarja += 1;
          } else if (row.tarja.estado === "cerrado") {
            acc.tarjas_cerradas += 1;
          } else if (row.tarja.panel_estado === "lista_cerrar") {
            acc.tarjas_listas += 1;
          } else {
            acc.tarjas_borrador += 1;
          }
          return acc;
        },
        {
          obras: 0,
          dias_esperados: 0,
          partes_completos: 0,
          partes_borrador: 0,
          partes_faltantes: 0,
          sin_tarja: 0,
          tarjas_borrador: 0,
          tarjas_listas: 0,
          tarjas_cerradas: 0,
        },
      ),
    [visibleRows],
  );
  const completionPercent = totals.dias_esperados
    ? Math.round((totals.partes_completos / totals.dias_esperados) * 100)
    : 0;

  const handleExport = async () => {
    const rowsWithTarja = visibleRows.filter((row) => row.tarja?.id);
    if (!rowsWithTarja.length) {
      notify("No hay tarjas para exportar con los filtros actuales", { type: "warning" });
      return;
    }

    setExportLoading(true);
    try {
      const groupedRows = await Promise.all(
        rowsWithTarja.map(async (row) => {
          const detalleRows = await fetchTarjaDetalleRows(Number(row.tarja?.id));
          return detalleRows.map((detalleRow) => ({
            ...detalleRow,
            proyecto_nombre: row.proyecto_nombre,
            encargado: row.encargado ?? "Sin encargado",
          }));
        }),
      );
      const exportRows = groupedRows.flat();
      if (!exportRows.length) {
        notify("Las tarjas filtradas no tienen detalles para exportar", { type: "warning" });
        return;
      }

      const title = `Tarjas ${startIso} - ${endIso}`;
      const filename = buildSafeFilename(`tarjas-${startIso}-${endIso}.xls`);
      downloadTarjaPanelExcel(filename, title, exportRows);
    } catch (exportError) {
      notify(exportError instanceof Error ? exportError.message : "No se pudo exportar", {
        type: "warning",
      });
    } finally {
      setExportLoading(false);
    }
  };

  const executeAction = async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    try {
      const { row, action } = actionTarget;
      if (action === "generar") {
        await postGenerateTarja({
          idproyecto: row.proyecto_id,
          contacto_id: row.contacto_id,
          fechainicio: startIso,
          fechafinal: endIso,
        });
        notify("Tarja generada", { type: "info" });
      } else if (action === "cerrar" && row.tarja) {
        await postCloseTarja(row.tarja.id);
        notify("Tarja cerrada", { type: "info" });
      } else if (action === "reabrir" && row.tarja) {
        await patchTarjaEstado(row.tarja.id, "borrador");
        notify("Tarja reabierta", { type: "info" });
      }
      setActionTarget(null);
      setRefreshKey((key) => key + 1);
    } catch (actionError) {
      notify(actionError instanceof Error ? actionError.message : "No se pudo completar la accion", {
        type: "warning",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const actionCopy = (() => {
    if (!actionTarget) return null;
    const projectName = [
      actionTarget.row.proyecto_nombre,
      actionTarget.row.encargado,
    ].filter(Boolean).join(" / ");
    if (actionTarget.action === "cerrar") {
      return {
        title: "Cerrar tarja",
        content: `Se cerrara la tarja de ${projectName}.`,
        confirm: "Cerrar",
      };
    }
    if (actionTarget.action === "reabrir") {
      return {
        title: "Reabrir tarja",
        content: `La tarja de ${projectName} volvera a estado borrador.`,
        confirm: "Reabrir",
      };
    }
    return {
      title: actionTarget.row.tarja ? "Regenerar tarja" : "Generar tarja",
      content: `Se generara la tarja de ${projectName} para la quincena seleccionada.`,
      confirm: "Generar",
    };
  })();

  return (
    <div className="w-full max-w-none min-w-0 overflow-x-hidden pr-2">
      <AppBreadcrumb items={[{ label: "Tarjas", current: true }]} />

      <div className="my-3 flex flex-wrap items-center justify-between gap-3">
        <TarjaPanelTitle onBack={handleBack} />
      </div>

      <div className="mb-3 rounded-lg bg-muted/30 px-2 pb-2 pt-4">
        <div className="flex w-full flex-wrap items-start gap-2">
          <div className="flex flex-wrap items-start gap-2">
            <QuincenaNavigator
              rangeStart={range.start}
              rangeEnd={range.end}
              quincenaNumber={range.number}
              selectedDate={startIso}
              onPrevious={handlePreviousQuincena}
              onNext={handleNextQuincena}
              onSelectedDateChange={handleSelectedDateChange}
              showSelectedDate={false}
            />
            <label className="relative flex h-8 text-[10px] font-medium leading-none text-blue-700">
              <span className="absolute -top-3 left-0">Estado</span>
              <select
                value={selectedProjectEstado}
                onChange={(event) => handleProjectEstadoChange(event.target.value)}
                className="h-8 w-[150px] rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Todos</option>
                {PROYECTO_ESTADO_CHOICES.map((estado) => (
                  <option key={estado.id} value={estado.id}>
                    {estado.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="relative flex h-8 text-[10px] font-medium leading-none text-blue-700">
              <span className="absolute -top-3 left-0">Encargado</span>
              <select
                value={selectedEncargado ?? ""}
                onChange={(event) => handleEncargadoChange(event.target.value)}
                className="h-8 w-[210px] rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Todos</option>
                {encargadoOptions.map((encargado) => (
                  <option key={encargado.id} value={encargado.id}>
                    {encargado.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="relative flex h-8 text-[10px] font-medium leading-none text-blue-700">
              <span className="absolute -top-3 left-0">idproyecto</span>
              <select
                value={selectedProject ?? ""}
                onChange={(event) => handleProjectChange(event.target.value)}
                className="h-8 w-[230px] rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Todas</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto h-8 px-2 text-[11px]"
            onClick={() => void handleExport()}
            disabled={loading || exportLoading}
          >
            {exportLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            Exportar
          </Button>
        </div>
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <KpiTile label="Obra/enc." value={totals.obras} tone="slate" />
        <KpiTile label="Avance partes" value={`${completionPercent}%`} tone="emerald" />
        <KpiTile label="Faltantes" value={totals.partes_faltantes} tone="rose" />
        <KpiTile label="Borradores" value={totals.partes_borrador} tone="amber" />
        <KpiTile label="Listas" value={totals.tarjas_listas} tone="blue" />
        <KpiTile label="Cerradas" value={totals.tarjas_cerradas} tone="emerald" />
      </div>

      {error ? (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm">
              <Loader2 className="size-3.5 animate-spin" />
              Cargando panel
            </span>
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] table-fixed border-collapse text-[11px]">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="w-[310px] px-3 py-2 text-left font-semibold">Obra</th>
                <th className="w-[360px] px-2 py-2 text-left font-semibold">Partes diarios</th>
                <th className="w-[105px] px-2 py-2 text-left font-semibold">Avance</th>
                <th className="w-[145px] px-2 py-2 text-left font-semibold">Tarja</th>
                <th className="w-[125px] px-2 py-2 text-left font-semibold">Bonos</th>
                <th className="w-[120px] px-3 py-2 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length ? (
                visibleRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 align-top hover:bg-blue-50/30">
                    <td className="px-3 py-3">
                      <div className="truncate text-[12px] font-semibold text-slate-900" title={row.proyecto_nombre}>
                        {row.proyecto_nombre}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-[9px] text-slate-500">
                        <span>{row.proyecto_estado ?? "sin estado"}</span>
                        {row.fecha_inicio ? <span>Inicio {row.fecha_inicio}</span> : null}
                      </div>
                      <div className="mt-1 line-clamp-1 text-[10px] leading-tight text-slate-600">
                        {row.encargado ?? "-"}
                        {row.encargado_principal ? (
                          <span className="ml-1 text-[8px] font-medium text-blue-600">principal</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="overflow-hidden px-2 py-3">
                      <DayStrip row={row} returnTo={returnTo} />
                    </td>
                    <td className="px-2 py-3">
                      <ProgressCell row={row} />
                    </td>
                    <td className="px-2 py-3">
                      <TarjaCell row={row} />
                    </td>
                    <td className="px-2 py-3">
                      <BonosCell tarja={row.tarja} />
                    </td>
                    <td className="px-3 py-3">
                      <RowActions
                        row={row}
                        returnTo={returnTo}
                        onAction={setActionTarget}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-[12px] text-slate-400">
                    Sin obras para la quincena seleccionada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Confirm
        isOpen={Boolean(actionTarget)}
        loading={actionLoading}
        title={actionCopy?.title ?? ""}
        content={actionCopy?.content ?? ""}
        confirm={actionCopy?.confirm ?? "Confirmar"}
        onClose={() => {
          if (!actionLoading) setActionTarget(null);
        }}
        onConfirm={() => {
          void executeAction();
        }}
      />
    </div>
  );
};

export default TarjaPanel;
