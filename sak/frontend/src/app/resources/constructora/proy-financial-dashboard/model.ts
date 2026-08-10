import type { PeriodType } from "@/components/forms/period-range-navigator";
export type { PeriodType } from "@/components/forms/period-range-navigator";

export type SelectOption = { value: string; label: string };

export type FinancialDashboardFilters = {
  startDate: string;
  endDate: string;
  proyectoId: string;
  estado: string;
};

export type FinancialKpis = {
  ingresos_acumulados: number;
  ingresos_manuales: number;
  egresos_acumulados: number;
  resultado_acumulado: number;
  margen_promedio: number;
  presupuestos: {
    ingresos: number;
    egresos: number;
    resultado: number;
  };
  desvios: {
    ingresos: number;
    egresos: number;
    resultado: number;
  };
  comparativos: {
    ingresos_pct: number;
    egresos_pct: number;
    resultado_pct: number;
    margen_pp: number;
  };
};

export type ProjectResultItem = {
  proyecto_id: number;
  proyecto: string;
  resultado: number;
};

export type NegativeDeviationItem = {
  rubro: string;
  proyecto: string;
  desvio: number;
  desvio_pct: number;
};

export type RubroResultItem = {
  rubro: string;
  egreso_real: number;
  ingreso_presupuestado: number;
  egreso_presupuestado: number;
  ingreso_manual: number;
  resultado: number;
  resultado_presupuestado: number;
  desvio: number;
  desvio_pct: number;
  proyectos_count: number;
};

export type MonthlyEvolutionItem = {
  periodo: string;
  estado: "abierto" | "cerrado";
  cerrado: boolean;
  ingresos: number;
  egresos: number;
  resultado: number;
  ingresos_real: number | null;
  egresos_real: number | null;
  resultado_real: number | null;
  ingresos_presupuestado: number | null;
  egresos_presupuestado: number | null;
  resultado_presupuestado: number | null;
};

export type ProjectSummaryItem = {
  proyecto_id: number;
  proyecto: string;
  acumulado_ingresos: number;
  acumulado_ingresos_manuales: number;
  acumulado_egresos: number;
  acumulado_resultado: number;
  variacion_ingresos_pct: number;
  variacion_egresos_pct: number;
  variacion_resultado_pct: number;
  ventana_abierta_real: number;
  ventana_abierta_presupuestado: number;
  ventana_abierta_total: number;
  ventana_abierta_ingresos_total: number;
  margen_total_esperado: number;
  estado: string;
};

export type ProjectDeviationMetric = {
  anterior: number;
  real: number;
  presupuestado: number;
  dif: number;
  var: number;
};

export type ProjectDeviationItem = {
  proyecto_id: number;
  proyecto: string;
  ingresos: ProjectDeviationMetric;
  egresos: ProjectDeviationMetric;
  resultado: ProjectDeviationMetric;
};

export type RubroDeviationItem = {
  rubro: string;
  ingresos: ProjectDeviationMetric;
  egresos: ProjectDeviationMetric;
  resultado: ProjectDeviationMetric;
};

export type FinancialDashboardResponse = {
  periodo: {
    start: string;
    end: string;
    estado: {
      estado: "abierto" | "cerrado";
      cerrado: boolean;
      fecha_cierre: string;
      fecha_referencia: string;
    };
  };
  filtros: Record<string, unknown>;
  kpis: FinancialKpis;
  resultado_por_proyecto: ProjectResultItem[];
  desvios_por_proyecto: ProjectDeviationItem[];
  desvios_por_rubro: RubroDeviationItem[];
  top_desvios_negativos: NegativeDeviationItem[];
  resultado_por_rubro: RubroResultItem[];
  costo_por_rubro: RubroResultItem[];
  evolucion_mensual: MonthlyEvolutionItem[];
  resumen_por_proyecto: ProjectSummaryItem[];
  selectors: {
    proyectos: Array<{ id: number; nombre: string }>;
    estados: Array<{ value: string; label: string; total: number }>;
  };
};

export const DEFAULT_FINANCIAL_PERIOD: PeriodType = "mes";

const periodMap: Partial<Record<PeriodType, number>> = {
  mes: 1,
  trimestre: 3,
  cuatrimestre: 4,
  semestre: 6,
  anio: 12,
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export const formatCurrency = (value: number) => currencyFormatter.format(Math.round(value || 0));
export const formatMillions = (value: number) => `$ ${(Number(value || 0) / 1_000_000).toFixed(2)} M`;
export const formatPercent = (value: number) => `${percentFormatter.format(value || 0)}%`;
export const formatPercentPoints = (value: number) => `${percentFormatter.format(value || 0)} p.p.`;

const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
};

const formatIsoDate = (value: Date) => value.toISOString().split("T")[0];

const getLastClosedMonthStart = () => {
  const today = new Date();
  const closedMonthOffset = today.getDate() >= 15 ? -1 : -2;
  return new Date(Date.UTC(today.getFullYear(), today.getMonth() + closedMonthOffset, 1));
};

export const buildDefaultFilters = (
  period: PeriodType = DEFAULT_FINANCIAL_PERIOD,
): FinancialDashboardFilters => {
  const months = periodMap[period] ?? 1;
  const lastClosedMonth = getLastClosedMonthStart();
  const start = new Date(Date.UTC(lastClosedMonth.getUTCFullYear(), lastClosedMonth.getUTCMonth() + 1 - months, 1));
  const end = new Date(Date.UTC(lastClosedMonth.getUTCFullYear(), lastClosedMonth.getUTCMonth() + 1, 0));

  return {
    startDate: formatIsoDate(start),
    endDate: formatIsoDate(end),
    proyectoId: "todos",
    estado: "02-ejecucion",
  };
};

export const serializeFiltersToParams = (
  filters: FinancialDashboardFilters,
  periodType: PeriodType,
) => {
  const params = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
    selectorPeriodo: periodType === "mes" ? "mensual" : periodType === "anio" ? "anual" : periodType === "semestre" ? "semestral" : "trimestral",
  });

  if (filters.proyectoId !== "todos") params.set("proyecto", filters.proyectoId);
  if (filters.estado !== "todos") params.set("estado", filters.estado);
  return params;
};

export const formatPeriodLabel = (periodo: string) => {
  const [year, month] = String(periodo).split("-");
  if (!year || !month) return periodo;
  return `${month}/${String(year).slice(-2)}`;
};

export const shiftDashboardFilters = (
  filters: FinancialDashboardFilters,
  periodType: PeriodType,
  steps: number,
): FinancialDashboardFilters => {
  if (periodType === "personalizado") return filters;

  const source = parseIsoDate(filters.startDate);
  const endSource = parseIsoDate(filters.endDate);
  const months = (periodMap[periodType] ?? 1) * steps;
  const start = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1));
  const end = new Date(Date.UTC(endSource.getUTCFullYear(), endSource.getUTCMonth() + months + 1, 0));
  return {
    ...filters,
    startDate: formatIsoDate(start),
    endDate: formatIsoDate(end),
  };
};
