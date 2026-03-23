import {
  formatInteger,
  formatPercent,
  type CrmDashboardResponse,
} from "../../model";

export type DashboardMetricRow = {
  label: string;
  count: string;
  value?: string;
  valueClassName?: string;
};

export type DashboardTrendPoint = {
  label: string;
  total: number;
};

export type DashboardFunnelItem = {
  key: string;
  label: string;
  count: number;
  className: string;
};

export type DashboardKpiRowViewModel = {
  metricCard: {
    title: string;
    count: number;
    rows: DashboardMetricRow[];
  };
  trendData: DashboardTrendPoint[];
  funnelData: DashboardFunnelItem[];
};

type UseDashboardKpiRowParams = {
  dashboardData: CrmDashboardResponse | null;
  periodTrendData: DashboardTrendPoint[];
};

export const useDashboardKpiRow = ({
  dashboardData,
  periodTrendData,
}: UseDashboardKpiRowParams): DashboardKpiRowViewModel => {
  const currentPeriodSummary = dashboardData?.period_summary ?? {
    nuevas: 0,
    ganadas: 0,
    perdidas: 0,
    cerradas: 0,
    pendientes_inicio: 0,
    pendientes_fin: 0,
    total_periodo: 0,
  };

  const nuevasSobrePendientesRate =
    currentPeriodSummary.pendientes_inicio > 0
      ? (currentPeriodSummary.nuevas / currentPeriodSummary.pendientes_inicio) * 100
      : 0;
  const ganadasSobreTotalRate =
    currentPeriodSummary.total_periodo > 0
      ? (currentPeriodSummary.ganadas / currentPeriodSummary.total_periodo) * 100
      : 0;
  const perdidasSobreTotalRate =
    currentPeriodSummary.total_periodo > 0
      ? (currentPeriodSummary.perdidas / currentPeriodSummary.total_periodo) * 100
      : 0;

  return {
    metricCard: {
      title: "Oportunidades del periodo",
      count: currentPeriodSummary.pendientes_fin,
      rows: [
        {
          label: "Anterior",
          count: formatInteger(currentPeriodSummary.pendientes_inicio),
        },
        {
          label: "Nuevas",
          count: formatInteger(currentPeriodSummary.nuevas),
          value: `${formatPercent(nuevasSobrePendientesRate)}%`,
          valueClassName: "bg-sky-50 text-sky-700",
        },
        {
          label: "Ganadas",
          count: formatInteger(currentPeriodSummary.ganadas),
          value: `${formatPercent(ganadasSobreTotalRate)}%`,
          valueClassName: "bg-emerald-50 text-emerald-700",
        },
        {
          label: "Perdidas",
          count: formatInteger(currentPeriodSummary.perdidas),
          value: `${formatPercent(perdidasSobreTotalRate)}%`,
          valueClassName: "bg-rose-50 text-rose-700",
        },
      ],
    },
    trendData: periodTrendData,
    funnelData: (dashboardData?.funnel ?? []).map((item) => {
      const colorMap: Record<string, string> = {
        prospect: "bg-slate-500",
        proceso: "bg-amber-500",
        reserva: "bg-violet-500",
        cerrada: "bg-emerald-500",
      };
      return {
        key: item.estado,
        label: item.label,
        count: item.count,
        className: colorMap[item.estado] ?? "bg-slate-500",
      };
    }),
  };
};
