import type { PoDashboardResponse } from "../../model";

export type DashboardSummaryCard = {
  title: string;
  count: number;
  amount: number;
  variation: number;
};

export type DashboardTopProviderItem = {
  proveedor: string;
  amount: number;
  count: number;
};

export type DashboardTrendPoint = {
  label: string;
  amount: number;
  count: number;
};

export type DashboardTipoSolicitudItem = {
  tipo_solicitud: string;
  amount: number;
  count: number;
};

export type DashboardKpiRowViewModel = {
  summaryCard: DashboardSummaryCard;
  rankingData: DashboardTopProviderItem[];
  trendData: DashboardTrendPoint[];
  distributionData: DashboardTipoSolicitudItem[];
};

type UseDashboardKpiRowParams = {
  dashboardData: PoDashboardResponse | null;
  previousPeriodData: PoDashboardResponse | null;
  periodTrendData: DashboardTrendPoint[];
};

export const useDashboardKpiRow = ({
  dashboardData,
  previousPeriodData,
  periodTrendData,
}: UseDashboardKpiRowParams): DashboardKpiRowViewModel => {
  const currentComprasPeriodo = dashboardData?.compras_periodo ?? {
    count: 0,
    amount: 0,
  };
  const previousComprasPeriodo = previousPeriodData?.compras_periodo ?? {
    count: 0,
    amount: 0,
  };

  const variation =
    previousComprasPeriodo.amount > 0
      ? ((currentComprasPeriodo.amount - previousComprasPeriodo.amount) /
          previousComprasPeriodo.amount) *
        100
      : currentComprasPeriodo.amount > 0
        ? 100
        : 0;

  return {
    summaryCard: {
      title: "Compras del periodo",
      count: currentComprasPeriodo.count,
      amount: currentComprasPeriodo.amount,
      variation,
    },
    rankingData: dashboardData?.ranking_proveedores ?? [],
    trendData: periodTrendData,
    distributionData: dashboardData?.tipo_solicitud ?? [],
  };
};
