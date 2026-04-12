"use client";

import {
  Bar,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatInteger, formatSignedPercent } from "../../model";
import type {
  DashboardKpiRowViewModel,
  DashboardMetricRow,
  DashboardTrendPoint,
} from "./use-dashboard-kpi-row";

const CompactMetricCard = ({
  eyebrow,
  totalDias,
  variacion,
  totalProps,
  promedioDias,
  rows,
}: {
  eyebrow: string;
  totalDias: number;
  variacion: number | null;
  totalProps: number;
  promedioDias: number | null;
  rows: DashboardMetricRow[];
}) => (
  <Card className="h-full border-border/70 shadow-sm">
    <CardContent className="space-y-2 p-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </div>
        <div className="mt-1 flex flex-wrap items-end gap-x-2 gap-y-1">
          <span className="text-2xl font-bold leading-none">{formatInteger(totalDias)}</span>
          <span className="mb-0.5 text-xs text-muted-foreground">días</span>
          {variacion != null && (
            <span
              className={cn(
                "mb-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                variacion >= 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700",
              )}
            >
              {formatSignedPercent(variacion)}
            </span>
          )}
        </div>
        <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{formatInteger(totalProps)}</span>{" "}
            propiedades
          </span>
          {promedioDias != null && (
            <span>
              <span className="font-semibold text-foreground">{formatInteger(promedioDias)}</span>{" "}
              días prom.
            </span>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-border/50 bg-slate-50/70">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-border/50 px-2 py-1 text-[8px] uppercase tracking-wide text-muted-foreground">
          <span>Estado</span>
          <span className="text-right">Días</span>
          <span className="text-right">Props</span>
        </div>
        <div className="divide-y divide-border/40">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2 py-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                {row.dotClass && (
                  <span className={cn("h-1.5 w-1.5 rounded-full", row.dotClass)} />
                )}
                {row.label}
              </div>
              <span className="text-right text-[11px] font-semibold tabular-nums text-foreground">
                {row.count}
              </span>
              <span className="w-10 text-right text-[11px] font-semibold tabular-nums text-foreground">
                {row.value ?? "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </CardContent>
  </Card>
);

const CompactTrendCard = ({ data }: { data: DashboardTrendPoint[] }) => (
  <Card className="h-full border-border/70 shadow-sm">
    <CardContent className="space-y-2 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Evolucion temporal
      </div>
      <div className="h-[148px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 16, right: 22, left: 22, bottom: 0 }}>
            <YAxis yAxisId="bar" orientation="left" hide domain={[0, (max: number) => Math.ceil(max * 2.8)]} />
            <YAxis yAxisId="line" orientation="right" hide />
            <Bar
              yAxisId="bar"
              dataKey="countVacantes"
              fill="#cbd5e1"
              radius={[2, 2, 0, 0]}
              barSize={18}
            >
              <LabelList
                dataKey="countVacantes"
                position="top"
                offset={4}
                formatter={(value) => formatInteger(Number(value ?? 0))}
                fill="#94a3b8"
                fontSize={9}
              />
            </Bar>
            <Line
              yAxisId="line"
              type="monotone"
              dataKey="total"
              stroke="#0f766e"
              strokeWidth={2}
              dot={{ r: 2, fill: "#0f766e" }}
              activeDot={{ r: 3 }}
            >
              <LabelList
                dataKey="total"
                position="top"
                offset={6}
                formatter={(value) => formatInteger(Number(value ?? 0))}
                fill="#134e4a"
                fontSize={9}
              />
            </Line>
          </ComposedChart>
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
  metricCard,
  trendData,
}: DashboardKpiRowViewModel) => (
  <div className="grid w-full max-w-[920px] gap-3 px-0 sm:px-1 md:grid-cols-2">
    <CompactMetricCard
      eyebrow={metricCard.eyebrow}
      totalDias={metricCard.totalDias}
      variacion={metricCard.variacion}
      totalProps={metricCard.totalProps}
      promedioDias={metricCard.promedioDias}
      rows={metricCard.rows}
    />
    <CompactTrendCard data={trendData} />
  </div>
);
