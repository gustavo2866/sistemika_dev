"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type DashboardRankingRowProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  value: ReactNode;
  valueLabel?: ReactNode;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  valueClassName?: string;
  valueLabelClassName?: string;
};

export const DashboardRankingRow = ({
  title,
  subtitle,
  value,
  valueLabel,
  className,
  titleClassName,
  subtitleClassName,
  valueClassName,
  valueLabelClassName,
}: DashboardRankingRowProps) => (
  <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-3", className)}>
    <div className="flex flex-col">
      <span className={cn("text-base font-semibold", titleClassName)}>{title}</span>
      {subtitle ? <span className={cn("text-xs text-muted-foreground", subtitleClassName)}>{subtitle}</span> : null}
    </div>
    <div className="text-right">
      <p className={cn("text-2xl font-semibold", valueClassName)}>{value}</p>
      {valueLabel ? (
        <p className={cn("text-xs uppercase tracking-wide text-muted-foreground", valueLabelClassName)}>
          {valueLabel}
        </p>
      ) : null}
    </div>
  </div>
);
