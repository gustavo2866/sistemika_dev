"use client";

import {
  LabelList,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMillions } from "../../model";
import type { DashboardKpiRowViewModel } from "./use-dashboard-kpi-row";
import {
  formatAdvanceAmount,
  formatAdvanceRatio,
  getAdvanceScaleMax,
  getAdvanceScalePct,
} from "./use-dashboard-kpi-row";

const PeriodCard = ({ result, metrics }: DashboardKpiRowViewModel["periodCard"]) => (
  <Card className="h-full border-border/70 shadow-sm">
    <CardContent className="space-y-3 p-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Periodo
        </div>
        <div
          className={cn(
            "mt-1 text-2xl font-bold leading-none",
            result >= 0 ? "text-emerald-700" : "text-rose-700",
          )}
        >
          {formatMillions(result)}
        </div>
      </div>
      <div className="space-y-1.5 rounded-lg border border-border/50 bg-slate-50/70 px-2 py-1.5">
        {metrics.map((row) => (
          <div key={row.label} className="grid grid-cols-[1fr_auto] items-center gap-2">
            <span className="text-[10px] font-medium text-muted-foreground">{row.label}</span>
            <span className={cn("text-[11px] font-semibold tabular-nums", row.valueClassName)}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

const AdvanceCard = ({ rows }: { rows: DashboardKpiRowViewModel["advanceRows"] }) => (
  <Card className="h-full border-border/70 shadow-sm">
    <CardContent className="space-y-2.5 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Avance
      </div>
      <div className="space-y-2.5">
        {rows.map((row) => {
          const max = getAdvanceScaleMax(row);
          return (
            <div key={row.key} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-foreground">{row.label}</span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700">
                  {formatAdvanceRatio(row.ratio)}
                </span>
              </div>
              <div className="space-y-1">
                <div className="grid grid-cols-[34px_1fr_auto] items-center gap-2">
                  <span className="text-[9px] font-medium text-muted-foreground">Pres.</span>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-slate-400"
                      style={{ width: `${getAdvanceScalePct(row.presupuestado, max)}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-semibold tabular-nums text-slate-700">
                    {formatAdvanceAmount(row.presupuestado)}
                  </span>
                </div>
                <div className="grid grid-cols-[34px_1fr_auto] items-center gap-2">
                  <span className="text-[9px] font-medium text-muted-foreground">Real</span>
                  <div className="h-2 rounded-full bg-emerald-50">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${getAdvanceScalePct(row.real, max)}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-semibold tabular-nums text-foreground">
                    {formatAdvanceAmount(row.real)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </CardContent>
  </Card>
);

const TrendCard = ({ data }: { data: DashboardKpiRowViewModel["trendData"] }) => (
  <Card className="h-full border-border/70 shadow-sm">
    <CardContent className="space-y-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Evolucion
        </div>
        <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Ingresos
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Egresos
          </span>
        </div>
      </div>
      <div className="h-[124px]">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart data={data} margin={{ top: 18, right: 8, left: 4, bottom: 0 }}>
            <YAxis yAxisId="ingresos" hide domain={["auto", "auto"]} />
            <YAxis yAxisId="egresos" hide orientation="right" domain={["auto", "auto"]} />
            <Line
              type="monotone"
              dataKey="ingresos"
              yAxisId="ingresos"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "#10b981" }}
              activeDot={{ r: 4 }}
            >
              <LabelList
                dataKey="ingresos"
                position="top"
                offset={8}
                formatter={(value) => {
                  const amount = Number(value ?? 0);
                  return amount > 0 ? formatMillions(amount) : "";
                }}
                className="fill-emerald-700"
                fontSize={9}
              />
            </Line>
            <Line
              type="monotone"
              dataKey="egresos"
              yAxisId="egresos"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "#f59e0b" }}
              activeDot={{ r: 4 }}
            >
              <LabelList
                dataKey="egresos"
                position="bottom"
                offset={6}
                formatter={(value) => formatMillions(Number(value ?? 0))}
                className="fill-amber-700"
                fontSize={9}
              />
            </Line>
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
        {data.map((item) => (
          <span key={item.label} className="truncate">
            {item.label}
          </span>
        ))}
      </div>
    </CardContent>
  </Card>
);

export const DashboardKpiRow = ({
  periodCard,
  advanceRows,
  trendData,
}: DashboardKpiRowViewModel) => (
  <div className="grid w-full max-w-[920px] gap-3 px-0 sm:px-1 md:grid-cols-2 xl:grid-cols-3">
    <PeriodCard result={periodCard.result} metrics={periodCard.metrics} />
    <AdvanceCard rows={advanceRows} />
    <TrendCard data={trendData} />
  </div>
);
