"use client";

import { useLocation, useNavigate } from "react-router-dom";
import { saveDashboardReturnMarker } from "./return-state";
import type { PropDashboardDetalleItem } from "./model";
import { usePropDashboard } from "./use-prop-dashboard";
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

export default function PropiedadesDashboardList() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;

  const handleMobileBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/propiedades");
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
    detailData,
    detailLoading,
    selectedAlertKey,
    activeSelectorKey,
    activeSubBucket,
    tipoOperacionOptions,
    emprendimientoOptions,
    alertItems,
    selectorData,
    hasMoreDetail,
    showKpis,
    applyRange,
    handleFilterChange,
    setDetailPage,
    setShowKpis,
    selectAlert,
    selectDetailSelector,
  } = usePropDashboard();

  const saveDashboardContext = (extra?: {
    propiedadId?: string | number | null;
    refreshAll?: boolean;
  }) => {
    saveDashboardReturnMarker(returnTo, {
      savedAt: Date.now(),
      propiedadId: extra?.propiedadId,
      refreshAll: extra?.refreshAll ?? false,
      filters,
      periodType,
      activeSelectorKey,
      activeSubBucket,
      activeAlertKey: selectedAlertKey,
    });
  };

  const handleOpenProperty = (item: PropDashboardDetalleItem) => {
    if (!item.propiedad_id) return;
    saveDashboardContext({ propiedadId: item.propiedad_id, refreshAll: true });
    const params = new URLSearchParams();
    params.set("returnTo", returnTo);
    navigate(`/propiedades/${item.propiedad_id}?${params.toString()}`);
  };

  const createPropertyParams = new URLSearchParams();
  createPropertyParams.set("returnTo", returnTo);
  if (filters.tipoOperacionId && filters.tipoOperacionId !== "todos") {
    createPropertyParams.set("tipo_operacion_id", filters.tipoOperacionId);
  }
  const createPropertyPath = `/propiedades/create?${createPropertyParams.toString()}`;
  const propertyListParams = new URLSearchParams();
  propertyListParams.set("returnTo", returnTo);
  if (filters.tipoOperacionId && filters.tipoOperacionId !== "todos") {
    propertyListParams.set("tipo_operacion_id", filters.tipoOperacionId);
  }
  const propertyListPath = `/propiedades?${propertyListParams.toString()}`;
  const selectedTipoOperacionLabel =
    filters.tipoOperacionId && filters.tipoOperacionId !== "todos"
      ? tipoOperacionOptions.find((option) => option.value === filters.tipoOperacionId)?.label ?? null
      : null;

  const headerModel = useDashboardHeader({
    dashboardLoading,
    onMobileBack: handleMobileBack,
    showKpis,
    onToggleKpis: () => setShowKpis((current: boolean) => !current),
    onRefresh: handleHardRefresh,
  });

  const primaryFiltersModel = useDashboardPrimaryFilters({
    periodType,
    filters,
    tipoOperacionOptions,
    emprendimientoOptions,
    onApplyRange: applyRange,
    onTipoOperacionChange: (value) => handleFilterChange("tipoOperacionId", value),
    onEmprendimientoChange: (value) => handleFilterChange("emprendimientoId", value),
  });

  const kpiRowModel = useDashboardKpiRow({
    dashboardData,
    selectorData,
    periodTrendData,
  });

  const mainPanelModel = useDashboardMainPanel({
    selectorData,
    activeSelectorKey,
    activeSubBucket,
    selectedAlertKey,
    detailData,
    detailLoading,
    hasMoreDetail,
    onLoadMore: () => setDetailPage((current: number) => current + 1),
    alertItems,
    onSelectAlert: selectAlert,
    onSelectStatusCard: selectDetailSelector,
    onOpenProperty: handleOpenProperty,
    onNavigate: (path) => {
      const isManagedDestination =
        path === createPropertyPath || path.startsWith("/propiedades") || path.startsWith("/emprendimientos");
      if (isManagedDestination) {
        saveDashboardContext({ refreshAll: path === createPropertyPath });
      }
      navigate(path);
    },
    createPropertyPath,
    propertyListPath,
    selectedTipoOperacionLabel,
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
