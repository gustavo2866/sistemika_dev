"use client";

import { BarChart3, ChartNoAxesCombined, RefreshCcw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useProyDashboard } from "./use-proy-dashboard";
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

export default function ProyDashboardList() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;

  const appendReturnToParam = (path: string) => {
    const [pathWithQuery, hash = ""] = path.split("#");
    const [pathname, queryString = ""] = pathWithQuery.split("?");
    const params = new URLSearchParams(queryString);
    params.set("returnTo", returnTo);
    const nextQuery = params.toString();
    return `${pathname}${nextQuery ? `?${nextQuery}` : ""}${hash ? `#${hash}` : ""}`;
  };

  const handleMobileBack = () => navigate("/proyectos");

  const {
    periodType,
    filters,
    dashboardData,
    selectorData,
    dashboardLoading,
    detailData,
    detailLoading,
    showKpis,
    activeSelectorKey,
    selectedAlertKey,
    proyectoOptions,
    estadoOptions,
    alertItems,
    hasMoreDetail,
    applyRange,
    handleFilterChange,
    setDetailPage,
    setShowKpis,
    refreshDashboard,
    selectAlert,
    selectEstado,
  } = useProyDashboard();

  const saveDashboardContext = () => {
    saveDashboardReturnMarker(returnTo, {
      savedAt: Date.now(),
      filters,
      periodType,
      showKpis,
      activeSelectorKey,
      selectedAlertKey,
    });
  };

  const createProjectPath = appendReturnToParam("/proyectos/create");
  const projectListPath = appendReturnToParam("/proyectos");

  const handleOpenProject = (item: { proyecto?: { id?: string | number | null } | null }) => {
    if (!item.proyecto?.id) return;
    saveDashboardContext();
    navigate(appendReturnToParam(`/proyectos/${item.proyecto.id}`));
  };

  const handleNavigate = (path: string) => {
    const shouldSaveContext = path.startsWith("/proyectos");
    if (shouldSaveContext) {
      saveDashboardContext();
    }
    const hasReturnTo = path.includes("returnTo=");
    navigate(shouldSaveContext && !hasReturnTo ? appendReturnToParam(path) : path);
  };

  const headerModel = useDashboardHeader({
    dashboardLoading,
    onMobileBack: handleMobileBack,
  });

  const primaryFiltersModel = useDashboardPrimaryFilters({
    periodType,
    filters,
    proyectoOptions,
    estadoOptions,
    onApplyRange: applyRange,
    onProyectoChange: (value) => handleFilterChange("proyectoId", value),
    onEstadoChange: (value) => handleFilterChange("estado", value),
  });

  const kpiRowModel = useDashboardKpiRow({
    dashboardData,
  });

  const mainPanelModel = useDashboardMainPanel({
    selectorData,
    activeSelectorKey,
    selectedAlertKey,
    detailData,
    detailLoading,
    hasMoreDetail,
    onLoadMore: () => setDetailPage((current) => current + 1),
    alertItems,
    onSelectEstado: selectEstado,
    onSelectAlert: selectAlert,
    onOpenProject: handleOpenProject,
    onNavigate: handleNavigate,
    createProjectPath,
    projectListPath,
  });

  const kpiToggleLabel = showKpis ? "Ocultar KPIs" : "Mostrar KPIs";

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

      <section className="w-full">
        <SectionShell className="px-3 py-2 sm:px-5 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px]">
              <ChartNoAxesCombined className="h-3.5 w-3.5 text-primary" />
              <span>KPIs</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 text-[10px] text-muted-foreground sm:text-[11px]"
                onClick={() => setShowKpis((current) => !current)}
                aria-label={kpiToggleLabel}
                title={kpiToggleLabel}
              >
                {showKpis ? (
                  <ChartNoAxesCombined className="h-3.5 w-3.5" />
                ) : (
                  <BarChart3 className="h-3.5 w-3.5" />
                )}
                <span>{showKpis ? "Ocultar" : "Mostrar"}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-7 shrink-0 px-0 text-muted-foreground sm:h-7 sm:w-7"
                onClick={refreshDashboard}
                title="Actualizar"
                aria-label="Actualizar"
              >
                <RefreshCcw className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {showKpis ? (
            <div className="mt-3">
              <DashboardKpiRow {...kpiRowModel} />
            </div>
          ) : null}
        </SectionShell>
      </section>

      <section className="flex w-full flex-col">
        <SectionShell className="px-0 py-0 sm:px-4 sm:py-4">
          <div className="flex flex-col px-0 py-0">
            <DashboardMainPanel {...mainPanelModel} />
          </div>
        </SectionShell>
      </section>
    </div>
  );
}
