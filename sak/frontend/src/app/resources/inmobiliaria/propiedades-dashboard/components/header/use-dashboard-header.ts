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
  title: "Dashboard Propiedades",
  dashboardLoading,
  loadingMessage: "Actualizando panel...",
  onMobileBack,
});
