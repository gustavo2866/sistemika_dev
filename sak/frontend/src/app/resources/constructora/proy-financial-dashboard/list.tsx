"use client";

import type { ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  DollarSign,
  Percent,
  RefreshCcw,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { FinancialKpiCards } from "@/components/financial-kpi-cards";
import { ZoomablePanel } from "@/components/zoomable-panel";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  formatMillions,
  formatPercent,
  formatPeriodLabel,
  shiftDashboardFilters,
  type FinancialDashboardResponse,
  type NegativeDeviationItem,
  type PeriodType,
  type ProjectDeviationItem,
  type ProjectResultItem,
  type ProjectSummaryItem,
  type RubroDeviationItem,
  type RubroResultItem,
  type SelectOption,
} from "./model";
import { useProyFinancialDashboard } from "./use-proy-financial-dashboard";

const SectionShell = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("min-h-0 w-full overflow-hidden rounded-lg border border-border/70 bg-white shadow-sm", className)}>
    {children}
  </div>
);

const CompactSelect = ({
  label,
  value,
  options,
  widthClassName,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  widthClassName: string;
  onChange: (value: string) => void;
}) => (
  <div className="flex min-w-0 items-center gap-1.5">
    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {label}
    </span>
    <select
      value={value === "todos" ? "todos" : value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-[22px] rounded-md border border-border/70 bg-white px-2 py-0 text-[10px] font-medium leading-[22px] text-foreground shadow-sm outline-none",
        widthClassName,
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const PERIOD_OPTIONS: Array<{ value: Exclude<PeriodType, "personalizado" | "cuatrimestre">; label: string }> = [
  { value: "mes", label: "Mes" },
  { value: "trimestre", label: "Trim." },
  { value: "semestre", label: "Sem." },
  { value: "anio", label: "Año" },
];

const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
};

const formatIsoDate = (value: Date) => value.toISOString().split("T")[0];

const periodMonths: Record<Exclude<PeriodType, "personalizado" | "cuatrimestre">, number> = {
  mes: 1,
  trimestre: 3,
  semestre: 6,
  anio: 12,
};

const buildRangeForPeriod = (
  endDate: string,
  periodType: Exclude<PeriodType, "personalizado" | "cuatrimestre">,
) => {
  const endSource = parseIsoDate(endDate);
  const months = periodMonths[periodType];
  const start = new Date(
    Date.UTC(endSource.getUTCFullYear(), endSource.getUTCMonth() + 1 - months, 1),
  );
  const end = new Date(
    Date.UTC(endSource.getUTCFullYear(), endSource.getUTCMonth() + 1, 0),
  );
  return {
    startDate: formatIsoDate(start),
    endDate: formatIsoDate(end),
  };
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const formatRangeLabel = (
  filters: { startDate: string; endDate: string },
  periodType: PeriodType,
) => {
  const end = parseIsoDate(filters.endDate);
  if (periodType === "mes") {
    return capitalize(
      new Intl.DateTimeFormat("es-AR", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(end),
    );
  }

  const start = parseIsoDate(filters.startDate);
  const formatter = new Intl.DateTimeFormat("es-AR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
  return `${capitalize(formatter.format(start))} - ${capitalize(formatter.format(end))}`;
};

const CompactPeriodControl = ({
  periodType,
  filters,
  onApplyRange,
}: {
  periodType: PeriodType;
  filters: { startDate: string; endDate: string; proyectoId: string; estado: string };
  onApplyRange: (range: { startDate: string; endDate: string }, type: PeriodType) => void;
}) => {
  const normalizedType =
    periodType === "personalizado" || periodType === "cuatrimestre" ? "mes" : periodType;

  const handleShift = (steps: number) => {
    const nextFilters = shiftDashboardFilters(filters, normalizedType, steps);
    onApplyRange(
      { startDate: nextFilters.startDate, endDate: nextFilters.endDate },
      normalizedType,
    );
  };

  const handlePeriodChange = (nextValue: string) => {
    const nextType = nextValue as Exclude<PeriodType, "personalizado" | "cuatrimestre">;
    onApplyRange(buildRangeForPeriod(filters.endDate, nextType), nextType);
  };

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Periodo
      </span>
      <div className="flex h-[22px] items-center gap-0.5 rounded-md border border-border/70 bg-white p-0.5 shadow-sm">
        <select
          value={normalizedType}
          onChange={(event) => handlePeriodChange(event.target.value)}
          className="h-[18px] w-[62px] rounded border-0 bg-slate-100 px-1.5 py-0 text-[10px] font-medium leading-[18px] text-foreground outline-none"
        >
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="ghost"
          className="h-[18px] w-[18px] rounded px-0 text-[10px]"
          onClick={() => handleShift(-1)}
        >
          {"<"}
        </Button>
        <div className="flex h-[18px] min-w-[88px] items-center justify-center rounded bg-slate-100 px-2 text-center text-[10px] font-medium leading-[18px]">
          {formatRangeLabel(filters, normalizedType)}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-[18px] w-[18px] rounded px-0 text-[10px]"
          onClick={() => handleShift(1)}
        >
          {">"}
        </Button>
      </div>
    </div>
  );
};

const PeriodStatusBadge = ({
  status,
}: {
  status?: FinancialDashboardResponse["periodo"]["estado"];
}) => {
  if (!status) return null;
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-md border px-2 text-[9px] font-semibold uppercase tracking-[0.06em]",
        status.cerrado
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700",
      )}
      title={`Fecha de cierre: ${status.fecha_cierre}`}
    >
      {status.estado}
    </span>
  );
};

const formatPreviousPeriodLabel = (startDate: string) => {
  const start = parseIsoDate(startDate);
  const previous = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 0));
  return new Intl.DateTimeFormat("es-AR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(previous).toLowerCase().replace(".", "");
};

const KpiGrid = ({
  dashboardData,
  previousPeriodLabel,
}: {
  dashboardData: FinancialDashboardResponse;
  previousPeriodLabel: string;
}) => {
  const kpis = dashboardData.kpis;
  const trendSuffix = `vs ${previousPeriodLabel}`;
  const accumulated = dashboardData.resumen_por_proyecto.reduce(
    (acc, item) => ({
      real: acc.real + item.ventana_abierta_real,
      presupuestado: acc.presupuestado + item.ventana_abierta_presupuestado,
      total: acc.total + item.ventana_abierta_total,
      ingresosEsperados: acc.ingresosEsperados + item.ventana_abierta_ingresos_total,
    }),
    { real: 0, presupuestado: 0, total: 0, ingresosEsperados: 0 },
  );
  const accumulatedMargin = accumulated.ingresosEsperados
    ? (accumulated.total / accumulated.ingresosEsperados) * 100
    : 0;

  return (
    <FinancialKpiCards
      items={[
        {
          key: "ingresos",
          title: "Ingresos",
          value: kpis.ingresos_acumulados,
          trend: kpis.comparativos.ingresos_pct,
          trendSuffix,
          budget: kpis.presupuestos.ingresos,
          deviation: kpis.desvios.ingresos,
          icon: DollarSign,
          iconClassName: "bg-emerald-600",
        },
        {
          key: "egresos",
          title: "Egresos",
          value: kpis.egresos_acumulados,
          trend: kpis.comparativos.egresos_pct,
          trendSuffix,
          budget: kpis.presupuestos.egresos,
          deviation: kpis.desvios.egresos,
          icon: ArrowDownToLine,
          iconClassName: "bg-rose-600",
        },
        {
          key: "resultado",
          title: "Resultado",
          value: kpis.resultado_acumulado,
          trend: kpis.comparativos.resultado_pct,
          trendSuffix,
          budget: kpis.presupuestos.resultado,
          deviation: kpis.desvios.resultado,
          icon: BarChart3,
          iconClassName: "bg-indigo-700",
        },
        {
          key: "margen",
          title: "Margen",
          value: kpis.margen_promedio,
          valueType: "percent",
          trend: kpis.comparativos.margen_pp,
          trendSuffix,
          trendType: "points",
          sideSummary: {
            title: "Acc",
            items: [
              { label: "Real", value: accumulated.real },
              { label: "Pres", value: accumulated.presupuestado },
              { label: "Total", value: accumulated.total },
              { label: "Mar", value: accumulatedMargin, valueType: "percent" },
            ],
          },
          icon: Percent,
          iconClassName: "bg-amber-500",
        },
      ]}
    />
  );
};

const CHART_LABEL_AXIS_WIDTH = 96;
const CHART_LABEL_LEFT_PADDING = 8;

const TruncatedAxisTick = ({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
}) => {
  const label = String(payload?.value ?? "");

  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject
        x={-CHART_LABEL_AXIS_WIDTH + CHART_LABEL_LEFT_PADDING}
        y={-7}
        width={CHART_LABEL_AXIS_WIDTH - CHART_LABEL_LEFT_PADDING - 6}
        height={14}
      >
        <div
          className="truncate pr-1 text-left text-[8px] leading-[14px] text-slate-600"
          title={label}
        >
          {label}
        </div>
      </foreignObject>
    </g>
  );
};

const ResultByProjectChart = ({ data }: { data: ProjectResultItem[] }) => {
  const chartData = data.map((item) => ({
    ...item,
    label: item.proyecto,
  }));
  const renderChart = () => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        layout="vertical"
        barCategoryGap="36%"
        margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
        <XAxis
          type="number"
          tickFormatter={(value) => String(Math.round(Number(value) / 1_000_000))}
          tick={{ fontSize: 8 }}
          tickLine={false}
          axisLine={{ stroke: "#9ca3af" }}
        />
        <YAxis
          dataKey="label"
          type="category"
          width={CHART_LABEL_AXIS_WIDTH}
          tick={<TruncatedAxisTick />}
          interval={0}
          tickLine={false}
        />
        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
        <Bar dataKey="resultado" radius={[0, 3, 3, 0]} maxBarSize={16}>
          {chartData.map((entry) => (
            <Cell key={entry.proyecto_id} fill={entry.resultado >= 0 ? "#1d4ed8" : "#ef4444"} />
          ))}
          <LabelList
            dataKey="resultado"
            position="right"
            formatter={(value) => formatMillions(Number(value))}
            fontSize={8}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <SectionShell className="flex h-full flex-col p-1.5">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <div className="text-xs font-semibold">Resultado por proyecto</div>
        <div className="text-[8px] text-muted-foreground">Millones</div>
      </div>
      <div className="min-h-0 flex-1">
        {renderChart()}
      </div>
    </SectionShell>
  );
};

const NegativeDeviations = ({ data }: { data: NegativeDeviationItem[] }) => (
  <SectionShell className="flex h-full flex-col p-1.5">
    <div className="mb-1 flex items-center justify-between gap-2">
      <div>
        <div className="text-xs font-semibold">Top 5 desvios negativos</div>
        <div className="text-[8px] text-muted-foreground">Acumulado</div>
      </div>
    </div>
    <div className="min-h-0 flex-1 overflow-hidden">
      <table className="w-full table-fixed text-left text-[8px]">
        <colgroup>
          <col className="w-[23%]" />
          <col className="w-[31%]" />
          <col className="w-[46%]" />
        </colgroup>
        <thead className="text-[8px] text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 font-semibold">Rubro</th>
            <th className="py-1 font-semibold">Proyecto</th>
            <th className="py-1 text-right font-semibold">Desvio</th>
          </tr>
        </thead>
        <tbody>
          {data.length ? (
            data.map((item) => (
              <tr key={`${item.rubro}-${item.proyecto}`} className="border-b last:border-0">
                <td className="truncate py-1 pr-2 font-medium" title={item.rubro}>{item.rubro}</td>
                <td className="truncate py-1 pr-2 text-muted-foreground" title={item.proyecto}>{item.proyecto}</td>
                <td className="py-1">
                  <div className="grid grid-cols-[34px_58px_1fr] items-center gap-1">
                    <span className="text-right text-[7px] font-medium tabular-nums">
                      {formatPercent(item.desvio_pct)}
                    </span>
                    <span className="truncate text-right text-[7px] font-semibold tabular-nums text-rose-700">
                      {formatMillions(item.desvio)}
                    </span>
                    <span className="h-2 rounded-sm bg-rose-100">
                      <span
                        className="block h-2 rounded-sm bg-rose-500"
                        style={{ width: `${Math.min(100, Math.max(8, Math.abs(item.desvio_pct)))}%` }}
                      />
                    </span>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} className="py-5 text-center text-muted-foreground">
                Sin desvios negativos en el periodo.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    <button
      type="button"
      className="mt-1 inline-flex w-fit items-center text-[8px] font-semibold text-blue-700 transition-colors hover:text-blue-900 hover:underline"
    >
      Ver mas desvios
      <ArrowUpRight className="ml-0.5 h-2.5 w-2.5" />
    </button>
  </SectionShell>
);

const RubroResultRanking = ({ data }: { data: RubroResultItem[] }) => {
  const rows = data.slice(0, 7);
  const chartData = rows.map((item) => ({
    ...item,
    label: item.rubro,
  }));
  const minResult = Math.min(
    0,
    ...chartData.flatMap((item) => [item.resultado, item.resultado_presupuestado]),
  );
  const maxResult = Math.max(
    0,
    ...chartData.flatMap((item) => [item.resultado, item.resultado_presupuestado]),
  );
  const padding = Math.max((maxResult - minResult) * 0.08, 1_000_000);

  return (
    <SectionShell className="flex h-full flex-col p-1.5">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <div className="text-xs font-semibold">Resultado por rubro</div>
        <div className="flex items-center gap-1.5 text-[8px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="h-px w-3 bg-blue-700" />Real</span>
          <span className="inline-flex items-center gap-1"><span className="h-px w-3 bg-slate-400" />Pres.</span>
          <span>Millones</span>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {chartData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              barCategoryGap="26%"
              barGap={1}
              margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis
                type="number"
                domain={[minResult - padding, maxResult + padding]}
                tickFormatter={(value) => String(Math.round(Number(value) / 1_000_000))}
                tick={{ fontSize: 8 }}
                tickLine={false}
                axisLine={{ stroke: "#9ca3af" }}
              />
              <YAxis
                dataKey="label"
                type="category"
                width={CHART_LABEL_AXIS_WIDTH}
                tick={<TruncatedAxisTick />}
                interval={0}
                tickLine={false}
              />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="resultado_presupuestado" radius={[0, 3, 3, 0]} maxBarSize={7}>
                {chartData.map((entry) => (
                  <Cell key={entry.rubro} fill={entry.resultado_presupuestado >= 0 ? "#94a3b8" : "#cbd5e1"} />
                ))}
                <LabelList
                  dataKey="resultado_presupuestado"
                  position="right"
                  formatter={(value) => formatMillions(Number(value))}
                  fontSize={7}
                  fill="#64748b"
                />
              </Bar>
              <Bar dataKey="resultado" radius={[0, 3, 3, 0]} maxBarSize={10}>
                {chartData.map((entry) => (
                  <Cell key={entry.rubro} fill={entry.resultado >= 0 ? "#1d4ed8" : "#ef4444"} />
                ))}
                <LabelList
                  dataKey="resultado"
                  position="right"
                  formatter={(value) => formatMillions(Number(value))}
                  fontSize={8}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
            Sin resultado por rubro en el periodo.
          </div>
        )}
      </div>
    </SectionShell>
  );
};

const buildEvolutionChartData = (data: FinancialDashboardResponse["evolucion_mensual"]) => {
  const rows = data.map((item) => ({
    ...item,
    label: formatPeriodLabel(item.periodo),
  }));
  const lastClosedIndex = rows.reduce(
    (lastIndex, item, index) => (item.cerrado ? index : lastIndex),
    -1,
  );

  if (lastClosedIndex < 0 || lastClosedIndex >= rows.length - 1) {
    return rows;
  }

  const bridge = rows[lastClosedIndex];
  return rows.map((item, index) => {
    if (index !== lastClosedIndex) return item;
    return {
      ...item,
      ingresos_presupuestado: bridge.ingresos_real,
      egresos_presupuestado: bridge.egresos_real,
      resultado_presupuestado: bridge.resultado_real,
    };
  });
};

const MonthlyEvolutionChart = ({ data }: { data: FinancialDashboardResponse["evolucion_mensual"] }) => {
  const chartData = buildEvolutionChartData(data);

  return (
  <SectionShell className="flex h-full flex-col p-1.5">
    <div className="mb-1 flex items-baseline justify-between gap-2">
      <div className="text-xs font-semibold">Evolucion mensual</div>
      <div className="flex items-center gap-1.5 text-[8px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-700" />Ing.</span>
        <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />Egr.</span>
        <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />Res.</span>
        <span className="hidden items-center gap-1 lg:inline-flex"><span className="h-px w-3 bg-slate-500" />Real</span>
        <span className="hidden items-center gap-1 lg:inline-flex"><span className="h-px w-3 border-t border-dashed border-slate-500" />Pres.</span>
      </div>
    </div>
    <div className="min-h-0 flex-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 8 }} tickLine={false} />
          <YAxis
            tickFormatter={(value) => String(Math.round(Number(value) / 1_000_000))}
            tick={{ fontSize: 8 }}
            tickLine={false}
          />
          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          <Line
            type="monotone"
            dataKey="ingresos_real"
            name="Ingresos real"
            stroke="#1d4ed8"
            strokeWidth={1.8}
            dot={{ r: 2 }}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="egresos_real"
            name="Egresos real"
            stroke="#ef4444"
            strokeWidth={1.8}
            dot={{ r: 2 }}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="resultado_real"
            name="Resultado real"
            stroke="#16a34a"
            strokeWidth={1.8}
            dot={{ r: 2 }}
            connectNulls={false}
          >
            <LabelList
              dataKey="resultado_real"
              position="top"
              formatter={(value) => formatMillions(Number(value))}
              fontSize={7}
              fill="#15803d"
            />
          </Line>
          <Line
            type="monotone"
            dataKey="ingresos_presupuestado"
            name="Ingresos presupuesto"
            stroke="#1d4ed8"
            strokeWidth={1.8}
            strokeDasharray="4 4"
            dot={{ r: 2 }}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="egresos_presupuestado"
            name="Egresos presupuesto"
            stroke="#ef4444"
            strokeWidth={1.8}
            strokeDasharray="4 4"
            dot={{ r: 2 }}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="resultado_presupuestado"
            name="Resultado presupuesto"
            stroke="#16a34a"
            strokeWidth={1.8}
            strokeDasharray="4 4"
            dot={{ r: 2 }}
            connectNulls={false}
          >
            <LabelList
              dataKey="resultado_presupuestado"
              position="top"
              formatter={(value) => formatMillions(Number(value))}
              fontSize={7}
              fill="#15803d"
            />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  </SectionShell>
  );
};

const marginStatusClass = (margin: number) => {
  const displayMargin = Math.round(Number(margin || 0) * 10) / 10;
  if (displayMargin >= 20) return "bg-emerald-500";
  if (displayMargin >= 10) return "bg-amber-500";
  return "bg-rose-500";
};

const SummaryAmount = ({
  value,
  variation,
  strong = false,
  valueClassName,
}: {
  value: number;
  variation?: number;
  strong?: boolean;
  valueClassName?: string;
}) => (
  <span
    className={cn(
      "min-w-0 items-baseline",
      variation !== undefined
        ? "grid grid-cols-[minmax(0,1fr)_27px] gap-0.5"
        : "block",
    )}
  >
    <span className={cn("min-w-0 truncate text-right tabular-nums", strong && "font-semibold", valueClassName)}>
      {formatMillions(value)}
    </span>
    {variation !== undefined ? (
      <span
        className={cn(
          "shrink-0 text-right text-[5.8px] font-medium tabular-nums",
          variation >= 0 ? "text-emerald-700" : "text-rose-700",
        )}
      >
        {variation >= 0 ? "+" : ""}
        {formatPercent(variation)}
      </span>
    ) : null}
  </span>
);

const ProjectSummaryTable = ({ data }: { data: ProjectSummaryItem[] }) => {
  const totals = data.reduce(
    (acc, item) => ({
      ingresos: acc.ingresos + item.acumulado_ingresos,
      egresos: acc.egresos + item.acumulado_egresos,
      resultado: acc.resultado + item.acumulado_resultado,
      accReal: acc.accReal + item.ventana_abierta_real,
      proy: acc.proy + item.ventana_abierta_presupuestado,
      total: acc.total + item.ventana_abierta_total,
      ingresosEsperados: acc.ingresosEsperados + item.ventana_abierta_ingresos_total,
    }),
    { ingresos: 0, egresos: 0, resultado: 0, accReal: 0, proy: 0, total: 0, ingresosEsperados: 0 },
  );
  const totalExpectedMargin = totals.ingresosEsperados
    ? (totals.total / totals.ingresosEsperados) * 100
    : 0;
  const totalMonthlyMargin = totals.ingresos
    ? (totals.resultado / totals.ingresos) * 100
    : 0;
  const exportColumns = [
    "Proyecto",
    "Ing.",
    "Egr.",
    "Res.",
    "Mar. %",
    "acc Real",
    "acc Pres",
    "acc Total",
    "acc Mar %",
    "Est.",
  ];
  const exportRows = [
    ...data.map((item) => {
      const monthlyMargin = item.acumulado_ingresos
        ? (item.acumulado_resultado / item.acumulado_ingresos) * 100
        : 0;

      return [
        item.proyecto,
        item.acumulado_ingresos,
        item.acumulado_egresos,
        item.acumulado_resultado,
        monthlyMargin,
        item.ventana_abierta_real,
        item.ventana_abierta_presupuestado,
        item.ventana_abierta_total,
        item.margen_total_esperado,
        item.estado,
      ];
    }),
    [
      "TOTAL",
      totals.ingresos,
      totals.egresos,
      totals.resultado,
      totalMonthlyMargin,
      totals.accReal,
      totals.proy,
      totals.total,
      totalExpectedMargin,
      "",
    ],
  ];

  return (
    <ZoomablePanel
      title="Resumen por proyecto"
      subtitle="Vista financiera"
      exportData={{
        filename: "resumen_por_proyecto.csv",
        columns: exportColumns,
        rows: exportRows,
      }}
      className="flex h-full flex-col p-1.5"
      contentClassName="min-h-0 flex-1"
      zoomContentClassName="h-full [&_table]:!w-full [&_table]:!text-[8.25px] [&_thead]:!text-[8px] [&_td]:!text-[8px] [&_th]:!text-[8px] [&_td]:!px-1.5 [&_td]:!py-1.5 [&_th]:!px-1.5 [&_th]:!py-2"
    >
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
        <table className="w-full table-fixed text-left text-[7.5px]">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[7%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
            <col className="w-[6%]" />
            <col className="w-[4%]" />
          </colgroup>
          <thead className="text-[7px] text-muted-foreground">
            <tr className="sticky top-0 z-10 border-b border-slate-200 bg-white">
              <th className="py-1.5 font-semibold">Proyecto</th>
              <th className="border-l border-slate-200/70 py-1.5 pl-1 text-right font-semibold">Ing.</th>
              <th className="py-1.5 pl-1 text-right font-semibold">Egr.</th>
              <th className="py-1.5 pl-1 text-right font-semibold">Res.</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Mar.</th>
              <th className="border-l border-slate-300 bg-slate-50/80 py-1.5 pl-2 text-right text-[6.25px] font-semibold leading-none">acc Real</th>
              <th className="bg-slate-50/80 py-1.5 text-right text-[6.25px] font-semibold leading-none">acc Pres</th>
              <th className="bg-slate-50/80 py-1.5 text-right text-[6.25px] font-semibold leading-none">acc Total</th>
              <th className="bg-slate-50/80 py-1.5 text-right text-[6.25px] font-semibold leading-none">acc Mar</th>
              <th className="py-1.5 text-center font-semibold">Est.</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => {
              const monthlyMargin = item.acumulado_ingresos
                ? (item.acumulado_resultado / item.acumulado_ingresos) * 100
                : 0;

              return (
                <tr key={item.proyecto_id} className="border-b last:border-0">
                  <td className="max-w-0 truncate py-1 pr-2 font-medium" title={item.proyecto}>
                    {item.proyecto}
                  </td>
                  <td className="truncate border-l border-slate-200/70 py-1 pl-1 text-right text-[7px]">
                    <SummaryAmount value={item.acumulado_ingresos} />
                  </td>
                  <td className="truncate py-1 pl-1 text-right text-[7px]">
                    <SummaryAmount value={item.acumulado_egresos} />
                  </td>
                  <td className="truncate py-1 pl-1 text-right text-[7px]">
                    <SummaryAmount
                      value={item.acumulado_resultado}
                      strong
                    />
                  </td>
                  <td className="truncate py-1 pr-2 text-right text-[7px]">{formatPercent(monthlyMargin)}</td>
                  <td className="truncate border-l border-slate-300 bg-slate-50/55 py-1 pl-2 text-right text-[6.25px]">{formatMillions(item.ventana_abierta_real)}</td>
                  <td className="truncate bg-slate-50/55 py-1 text-right text-[6.25px]">{formatMillions(item.ventana_abierta_presupuestado)}</td>
                  <td className="truncate bg-slate-50/55 py-1 text-right text-[6.25px] font-semibold">{formatMillions(item.ventana_abierta_total)}</td>
                  <td className="truncate bg-slate-50/55 py-1 text-right text-[6.25px]">{formatPercent(item.margen_total_esperado)}</td>
                  <td className="py-1 text-center">
                    <span
                      className={cn("inline-block h-2 w-2 rounded-full", marginStatusClass(item.margen_total_esperado))}
                      title={`Margen esperado: ${formatPercent(item.margen_total_esperado)}`}
                    />
                  </td>
                </tr>
              );
            })}
            {data.length ? (
              <tr className="sticky bottom-0 border-t bg-slate-50 font-bold">
                <td className="py-1">TOTAL</td>
                <td className="truncate border-l border-slate-200/70 py-1 pl-1 text-right text-[7px]">{formatMillions(totals.ingresos)}</td>
                <td className="truncate py-1 pl-1 text-right text-[7px]">{formatMillions(totals.egresos)}</td>
                <td className="truncate py-1 pl-1 text-right text-[7px]">
                  <SummaryAmount
                    value={totals.resultado}
                    strong
                  />
                </td>
                <td className="truncate py-1 pr-2 text-right text-[7px]">{formatPercent(totalMonthlyMargin)}</td>
                <td className="truncate border-l border-slate-300 bg-slate-100/80 py-1 pl-2 text-right text-[6.25px]">{formatMillions(totals.accReal)}</td>
                <td className="truncate bg-slate-100/80 py-1 text-right text-[6.25px]">{formatMillions(totals.proy)}</td>
                <td className="truncate bg-slate-100/80 py-1 text-right text-[6.25px]">{formatMillions(totals.total)}</td>
                <td className="bg-slate-100/80 py-1 text-right text-[6.25px]">{formatPercent(totalExpectedMargin)}</td>
                <td className="py-1" />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </ZoomablePanel>
  );
};

type DeviationTableItem = ProjectDeviationItem | RubroDeviationItem;

const DeviationTable = ({
  data,
  title,
  labelHeader,
  filename,
  getKey,
  getLabel,
}: {
  data: DeviationTableItem[];
  title: string;
  labelHeader: string;
  filename: string;
  getKey: (item: DeviationTableItem) => string | number;
  getLabel: (item: DeviationTableItem) => string;
}) => {
  const exportColumns = [
    labelHeader,
    "Ingreso Ant",
    "Ingreso Real",
    "Ingreso Pres",
    "Ingreso Var %",
    "Egreso Ant",
    "Egreso Real",
    "Egreso Pres",
    "Egreso Var %",
    "Resultado Ant",
    "Resultado Real",
    "Resultado Pres",
    "Resultado Var %",
  ];
  const exportRows = data.map((item) => [
    getLabel(item),
    item.ingresos.anterior,
    item.ingresos.real,
    item.ingresos.presupuestado,
    item.ingresos.var,
    item.egresos.anterior,
    item.egresos.real,
    item.egresos.presupuestado,
    item.egresos.var,
    item.resultado.anterior,
    item.resultado.real,
    item.resultado.presupuestado,
    item.resultado.var,
  ]);

  const MetricCells = ({
    metric,
    strong = false,
  }: {
    metric: ProjectDeviationItem["ingresos"];
    strong?: boolean;
  }) => (
    <>
      <td className="truncate py-1 text-right text-[5.8px] tabular-nums text-slate-500">{formatMillions(metric.anterior)}</td>
      <td className="truncate py-1 text-right text-[6.25px] tabular-nums">{formatMillions(metric.real)}</td>
      <td className="truncate py-1 pr-0 text-right text-[6.25px] tabular-nums text-slate-500">{formatMillions(metric.presupuestado)}</td>
      <td className="py-1 pl-0 text-right">
        <span
          className={cn(
            "inline-flex max-w-full items-baseline justify-end text-[5.2px] tabular-nums",
            metric.var >= 0 ? "text-emerald-700" : "text-rose-700",
            strong && "font-semibold",
          )}
        >
          <span className="min-w-0 truncate">{formatPercent(metric.var)}</span>
        </span>
      </td>
    </>
  );

  return (
    <ZoomablePanel
      title={title}
      subtitle="Real vs presupuesto"
      exportData={{
        filename,
        columns: exportColumns,
        rows: exportRows,
      }}
      className="flex h-full flex-col p-1.5"
      contentClassName="min-h-0 flex-1"
      zoomContentClassName="h-full [&_table]:!w-full [&_table]:!text-[11px] [&_thead]:!text-[10px] [&_tbody_td]:!text-[11px] [&_tbody_span]:!text-[10px] [&_th]:!text-[10px] [&_td]:!px-2.5 [&_td]:!py-2 [&_th]:!px-2.5 [&_th]:!py-1.5"
    >
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-100">
        <table className="w-full table-fixed text-left text-[5.8px]">
          <colgroup>
            <col className="w-[14%]" />
            {["anterior", "real", "pres", "var", "anterior", "real", "pres", "var", "anterior", "real", "pres", "var"].map((type, index) => (
              <col
                key={`${type}-${index}`}
                className={type === "var" ? "w-[5%]" : "w-[7.33%]"}
              />
            ))}
          </colgroup>
          <thead className="text-[5.8px] text-muted-foreground">
            <tr className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50">
              <th rowSpan={2} className="px-1 py-0.5 text-left font-semibold">{labelHeader}</th>
              <th colSpan={4} className="border-l border-slate-200/70 py-0.5 text-center font-semibold text-slate-600">Ingreso</th>
              <th colSpan={4} className="border-l border-slate-200/70 py-0.5 text-center font-semibold text-slate-600">Egreso</th>
              <th colSpan={4} className="border-l border-slate-200/70 py-0.5 text-center font-semibold text-slate-600">Resultado</th>
            </tr>
            <tr className="sticky top-[16px] z-10 border-b border-slate-100 bg-slate-50">
              {["Ant", "Real", "Pres", "Var", "Ant", "Real", "Pres", "Var", "Ant", "Real", "Pres", "Var"].map((label, index) => (
                <th
                  key={`${label}-${index}`}
                  className={cn("px-0.5 py-0.5 text-right font-semibold", index % 4 === 0 && "border-l border-slate-200/70")}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length ? data.map((item) => (
              <tr key={getKey(item)} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/40 last:border-0">
                <td className="max-w-0 truncate px-1 py-1 text-[6.25px] font-medium" title={getLabel(item)}>{getLabel(item)}</td>
                <MetricCells metric={item.ingresos} />
                <MetricCells metric={item.egresos} />
                <MetricCells metric={item.resultado} strong />
              </tr>
            )) : (
              <tr>
                <td colSpan={13} className="py-5 text-center text-muted-foreground">
                  Sin datos en el periodo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ZoomablePanel>
  );
};

const ProjectDeviationTable = ({ data }: { data: ProjectDeviationItem[] }) => (
  <DeviationTable
    data={data}
    title="Desvios por proyecto"
    labelHeader="Proyecto"
    filename="desvios_por_proyecto.csv"
    getKey={(item) => (item as ProjectDeviationItem).proyecto_id}
    getLabel={(item) => (item as ProjectDeviationItem).proyecto}
  />
);

const RubroDeviationTable = ({ data }: { data: RubroDeviationItem[] }) => (
  <DeviationTable
    data={data}
    title="Desvios por rubro"
    labelHeader="Rubro"
    filename="desvios_por_rubro.csv"
    getKey={(item) => (item as RubroDeviationItem).rubro}
    getLabel={(item) => (item as RubroDeviationItem).rubro}
  />
);

export default function ProyFinancialDashboardList() {
  const {
    periodType,
    filters,
    dashboardData,
    loading,
    proyectoOptions,
    estadoOptions,
    applyRange,
    handleFilterChange,
    refreshDashboard,
  } = useProyFinancialDashboard();

  return (
    <div className="mx-auto flex h-[calc(100dvh-70px)] max-h-[calc(100dvh-70px)] w-full max-w-7xl min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden px-0 pt-1.5 pb-2 sm:px-2 sm:pt-2">
      <SectionShell className="shrink-0 p-1.5">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-[210px] items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
              <h1 className="truncate text-xl font-bold leading-none tracking-tight">
                Dashboard Financiero
              </h1>
            </div>

            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              <CompactPeriodControl
                periodType={periodType}
                filters={filters}
                onApplyRange={applyRange}
              />
              <CompactSelect
                label="Proyecto"
                value={filters.proyectoId}
                options={proyectoOptions}
                widthClassName="w-[150px]"
                onChange={(value) => handleFilterChange("proyectoId", value)}
              />
              <CompactSelect
                label="Estado"
                value={filters.estado}
                options={estadoOptions}
                widthClassName="w-[118px]"
                onChange={(value) => handleFilterChange("estado", value)}
              />
              <PeriodStatusBadge status={dashboardData?.periodo?.estado} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-[22px] w-[22px] px-0"
                onClick={refreshDashboard}
                disabled={loading}
                title="Actualizar"
                aria-label="Actualizar"
              >
                <RefreshCcw className={cn("h-3 w-3", loading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </div>
      </SectionShell>

      {dashboardData ? (
        <>
          <div className="shrink-0">
            <KpiGrid
              dashboardData={dashboardData}
              previousPeriodLabel={formatPreviousPeriodLabel(filters.startDate)}
            />
          </div>
          <div className="grid shrink-0 gap-1.5 lg:grid-cols-2">
            <div className="h-[220px] min-h-0">
              <ResultByProjectChart data={dashboardData.resultado_por_proyecto} />
            </div>
            <div className="h-[220px] min-h-0">
              <MonthlyEvolutionChart data={dashboardData.evolucion_mensual} />
            </div>
            <div className="h-[250px] min-h-0">
              <RubroResultRanking data={dashboardData.resultado_por_rubro ?? dashboardData.costo_por_rubro} />
            </div>
            <div className="h-[250px] min-h-0">
              <ProjectSummaryTable data={dashboardData.resumen_por_proyecto} />
            </div>
            <div className="h-[250px] min-h-0">
              <ProjectDeviationTable data={dashboardData.desvios_por_proyecto} />
            </div>
            <div className="h-[250px] min-h-0">
              <NegativeDeviations data={dashboardData.top_desvios_negativos} />
            </div>
            <div className="h-[250px] min-h-0 lg:col-start-1">
              <RubroDeviationTable data={dashboardData.desvios_por_rubro} />
            </div>
          </div>
        </>
      ) : (
        <SectionShell className="min-h-0 flex-1 p-8 text-center text-sm text-muted-foreground">
          {loading ? "Cargando dashboard financiero..." : "Sin datos financieros para el periodo."}
        </SectionShell>
      )}
    </div>
  );
}
