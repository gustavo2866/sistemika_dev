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
  title: "Dashboard Propiedades",
  dashboardLoading,
  loadingMessage: "Actualizando panel...",
  onMobileBack,
  showKpis,
  onToggleKpis,
  onRefresh,
});
