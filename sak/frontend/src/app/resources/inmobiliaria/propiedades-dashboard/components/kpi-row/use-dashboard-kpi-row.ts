import {
  formatInteger,
  type PropDashboardCurrentData,
  type PropDashboardSelectorResponse,
} from "../../model";

export type DashboardMetricRow = {
  label: string;
  count: string;
  value?: string;
  valueClassName?: string;
  dotClass?: string;
};

export type DashboardTrendPoint = {
  label: string;
  total: number;
  countVacantes: number;
};

export type DashboardKpiRowViewModel = {
  metricCard: {
    eyebrow: string;
    totalDias: number;
    variacion: number | null;
    totalProps: number;
    promedioDias: number | null;
    rows: DashboardMetricRow[];
  };
  trendData: DashboardTrendPoint[];
};

type UseDashboardKpiRowParams = {
  dashboardData: PropDashboardCurrentData | null;
  selectorData: PropDashboardSelectorResponse | null;
  periodTrendData: DashboardTrendPoint[];
};

export const useDashboardKpiRow = ({
  dashboardData,
  selectorData,
  periodTrendData,
}: UseDashboardKpiRowParams): DashboardKpiRowViewModel => {
  const diasKpi = dashboardData?.kpis?.dias_vacancia_periodo ?? {
    total: 0,
    por_estado: { recibida: 0, en_reparacion: 0, disponible: 0 },
    variacion_vs_anterior: null,
  };
  const totalProps = dashboardData?.period_summary?.activas_fin ?? 0;
  const promedioDias = totalProps > 0 ? Math.round(diasKpi.total / totalProps) : null;

  return {
    metricCard: {
      eyebrow: "Vacancia del período",
      totalDias: diasKpi.total,
      variacion: diasKpi.variacion_vs_anterior ?? null,
      totalProps,
      promedioDias,
      rows: [
        {
          label: "Recibida",
          count: formatInteger(diasKpi.por_estado.recibida),
          value:
            selectorData?.recibida?.count != null
              ? formatInteger(selectorData.recibida.count)
              : undefined,
          dotClass: "bg-sky-400",
        },
        {
          label: "En Reparación",
          count: formatInteger(diasKpi.por_estado.en_reparacion),
          value:
            selectorData?.en_reparacion?.count != null
              ? formatInteger(selectorData.en_reparacion.count)
              : undefined,
          dotClass: "bg-amber-400",
        },
        {
          label: "Disponible",
          count: formatInteger(diasKpi.por_estado.disponible),
          value:
            selectorData?.disponible?.count != null
              ? formatInteger(selectorData.disponible.count)
              : undefined,
          dotClass: "bg-emerald-400",
        },
      ],
    },
    trendData: periodTrendData,
  };
};
