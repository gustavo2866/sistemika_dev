import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowUpRight, Calendar, Check, CheckCheck, Clock3, Mail, User, Workflow, X } from "lucide-react";
import type { PeriodType } from "@/components/forms/period-range-navigator";
export type { PeriodType } from "@/components/forms/period-range-navigator";

export type CrmOportunidadLite = Record<string, any>;

export type CrmRankingEntry = {
  oportunidad: CrmOportunidadLite;
  estado: string;
  fecha: string;
  monto: number;
  moneda?: string | null;
  dias_pipeline: number;
  bucket: string;
  kpiKey: "pendientes" | "nuevas" | "cerradas" | "en_proceso";
};

export type PropiedadRankingEntry = {
  propiedad: CrmOportunidadLite;
  perdidas: number;
  fecha_disponible: string | null;
};

export type CrmDashboardResponse = {
  range: { startDate: string; endDate: string };
  filters: Record<string, unknown>;
  kpis: Record<
    "pendientes" | "nuevas" | "cerradas" | "en_proceso",
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
    pendientes: CrmRankingEntry[];
    nuevas: CrmRankingEntry[];
    cerradas: CrmRankingEntry[];
    en_proceso: CrmRankingEntry[];
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

export type KpiKey = "pendientes" | "nuevas" | "cerradas" | "en_proceso";
export type AlertKey = "mensajesSinLeer" | "prospectSinResolver" | "tareasVencidas" | "enProcesoSinMovimiento";
export type SelectOption = { value: string; label: string };
export type KpiTone = {
  variant: "default" | "warning" | "danger" | "success";
  cardClassName: string;
  metricClassName: string;
  amountClassName: string;
  accentLabelClassName: string;
  panelClassName: string;
  chipClassName: string;
};
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
  description: string;
  icon: LucideIcon;
};
export type CrmDashboardKpiBreakdownItem = {
  key: string;
  label: string;
  value: string;
  badge?: string;
  icon?: LucideIcon;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
  badgeClassName?: string;
  iconClassName?: string;
};
export type CrmDashboardKpiCardViewModel = {
  key: KpiKey;
  title: string;
  icon: LucideIcon;
  variant: "default" | "warning" | "danger" | "success";
  cardClassName: string;
  titleDotClassName: string;
  metricClassName: string;
  amountClassName: string;
  accentLabelClassName: string;
  panelClassName: string;
  chipClassName: string;
  count: string;
  amount: string;
  variationLabel: string;
  variationValue?: string;
  breakdown?: CrmDashboardKpiBreakdownItem[];
};
export type CrmDashboardEvolutionItem = {
  bucket: string;
  totales: number;
  nuevas: number;
  ganadas: number;
  perdidas: number;
  pendientes: number;
};

export const DEFAULT_CRM_PERIOD: PeriodType = "trimestre";

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

export const buildBucketOptions = (dashboardData: CrmDashboardResponse | null): string[] => {
  if (!dashboardData?.evolucion) return ["todos"];
  const buckets = Array.from(new Set(dashboardData.evolucion.map((item) => item.bucket).filter(Boolean)));
  return ["todos", ...buckets];
};

export const buildStageOptions = (dashboardData: CrmDashboardResponse | null): string[] => {
  if (!dashboardData?.funnel) return ["todos"];
  return ["todos", ...dashboardData.funnel.map((item) => item.estado)];
};

export const buildEvolutionData = (dashboardData: CrmDashboardResponse | null): CrmDashboardEvolutionItem[] => {
  if (!dashboardData?.evolucion) return [];
  return dashboardData.evolucion.map((bucket) => ({
    bucket: bucket.bucket || "Sin datos",
    totales: Number(bucket.totales) || 0,
    nuevas: Number(bucket.nuevas) || 0,
    ganadas: Number(bucket.ganadas) || 0,
    perdidas: Number(bucket.perdidas) || 0,
    pendientes: Number(bucket.pendientes) || 0,
  }));
};

export const buildPropiedadRanking = (
  dashboardData: CrmDashboardResponse | null,
  sort: "perdidas" | "antiguedad",
): PropiedadRankingEntry[] => {
  const list = dashboardData?.ranking_propiedades ?? [];
  const sorted = [...list].sort((a, b) => {
    if (sort === "perdidas") {
      return b.perdidas - a.perdidas || ((b.fecha_disponible ?? "") < (a.fecha_disponible ?? "") ? -1 : 1);
    }
    const aDate = a.fecha_disponible ? new Date(a.fecha_disponible).getTime() : Number.MAX_SAFE_INTEGER;
    const bDate = b.fecha_disponible ? new Date(b.fecha_disponible).getTime() : Number.MAX_SAFE_INTEGER;
    return aDate - bDate;
  });
  return sorted.slice(0, 10);
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
    key: "prospectSinResolver",
    label: "Prospect",
    count: dashboardData?.alerts?.prospectSinResolver ?? 0,
    icon: User,
    className: "border-slate-200 bg-slate-50 text-slate-700",
    badgeClassName: "bg-slate-200 text-slate-700",
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
    label: "Oportunidades sin movimiento +30 dias",
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
  { key: "pendientes", title: "Pendientes", description: "Oportunidades pendientes arrastradas del periodo anterior", icon: Clock3 },
  { key: "nuevas", title: "Nuevas", description: "Ingresaron al pipeline dentro del periodo", icon: ArrowUpRight },
  { key: "cerradas", title: "Cerradas", description: "Total de oportunidades ganadas y perdidas en el periodo", icon: CheckCheck },
  { key: "en_proceso", title: "En proceso", description: "Oportunidades activas al cierre del periodo", icon: Workflow },
];

export const KPI_TONES: Record<KpiKey, KpiTone> = {
  pendientes: {
    variant: "default",
    cardClassName: "border-slate-200 bg-gradient-to-br from-slate-50 to-white",
    metricClassName: "text-slate-900",
    amountClassName: "text-slate-900",
    accentLabelClassName: "text-slate-600",
    panelClassName: "border-slate-200/80 bg-white/80",
    chipClassName: "border-slate-200 bg-slate-100 text-slate-700",
  },
  nuevas: {
    variant: "success",
    cardClassName: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-lime-50",
    metricClassName: "text-emerald-800",
    amountClassName: "text-emerald-900",
    accentLabelClassName: "text-emerald-700",
    panelClassName: "border-emerald-200/80 bg-white/75",
    chipClassName: "border-emerald-200 bg-emerald-100 text-emerald-700",
  },
  cerradas: {
    variant: "warning",
    cardClassName: "border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50",
    metricClassName: "text-blue-800",
    amountClassName: "text-blue-900",
    accentLabelClassName: "text-blue-700",
    panelClassName: "border-blue-200/80 bg-white/75",
    chipClassName: "border-blue-200 bg-blue-100 text-blue-700",
  },
  en_proceso: {
    variant: "danger",
    cardClassName: "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50",
    metricClassName: "text-amber-800",
    amountClassName: "text-amber-900",
    accentLabelClassName: "text-amber-700",
    panelClassName: "border-amber-200/80 bg-white/75",
    chipClassName: "border-amber-200 bg-amber-100 text-amber-700",
  },
};

export const getAdditionalFiltersActiveCount = (filters: CrmDashboardFilters): number =>
  [
    filters.propietario.trim() !== "",
    filters.tipoPropiedad.trim() !== "",
    filters.emprendimientoId !== "todos",
  ].filter(Boolean).length;

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

type KpiSnapshot = {
  count: number;
  amount: number;
  incremento?: number;
  conversion?: number;
  variacion?: number;
  ganadas?: { count: number; rate: number };
  perdidas?: { count: number; rate: number };
};

export const getClosedRates = (
  kpiData: ReturnType<typeof getKpiData>,
  kpi: KpiSnapshot,
) => {
  const closedBaseCount = (kpiData.pendientes?.count ?? 0) + (kpiData.nuevas?.count ?? 0);
  return {
    closedWonRate: closedBaseCount > 0 ? ((kpi.ganadas?.count ?? 0) / closedBaseCount) * 100 : 0,
    closedLostRate: closedBaseCount > 0 ? ((kpi.perdidas?.count ?? 0) / closedBaseCount) * 100 : 0,
  };
};

export const getKpiVariation = (
  key: KpiKey,
  kpi: KpiSnapshot,
) => (key === "cerradas" ? undefined : key === "en_proceso" ? kpi.variacion : kpi.incremento);

export const buildClosedBreakdown = (
  kpi: KpiSnapshot,
  rates: { closedWonRate: number; closedLostRate: number },
): CrmDashboardKpiBreakdownItem[] => [
  {
    key: "ganada",
    label: "Ganada",
    value: formatInteger(kpi.ganadas?.count ?? 0),
    badge: `${formatPercent(rates.closedWonRate)}%`,
    icon: Check,
    className: "border-emerald-200/80 bg-emerald-50/70",
    labelClassName: "text-emerald-700",
    valueClassName: "text-emerald-700",
    badgeClassName: "border-emerald-200 bg-emerald-100 text-emerald-700",
    iconClassName: "text-emerald-700",
  },
  {
    key: "perdida",
    label: "Perdida",
    value: formatInteger(kpi.perdidas?.count ?? 0),
    badge: `${formatPercent(rates.closedLostRate)}%`,
    icon: X,
    className: "border-rose-200/80 bg-rose-50/70",
    labelClassName: "text-rose-700",
    valueClassName: "text-rose-700",
    badgeClassName: "border-rose-200 bg-rose-100 text-rose-700",
    iconClassName: "text-rose-700",
  },
];

export const buildKpiCardViewModels = (
  kpiData: ReturnType<typeof getKpiData>,
): CrmDashboardKpiCardViewModel[] =>
  KPI_CARDS.map((card) => {
    const kpi = kpiData[card.key] ?? { count: 0, amount: 0 };
    const tone = KPI_TONES[card.key];
    const rates = getClosedRates(kpiData, kpi);
    const variation = getKpiVariation(card.key, kpi);
    return {
      key: card.key,
      title: card.title,
      icon: card.icon,
      variant: tone.variant,
      cardClassName: tone.cardClassName,
      titleDotClassName: tone.amountClassName.replace("text-", "bg-"),
      metricClassName: tone.metricClassName,
      amountClassName: tone.amountClassName,
      accentLabelClassName: tone.accentLabelClassName,
      panelClassName: tone.panelClassName,
      chipClassName: tone.chipClassName,
      count: formatInteger(kpi.count ?? 0),
      amount: formatCurrency(kpi.amount ?? 0),
      variationLabel: card.key === "en_proceso" ? "Variacion" : "Incremento",
      variationValue: variation !== undefined ? `${formatPercent(variation)}%` : undefined,
      breakdown: card.key === "cerradas" ? buildClosedBreakdown(kpi, rates) : undefined,
    };
  });

export const exportDetalleCsv = (items: CrmDashboardDetalleItem[]): void => {
  if (!items.length) return;
  const headers = [
    "ID",
    "Oportunidad",
    "Estado",
    "Responsable",
    "Propiedad",
    "Fecha Creacion",
    "Fecha Cierre",
    "Monto",
    "Moneda",
    "Dias Pipeline",
  ];
  const rows = items.map((item) => {
    const oportunidad = item.oportunidad ?? {};
    return [
      oportunidad.id ?? "",
      oportunidad.descripcion_estado ?? "",
      item.estado_al_corte,
      oportunidad.responsable?.full_name ?? "",
      oportunidad.propiedad?.nombre ?? "",
      item.fecha_creacion,
      item.fecha_cierre ?? "",
      item.monto,
      item.moneda ?? "",
      item.dias_pipeline,
    ];
  });
  const csv = [headers, ...rows]
    .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "crm_dashboard_detalle.csv";
  link.click();
  URL.revokeObjectURL(url);
};
