"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency, formatInteger } from "../../model";
import type {
  DashboardMainPanelViewModel,
  DashboardStatusCardItem,
} from "./use-dashboard-main-panel";
import { DashboardListSection } from "./dashboard-list-section";

const getCompactAlertLabel = (label: string) => {
  if (label === "Inactivo +30d") return "Inactivo";
  return label;
};

const getAlertTextClass = (className: string) =>
  className.split(" ").find((token) => token.startsWith("text-")) ?? "text-foreground";

const KpiCard = ({
  title,
  count,
  amount,
  icon: Icon,
  accentClassName,
  iconClassName,
  selected,
  onSelect,
}: DashboardStatusCardItem) => (
  <button
    type="button"
    onClick={onSelect}
    className={cn(
      "flex w-full flex-col overflow-hidden rounded-lg border bg-white text-left shadow-sm transition-all hover:shadow-md",
      selected && "ring-2 ring-primary/30 ring-offset-1",
    )}
  >
    <div className="flex flex-1 flex-col gap-0 p-1 pb-0.5 sm:p-2.5 sm:pb-2 lg:p-1.5 lg:pb-1">
      <div className="flex items-center gap-0.5 sm:gap-1 lg:gap-0.5">
        <Icon
          className={cn(
            "h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3 lg:h-2.5 lg:w-2.5",
            iconClassName,
          )}
        />
        <span className="truncate text-[8px] font-medium text-muted-foreground sm:text-[11px] lg:text-[9px]">
          {title}
        </span>
      </div>
      <div className="mt-px flex items-end justify-between gap-1 sm:mt-1 sm:gap-2 lg:mt-0.5 lg:gap-1">
        <span className="ml-3 text-[13px] font-bold leading-none tracking-tight sm:ml-0 sm:text-2xl lg:text-[18px]">
          {formatInteger(count)}
        </span>
        <span className="text-[8px] font-semibold text-muted-foreground sm:text-[11px] lg:text-[9px]">
          {formatCurrency(amount)}
        </span>
      </div>
    </div>
    <div className="h-[3px] w-full shrink-0 bg-slate-100">
      <div
        className={cn("h-full transition-all duration-500", accentClassName)}
        style={{ width: `${Math.min(100, Math.max(12, count > 0 ? 100 : 12))}%` }}
      />
    </div>
  </button>
);

const DashboardSelectorsSection = ({
  statusCards,
  detailLoading,
}: Pick<DashboardMainPanelViewModel, "statusCards" | "detailLoading">) => (
  <section className="w-full rounded-xl border border-border/60 bg-card/80 p-1.5 shadow-sm sm:p-2">
    <div
      className={cn(
        "grid grid-cols-2 gap-1.5 sm:gap-2 lg:grid-cols-4 lg:gap-1.5",
        detailLoading && "animate-pulse",
      )}
    >
      {statusCards.map(({ key, ...card }) => (
        <KpiCard key={key} {...card} />
      ))}
    </div>
  </section>
);

const DashboardAlertsSection = ({
  alerts,
}: Pick<DashboardMainPanelViewModel, "alerts">) => (
  <section className="w-full rounded-xl border border-border/60 bg-card/80 p-1.5 shadow-sm sm:p-2">
    <div className="flex items-start gap-2 sm:gap-3">
      <div className="flex shrink-0 items-center gap-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <AlertTriangle className="h-3 w-3 text-amber-600" />
        <span>Alarmas</span>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-1.5 sm:gap-2">
        {alerts.map((alert) => {
          const Icon = alert.icon;
          return (
            <button
              key={alert.key}
              type="button"
              onClick={alert.onSelect}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center rounded-md border border-transparent px-1 py-1 text-center transition-colors",
                alert.selected && "border-border/80 bg-muted/20",
              )}
            >
              <div className="flex items-center gap-0.5 sm:gap-1">
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 sm:h-4.5 sm:w-4.5",
                    getAlertTextClass(alert.className),
                  )}
                />
                <span
                  className={cn(
                    "text-[8px] font-semibold leading-none sm:text-[9px]",
                    alert.selected ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {formatInteger(alert.count)}
                </span>
              </div>
              <span
                className={cn(
                  "mt-1 w-full truncate text-[8px] leading-none sm:text-[9px]",
                  alert.selected ? "font-semibold text-primary" : "font-medium text-foreground",
                )}
              >
                {getCompactAlertLabel(alert.label)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  </section>
);

const DashboardQuickActionsSection = ({
  quickActions,
}: Pick<DashboardMainPanelViewModel, "quickActions">) => (
  <section className="rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm">
    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      <Zap className="h-3 w-3 text-sky-600" />
      <span>Acciones rapidas</span>
    </div>
    <div className="grid grid-cols-2 gap-1.5">
      {quickActions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.key}
            type="button"
            variant="outline"
            size="sm"
            className="h-8 justify-start gap-1.5 px-2 text-[9px]"
            onClick={action.onClick}
          >
            <Icon className="h-3 w-3" />
            {action.label}
          </Button>
        );
      })}
    </div>
  </section>
);

export const DashboardMainPanel = ({
  statusCards,
  detailItems,
  detailLoading,
  hasMoreDetail,
  onLoadMore,
  alerts,
  quickActions,
}: DashboardMainPanelViewModel) => {
  const [isListExpanded, setIsListExpanded] = useState(true);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:items-start">
        <DashboardSelectorsSection
          statusCards={statusCards}
          detailLoading={detailLoading}
        />
        <DashboardAlertsSection alerts={alerts} />
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:items-start">
        <DashboardListSection
          detailItems={detailItems}
          detailLoading={detailLoading}
          hasMoreDetail={hasMoreDetail}
          onLoadMore={onLoadMore}
          expanded={isListExpanded}
          onToggleExpanded={() => setIsListExpanded((current) => !current)}
        />
        <DashboardQuickActionsSection quickActions={quickActions} />
      </div>
    </div>
  );
};
