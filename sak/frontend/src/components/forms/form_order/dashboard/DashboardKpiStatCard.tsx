"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { DashboardKpiCard } from "./DashboardKpiCard";
import { cn } from "@/lib/utils";

export type DashboardKpiStatBreakdown = {
  key: string;
  label: string;
  value: ReactNode;
  badge?: ReactNode;
  icon?: LucideIcon;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
  badgeClassName?: string;
  iconClassName?: string;
};

export type DashboardKpiStatCardProps = {
  title: string;
  icon: LucideIcon;
  variant?: "default" | "warning" | "danger" | "success";
  selected?: boolean;
  onSelect?: () => void;
  count: ReactNode;
  amount: ReactNode;
  countLabel?: string;
  amountLabel?: string;
  variationLabel?: string;
  variationValue?: ReactNode;
  breakdown?: DashboardKpiStatBreakdown[];
  className?: string;
  cardClassName?: string;
  metricClassName?: string;
  amountClassName?: string;
  accentLabelClassName?: string;
  panelClassName?: string;
  chipClassName?: string;
  titleDotClassName?: string;
};

export const DashboardKpiStatCard = ({
  title,
  icon: Icon,
  variant = "default",
  selected = false,
  onSelect,
  count,
  amount,
  countLabel = "Cantidad",
  amountLabel = "Monto",
  variationLabel,
  variationValue,
  breakdown,
  className,
  cardClassName,
  metricClassName,
  amountClassName,
  accentLabelClassName,
  panelClassName,
  chipClassName,
  titleDotClassName,
}: DashboardKpiStatCardProps) => (
  <DashboardKpiCard
    title={
      <div className="flex items-center gap-0.5 sm:gap-1">
        <span className={cn("h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2", titleDotClassName)} />
        <Icon className={cn("h-2.5 w-2.5 sm:h-3 sm:w-3", accentLabelClassName)} />
        <span>{title}</span>
      </div>
    }
    variant={variant}
    compact
    selected={selected}
    className={cn("h-full w-full", cardClassName, className)}
    onSelect={onSelect}
  >
    <div className="flex flex-col gap-0.5">
      <div className="grid grid-cols-[minmax(56px,0.78fr)_minmax(68px,0.92fr)] gap-1 sm:grid-cols-[minmax(72px,0.8fr)_minmax(88px,0.96fr)] sm:gap-1.5">
        <div
          className={cn(
            "flex min-w-0 items-center justify-between gap-1 rounded-md border px-1 py-0.5 sm:px-1.5 sm:py-1",
            panelClassName,
          )}
        >
          <span className="truncate text-[6px] font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[7px]">
            {countLabel}
          </span>
          <span className={cn("shrink-0 text-[8px] font-semibold leading-none sm:text-[10px]", metricClassName)}>
            {count}
          </span>
        </div>
        <div
          className={cn(
            "flex min-w-0 items-center justify-between gap-1 rounded-md border px-1 py-0.5 sm:px-1.5 sm:py-1",
            panelClassName,
          )}
        >
          <span className="truncate text-[6px] font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[7px]">
            {amountLabel}
          </span>
          <span
            className={cn(
              "truncate whitespace-nowrap text-[6px] font-semibold leading-none tabular-nums sm:text-[8px]",
              amountClassName,
            )}
          >
            {amount}
          </span>
        </div>
      </div>

      {breakdown?.length ? (
        <div className="flex flex-wrap items-center gap-0.5 border-t border-black/5 pt-0.5 sm:gap-1 sm:pt-1">
          {breakdown.map((item) => {
            return (
              <div
                key={item.key}
                className={cn(
                  "inline-flex min-w-0 items-center gap-0.5 rounded-full border px-1 py-0.5 sm:gap-1 sm:px-1.5",
                  item.className,
                )}
              >
                <span
                  className={cn(
                    "truncate text-[6px] font-medium leading-none sm:text-[7px]",
                    item.labelClassName,
                  )}
                >
                  {item.label}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[6px] font-semibold leading-none sm:text-[7px]",
                    item.valueClassName,
                  )}
                >
                  {item.value}
                </span>
                {item.badge ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-1 py-0 text-[6px] font-semibold sm:px-1.5 sm:text-[7px]",
                      item.badgeClassName,
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {variationValue !== undefined ? (
        <div className="flex items-center justify-between gap-1 border-t border-black/5 pt-0.5 sm:pt-1">
          <span
            className={cn(
              "truncate text-[6px] font-medium uppercase tracking-[0.06em] sm:text-[7px]",
              accentLabelClassName,
            )}
          >
            {variationLabel}
          </span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0 text-[8px] font-semibold sm:px-2 sm:text-[9px]",
              chipClassName,
            )}
          >
            {variationValue}
          </span>
        </div>
      ) : null}
    </div>
  </DashboardKpiCard>
);
