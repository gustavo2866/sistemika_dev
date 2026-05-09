"use client";

import {
  LabelList,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatInteger } from "../../model";
import type {
  DashboardFunnelItem,
  DashboardKpiRowViewModel,
  DashboardMetricRow,
  DashboardTrendPoint,
} from "./use-dashboard-kpi-row";

const CompactMetricCard = ({
  title,
  count,
  rows,
}: {
  title: string;
  count: number;
  rows: DashboardMetricRow[];
}) => (
  <Card className="h-full border-border/70 shadow-sm">
    <CardContent className="space-y-2 p-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </div>
        <div className="mt-1 text-2xl font-bold leading-none">{formatInteger(count)}</div>
      </div>
      <div className="space-y-1.5 rounded-lg border border-border/50 bg-slate-50/70 px-2 py-1.5">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[1fr_2rem_4.25rem] items-center gap-2">
            <div className="text-[10px] font-medium text-muted-foreground">{row.label}</div>
            <span className="w-full text-right text-[11px] font-semibold tabular-nums text-foreground">
              {row.count}
            </span>
            {row.value ? (
              <span
                className={cn(
                  "w-full rounded-full px-1.5 py-0.5 text-right text-[10px] font-semibold tabular-nums",
                  row.valueClassName,
                )}
              >
                {row.value}
              </span>
            ) : (
              <span />
            )}
          </div>
        ))}
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
      <div className="h-[72px]">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart data={data} margin={{ top: 14, right: 4, left: 4, bottom: 0 }}>
            <Line
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
                offset={8}
                formatter={(value) => formatInteger(Number(value ?? 0))}
                className="fill-muted-foreground"
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

const CompactFunnelCard = ({ data }: { data: DashboardFunnelItem[] }) => {
  const maxCount = data.length ? Math.max(...data.map((item) => item.count), 0) : 0;

  return (
    <Card className="h-full border-border/70 shadow-sm">
      <CardContent className="space-y-2 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Embudo de oportunidades
        </div>
        <div className="space-y-1.5">
          {data.map((item) => {
            const ratio = maxCount > 0 ? item.count / maxCount : 0;
            const width = `${Math.max(44, Math.round(ratio * 100))}%`;
            return (
              <div key={item.key} className="flex justify-center">
                <div
                  className={cn(
                    "flex h-6 items-center justify-between gap-2 rounded-sm px-2 text-[9px] font-medium text-white",
                    item.className,
                  )}
                  style={{
                    width,
                    clipPath: "polygon(6% 0, 94% 0, 100% 100%, 0 100%)",
                  }}
                >
                  <span className="truncate">{item.label}</span>
                  <span className="shrink-0 font-semibold">{formatInteger(item.count)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export const DashboardKpiRow = ({
  metricCard,
  trendData,
  funnelData,
}: DashboardKpiRowViewModel) => (
  <div className="grid w-full gap-3 px-0 sm:px-1 md:grid-cols-2 xl:grid-cols-3">
    <CompactMetricCard
      title={metricCard.title}
      count={metricCard.count}
      rows={metricCard.rows}
    />
    <CompactTrendCard data={trendData} />
    <CompactFunnelCard data={funnelData} />
  </div>
);
