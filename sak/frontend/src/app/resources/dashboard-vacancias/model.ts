import type { PeriodType } from "@/components/forms/period-range-navigator";
import type { Vacancia } from "../propiedades/model";

/**
 * Tipos del Dashboard de Vacancias
 */

export type EstadoCorte = "Activo" | "Alquilada" | "Retirada";

export type DashboardItem = {
  vacancia: Vacancia;
  dias_totales: number;
  dias_reparacion: number;
  dias_disponible: number;
  estado_corte: EstadoCorte;
  bucket: string;
};

export type DashboardBucket = {
  bucket: string;
  count: number;
  dias_totales: number;
  dias_reparacion: number;
  dias_disponible: number;
};

export type DashboardKPIs = {
  totalVacancias: number;
  promedioDiasTotales: number;
  promedioDiasReparacion: number;
  promedioDiasDisponible: number;
  porcentajeRetiro: number;
};

export type DashboardEstadosFinales = {
  activo: number;
  alquilada: number;
  retirada: number;
};

export type DashboardKpiCards = {
  totales: KpiStats;
  disponible: KpiStats;
  reparacion: KpiStats;
  activas: KpiStats;
};

export type DashboardActivosDetalle = {
  reparacion: number;
  disponible: number;
};

export type DashboardResponse = {
  range: { startDate: string; endDate: string };
  kpis: DashboardKPIs;
  buckets: DashboardBucket[];
  estados_finales: DashboardEstadosFinales;
  activos_detalle: DashboardActivosDetalle;
  kpi_cards: DashboardKpiCards;
  top: DashboardItem[];
};

export type CalculatedVacancia = {
  vacancia: Vacancia;
  diasTotales: number;
  diasReparacion: number;
  diasDisponible: number;
  estadoCorte: EstadoCorte;
  bucket: string;
};

export type KpiStats = {
  count: number;
  propiedades: number;
  dias: number;
  costo: number;
  promedio: number;
};

export type DashboardFilters = {
  startDate: string;
  endDate: string;
  estadoPropiedad: string;
  propietario: string;
  ambientes: string;
};

export type FiltroVacancia =
  | "todos"
  | "activas"
  | "retiro"
  | "reparacion"
  | "disponible";

/**
 * Constantes
 */

export const DEFAULT_PERIOD: PeriodType = "anio";

/**
 * Funciones de utilidad para periodos
 */

export const periodMonths = (period: PeriodType): number => {
  switch (period) {
    case "mes":
      return 1;
    case "trimestre":
      return 3;
    case "cuatrimestre":
      return 4;
    case "semestre":
      return 6;
    case "anio":
      return 12;
    default:
      return 3;
  }
};

export const buildDefaultFilters = (period: PeriodType = DEFAULT_PERIOD): DashboardFilters => {
  const today = new Date();
  const months = periodMonths(period);
  const startReference = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1 - months, 1));
  const start = startReference.toISOString().split("T")[0];
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0))
    .toISOString()
    .split("T")[0];

  return {
    startDate: start,
    endDate: end,
    estadoPropiedad: "",
    propietario: "",
    ambientes: "",
  };
};

/**
 * Funciones de formateo
 */

const integerFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const currencyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export const formatInteger = (value: number): string => integerFormatter.format(Math.round(value));
export const formatDecimal = (value: number): string => decimalFormatter.format(value);
export const formatCurrency = (value: number): string => currencyFormatter.format(Math.max(0, Math.round(value)));

/**
 * Funciones de cálculo de costos
 */

export const getVacanciaCost = (vacancia: Vacancia, dias: number): number => {
  const alquiler = Number(vacancia.propiedad?.valor_alquiler ?? 0);
  const expensas = Number(vacancia.propiedad?.expensas ?? 0);
  const costoDiario = (alquiler + expensas) / 30;
  return dias * costoDiario;
};

/**
 * Funciones de cálculo de estadísticas
 */

export const calculateStats = (items: CalculatedVacancia[]): KpiStats => {
  const uniqueProps = new Set<number>();
  let totalDias = 0;
  let totalCosto = 0;

  items.forEach((item) => {
    uniqueProps.add(item.vacancia.propiedad_id);
    totalDias += item.diasTotales;
    totalCosto += getVacanciaCost(item.vacancia, item.diasTotales);
  });

  const propiedades = uniqueProps.size;
  return {
    count: items.length,
    propiedades,
    dias: Math.round(totalDias),
    costo: totalCosto,
    promedio: propiedades ? totalDias / Math.max(propiedades, 1) : 0,
  };
};

export const calculatePorcentajeRetiro = (items: CalculatedVacancia[]): number => {
  if (items.length === 0) return 0;
  const retiradas = items.filter((item) => item.estadoCorte === "Retirada").length;
  return Math.round((retiradas / items.length) * 1000) / 10;
};

/**
 * Funciones de utilidad para etiquetas
 */

export const getVacanciaEstadoLabel = (estado: EstadoCorte): string => {
  if (estado === "Alquilada") return "Alquilada";
  if (estado === "Retirada") return "Retirada";
  return "Activo";
};

/**
 * Función de exportación CSV
 */

export const exportRanking = (items: CalculatedVacancia[]): void => {
  if (!items.length) return;
  
  const header = ["Propiedad", "Estado", "Dias", "Propietario", "Ambientes", "Costo", "Bucket"];
  const rows = items.map((i) => [
    i.vacancia.propiedad?.nombre ?? `Propiedad ${i.vacancia.propiedad_id}`,
    getVacanciaEstadoLabel(i.estadoCorte),
    i.diasTotales,
    i.vacancia.propiedad?.propietario ?? "Sin propietario",
    i.vacancia.propiedad?.ambientes ?? "",
    getVacanciaCost(i.vacancia, i.diasTotales),
    i.bucket,
  ]);
  
  const csv = [header, ...rows]
    .map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ranking_vacancias.csv";
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Funciones de transformación de datos
 */

export const mapDashboardItemToCalculated = (item: DashboardItem): CalculatedVacancia => ({
  vacancia: item.vacancia,
  diasTotales: item.dias_totales,
  diasReparacion: item.dias_reparacion,
  diasDisponible: item.dias_disponible,
  estadoCorte: item.estado_corte,
  bucket: item.bucket,
});

export const sortBuckets = (buckets: DashboardBucket[]): DashboardBucket[] => {
  return [...buckets].sort((a, b) => {
    if (a.bucket === "Historico") return -1;
    if (b.bucket === "Historico") return 1;
    return a.bucket.localeCompare(b.bucket);
  });
};

export type DashboardDetalleResponse = {
  data: DashboardItem[];
  total: number;
  page: number;
  perPage: number;
};
