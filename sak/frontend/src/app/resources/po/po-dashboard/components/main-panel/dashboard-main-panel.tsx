"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency, formatInteger } from "../../model";
import type {
  DashboardMainPanelViewModel,
  DashboardStatusCardItem,
} from "./use-dashboard-main-panel";
import { DashboardListSection } from "./dashboard-list-section";

const getAlertTextClass = (className: string) =>
  className.split(" ").find((token) => token.startsWith("text-")) ??
  "text-foreground";

const StatusCard = ({
  title,
  count,
  amount,
  icon: Icon,
  accentClassName,
  iconClassName,
  selected,
  onSelect,
}: DashboardStatusCardItem) => (
  <div
    className={cn(
      "overflow-hidden rounded-lg border bg-white shadow-sm transition-all hover:shadow-md",
      selected && "ring-2 ring-primary/30 ring-offset-1",
    )}
  >
    <button type="button" onClick={onSelect} className="flex w-full flex-col text-left">
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
          <span className="text-[13px] font-bold leading-none tracking-tight sm:text-2xl lg:text-[18px]">
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
          style={{ width: `${Math.min(100, Math.max(14, count > 0 ? 100 : 14))}%` }}
        />
      </div>
    </button>
  </div>
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
        <StatusCard key={key} {...card} />
      ))}
    </div>
  </section>
);

const DashboardAlertsSection = ({
  alerts,
}: Pick<DashboardMainPanelViewModel, "alerts">) => (
  <section className="w-full rounded-xl border border-border/60 bg-card/80 p-1.5 shadow-sm sm:p-2">
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <AlertTriangle className="h-3 w-3 text-amber-600" />
        <span>Alarmas</span>
      </div>
      <div className="grid grid-cols-1 gap-0.5">
        {alerts.map((alert) => {
          const Icon = alert.icon;
          return (
            <button
              key={alert.key}
              type="button"
              onClick={alert.onSelect}
              className={cn(
                "group flex min-w-0 items-center justify-between rounded-md border border-transparent px-2 py-1 text-left transition-colors hover:border-border/60 hover:bg-muted/10",
                alert.selected && "border-border/80 bg-muted/20",
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-colors",
                    getAlertTextClass(alert.className),
                    !alert.selected && "group-hover:text-primary/80",
                  )}
                />
                <span
                  className={cn(
                    "truncate text-[7px] font-medium leading-none transition-colors sm:text-[8px] lg:text-[9px]",
                    alert.selected ? "text-primary" : "text-muted-foreground",
                    !alert.selected && "group-hover:text-primary/80",
                  )}
                >
                  {alert.label}
                </span>
              </div>
              <span
                className={cn(
                  "shrink-0 text-[9px] font-bold leading-none transition-colors sm:text-[10px] lg:text-[11px]",
                  alert.selected ? "text-primary" : "text-foreground",
                  !alert.selected && "group-hover:text-primary/80",
                )}
              >
                {formatInteger(alert.count)}
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
  detailTitle,
  detailEmptyMessage,
}: DashboardMainPanelViewModel) => {
  const [isListExpanded, setIsListExpanded] = useState(true);
  const prevDetailTitleRef = useRef(detailTitle);

  useEffect(() => {
    if (prevDetailTitleRef.current !== detailTitle) {
      prevDetailTitleRef.current = detailTitle;
      setIsListExpanded(true);
    }
  }, [detailTitle]);

  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,8fr)_minmax(0,2fr)] lg:items-start">
      {/* Left column: selectors + list */}
      <div className="flex flex-col gap-3">
        <DashboardSelectorsSection
          statusCards={statusCards}
          detailLoading={detailLoading}
        />
        <DashboardListSection
          detailItems={detailItems}
          detailLoading={detailLoading}
          hasMoreDetail={hasMoreDetail}
          onLoadMore={onLoadMore}
          expanded={isListExpanded}
          onToggleExpanded={() => setIsListExpanded((current) => !current)}
          title={detailTitle}
          emptyMessage={detailEmptyMessage}
        />
      </div>
      {/* Right column: alerts + quick actions */}
      <div className="flex flex-col gap-3">
        <DashboardAlertsSection alerts={alerts} />
        <DashboardQuickActionsSection quickActions={quickActions} />
      </div>
    </div>
  );
};
