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
      <div className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", titleDotClassName)} />
        <Icon className={cn("h-3.5 w-3.5", accentLabelClassName)} />
        <span>{title}</span>
      </div>
    }
    variant={variant}
    compact
    selected={selected}
    className={cn("h-full w-full", cardClassName, className)}
    onSelect={onSelect}
  >
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[minmax(96px,0.8fr)_minmax(140px,1.35fr)] gap-2">
        <div className={cn("min-w-0 rounded-md border px-2 py-1.5", panelClassName)}>
          <p className={cn("text-[15px] font-semibold leading-none sm:text-[16px]", metricClassName)}>
            {count}
          </p>
          <p className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground sm:text-[10px]">
            {countLabel}
          </p>
        </div>
        <div className={cn("min-w-0 rounded-md border px-2 py-1.5 text-right", panelClassName)}>
          <p
            className={cn(
              "truncate whitespace-nowrap text-[15px] font-semibold leading-none tabular-nums sm:text-[16px]",
              amountClassName,
            )}
          >
            {amount}
          </p>
          <p className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground sm:text-[10px]">
            {amountLabel}
          </p>
        </div>
      </div>

      {breakdown?.length ? (
        <div className="grid grid-cols-2 gap-2 border-t border-black/5 pt-1 text-[10px] text-muted-foreground sm:text-[11px]">
          {breakdown.map((item) => {
            const BreakdownIcon = item.icon;
            return (
              <div
                key={item.key}
                className={cn(
                  "flex min-w-0 items-center justify-between gap-2 rounded-md border px-2 py-1",
                  item.className,
                )}
              >
                <div className="flex min-w-0 items-center gap-1">
                  {BreakdownIcon ? (
                    <BreakdownIcon className={cn("h-3.5 w-3.5 shrink-0", item.iconClassName)} />
                  ) : null}
                  <span className={cn("truncate text-[8px] font-medium leading-none", item.labelClassName)}>
                    {item.label}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className={item.valueClassName}>{item.value}</span>
                  {item.badge ? (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-1.5 py-0.5 font-semibold",
                        item.badgeClassName,
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {variationValue !== undefined ? (
        <div className="flex items-center justify-between border-t border-black/5 pt-1 text-[10px] text-muted-foreground sm:text-[11px]">
          <span className={accentLabelClassName}>{variationLabel}</span>
          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 font-semibold", chipClassName)}>
            {variationValue}
          </span>
        </div>
      ) : null}
    </div>
  </DashboardKpiCard>
);
