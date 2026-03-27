"use client";

import {
  Bar,
  BarChart as RechartsBarChart,
  Cell,
  LabelList,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  XAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  formatCurrencyMillions,
  formatInteger,
  formatPercent,
} from "../../model";
import type {
  DashboardKpiRowViewModel,
  DashboardTipoSolicitudItem,
  DashboardTopProviderItem,
  DashboardTrendPoint,
} from "./use-dashboard-kpi-row";

const MINI_PIE_COLORS = ["#0f766e", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444"];

const SummaryCard = ({
  title,
  count,
  amount,
  variation,
}: DashboardKpiRowViewModel["summaryCard"]) => (
  <Card className="h-full border-border/70 shadow-sm">
    <CardContent className="space-y-2 p-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </div>
        <div className="mt-1 text-2xl font-bold leading-none">
          {formatInteger(count)}
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-sm font-semibold">
          {formatCurrencyMillions(amount)}
        </div>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
            variation >= 0
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700",
          )}
        >
          {formatPercent(variation)}
        </span>
      </div>
      <div className="text-[10px] text-muted-foreground">
        Variacion vs periodo anterior
      </div>
    </CardContent>
  </Card>
);

const TopProvidersCard = ({
  rankingData,
}: {
  rankingData: DashboardTopProviderItem[];
}) => {
  const topFive = rankingData.slice(0, 5);
  const maxAmount = topFive.length
    ? Math.max(...topFive.map((entry) => entry.amount), 0)
    : 0;

  return (
    <Card className="h-full border-border/70 shadow-sm">
      <CardContent className="space-y-2 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Top five de proveedores
        </div>
        <div className="space-y-2">
          {topFive.length === 0 ? (
            <div className="text-xs text-muted-foreground">Sin datos.</div>
          ) : (
            topFive.map((entry, index) => {
              const pct = maxAmount > 0 ? (entry.amount / maxAmount) * 100 : 0;
              return (
                <div key={`${entry.proveedor}-${index}`} className="space-y-1">
                  <div className="flex items-start gap-2 text-xs">
                    <span className="w-4 shrink-0 pt-0.5 text-[10px] font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium" title={entry.proveedor}>
                        {entry.proveedor}
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold">
                      {formatCurrencyMillions(entry.amount)}
                    </span>
                  </div>
                  <div className="ml-6 h-1.5 rounded-full bg-slate-100">
                    <div
                      className="h-1.5 rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const TrendCard = ({ data }: { data: DashboardTrendPoint[] }) => (
  <Card className="h-full border-border/70 shadow-sm">
    <CardContent className="space-y-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Evolucion
          </div>
          <div className="mt-1 text-sm font-semibold">
            {data.length
              ? formatCurrencyMillions(data[data.length - 1].amount)
              : formatCurrencyMillions(0)}
          </div>
        </div>
        <div className="text-right text-[10px] text-muted-foreground">
          Ultimos 4 periodos
        </div>
      </div>
      <div className="h-[68px]">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart
            data={data}
            margin={{ top: 14, right: 4, left: 4, bottom: 0 }}
          >
            <Line
              type="monotone"
              dataKey="amount"
              stroke="#0f766e"
              strokeWidth={2}
              dot={{ r: 2, fill: "#0f766e" }}
              activeDot={{ r: 3 }}
            >
              <LabelList
                dataKey="amount"
                position="top"
                offset={8}
                formatter={(value: unknown) =>
                  formatCurrencyMillions(Number((value as number) ?? 0))
                }
                className="fill-muted-foreground"
                fontSize={9}
              />
            </Line>
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        {data.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
    </CardContent>
  </Card>
);

const TipoSolicitudCard = ({
  data,
}: {
  data: DashboardTipoSolicitudItem[];
}) => {
  const barData = data.slice(0, 4);

  return (
    <Card className="h-full border-border/70 shadow-sm">
      <CardContent className="space-y-2 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          por tipo solicitud
        </div>
        {barData.length === 0 ? (
          <div className="text-xs text-muted-foreground">Sin datos.</div>
        ) : (
          <>
            <div className="h-[110px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart
                  data={barData}
                  margin={{ top: 20, right: 4, left: 4, bottom: 0 }}
                  barCategoryGap={12}
                >
                  <XAxis
                    dataKey="tipo_solicitud"
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    tick={{ fontSize: 9, fill: "#6b7280" }}
                    tickFormatter={(value: string) =>
                      value.length > 7 ? `${value.slice(0, 7)}...` : value
                    }
                  />
                  <Bar
                    dataKey="amount"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  >
                    <LabelList
                      dataKey="amount"
                      position="top"
                      offset={6}
                      formatter={(value: unknown) =>
                        formatCurrencyMillions(Number((value as number) ?? 0))
                      }
                      className="fill-muted-foreground"
                      fontSize={8}
                    />
                    {barData.map((entry, index) => (
                      <Cell
                        key={`${entry.tipo_solicitud}-${index}`}
                        fill={MINI_PIE_COLORS[index % MINI_PIE_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {barData.map((entry, index) => (
                <div
                  key={`${entry.tipo_solicitud}-${index}`}
                  className="flex min-w-0 items-center gap-1.5 text-[9px] text-muted-foreground"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        MINI_PIE_COLORS[index % MINI_PIE_COLORS.length],
                    }}
                  />
                  <span
                    className="truncate"
                    title={entry.tipo_solicitud}
                  >
                    {entry.tipo_solicitud}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export const DashboardKpiRow = ({
  summaryCard,
  rankingData,
  trendData,
  distributionData,
}: DashboardKpiRowViewModel) => (
  <div className="grid w-full max-w-[920px] gap-3 px-0 sm:px-1 md:grid-cols-2 xl:grid-cols-4">
    <SummaryCard {...summaryCard} />
    <TopProvidersCard rankingData={rankingData} />
    <TrendCard data={trendData} />
    <TipoSolicitudCard data={distributionData} />
  </div>
);
