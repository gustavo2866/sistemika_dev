"use client";

import { useLocation, useNavigate } from "react-router-dom";
import type { CrmDashboardDetalleItem } from "./model";
import { useCrmDashboard } from "./use-crm-dashboard";
import { saveDashboardReturnMarker } from "./return-state";
import {
  DashboardHeader,
  DashboardKpiRow,
  DashboardMainPanel,
  DashboardPrimaryFilters,
  useDashboardHeader,
  useDashboardKpiRow,
  useDashboardMainPanel,
  useDashboardPrimaryFilters,
} from "./components";

const SectionShell = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`w-full rounded-xl border border-border/70 bg-gradient-to-br from-slate-50 via-white to-slate-100/70 shadow-sm ${className}`}
  >
    {children}
  </div>
);

export default function DashboardCrmList() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;

  const handleMobileBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/crm/oportunidades");
  };

  const handleHardRefresh = () => {
    if (typeof window === "undefined") return;
    window.location.reload();
  };

  const {
    periodType,
    filters,
    dashboardData,
    dashboardLoading,
    periodTrendData,
    detailKpi,
    detailData,
    detailLoading,
    selectedAlertKey,
    tipoOperacionOptions,
    alertItems,
    selectorData,
    hasMoreDetail,
    showKpis,
    applyRange,
    handleFilterChange,
    setDetailPage,
    setShowKpis,
    selectAlert,
    selectDetailKpi,
  } = useCrmDashboard();

  const headerModel = useDashboardHeader({
    dashboardLoading,
    onMobileBack: handleMobileBack,
    showKpis,
    onToggleKpis: () => setShowKpis((current) => !current),
    onRefresh: handleHardRefresh,
  });

  const primaryFiltersModel = useDashboardPrimaryFilters({
    periodType,
    filters,
    tipoOperacionOptions,
    onApplyRange: applyRange,
    onTipoOperacionChange: (value) => handleFilterChange("tipoOperacionId", value),
  });

  const kpiRowModel = useDashboardKpiRow({
    dashboardData,
    periodTrendData: periodTrendData.map((item) => ({
      label: item.label,
      total: item.total,
    })),
  });

  const handleOpenOpportunity = (item: CrmDashboardDetalleItem) => {
    if (!item.oportunidad?.id) return;
    saveDashboardReturnMarker(returnTo, {
      savedAt: Date.now(),
      oportunidadId: item.oportunidad.id,
    });
    navigate(`/crm/oportunidades/${item.oportunidad.id}`, {
      state: { returnTo },
    });
  };

  const createOpportunityParams = new URLSearchParams();
  createOpportunityParams.set("returnTo", returnTo);
  if (filters.tipoOperacionId && filters.tipoOperacionId !== "todos") {
    createOpportunityParams.set("tipo_operacion_id", filters.tipoOperacionId);
  }
  const createOpportunityPath = `/crm/oportunidades/create?${createOpportunityParams.toString()}`;

  const saveDashboardContext = () => {
    saveDashboardReturnMarker(returnTo, {
      savedAt: Date.now(),
      filters,
      periodType,
    });
  };

  const mainPanelModel = useDashboardMainPanel({
    selectorData,
    detailKpi,
    selectedAlertKey,
    detailData,
    detailLoading,
    hasMoreDetail,
    onLoadMore: () => setDetailPage((current) => current + 1),
    alertItems,
    onSelectAlert: selectAlert,
    onSelectStatusCard: selectDetailKpi,
    onOpenOpportunity: handleOpenOpportunity,
    onNavigate: (path) => {
      const isCrmDestination = path.startsWith("/crm/");

      if (path === createOpportunityPath || isCrmDestination) {
        saveDashboardContext();
      }

      navigate(path, isCrmDestination ? { state: { returnTo } } : undefined);
    },
    createOpportunityPath,
  });

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain px-0 pt-2 pb-3 xl:max-w-6xl 2xl:max-w-7xl sm:px-2 sm:pt-4 sm:pb-4">
      <section className="w-full">
        <SectionShell className="pt-2 pb-1 sm:pt-3 sm:pb-2">
          <div className="relative space-y-0.5 px-0 pt-1 pb-0 sm:space-y-1.5 sm:px-5 sm:pt-2 sm:pb-1">
            <DashboardHeader {...headerModel} />
            <DashboardPrimaryFilters {...primaryFiltersModel} />
          </div>
        </SectionShell>
      </section>

      <section className="flex w-full flex-col">
        <SectionShell className="px-0 py-0 sm:px-4 sm:py-4">
          <div className="flex flex-col px-0 py-0">
            <DashboardMainPanel
              {...mainPanelModel}
              kpiContent={<DashboardKpiRow {...kpiRowModel} />}
              showKpis={showKpis}
            />
          </div>
        </SectionShell>
      </section>
    </div>
  );
}
