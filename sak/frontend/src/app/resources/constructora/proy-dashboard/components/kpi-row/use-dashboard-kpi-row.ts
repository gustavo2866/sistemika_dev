import {
  formatMillions,
  formatPeriodLabel,
  formatPercent,
  getIngresoTotal,
  getResultadoPeriodo,
  type ProyDashboardResponse,
} from "../../model";

export type DashboardPeriodMetric = {
  label: string;
  value: string;
  valueClassName?: string;
};

export type DashboardAdvanceMetric = {
  key: string;
  label: string;
  presupuestado: number;
  real: number;
  ratio: number;
};

export type DashboardTrendPoint = {
  label: string;
  ingresos: number;
  egresos: number;
};

export type DashboardKpiRowViewModel = {
  periodCard: {
    result: number;
    metrics: DashboardPeriodMetric[];
  };
  advanceRows: DashboardAdvanceMetric[];
  trendData: DashboardTrendPoint[];
};

type UseDashboardKpiRowParams = {
  dashboardData: ProyDashboardResponse | null;
};

const getConceptRatio = (real: number, presupuestado: number) =>
  presupuestado > 0 ? (real / presupuestado) * 100 : 0;

export const useDashboardKpiRow = ({
  dashboardData,
}: UseDashboardKpiRowParams): DashboardKpiRowViewModel => {
  const realTotal = dashboardData?.kpis_nuevos?.real_total;
  const presupuestoTotal = dashboardData?.kpis_nuevos?.presupuesto_total;
  const realByPeriod = dashboardData?.kpis_nuevos?.real?.por_periodo ?? [];

  return {
    periodCard: {
      result: getResultadoPeriodo(realTotal),
      metrics: [
        {
          label: "Ingresos",
          value: formatMillions(getIngresoTotal(realTotal)),
          valueClassName: "text-emerald-700",
        },
        {
          label: "MO propios",
          value: formatMillions(Number(realTotal?.mo_propia ?? 0)),
        },
        {
          label: "MO terceros",
          value: formatMillions(Number(realTotal?.mo_terceros ?? 0)),
        },
        {
          label: "Materiales",
          value: formatMillions(Number(realTotal?.materiales ?? 0)),
        },
      ],
    },
    advanceRows: [
      {
        key: "ingresos",
        label: "Ingresos",
        presupuestado: Number(presupuestoTotal?.importe ?? 0),
        real: getIngresoTotal(realTotal),
        ratio: getConceptRatio(getIngresoTotal(realTotal), Number(presupuestoTotal?.importe ?? 0)),
      },
      {
        key: "mo_propia",
        label: "MO propios",
        presupuestado: Number(presupuestoTotal?.mo_propia ?? 0),
        real: Number(realTotal?.mo_propia ?? 0),
        ratio: getConceptRatio(Number(realTotal?.mo_propia ?? 0), Number(presupuestoTotal?.mo_propia ?? 0)),
      },
      {
        key: "mo_terceros",
        label: "MO terceros",
        presupuestado: Number(presupuestoTotal?.mo_terceros ?? 0),
        real: Number(realTotal?.mo_terceros ?? 0),
        ratio: getConceptRatio(Number(realTotal?.mo_terceros ?? 0), Number(presupuestoTotal?.mo_terceros ?? 0)),
      },
      {
        key: "materiales",
        label: "Materiales",
        presupuestado: Number(presupuestoTotal?.materiales ?? 0),
        real: Number(realTotal?.materiales ?? 0),
        ratio: getConceptRatio(Number(realTotal?.materiales ?? 0), Number(presupuestoTotal?.materiales ?? 0)),
      },
    ],
    trendData: realByPeriod.map((item) => ({
      label: formatPeriodLabel(item.periodo),
      ingresos: Number(item.importe ?? 0),
      egresos:
        Number(item.mo_propia ?? 0) +
        Number(item.mo_terceros ?? 0) +
        Number(item.materiales ?? 0),
    })),
  };
};

export const formatAdvanceRatio = (ratio: number) => `${formatPercent(ratio)}%`;
export const formatAdvanceAmount = (amount: number) => formatMillions(amount);
export const getAdvanceScaleMax = (row: DashboardAdvanceMetric) =>
  Math.max(row.presupuestado, row.real, 1);
export const getAdvanceScalePct = (amount: number, max: number) =>
  Math.max(8, Math.round((amount / max) * 100));
