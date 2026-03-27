import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCheck,
  ClipboardList,
  Clock3,
  Receipt,
  Send,
} from "lucide-react";
import type { PeriodType } from "@/components/forms/period-range-navigator";

export type { PeriodType } from "@/components/forms/period-range-navigator";

export type PoProveedorLite = {
  id?: string | number | null;
  nombre?: string | null;
};

export type PoSolicitanteLite = {
  id?: string | number | null;
  nombre?: string | null;
};

export type PoOrderStatusLite = {
  nombre?: string | null;
};

export type PoTipoSolicitudLite = {
  id?: string | number | null;
  nombre?: string | null;
};

export type PoOrderLite = {
  id?: string | number;
  titulo?: string | null;
  proveedor_id?: string | number | null;
  proveedor?: PoProveedorLite | null;
  solicitante_id?: string | number | null;
  solicitante?: PoSolicitanteLite | null;
  tipo_solicitud_id?: string | number | null;
  tipo_solicitud?: PoTipoSolicitudLite | null;
  order_status?: PoOrderStatusLite | null;
  total?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type PoDashboardFilters = {
  startDate: string;
  endDate: string;
  solicitanteId: string;
  proveedorId: string;
  tipoSolicitudId: string;
  departamentoId: string;
  tipoCompra: string;
};

export type PoDashboardKpiKey =
  | "pendientes"
  | "solicitadas"
  | "emitidas"
  | "en_proceso"
  | "facturadas";

export type PoDashboardAlertKey =
  | "rechazadas"
  | "solicitudes_vencidas"
  | "emitidas_vencidas";

export type SelectOption = { value: string; label: string };

export type PoDashboardResponse = {
  range: { startDate: string; endDate: string };
  filters: Record<string, unknown>;
  compras_periodo: {
    count: number;
    amount: number;
  };
  kpis: Record<
    PoDashboardKpiKey,
    {
      count: number;
      amount: number;
    }
  >;
  alerts: Record<PoDashboardAlertKey, number>;
  tipo_solicitud: Array<{
    tipo_solicitud: string;
    count: number;
    amount: number;
  }>;
  evolucion: Array<{
    bucket: string;
    total: number;
    solicitadas: number;
    emitidas: number;
    en_proceso: number;
    facturadas: number;
    rechazadas: number;
  }>;
  ranking_proveedores: Array<{
    proveedor: string;
    count: number;
    amount: number;
  }>;
  stats: {
    periodo: number;
    arrastre: number;
    total_filtrado: number;
  };
};

export type PoDashboardDetalleItem = {
  order: PoOrderLite;
  fecha_creacion: string;
  fecha_estado: string;
  dias_abierta: number;
  monto: number;
  bucket: string;
  estado: string;
};

export type PoDashboardDetalleResponse = {
  data: PoDashboardDetalleItem[];
  total: number;
  page: number;
  perPage: number;
};

export type PoDashboardAlertItem = {
  key: PoDashboardAlertKey;
  label: string;
  icon: LucideIcon;
  className: string;
  badgeClassName: string;
  count: number;
};

export type PoDashboardKpiCard = {
  key: PoDashboardKpiKey;
  title: string;
  icon: LucideIcon;
};

export const DEFAULT_PO_PERIOD: PeriodType = "mes";
export const PO_DASHBOARD_DETAIL_PAGE_SIZE = 15;
export const PO_DASHBOARD_DETAIL_VISIBLE_ROWS = 5;
export const PO_DASHBOARD_DETAIL_VIEWPORT_HEIGHT = 196;

const periodMap: Partial<Record<PeriodType, number>> = {
  mes: 1,
  trimestre: 3,
  cuatrimestre: 4,
  semestre: 6,
  anio: 12,
};

const integerFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 0,
});

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const currencyMillionsFormatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export const formatInteger = (value: number): string =>
  integerFormatter.format(Math.round(value || 0));

export const formatCurrency = (value: number): string =>
  currencyFormatter.format(Math.round(value || 0));

export const formatCurrencyMillions = (value: number): string =>
  `${currencyMillionsFormatter.format((value || 0) / 1_000_000)} M`;

export const formatPercent = (value: number): string =>
  `${value > 0 ? "+" : ""}${percentFormatter.format(value)}%`;

export const formatDateValue = (value?: string | null): string => {
  if (!value) return "-";
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
      )
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-AR");
};

export const buildDefaultFilters = (
  period: PeriodType = DEFAULT_PO_PERIOD,
): PoDashboardFilters => {
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
    solicitanteId: "todos",
    proveedorId: "todos",
    tipoSolicitudId: "todos",
    departamentoId: "todos",
    tipoCompra: "todos",
  };
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

export const shiftDashboardFilters = (
  filters: PoDashboardFilters,
  periodType: PeriodType,
  steps: number,
): PoDashboardFilters => {
  if (periodType === "personalizado") {
    const start = parseIsoDate(filters.startDate);
    const end = parseIsoDate(filters.endDate);
    const diffDays =
      Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
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

export const formatTrendLabel = (
  startDate: string,
  periodType: PeriodType,
): string => {
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
  return formatDateValue(startDate);
};

export const serializeFiltersToParams = (
  filters: PoDashboardFilters,
): URLSearchParams => {
  const params = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
  });
  if (filters.solicitanteId && filters.solicitanteId !== "todos") {
    params.set("solicitante", filters.solicitanteId);
  }
  if (filters.proveedorId && filters.proveedorId !== "todos") {
    params.set("proveedor", filters.proveedorId);
  }
  if (filters.tipoSolicitudId && filters.tipoSolicitudId !== "todos") {
    params.set("tipoSolicitud", filters.tipoSolicitudId);
  }
  if (filters.departamentoId && filters.departamentoId !== "todos") {
    params.set("departamento", filters.departamentoId);
  }
  if (filters.tipoCompra && filters.tipoCompra !== "todos") {
    params.set("tipoCompra", filters.tipoCompra);
  }
  return params;
};

export const buildAlertItems = (
  dashboardData: PoDashboardResponse | null,
): PoDashboardAlertItem[] => [
  {
    key: "rechazadas",
    label: "Rechazadas",
    icon: AlertTriangle,
    className: "border-rose-200 bg-rose-50 text-rose-700",
    badgeClassName: "bg-rose-100 text-rose-700",
    count: dashboardData?.alerts?.rechazadas ?? 0,
  },
  {
    key: "solicitudes_vencidas",
    label: "Solicitadas +10d",
    icon: Clock3,
    className: "border-amber-200 bg-amber-50 text-amber-700",
    badgeClassName: "bg-amber-100 text-amber-700",
    count: dashboardData?.alerts?.solicitudes_vencidas ?? 0,
  },
  {
    key: "emitidas_vencidas",
    label: "Emitidas +10d",
    icon: Receipt,
    className: "border-sky-200 bg-sky-50 text-sky-700",
    badgeClassName: "bg-sky-100 text-sky-700",
    count: dashboardData?.alerts?.emitidas_vencidas ?? 0,
  },
];

export const findActiveAlert = (
  alertItems: PoDashboardAlertItem[],
  selectedAlertKey: PoDashboardAlertKey | null,
): PoDashboardAlertItem | null =>
  selectedAlertKey
    ? alertItems.find((item) => item.key === selectedAlertKey) ?? null
    : null;

export const PO_DASHBOARD_KPI_CARDS: PoDashboardKpiCard[] = [
  { key: "solicitadas", title: "Solicitadas", icon: ClipboardList },
  { key: "emitidas", title: "Emitidas", icon: Send },
  { key: "en_proceso", title: "En proceso", icon: Receipt },
  { key: "facturadas", title: "Facturadas", icon: CheckCheck },
];

export const getKpiData = (dashboardData: PoDashboardResponse | null) =>
  (dashboardData?.kpis ?? {}) as Record<
    PoDashboardKpiKey,
    {
      count: number;
      amount: number;
    }
  >;
