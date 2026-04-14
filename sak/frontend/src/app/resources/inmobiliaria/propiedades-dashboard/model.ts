import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  CalendarSync,
  CheckCircle2,
  Home,
  HousePlus,
  Wrench,
  XCircle,
} from "lucide-react";
import type { PeriodType } from "@/components/forms/period-range-navigator";

export type { PeriodType } from "@/components/forms/period-range-navigator";

export type PropDashboardSelectorKey =
  | "recibida"
  | "en_reparacion"
  | "disponible"
  | "realizada"
  | "retirada";

export type PropDashboardAlertKey = "vencimiento_lt_60" | "renovacion_lt_60";

export type PropDashboardKpiKey =
  | "vacancias_periodo"
  | "vacancias_anteriores"
  | "recibidas"
  | "en_reparacion"
  | "disponible"
  | "realizada";

export type SelectOption = {
  value: string;
  label: string;
};

export type PropDashboardFilters = {
  startDate: string;
  endDate: string;
  tipoOperacionId: string;
  emprendimientoId: string;
};

export type PropDashboardKpiValue = {
  count: number;
  dias_vacancia_promedio: number;
  dias_vacancia_total: number;
  variacion_vs_anterior?: number | null;
};

export type PropDashboardSelectorValue = {
  count: number;
  vencimiento_lt_60?: number;
  renovacion_lt_60?: number;
  lt_30?: number;
  gt_30?: number;
};

export type PropDashboardTrendPoint = {
  bucket: string;
  count_vacantes: number;
  dias_total: number;
};

// Shape of the new /bundle endpoint
export type PropDashboardCurrentData = {
  range: { startDate: string; endDate: string };
  filters: {
    tipoOperacionId?: number | null;
    emprendimientoId?: number | null;
  };
  kpis: {
    dias_vacancia_periodo: {
      total: number;
      por_estado: { recibida: number; en_reparacion: number; disponible: number };
      variacion_vs_anterior?: number | null;
    };
  };
  period_summary: {
    activas_inicio: number;
    activas_fin: number;
    netas: number;
    nuevas_vacancias: number;
    vacancias_resueltas: number;
  };
};

// Legacy shape kept for backward-compat with snapshot/selectors usage
export type PropDashboardResponse = {
  range: { startDate: string; endDate: string };
  filters: {
    tipoOperacionId?: number | null;
    emprendimientoId?: number | null;
  };
  kpis: Record<PropDashboardKpiKey, PropDashboardKpiValue>;
  period_summary: {
    activas_inicio: number;
    activas_fin: number;
    netas: number;
    nuevas_vacancias: number;
    vacancias_resueltas: number;
  };
  selectors: Record<PropDashboardSelectorKey, PropDashboardSelectorValue>;
  alerts: Record<PropDashboardAlertKey, number>;
  stats: {
    sin_vacancia_fecha: number;
  };
};

export type PropDashboardBundleResponse = {
  current: PropDashboardCurrentData;
  trend: PropDashboardTrendPoint[];
};

export type PropDashboardSelectorResponse = Record<
  PropDashboardSelectorKey,
  PropDashboardSelectorValue
> & {
  pivotDate?: string;
};

export type PropDashboardDetalleItem = {
  propiedad_id: number;
  nombre: string;
  propietario: string | null;
  tipo_propiedad_id: number | null;
  tipo_actualizacion_id?: number | null;
  tipo_operacion_id?: number | null;
  propiedad_status_id?: number | null;
  estado: string | null;
  estado_fecha?: string | null;
  vacancia_fecha: string | null;
  dias_vacancia: number;
  fecha_inicio_contrato?: string | null;
  vencimiento_contrato: string | null;
  fecha_renovacion: string | null;
  valor_alquiler: number | null;
  dias_para_vencimiento?: number | null;
  dias_para_renovacion?: number | null;
};

export type PropDashboardDetalleResponse = {
  data: PropDashboardDetalleItem[];
  total: number;
  page: number;
  perPage: number;
};

export type PropDashboardAlertItem = {
  key: PropDashboardAlertKey;
  label: string;
  count: number;
  icon: LucideIcon;
  className: string;
  badgeClassName: string;
};

export type PropDashboardSelectorCardMeta = {
  key: PropDashboardSelectorKey;
  title: string;
  icon: LucideIcon;
  accentClassName: string;
  iconClassName: string;
  buckets?: Array<{
    key: string;
    label: string;
    tone: "danger" | "warning" | "muted";
  }>;
};

export const DEFAULT_PROP_PERIOD: PeriodType = "mes";
export const PROP_DASHBOARD_DETAIL_PAGE_SIZE = 15;
export const PROP_DASHBOARD_DETAIL_VISIBLE_ROWS = 6;
export const PROP_DASHBOARD_DETAIL_VIEWPORT_HEIGHT = 236;

const periodMap: Partial<Record<PeriodType, number>> = {
  mes: 1,
  trimestre: 3,
  cuatrimestre: 4,
  semestre: 6,
  anio: 12,
};

export const buildDefaultFilters = (
  period: PeriodType = DEFAULT_PROP_PERIOD,
): PropDashboardFilters => {
  const today = new Date();
  const months = periodMap[period] ?? 1;
  const startRef = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1 - months, 1),
  );
  const startDate = startRef.toISOString().split("T")[0];
  const endDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0),
  )
    .toISOString()
    .split("T")[0];

  return {
    startDate,
    endDate,
    tipoOperacionId: "todos",
    emprendimientoId: "todos",
  };
};

const integerFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 0,
});
const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const decimalFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

export const formatInteger = (value: number): string =>
  integerFormatter.format(Math.round(value || 0));

export const formatCurrency = (value: number): string =>
  currencyFormatter.format(Math.round(value || 0));

export const formatDecimal = (value?: number | null): string =>
  decimalFormatter.format(value ?? 0);

export const formatSignedPercent = (value?: number | null): string => {
  if (value == null) return "n/d";
  return `${value > 0 ? "+" : ""}${decimalFormatter.format(value)}%`;
};

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

export const serializeBaseFiltersToParams = (
  filters: Pick<PropDashboardFilters, "tipoOperacionId" | "emprendimientoId">,
): URLSearchParams => {
  const params = new URLSearchParams();
  if (filters.tipoOperacionId && filters.tipoOperacionId !== "todos") {
    params.set("tipoOperacionId", filters.tipoOperacionId);
  }
  if (filters.emprendimientoId && filters.emprendimientoId !== "todos") {
    params.set("emprendimientoId", filters.emprendimientoId);
  }
  return params;
};

export const serializeFiltersToParams = (
  filters: PropDashboardFilters,
): URLSearchParams => {
  const params = serializeBaseFiltersToParams(filters);
  params.set("startDate", filters.startDate);
  params.set("endDate", filters.endDate);
  return params;
};

export const shiftDashboardFilters = (
  filters: PropDashboardFilters,
  periodType: PeriodType,
  steps: number,
): PropDashboardFilters => {
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

export const buildAlertItems = (
  selectorData: PropDashboardSelectorResponse | null,
): PropDashboardAlertItem[] => [
  {
    key: "vencimiento_lt_60",
    label: "Venc. <60d",
    count: selectorData?.realizada?.vencimiento_lt_60 ?? 0,
    icon: CalendarClock,
    className: "border-rose-200 bg-rose-50 text-rose-700",
    badgeClassName: "bg-rose-100 text-rose-700",
  },
  {
    key: "renovacion_lt_60",
    label: "Renov. <60d",
    count: selectorData?.realizada?.renovacion_lt_60 ?? 0,
    icon: CalendarSync,
    className: "border-amber-200 bg-amber-50 text-amber-700",
    badgeClassName: "bg-amber-100 text-amber-700",
  },
];

export const findActiveAlert = (
  alertItems: PropDashboardAlertItem[],
  selectedAlertKey: PropDashboardAlertKey | null,
): PropDashboardAlertItem | null =>
  selectedAlertKey
    ? alertItems.find((item) => item.key === selectedAlertKey) ?? null
    : null;

export const SELECTOR_CARDS: PropDashboardSelectorCardMeta[] = [
  {
    key: "recibida",
    title: "Recibida",
    icon: HousePlus,
    accentClassName: "bg-sky-500",
    iconClassName: "text-sky-600",
  },
  {
    key: "en_reparacion",
    title: "En reparacion",
    icon: Wrench,
    accentClassName: "bg-amber-500",
    iconClassName: "text-amber-600",
  },
  {
    key: "disponible",
    title: "Disponible",
    icon: CheckCircle2,
    accentClassName: "bg-emerald-500",
    iconClassName: "text-emerald-600",
  },
  {
    key: "realizada",
    title: "Realizada",
    icon: Home,
    accentClassName: "bg-violet-500",
    iconClassName: "text-violet-600",
  },
  {
    key: "retirada",
    title: "Retirada",
    icon: XCircle,
    accentClassName: "bg-rose-500",
    iconClassName: "text-rose-600",
  },
];

export const getSelectorCardMeta = (key: PropDashboardSelectorKey) =>
  SELECTOR_CARDS.find((item) => item.key === key);
