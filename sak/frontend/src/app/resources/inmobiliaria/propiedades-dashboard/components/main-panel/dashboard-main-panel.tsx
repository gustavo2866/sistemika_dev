"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatInteger } from "../../model";
import type {
  DashboardMainPanelViewModel,
  DashboardStatusBucketItem,
  DashboardStatusCardItem,
} from "./use-dashboard-main-panel";
import { DashboardListSection } from "./dashboard-list-section";

const getBucketToneClasses = (tone: DashboardStatusBucketItem["tone"]) => {
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const StatusCard = ({
  title,
  count,
  icon: Icon,
  accentClassName,
  iconClassName,
  selected,
  onSelect,
  buckets,
}: DashboardStatusCardItem) => (
  <div
    className={cn(
      "overflow-hidden rounded-lg border bg-white shadow-sm transition-all hover:shadow-md",
      selected && "ring-2 ring-primary/30 ring-offset-1",
    )}
  >
    <button type="button" onClick={onSelect} className="flex w-full flex-col text-left">
      <div className="flex flex-1 flex-col gap-0 p-2 pb-1.5">
        <div className="flex items-center gap-1">
          <Icon className={cn("h-3 w-3 shrink-0", iconClassName)} />
          <span className="truncate text-[10px] font-medium text-muted-foreground">{title}</span>
        </div>
        <div className="mt-1 flex items-end justify-between gap-2">
          <span className="text-2xl font-bold leading-none tracking-tight">
            {formatInteger(count)}
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
    {buckets.length > 0 ? (
      <div className="grid gap-1 border-t border-border/60 bg-slate-50/70 p-1.5">
        {buckets.map((bucket) => (
          <button
            key={bucket.key}
            type="button"
            onClick={bucket.onSelect}
            className={cn(
              "flex items-center justify-between rounded-md border px-2 py-1 text-[9px] font-medium transition-colors",
              getBucketToneClasses(bucket.tone),
              bucket.selected && "ring-1 ring-primary/40",
            )}
          >
            <span className="truncate">{bucket.label}</span>
            <span className="font-semibold">{formatInteger(bucket.count)}</span>
          </button>
        ))}
      </div>
    ) : null}
  </div>
);

const DashboardSelectorsSection = ({
  statusCards,
  detailLoading,
}: Pick<DashboardMainPanelViewModel, "statusCards" | "detailLoading">) => (
  <section className="w-full rounded-xl border border-border/60 bg-card/80 p-1.5 shadow-sm sm:p-2">
    <div
      className={cn(
        "grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 xl:grid-cols-5",
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
  <section className="w-full rounded-xl border border-border/60 bg-card/80 p-2 shadow-sm">
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <AlertTriangle className="h-3 w-3 text-amber-600" />
        <span>Alarmas</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {alerts.map((alert) => {
          const Icon = alert.icon;
          return (
            <button
              key={alert.key}
              type="button"
              onClick={alert.onSelect}
              className={cn(
                "group flex min-w-0 flex-col items-center justify-center rounded-md border border-transparent px-2 py-2 text-center transition-colors hover:border-border/60 hover:bg-muted/10",
                alert.selected && "border-border/80 bg-muted/20",
              )}
            >
              <div className="flex items-center gap-1">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="text-[10px] font-semibold leading-none">
                  {formatInteger(alert.count)}
                </span>
              </div>
              <span className="mt-1 w-full truncate text-[9px] font-medium leading-none">
                {alert.label}
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
            className="h-8 justify-start gap-1.5 px-2 text-[10px]"
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
  showContratoColumn,
  valueColumnLabel,
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
          title={detailTitle}
          emptyMessage={detailEmptyMessage}
          showContratoColumn={showContratoColumn}
          valueColumnLabel={valueColumnLabel}
        />
        <DashboardQuickActionsSection quickActions={quickActions} />
      </div>
    </div>
  );
};
