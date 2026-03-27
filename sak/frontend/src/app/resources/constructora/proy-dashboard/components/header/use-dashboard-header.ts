export type DashboardHeaderViewModel = {
  title: string;
  dashboardLoading: boolean;
  loadingMessage: string;
  onMobileBack: () => void;
};

type UseDashboardHeaderParams = {
  dashboardLoading: boolean;
  onMobileBack: () => void;
};

export const useDashboardHeader = ({
  dashboardLoading,
  onMobileBack,
}: UseDashboardHeaderParams): DashboardHeaderViewModel => ({
  title: "Dashboard Proyectos",
  dashboardLoading,
  loadingMessage: "Actualizando metricas...",
  onMobileBack,
});
