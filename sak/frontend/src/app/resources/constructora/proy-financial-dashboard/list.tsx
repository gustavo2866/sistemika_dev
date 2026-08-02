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
          icon: Percent,
          iconClassName: "bg-amber-500",
        },
      ]}
    />
  );
};

const ResultByProjectChart = ({ data }: { data: ProjectResultItem[] }) => {
  const chartData = data.map((item) => ({
    ...item,
    label: item.proyecto.length > 20 ? `${item.proyecto.slice(0, 19)}.` : item.proyecto,
  }));

  return (
    <SectionShell className="flex h-full flex-col p-1.5">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <div className="text-xs font-semibold">Resultado por proyecto</div>
        <div className="text-[8px] text-muted-foreground">Millones</div>
      </div>
      <div className="min-h-0 flex-1">
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
              width={142}
              tick={{ fontSize: 8 }}
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
    label: item.rubro.length > 20 ? `${item.rubro.slice(0, 19)}.` : item.rubro,
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
        <div className="flex items-center gap-2 text-[8px] text-muted-foreground">
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
                width={142}
                tick={{ fontSize: 8 }}
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
      <div className="flex items-center gap-2 text-[8px] text-muted-foreground">
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
  <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_32px] items-baseline gap-1">
    <span className={cn("min-w-0 truncate text-right tabular-nums", strong && "font-semibold", valueClassName)}>
      {formatMillions(value)}
    </span>
    {variation !== undefined ? (
      <span
        className={cn(
          "shrink-0 text-right text-[6.5px] font-medium tabular-nums",
          variation >= 0 ? "text-emerald-700" : "text-rose-700",
        )}
      >
        {variation >= 0 ? "+" : ""}
        {formatPercent(variation)}
      </span>
    ) : null}
  </span>
);

const SummaryMetricHeader = ({ label }: { label: string }) => (
  <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_32px] items-end gap-1">
    <span className="min-w-0 text-right font-semibold">{label}</span>
    <span className="inline-flex shrink-0 items-center justify-end gap-0.5 text-[6.5px] font-semibold text-muted-foreground">
      <ArrowUpRight className="h-2 w-2" />
      Var
    </span>
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

  return (
    <SectionShell className="flex h-full flex-col p-1.5">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <div className="text-xs font-semibold">Resumen por proyecto</div>
        <div className="text-[8px] text-muted-foreground">Vista financiera</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
        <table className="w-full table-fixed text-left text-[7.5px]">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
            <col className="w-[6%]" />
            <col className="w-[5%]" />
          </colgroup>
          <thead className="text-[7.5px] text-muted-foreground">
            <tr className="sticky top-0 z-10 border-b bg-white">
              <th className="py-1 font-semibold">Proyecto</th>
              <th className="border-l border-slate-200/70 py-1 pl-1 text-right"><SummaryMetricHeader label="Ing." /></th>
              <th className="border-l border-slate-200/70 py-1 pl-1 text-right"><SummaryMetricHeader label="Egr." /></th>
              <th className="border-l border-slate-200/70 py-1 pl-1 text-right"><SummaryMetricHeader label="Res." /></th>
              <th className="py-1 text-right font-semibold">Acc</th>
              <th className="py-1 text-right font-semibold">Proy</th>
              <th className="py-1 text-right font-semibold">Total</th>
              <th className="py-1 text-right font-semibold">Mar.</th>
              <th className="py-1 text-center font-semibold">Est.</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.proyecto_id} className="border-b last:border-0">
                <td className="max-w-0 truncate py-1 pr-2 font-medium" title={item.proyecto}>
                  {item.proyecto}
                </td>
                <td className="truncate border-l border-slate-200/70 py-1 pl-1 text-right">
                  <SummaryAmount value={item.acumulado_ingresos} variation={item.variacion_ingresos_pct} />
                </td>
                <td className="truncate border-l border-slate-200/70 py-1 pl-1 text-right">
                  <SummaryAmount value={item.acumulado_egresos} variation={item.variacion_egresos_pct} />
                </td>
                <td className="truncate border-l border-slate-200/70 py-1 pl-1 text-right">
                  <SummaryAmount
                    value={item.acumulado_resultado}
                    variation={item.variacion_resultado_pct}
                    strong
                    valueClassName={item.acumulado_resultado >= 0 ? "text-emerald-700" : "text-rose-700"}
                  />
                </td>
                <td className="truncate py-1 text-right">{formatMillions(item.ventana_abierta_real)}</td>
                <td className="truncate py-1 text-right">{formatMillions(item.ventana_abierta_presupuestado)}</td>
                <td className="truncate py-1 text-right font-semibold">{formatMillions(item.ventana_abierta_total)}</td>
                <td className="truncate py-1 text-right">{formatPercent(item.margen_total_esperado)}</td>
                <td className="py-1 text-center">
                  <span
                    className={cn("inline-block h-2 w-2 rounded-full", marginStatusClass(item.margen_total_esperado))}
                    title={`Margen esperado: ${formatPercent(item.margen_total_esperado)}`}
                  />
                </td>
              </tr>
            ))}
            {data.length ? (
              <tr className="sticky bottom-0 border-t bg-slate-50 font-bold">
                <td className="py-1">TOTAL</td>
                <td className="truncate border-l border-slate-200/70 py-1 pl-1 text-right">{formatMillions(totals.ingresos)}</td>
                <td className="truncate border-l border-slate-200/70 py-1 pl-1 text-right">{formatMillions(totals.egresos)}</td>
                <td className="truncate border-l border-slate-200/70 py-1 pl-1 text-right">{formatMillions(totals.resultado)}</td>
                <td className="truncate py-1 text-right">{formatMillions(totals.accReal)}</td>
                <td className="truncate py-1 text-right">{formatMillions(totals.proy)}</td>
                <td className="truncate py-1 text-right">{formatMillions(totals.total)}</td>
                <td className="py-1 text-right">{formatPercent(totalExpectedMargin)}</td>
                <td className="py-1" />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </SectionShell>
  );
};

const ProjectDeviationTable = ({ data }: { data: ProjectDeviationItem[] }) => {
  const MetricCells = ({
    metric,
    strong = false,
  }: {
    metric: ProjectDeviationItem["ingresos"];
    strong?: boolean;
  }) => (
    <>
      <td className="truncate py-1.5 text-right tabular-nums">{formatMillions(metric.real)}</td>
      <td className="truncate py-1.5 text-right tabular-nums text-slate-500">{formatMillions(metric.presupuestado)}</td>
      <td className="py-1.5 text-right">
        <span
          className={cn(
            "inline-flex max-w-full items-baseline justify-end gap-1 rounded-sm px-1 py-0.5 tabular-nums",
            metric.dif >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
            strong && "font-semibold",
          )}
        >
          <span className="min-w-0 truncate">{formatMillions(metric.dif)}</span>
        </span>
      </td>
    </>
  );

  return (
    <SectionShell className="flex h-full flex-col p-1.5">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <div className="text-xs font-semibold">Desvios por proyecto</div>
        <div className="text-[8px] text-muted-foreground">Real vs presupuesto</div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-100">
        <table className="w-full min-w-[600px] table-fixed text-left text-[7px]">
          <colgroup>
            <col className="w-[16%]" />
            {Array.from({ length: 9 }).map((_, index) => (
              <col key={index} className="w-[9.33%]" />
            ))}
          </colgroup>
          <thead className="text-[7.5px] text-muted-foreground">
            <tr className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50">
              <th rowSpan={2} className="px-1.5 py-1 text-left font-semibold">Proyecto</th>
              <th colSpan={3} className="border-l border-slate-200/70 py-1 text-center font-semibold text-slate-600">Ingreso</th>
              <th colSpan={3} className="border-l border-slate-200/70 py-1 text-center font-semibold text-slate-600">Egreso</th>
              <th colSpan={3} className="border-l border-slate-200/70 py-1 text-center font-semibold text-slate-600">Resultado</th>
            </tr>
            <tr className="sticky top-[21px] z-10 border-b border-slate-100 bg-slate-50">
              {["Real", "Pres", "Dif", "Real", "Pres", "Dif", "Real", "Pres", "Dif"].map((label, index) => (
                <th
                  key={`${label}-${index}`}
                  className={cn("px-1 py-1 text-right font-semibold", index % 3 === 0 && "border-l border-slate-200/70")}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length ? data.map((item) => (
              <tr key={item.proyecto_id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/40 last:border-0">
                <td className="max-w-0 truncate px-1.5 py-1.5 font-medium" title={item.proyecto}>{item.proyecto}</td>
                <MetricCells metric={item.ingresos} />
                <MetricCells metric={item.egresos} />
                <MetricCells metric={item.resultado} strong />
              </tr>
            )) : (
              <tr>
                <td colSpan={10} className="py-5 text-center text-muted-foreground">
                  Sin desvios por proyecto en el periodo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionShell>
  );
};

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
