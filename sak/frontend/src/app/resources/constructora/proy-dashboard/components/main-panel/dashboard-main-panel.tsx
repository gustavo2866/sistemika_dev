"use client";

import { AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatInteger } from "../../model";
import type {
  DashboardMainPanelViewModel,
  DashboardStatusCardItem,
} from "./use-dashboard-main-panel";
import { DashboardListSection } from "./dashboard-list-section";

const getAlertTextClass = (className: string) =>
  className.split(" ").find((token) => token.startsWith("text-")) ?? "text-foreground";

const KpiCard = ({
  title,
  count,
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
          Estado
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

const getCompactAlertLabel = (label: string) => {
  if (label === "Ordenes rechazadas") return "Rechazadas";
  if (label === "Mensajes nuevos") return "Mensajes";
  if (label === "Tareas vencidas") return "Vencidas";
  return label;
};

const DashboardSelectorsSection = ({
  statusCards,
  detailLoading,
}: Pick<DashboardMainPanelViewModel, "statusCards" | "detailLoading">) => (
  <section className="w-full rounded-xl border border-border/60 bg-card/80 p-1.5 shadow-sm sm:p-2">
    <div
      className={cn(
        "grid grid-cols-2 gap-1.5 sm:gap-2 lg:grid-cols-4 lg:gap-1.5 xl:grid-cols-5",
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
    <div className="flex flex-col gap-2 sm:gap-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <AlertTriangle className="h-3 w-3 text-amber-600" />
        <span>Alarmas</span>
      </div>
      <div className="grid grid-cols-1 gap-1 xl:grid-cols-3 xl:gap-1.5">
        {alerts.map((alert) => {
          const Icon = alert.icon;
          return (
            <button
              key={alert.key}
              type="button"
              onClick={alert.onSelect}
              className={cn(
                "group flex min-w-0 items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-border/60 hover:bg-muted/10 xl:flex-col xl:items-center xl:justify-center xl:py-1 xl:text-center",
                alert.selected && "border-border/80 bg-muted/20",
              )}
            >
              <div className="flex items-center gap-1">
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-colors xl:h-4 xl:w-4",
                    getAlertTextClass(alert.className),
                    !alert.selected && "group-hover:text-primary/80",
                  )}
                />
                <span
                  className={cn(
                    "text-[9px] font-medium leading-none transition-colors xl:hidden",
                    alert.selected ? "text-primary" : "text-muted-foreground",
                    !alert.selected && "group-hover:text-primary/80",
                  )}
                >
                  {getCompactAlertLabel(alert.label)}
                </span>
              </div>
              <div className="flex items-center gap-1 xl:mt-0.5 xl:flex-col xl:gap-0">
                <span
                  className={cn(
                    "text-[10px] font-bold leading-none transition-colors",
                    alert.selected ? "text-primary" : "text-foreground",
                    !alert.selected && "group-hover:text-primary/80",
                  )}
                >
                  {formatInteger(alert.count)}
                </span>
                <span
                  className={cn(
                    "hidden truncate text-[8px] leading-none transition-colors xl:mt-0.5 xl:block xl:w-full xl:text-center",
                    alert.selected ? "font-semibold text-primary" : "font-medium text-foreground",
                    !alert.selected && "group-hover:text-primary/80",
                  )}
                >
                  {getCompactAlertLabel(alert.label)}
                </span>
              </div>
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
    <div className="grid gap-1.5">
      {quickActions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.key}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 justify-start gap-1 px-1.5 text-[9px] xl:h-8 xl:gap-1.5 xl:px-2 xl:text-[10px]"
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
  totalProjects,
  listTitle,
}: DashboardMainPanelViewModel) => (
  <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,8fr)_minmax(0,2fr)] lg:items-start">
    {/* Left column: selectors + list */}
    <div className="flex flex-col gap-3">
      <DashboardSelectorsSection
        statusCards={statusCards}
        detailLoading={detailLoading}
      />
      <DashboardListSection
        title={listTitle}
        totalProjects={totalProjects}
        detailItems={detailItems}
        detailLoading={detailLoading}
        hasMoreDetail={hasMoreDetail}
        onLoadMore={onLoadMore}
      />
    </div>
    {/* Right column: alerts + quick actions */}
    <div className="flex flex-col gap-3">
      <DashboardAlertsSection alerts={alerts} />
      <DashboardQuickActionsSection quickActions={quickActions} />
    </div>
  </div>
);
