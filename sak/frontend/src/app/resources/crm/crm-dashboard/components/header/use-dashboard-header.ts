export type DashboardHeaderViewModel = {
  title: string;
  dashboardLoading: boolean;
  loadingMessage: string;
  onMobileBack: () => void;
  showKpis: boolean;
  onToggleKpis: () => void;
  onRefresh: () => void;
};

type UseDashboardHeaderParams = {
  dashboardLoading: boolean;
  onMobileBack: () => void;
  showKpis: boolean;
  onToggleKpis: () => void;
  onRefresh: () => void;
};

export const useDashboardHeader = ({
  dashboardLoading,
  onMobileBack,
  showKpis,
  onToggleKpis,
  onRefresh,
}: UseDashboardHeaderParams): DashboardHeaderViewModel => ({
  title: "CRM Dashboard",
  dashboardLoading,
  loadingMessage: "Actualizando metricas...",
  onMobileBack,
  showKpis,
  onToggleKpis,
  onRefresh,
});
