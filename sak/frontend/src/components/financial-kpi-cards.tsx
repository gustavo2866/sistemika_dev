"use client";

import type { ComponentType } from "react";
import { ArrowUpRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const percentFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const formatMillions = (value: number) => `$ ${(Number(value || 0) / 1_000_000).toFixed(2)} M`;
const formatPercent = (value: number) => `${percentFormatter.format(value || 0)}%`;
const formatPercentPoints = (value: number) => `${percentFormatter.format(value || 0)} p.p.`;

export type FinancialKpiCardItem = {
  key: string;
  title: string;
  value: number;
  valueType?: "millions" | "percent";
  detail?: string;
  detailTitle?: string;
  trend?: number;
  trendSuffix?: string;
  trendType?: "percent" | "points";
  budget?: number;
  budgetValueType?: "millions" | "percent";
  deviation?: number;
  deviationType?: "millions" | "points";
  showDeviationPercent?: boolean;
  sideSummary?: {
    title: string;
    items: Array<{
      label: string;
      value: number;
      valueType?: "millions" | "percent";
      className?: string;
    }>;
  };
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
};

const formatValue = (value: number, valueType: FinancialKpiCardItem["valueType"]) =>
  valueType === "percent" ? formatPercent(value) : formatMillions(value);

const FinancialKpiCard = ({
  title,
  value,
  valueType = "millions",
  detail,
  detailTitle,
  trend,
  trendSuffix,
  trendType = "percent",
  budget,
  budgetValueType,
  deviation,
  deviationType = "millions",
  showDeviationPercent,
  sideSummary,
  icon: Icon,
  iconClassName,
}: FinancialKpiCardItem) => {
  const resolvedBudgetValueType = budgetValueType ?? valueType;
  const shouldShowDeviationPercent =
    showDeviationPercent ?? resolvedBudgetValueType === "millions";
  const deviationPct = budget ? (Number(deviation ?? 0) / budget) * 100 : 0;
  const deviationText =
    deviationType === "points"
      ? formatPercentPoints(Number(deviation ?? 0))
      : formatMillions(Number(deviation ?? 0));
  const trendText =
    trend === undefined
      ? trendSuffix
      : `${trend >= 0 ? "+" : ""}${
          trendType === "points" ? formatPercentPoints(trend) : formatPercent(trend)
        } ${trendSuffix ?? ""}`;

  return (
    <Card className="h-[62px] rounded-md border-border/70 py-0 shadow-sm">
      <CardContent
        className={cn(
          "grid h-full items-center gap-2 px-2.5 py-1.5",
          sideSummary
            ? "grid-cols-[30px_minmax(0,1fr)_70px]"
            : budget !== undefined
              ? "grid-cols-[30px_1fr_58px]"
              : "grid-cols-[30px_1fr]",
        )}
      >
        <div className={cn("flex h-[30px] w-[30px] items-center justify-center rounded-md text-white", iconClassName)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex min-h-0 min-w-0 flex-col justify-center">
          <div className="truncate text-[9px] font-medium leading-none text-muted-foreground">{title}</div>
          <div className="mt-0.5 truncate text-[15px] font-bold leading-none tracking-tight text-foreground">
            {formatValue(value, valueType)}
          </div>
          {trendText ? (
            <div
              className={cn(
                "mt-1 inline-flex max-w-full items-center gap-0.5 truncate text-[8px] font-medium leading-none",
                trend === undefined || trend >= 0 ? "text-emerald-700" : "text-rose-700",
              )}
            >
              {trend !== undefined ? <ArrowUpRight className="h-2.5 w-2.5 shrink-0" /> : null}
              <span className="truncate">{trendText}</span>
            </div>
          ) : null}
          {!trendText && detail ? (
            <div
              className="mt-1 truncate text-[8px] font-medium leading-none text-muted-foreground"
              title={detailTitle}
            >
              {detail}
            </div>
          ) : null}
        </div>
        {budget !== undefined ? (
          <div className="min-w-0 border-l border-slate-200/70 pl-2 text-right">
            <div className="text-[6.5px] font-semibold uppercase leading-none text-muted-foreground">Pres</div>
            <div className="mt-0.5 truncate text-[8px] font-semibold leading-none text-slate-600">
              {formatValue(budget, resolvedBudgetValueType)}
            </div>
            <div className={cn("mt-1 truncate text-[8px] font-semibold leading-none", Number(deviation ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700")}>
              {Number(deviation ?? 0) >= 0 ? "+" : ""}
              {deviationText}
            </div>
            {shouldShowDeviationPercent ? (
              <div className={cn("mt-0.5 truncate text-[6px] font-semibold leading-none", Number(deviation ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700")}>
                {deviationPct >= 0 ? "+" : ""}
                {formatPercent(deviationPct)}
              </div>
            ) : null}
          </div>
        ) : sideSummary ? (
          <div className="min-w-0 border-l border-slate-200/70 pl-2 text-right">
            <div className="text-[6.5px] font-semibold uppercase leading-none text-muted-foreground">
              {sideSummary.title}
            </div>
            <div className="mt-0.5 space-y-0.5">
              {sideSummary.items.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "flex min-w-0 items-baseline justify-between gap-1 text-[6.5px] font-semibold leading-none text-slate-600",
                    item.className,
                  )}
                >
                  <span className="shrink-0 text-muted-foreground">{item.label}</span>
                  <span className="truncate tabular-nums">{formatValue(item.value, item.valueType ?? "millions")}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export const FinancialKpiCards = ({
  items,
  className,
}: {
  items: FinancialKpiCardItem[];
  className?: string;
}) => (
  <div className={cn("grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4", className)}>
    {items.map(({ key, ...item }) => (
      <FinancialKpiCard key={key} {...item} />
    ))}
  </div>
);
