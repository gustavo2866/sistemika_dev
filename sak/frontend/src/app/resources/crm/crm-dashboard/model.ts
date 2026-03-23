import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Calendar, CheckCheck, Mail, User, Workflow } from "lucide-react";
import type { PeriodType } from "@/components/forms/period-range-navigator";
export type { PeriodType } from "@/components/forms/period-range-navigator";

export type CrmContactoLite = {
  id?: string | number;
  nombre?: string | null;
  nombre_completo?: string | null;
};

export type CrmMonedaLite = {
  codigo?: string | null;
};

export type CrmResponsableLite = {
  full_name?: string | null;
};

export type CrmPropiedadLite = {
  nombre?: string | null;
};

export type CrmOportunidadLite = {
  id?: string | number;
  titulo?: string | null;
  descripcion_estado?: string | null;
  estado?: string | null;
  fecha_estado?: string | null;
  contacto_id?: string | number | null;
  contacto?: CrmContactoLite | null;
  moneda?: CrmMonedaLite | null;
  responsable?: CrmResponsableLite | null;
  propiedad?: CrmPropiedadLite | null;
  monto?: number | null;
  [key: string]: unknown;
};

export type CrmRankingEntry = {
  oportunidad: CrmOportunidadLite;
  estado: string;
  fecha: string;
  monto: number;
  moneda?: string | null;
  dias_pipeline: number;
  bucket: string;
  kpiKey: "prospect" | "proceso" | "reserva" | "cerrada";
};

export type PropiedadRankingEntry = {
  propiedad: CrmOportunidadLite;
  perdidas: number;
  fecha_disponible: string | null;
};

export type CrmDashboardResponse = {
  range: { startDate: string; endDate: string };
  filters: Record<string, unknown>;
  selectors: Record<
    "prospect" | "proceso" | "reserva" | "cerrada",
    {
      count: number;
      amount: number;
    }
  >;
  kpis: Record<
    "prospect" | "proceso" | "reserva" | "cerrada",
    {
      count: number;
      amount: number;
      incremento?: number;
      conversion?: number;
      variacion?: number;
      ganadas?: { count: number; rate: number };
      perdidas?: { count: number; rate: number };
    }
  >;
  period_summary: {
    nuevas: number;
    ganadas: number;
    perdidas: number;
    cerradas: number;
    pendientes_inicio: number;
    pendientes_fin: number;
    total_periodo: number;
  };
  funnel: Array<{
    estado: string;
    label: string;
    count: number;
    amount: number;
    conversion: number;
    dropVsPrevious: number;
  }>;
  evolucion: Array<{
    bucket: string;
    totales: number;
    nuevas: number;
    ganadas: number;
    perdidas: number;
    pendientes: number;
  }>;
  ranking: {
    prospect: CrmRankingEntry[];
    proceso: CrmRankingEntry[];
    reserva: CrmRankingEntry[];
    cerrada: CrmRankingEntry[];
  };
  ranking_propiedades: PropiedadRankingEntry[];
  alerts: {
    mensajesSinLeer: number;
    prospectSinResolver: number;
    tareasVencidas: number;
    enProcesoSinMovimiento: number;
  };
  stats: { sinMonto: number; sinPropiedad: number };
};

export type CrmDashboardDetalleItem = {
  oportunidad: CrmOportunidadLite;
  fecha_creacion: string;
  fecha_cierre: string | null;
  estado_al_corte: string;
  estado_cierre: string | null;
  dias_pipeline: number;
  monto: number;
  monto_propiedad: number;
  moneda: string | null;
  kpiKey: string;
  bucket: string | null;
};

export type CrmDashboardDetalleResponse = {
  data: CrmDashboardDetalleItem[];
  total: number;
  page: number;
  perPage: number;
};

export type CrmDashboardFilters = {
  startDate: string;
  endDate: string;
  tipoOperacionId: string;
  tipoPropiedad: string;
  emprendimientoId: string;
  propietario: string;
};

export type KpiKey = "prospect" | "proceso" | "reserva" | "cerrada";
export type AlertKey = "mensajesSinLeer" | "prospectSinResolver" | "tareasVencidas" | "enProcesoSinMovimiento";
export type SelectOption = { value: string; label: string };
export type CrmDashboardAlertItem = {
  key: AlertKey;
  label: string;
  count: number;
  icon: LucideIcon;
  className: string;
  badgeClassName: string;
};
export type CrmDashboardKpiCard = {
  key: KpiKey;
  title: string;
  icon: LucideIcon;
};

export const DEFAULT_CRM_PERIOD: PeriodType = "trimestre";
export const CRM_DASHBOARD_DETAIL_PAGE_SIZE = 15;
export const CRM_DASHBOARD_DETAIL_VISIBLE_ROWS = 5;
export const CRM_DASHBOARD_DETAIL_VIEWPORT_HEIGHT = 196;

const periodMap: Partial<Record<PeriodType, number>> = {
  mes: 1,
  trimestre: 3,
  cuatrimestre: 4,
  semestre: 6,
  anio: 12,
};

export const buildDefaultFilters = (period: PeriodType = DEFAULT_CRM_PERIOD): CrmDashboardFilters => {
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
    tipoOperacionId: "todos",
    tipoPropiedad: "",
    emprendimientoId: "todos",
    propietario: "",
  };
};

const integerFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const percentFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export const formatInteger = (value: number): string => integerFormatter.format(Math.round(value));
export const formatCurrency = (value: number): string => currencyFormatter.format(Math.round(value || 0));
export const formatPercent = (value?: number): string => percentFormatter.format(value ?? 0);
export const formatSignedPercent = (value?: number): string => `${(value ?? 0) > 0 ? "+" : ""}${percentFormatter.format(value ?? 0)}%`;

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

export const parseCsvValues = (value: string): string[] => {
  if (!value) return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
};

export const serializeFiltersToParams = (filters: CrmDashboardFilters): URLSearchParams => {
  const params = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
  });
  if (filters.tipoOperacionId && filters.tipoOperacionId !== "todos") params.set("tipoOperacion", filters.tipoOperacionId);
  if (filters.tipoPropiedad.trim()) params.set("tipoPropiedad", filters.tipoPropiedad);
  if (filters.emprendimientoId && filters.emprendimientoId !== "todos") params.set("emprendimiento", filters.emprendimientoId);
  if (filters.propietario) params.set("propietario", filters.propietario);
  return params;
};

export const shiftDashboardFilters = (
  filters: CrmDashboardFilters,
  periodType: PeriodType,
  steps: number,
): CrmDashboardFilters => {
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

export const formatTrendLabel = (startDate: string, periodType: PeriodType): string => {
  const date = parseIsoDate(startDate);
  const yearShort = String(date.getUTCFullYear()).slice(-2);
  const month = date.getUTCMonth();

  if (periodType === "mes") {
    return `${String(month + 1).padStart(2, "0")}/${yearShort}`;
  }
  if (periodType === "trimestre") {
    return `T${Math.floor(month / 3) + 1} ${yearShort}`;
  }
  if (periodType === "cuatrimestre") {
    return `C${Math.floor(month / 4) + 1} ${yearShort}`;
  }
  if (periodType === "semestre") {
    return `S${Math.floor(month / 6) + 1} ${yearShort}`;
  }
  if (periodType === "anio") {
    return String(date.getUTCFullYear());
  }
  return startDate;
};

export const buildAlertItems = (dashboardData: CrmDashboardResponse | null): CrmDashboardAlertItem[] => [
  {
    key: "mensajesSinLeer",
    label: "Sin leer",
    count: dashboardData?.alerts?.mensajesSinLeer ?? 0,
    icon: Mail,
    className: "border-sky-200 bg-sky-50 text-sky-700",
    badgeClassName: "bg-sky-100 text-sky-700",
  },
  {
    key: "tareasVencidas",
    label: "Vencidas",
    count: dashboardData?.alerts?.tareasVencidas ?? 0,
    icon: Calendar,
    className: "border-amber-200 bg-amber-50 text-amber-700",
    badgeClassName: "bg-amber-100 text-amber-700",
  },
  {
    key: "enProcesoSinMovimiento",
    label: "Inactivo +30d",
    count: dashboardData?.alerts?.enProcesoSinMovimiento ?? 0,
    icon: AlertTriangle,
    className: "border-rose-200 bg-rose-50 text-rose-700",
    badgeClassName: "bg-rose-100 text-rose-700",
  },
];

export const findActiveAlert = (
  alertItems: CrmDashboardAlertItem[],
  selectedAlertKey: AlertKey | null,
): CrmDashboardAlertItem | null =>
  selectedAlertKey ? alertItems.find((item) => item.key === selectedAlertKey) ?? null : null;

export const KPI_CARDS: CrmDashboardKpiCard[] = [
  { key: "prospect", title: "Prospect", icon: User },
  { key: "proceso", title: "Proceso", icon: Workflow },
  { key: "reserva", title: "Reserva", icon: Calendar },
  { key: "cerrada", title: "Cerrada", icon: CheckCheck },
];

export const getKpiData = (dashboardData: CrmDashboardResponse | null) =>
  (dashboardData?.kpis ??
    {}) as Record<
    KpiKey,
    {
      count: number;
      amount: number;
      incremento?: number;
      conversion?: number;
      variacion?: number;
      ganadas?: { count: number; rate: number };
      perdidas?: { count: number; rate: number };
    }
  >;

export const getSelectorData = (dashboardData: CrmDashboardResponse | null) =>
  (dashboardData?.selectors ??
    {}) as Record<
    KpiKey,
    {
      count: number;
      amount: number;
    }
  >;
