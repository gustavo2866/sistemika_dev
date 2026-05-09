"use client";

import {
  ArrowLeft,
  BarChart3,
  ChartNoAxesCombined,
  Kanban,
  RefreshCcw,
} from "lucide-react";
import { ResourceTitle } from "@/components/forms/form_order";
import { Button } from "@/components/ui/button";
import type { DashboardHeaderViewModel } from "./use-dashboard-header";

export const DashboardHeader = ({
  title,
  dashboardLoading,
  loadingMessage,
  onMobileBack,
  showKpis,
  onToggleKpis,
  onRefresh,
}: DashboardHeaderViewModel) => (
  <>
    <div className="px-3 sm:hidden">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onMobileBack}
          aria-label="Volver"
          className="flex items-center gap-1 text-primary transition-opacity active:opacity-60"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="text-[11px] font-medium">Volver</span>
        </button>
        <HeaderActions
          showKpis={showKpis}
          onToggleKpis={onToggleKpis}
          onRefresh={onRefresh}
          dashboardLoading={dashboardLoading}
        />
      </div>
      <div className="-mt-0.5 flex items-center justify-center">
        <span className="text-[14px] font-semibold tracking-tight text-foreground">
          {title}
        </span>
      </div>
    </div>

    <div className="relative hidden items-start justify-between gap-1.5 sm:flex sm:gap-3">
      <div className="min-w-0">
        <ResourceTitle
          icon={Kanban}
          text={title}
          className="text-[1.15rem] sm:text-lg md:text-[1.75rem]"
          iconWrapperClassName="h-8 w-8 rounded-xl bg-primary/10 text-primary shadow-none sm:h-10 sm:w-10"
          iconClassName="h-4.5 w-4.5 sm:h-5.5 sm:w-5.5"
        />
      </div>
      <div className="flex shrink-0 items-start gap-2">
        {dashboardLoading ? (
          <div className="pointer-events-none hidden items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/95 px-2 py-0.5 text-[10px] font-medium text-blue-700 shadow-sm md:inline-flex">
            <RefreshCcw className="h-3 w-3 animate-spin" />
            {loadingMessage}
          </div>
        ) : null}
        <HeaderActions
          showKpis={showKpis}
          onToggleKpis={onToggleKpis}
          onRefresh={onRefresh}
          dashboardLoading={dashboardLoading}
        />
      </div>
    </div>
  </>
);

const HeaderActions = ({
  showKpis,
  onToggleKpis,
  onRefresh,
  dashboardLoading,
}: {
  showKpis: boolean;
  onToggleKpis: () => void;
  onRefresh: () => void;
  dashboardLoading: boolean;
}) => {
  const KpiIcon = showKpis ? ChartNoAxesCombined : BarChart3;

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant={showKpis ? "secondary" : "outline"}
        size="sm"
        className="h-6 w-6 gap-1 px-0 text-[10px] sm:h-8 sm:w-auto sm:px-2.5 sm:text-[11px]"
        onClick={onToggleKpis}
        aria-pressed={showKpis}
        title={showKpis ? "Ocultar KPIs" : "Mostrar KPIs"}
        aria-label={showKpis ? "Ocultar KPIs" : "Mostrar KPIs"}
      >
        <KpiIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        <span className="hidden sm:inline">KPI</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-6 w-6 shrink-0 px-0 text-muted-foreground sm:h-8 sm:w-8"
        onClick={onRefresh}
        disabled={dashboardLoading}
        title="Actualizar"
        aria-label="Actualizar"
      >
        <RefreshCcw
          className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${dashboardLoading ? "animate-spin" : ""}`}
        />
      </Button>
    </div>
  );
};
