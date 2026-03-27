import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Mail, OctagonX } from "lucide-react";
import type { PeriodType } from "@/components/forms/period-range-navigator";
export type { PeriodType } from "@/components/forms/period-range-navigator";

export type ProyectoDashboardLite = {
  id?: string | number;
  nombre?: string | null;
  estado?: string | null;
  ingresos?: number | null;
  [key: string]: unknown;
};

export type ProyDashboardKpiConcept = {
  materiales: number;
  mo_propia: number;
  mo_terceros: number;
  importe: number;
  horas?: number;
  metros?: number;
  superficie?: number;
};

export type ProyDashboardKpiPeriod = ProyDashboardKpiConcept & {
  periodo: string;
};

export type ProyDashboardKpiGroup = ProyDashboardKpiConcept & {
  por_periodo: ProyDashboardKpiPeriod[];
};

export type ProyDashboardResponse = {
  periodo: { start: string; end: string };
  filtros: Record<string, unknown>;
  kpis_nuevos: {
    presupuestado: ProyDashboardKpiGroup;
    real: ProyDashboardKpiGroup;
    presupuesto_total: ProyDashboardKpiConcept;
    real_total: ProyDashboardKpiConcept;
  };
  alerts: {
    mensajes: number;
    eventos: number;
    ordenes_rechazadas: number;
  };
};

export type ProyDashboardDetalleItem = {
  proyecto: ProyectoDashboardLite;
  estado_al_corte: string;
  avance: number;
  importe_ejecutado: number;
  costo_ejecutado: number;
  horas_trabajadas: number;
  fecha_creacion: string;
  fecha_ultimo_avance: string | null;
  bucket: string | null;
  context: string;
};

export type ProyDashboardDetalleResponse = {
  data: ProyDashboardDetalleItem[];
  total: number;
  page: number;
  perPage: number;
};

export type ProyDashboardSelectorsResponse = {
  total: number;
  por_estado: Record<string, number>;
};

export type ProyDashboardFilters = {
  startDate: string;
  endDate: string;
  proyectoId: string;
  estado: string;
};

export type SelectOption = { value: string; label: string };
export type AlertKey = "mensajes" | "eventos" | "ordenes_rechazadas";

export type ProyDashboardAlertItem = {
  key: AlertKey;
  label: string;
  count: number;
  icon: LucideIcon;
  className: string;
  badgeClassName: string;
};

export const DEFAULT_PROY_PERIOD: PeriodType = "mes";
export const PROY_DASHBOARD_DETAIL_PAGE_SIZE = 12;
export const PROY_DASHBOARD_DETAIL_VIEWPORT_HEIGHT = 248;

const periodMap: Partial<Record<PeriodType, number>> = {
  mes: 1,
  trimestre: 3,
  cuatrimestre: 4,
  semestre: 6,
  anio: 12,
};

const integerFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const percentFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export const formatInteger = (value: number) => integerFormatter.format(Math.round(value || 0));
export const formatCurrency = (value: number) => currencyFormatter.format(Math.round(value || 0));
export const formatMillions = (value: number) => `${(Number(value || 0) / 1_000_000).toFixed(2)} M`;
export const formatPercent = (value?: number) => percentFormatter.format(value ?? 0);

const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
};

const formatIsoDate = (value: Date) => value.toISOString().split("T")[0];

const shiftIsoDateByMonths = (value: string, months: number) => {
  const source = parseIsoDate(value);
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth() + months;
  const day = source.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return formatIsoDate(new Date(Date.UTC(year, month, Math.min(day, lastDay))));
};

const shiftIsoDateByDays = (value: string, days: number) => {
  const source = parseIsoDate(value);
  source.setUTCDate(source.getUTCDate() + days);
  return formatIsoDate(source);
};

export const buildDefaultFilters = (period: PeriodType = DEFAULT_PROY_PERIOD): ProyDashboardFilters => {
  const today = new Date();
  const months = periodMap[period] ?? 3;
  const startRef = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1 - months, 1));
  const startDate = startRef.toISOString().split("T")[0];
  const endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0))
    .toISOString()
    .split("T")[0];

  return {
    startDate,
    endDate,
    proyectoId: "todos",
    estado: "todos",
  };
};

const resolveSelectorPeriodo = (
  periodType: PeriodType,
  filters: Pick<ProyDashboardFilters, "startDate" | "endDate">,
) => {
  if (periodType === "mes") return "mensual";
  if (periodType === "trimestre") return "trimestral";
  if (periodType === "semestre") return "semestral";
  if (periodType === "anio") return "anual";
  if (periodType === "cuatrimestre") return "trimestral";

  const start = parseIsoDate(filters.startDate);
  const end = parseIsoDate(filters.endDate);
  const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  if (diffDays <= 45) return "mensual";
  if (diffDays <= 120) return "trimestral";
  if (diffDays <= 240) return "semestral";
  return "anual";
};

export const serializeFiltersToParams = (
  filters: ProyDashboardFilters,
  periodType: PeriodType,
): URLSearchParams => {
  const params = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
    selectorPeriodo: resolveSelectorPeriodo(periodType, filters),
  });

  if (filters.proyectoId && filters.proyectoId !== "todos") {
    params.set("proyecto", filters.proyectoId);
  }
  if (filters.estado && filters.estado !== "todos") {
    params.set("estado", filters.estado);
  }

  return params;
};

export const shiftDashboardFilters = (
  filters: ProyDashboardFilters,
  periodType: PeriodType,
  steps: number,
): ProyDashboardFilters => {
  if (periodType === "personalizado") {
    const start = parseIsoDate(filters.startDate);
    const end = parseIsoDate(filters.endDate);
    const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const offset = diffDays * steps;
    return {
      ...filters,
      startDate: shiftIsoDateByDays(filters.startDate, offset),
      endDate: shiftIsoDateByDays(filters.endDate, offset),
    };
  }

  const months = (periodMap[periodType] ?? 1) * steps;
  return {
    ...filters,
    startDate: shiftIsoDateByMonths(filters.startDate, months),
    endDate: shiftIsoDateByMonths(filters.endDate, months),
  };
};

export const formatPeriodLabel = (periodo: string) => {
  const [year, month] = String(periodo).split("-");
  if (!year || !month) return periodo;
  return `${month}/${String(year).slice(-2)}`;
};

export const formatDateValue = (value?: string | null) => {
  if (!value) return "-";
  const date = parseIsoDate(String(value).slice(0, 10));
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
};

export const getIngresoTotal = (kpi?: Partial<ProyDashboardKpiConcept> | null) => Number(kpi?.importe ?? 0);
export const getCostoTotal = (kpi?: Partial<ProyDashboardKpiConcept> | null) =>
  Number(kpi?.mo_propia ?? 0) + Number(kpi?.mo_terceros ?? 0) + Number(kpi?.materiales ?? 0);
export const getResultadoPeriodo = (kpi?: Partial<ProyDashboardKpiConcept> | null) =>
  getIngresoTotal(kpi) - getCostoTotal(kpi);

export const buildAlertItems = (dashboardData: ProyDashboardResponse | null): ProyDashboardAlertItem[] => [
  {
    key: "ordenes_rechazadas",
    label: "Ordenes rechazadas",
    count: dashboardData?.alerts?.ordenes_rechazadas ?? 0,
    icon: OctagonX,
    className: "border-rose-200 bg-rose-50 text-rose-700",
    badgeClassName: "bg-rose-100 text-rose-700",
  },
  {
    key: "mensajes",
    label: "Mensajes nuevos",
    count: dashboardData?.alerts?.mensajes ?? 0,
    icon: Mail,
    className: "border-sky-200 bg-sky-50 text-sky-700",
    badgeClassName: "bg-sky-100 text-sky-700",
  },
  {
    key: "eventos",
    label: "Tareas vencidas",
    count: dashboardData?.alerts?.eventos ?? 0,
    icon: AlertTriangle,
    className: "border-amber-200 bg-amber-50 text-amber-700",
    badgeClassName: "bg-amber-100 text-amber-700",
  },
];
