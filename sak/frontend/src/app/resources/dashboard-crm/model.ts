import type { PeriodType } from "@/components/forms/period-range-navigator";

export type CrmOportunidadLite = Record<string, any>;

export type CrmRankingEntry = {
  oportunidad: CrmOportunidadLite;
  estado: string;
  fecha: string;
  monto: number;
  moneda?: string | null;
  dias_pipeline: number;
  bucket: string;
  kpiKey: "totales" | "nuevas" | "ganadas" | "pendientes";
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
    "totales" | "nuevas" | "ganadas" | "pendientes",
    { count: number; amount: number; incremento?: number; conversion?: number }
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
    totales: CrmRankingEntry[];
    nuevas: CrmRankingEntry[];
    ganadas: CrmRankingEntry[];
    pendientes: CrmRankingEntry[];
  };
  ranking_propiedades: PropiedadRankingEntry[];
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

export const DEFAULT_CRM_PERIOD: PeriodType = "trimestre";

const periodMap: Record<PeriodType, number> = {
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
