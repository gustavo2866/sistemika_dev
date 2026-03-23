"use client";

import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  FORM_FIELD_LABEL_CLASS,
  FORM_SELECT_TRIGGER_CLASS,
  PeriodRangeNavigator,
  ResourceTitle,
} from "@/components/forms/form_order";
import { cn } from "@/lib/utils";
import { getOrderStatusBadgeClass } from "@/app/resources/po/po-orders/model";
import {
  Cell,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle,
  CalendarDays,
  BarChart3,
  ChartNoAxesCombined,
  ClipboardCheck,
  ClipboardList,
  RefreshCcw,
  Receipt,
  ShoppingCart,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import { PO_DASHBOARD_KPI_CARDS, formatCurrency, formatCurrencyMillions, formatDateValue, formatInteger, formatPercent, type PoDashboardDetailItem, type PoDashboardKpiKey } from "./model";
import { usePoDashboard } from "./use-po-dashboard";

const KPI_ACCENT_CLASSES: Record<PoDashboardKpiKey, string> = {
  pendientes: "bg-slate-500",
  solicitadas: "bg-amber-500",
  emitidas: "bg-sky-500",
  en_proceso: "bg-emerald-500",
  facturadas: "bg-violet-500",
};

const KPI_ICON_CLASSES: Record<PoDashboardKpiKey, string> = {
  pendientes: "text-slate-600",
  solicitadas: "text-amber-600",
  emitidas: "text-sky-600",
  en_proceso: "text-emerald-600",
  facturadas: "text-violet-600",
};

const getOrderIdLabel = (item: PoDashboardDetailItem) =>
  item.order?.id ? String(item.order.id).padStart(6, "0") : "-";

const getProveedorLabel = (item: PoDashboardDetailItem) =>
  item.order?.proveedor?.nombre ?? "Sin proveedor";

const getSolicitanteLabel = (item: PoDashboardDetailItem) =>
  item.order?.solicitante?.nombre ?? "Sin solicitante";

const KpiCard = ({
  title,
  count,
  amount,
  icon: Icon,
  accentClassName,
  iconClassName,
  selected,
  onSelect,
}: {
  title: string;
  count: number;
  amount: number;
  icon: any;
  accentClassName: string;
  iconClassName: string;
  selected: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={cn(
      "flex w-full flex-col overflow-hidden rounded-lg border bg-white text-left shadow-sm transition-all hover:shadow-md",
      selected && "ring-2 ring-primary/30 ring-offset-1",
    )}
  >
    <div className="flex flex-1 flex-col gap-0 p-2 pb-1.5 sm:p-2.5 sm:pb-2">
      <div className="flex items-center gap-1">
        <Icon className={cn("h-3 w-3 shrink-0", iconClassName)} />
        <span className="truncate text-[10px] font-medium text-muted-foreground sm:text-[11px]">
          {title}
        </span>
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span className="text-xl font-bold leading-none tracking-tight sm:text-2xl">
          {formatInteger(count)}
        </span>
        <span className="text-[10px] font-semibold text-muted-foreground sm:text-[11px]">
          {formatCurrency(amount)}
        </span>
      </div>
    </div>
    <div className="h-[3px] w-full shrink-0 bg-slate-100">
      <div
        className={cn("h-full transition-all duration-500", accentClassName)}
        style={{ width: `${Math.min(100, Math.max(12, count > 0 ? 100 : 12))}%` }}
      />
    </div>
  </button>
);

const MINI_PIE_COLORS = ["#0f766e", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444"];

const MiniMetricCard = ({
  title,
  count,
  amount,
  variation,
}: {
  title: string;
  count: number;
  amount: number;
  variation: number;
}) => (
  <Card className="h-full border-border/70 shadow-sm">
    <CardContent className="space-y-2 p-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </div>
        <div className="mt-1 text-2xl font-bold leading-none">{formatInteger(count)}</div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-sm font-semibold">{formatCurrencyMillions(amount)}</div>
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

const MiniTopProvidersCard = ({
  rankingData,
}: {
  rankingData: Array<{ proveedor: string; amount: number; count: number }>;
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
                <div key={entry.proveedor} className="space-y-1">
                  <div className="flex items-start gap-2 text-xs">
                    <span className="w-4 shrink-0 pt-0.5 text-[10px] font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium" title={entry.proveedor}>
                        {entry.proveedor}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatInteger(entry.count)} ordenes
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

const MiniTrendCard = ({
  data,
}: {
  data: Array<{ label: string; amount: number; count: number }>;
}) => (
  <Card className="h-full border-border/70 shadow-sm">
    <CardContent className="space-y-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Evolucion
          </div>
          <div className="mt-1 text-sm font-semibold">
            {data.length ? formatCurrencyMillions(data[data.length - 1].amount) : formatCurrencyMillions(0)}
          </div>
        </div>
        <div className="text-right text-[10px] text-muted-foreground">
          Ultimos 4 periodos
        </div>
      </div>
      <div className="h-[68px]">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart data={data}>
            <Line
              type="monotone"
              dataKey="amount"
              stroke="#0f766e"
              strokeWidth={2}
              dot={{ r: 2, fill: "#0f766e" }}
              activeDot={{ r: 3 }}
            />
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

const MiniPieCard = ({
  data,
}: {
  data: Array<{ tipo_solicitud: string; amount: number; count: number }>;
}) => {
  const pieData = data.slice(0, 4);

  return (
    <Card className="h-full border-border/70 shadow-sm">
      <CardContent className="space-y-2 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Compras por tipo solicitud
        </div>
        <div className="flex items-center gap-3">
          <div className="h-[92px] w-[92px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={pieData}
                  dataKey="amount"
                  nameKey="tipo_solicitud"
                  innerRadius={18}
                  outerRadius={34}
                  paddingAngle={2}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={entry.tipo_solicitud} fill={MINI_PIE_COLORS[index % MINI_PIE_COLORS.length]} />
                  ))}
                </Pie>
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            {pieData.length === 0 ? (
              <div className="text-xs text-muted-foreground">Sin datos.</div>
            ) : (
              pieData.map((entry, index) => (
                <div key={entry.tipo_solicitud} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: MINI_PIE_COLORS[index % MINI_PIE_COLORS.length] }}
                  />
                  <span className="min-w-0 flex-1 truncate" title={entry.tipo_solicitud}>
                    {entry.tipo_solicitud}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatCurrencyMillions(entry.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const DetailOrderCard = ({
  item,
  onClick,
}: {
  item: PoDashboardDetailItem;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full rounded-md border border-border/60 bg-card px-2.5 py-1.5 text-left transition-colors hover:bg-muted/40"
  >
    <div className="grid gap-2 sm:hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[8px] font-semibold text-foreground">
            {getOrderIdLabel(item)}
          </div>
          <div className="truncate text-[8px] text-muted-foreground">
            {getProveedorLabel(item)}
          </div>
          <div className="truncate text-[8px] text-muted-foreground">
            {item.order?.titulo ?? "-"}
          </div>
        </div>
        <Badge className={`h-4.5 shrink-0 px-1.5 py-0 text-[8px] font-medium ${getOrderStatusBadgeClass(item.order?.order_status?.nombre)}`}>
          {item.order?.order_status?.nombre ?? "-"}
        </Badge>
      </div>
      <div className="flex items-center justify-between gap-2 text-[8px] text-muted-foreground">
        <span className="truncate">{getSolicitanteLabel(item)}</span>
        <span className="shrink-0 font-medium text-foreground">{formatCurrency(item.monto)}</span>
      </div>
    </div>
    <div className="hidden items-center gap-1.5 sm:grid sm:grid-cols-[54px_54px_58px_88px_64px_56px_58px]">
      <div className="truncate text-[9px] font-semibold text-foreground">
        {getOrderIdLabel(item)}
      </div>
      <div className="truncate text-[9px] text-muted-foreground">
        {formatDateValue(item.fecha_creacion)}
      </div>
      <div className="truncate text-[9px]">{getProveedorLabel(item)}</div>
      <div className="truncate text-[9px] text-muted-foreground">{item.order?.titulo ?? "-"}</div>
      <div className="truncate text-[9px] font-medium text-foreground">
        {formatCurrency(item.monto)}
      </div>
      <div>
        <Badge className={`h-4.5 px-1.5 py-0 text-[7px] font-medium ${getOrderStatusBadgeClass(item.order?.order_status?.nombre)}`}>
          {item.order?.order_status?.nombre ?? "-"}
        </Badge>
      </div>
      <div className="truncate text-[9px] text-muted-foreground">{getSolicitanteLabel(item)}</div>
    </div>
  </button>
);

export default function PoDashboardList() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;
  const {
    periodType,
    filters,
    dashboardData,
    dashboardLoading,
    detailKpi,
    detailData,
    detailLoading,
    selectedAlertKey,
    showAdditionalFilters,
    showKpis,
    previousPeriodData,
    periodTrendData,
    solicitanteOptions,
    proveedorOptions,
    tipoSolicitudOptions,
    alertItems,
    hasMoreDetail,
    applyRange,
    handleFilterChange,
    setDetailPage,
    setShowAdditionalFilters,
    setShowKpis,
    resetFilters,
    selectAlert,
    selectDetailKpi,
  } = usePoDashboard();
  const [openSections, setOpenSections] = useState<string[]>(["detalle"]);

  const rankingData = dashboardData?.ranking_proveedores ?? [];
  const currentComprasPeriodo = dashboardData?.compras_periodo ?? { count: 0, amount: 0 };
  const previousComprasPeriodo = previousPeriodData?.compras_periodo ?? { count: 0, amount: 0 };
  const comprasPeriodoVariation =
    previousComprasPeriodo.amount > 0
      ? ((currentComprasPeriodo.amount - previousComprasPeriodo.amount) / previousComprasPeriodo.amount) * 100
      : currentComprasPeriodo.amount > 0
        ? 100
        : 0;

  return (
    <div className="w-full max-w-[1180px] space-y-3 px-0 py-2 sm:space-y-4 sm:px-2 sm:py-4">
      <section>
        <Card className="border-border/70 bg-gradient-to-br from-slate-50 via-white to-slate-100/70 shadow-sm">
          <CardHeader className="space-y-2 px-0 py-1.5 sm:px-5 sm:py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <ResourceTitle
                  icon={ShoppingCart}
                  text="Dashboard OC"
                  className="text-[1.15rem] sm:text-lg md:text-[1.75rem]"
                  iconWrapperClassName="h-6 w-6 rounded-xl bg-primary/10 text-primary shadow-none sm:h-8 sm:w-8"
                  iconClassName="h-3 w-3 sm:h-4 sm:w-4"
                />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {dashboardLoading ? (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      <RefreshCcw className="h-3 w-3 animate-spin" />
                      Actualizando metricas...
                    </div>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full sm:h-12 sm:w-12"
                onClick={() => setShowKpis((current) => !current)}
                title={showKpis ? "Ocultar KPIs" : "Mostrar KPIs"}
                aria-label={showKpis ? "Ocultar KPIs" : "Mostrar KPIs"}
              >
                {showKpis ? <ChartNoAxesCombined className="size-5 sm:size-6" /> : <BarChart3 className="size-5 sm:size-6" />}
              </Button>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/95 p-1 sm:p-2">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-1.5">
                <div className="flex flex-wrap items-end gap-x-2 gap-y-1.5">
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={cn(
                        FORM_FIELD_LABEL_CLASS,
                        "text-[8px] uppercase tracking-[0.14em] text-muted-foreground sm:text-[9px]",
                      )}
                    >
                      Periodo
                    </span>
                    <PeriodRangeNavigator
                      value={{ startDate: filters.startDate, endDate: filters.endDate }}
                      periodType={periodType}
                      onChange={applyRange}
                      hideLabel
                      className="min-w-0 lg:w-fit"
                    />
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span
                      className={cn(
                        FORM_FIELD_LABEL_CLASS,
                        "text-[8px] uppercase tracking-[0.14em] text-muted-foreground sm:text-[9px]",
                      )}
                    >
                      Solicitante
                    </span>
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <div className="flex items-center gap-0.5 rounded-lg border border-border/70 bg-card p-0.5 shadow-sm sm:p-1">
                        <div className="compact-filter">
                          <Select
                            value={filters.solicitanteId}
                            onValueChange={(value) => handleFilterChange("solicitanteId", value)}
                          >
                            <SelectTrigger
                              className={cn(
                                FORM_SELECT_TRIGGER_CLASS,
                                "h-5 w-[138px] bg-background text-[8px] sm:h-6 sm:w-[170px] sm:text-[10px]",
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {solicitanteOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 shrink-0 px-0 text-[10px] sm:h-8 sm:w-8"
                        onClick={() => setShowAdditionalFilters((current) => !current)}
                        title={showAdditionalFilters ? "Ocultar filtros" : "Mas filtros"}
                        aria-label={showAdditionalFilters ? "Ocultar filtros" : "Mas filtros"}
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 shrink-0 px-0 text-[10px] sm:h-8 sm:w-8"
                        onClick={resetFilters}
                        title="Limpiar"
                        aria-label="Limpiar"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {showAdditionalFilters ? (
                <div className="mt-1.5 border-t border-border/50 pt-1.5">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="inline-flex h-5 items-center rounded-full border border-border/60 bg-muted px-2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Filtros adicionales
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid w-full gap-[1px] sm:gap-[2px]">
                      <Label
                        className={cn(
                          FORM_FIELD_LABEL_CLASS,
                          "uppercase tracking-[0.18em] text-muted-foreground",
                        )}
                      >
                        Proveedor
                      </Label>
                      <Select
                        value={filters.proveedorId}
                        onValueChange={(value) => handleFilterChange("proveedorId", value)}
                      >
                        <div className="compact-filter">
                          <SelectTrigger
                            className={cn(
                              FORM_SELECT_TRIGGER_CLASS,
                              "h-5 w-full bg-background text-[9px] sm:text-[10px]",
                            )}
                          >
                            <SelectValue />
                          </SelectTrigger>
                        </div>
                        <SelectContent>
                          {proveedorOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid w-full gap-[1px] sm:gap-[2px]">
                      <Label
                        className={cn(
                          FORM_FIELD_LABEL_CLASS,
                          "uppercase tracking-[0.18em] text-muted-foreground",
                        )}
                      >
                        Tipo solicitud
                      </Label>
                      <Select
                        value={filters.tipoSolicitudId}
                        onValueChange={(value) => handleFilterChange("tipoSolicitudId", value)}
                      >
                        <div className="compact-filter">
                          <SelectTrigger
                            className={cn(
                              FORM_SELECT_TRIGGER_CLASS,
                              "h-5 w-full bg-background text-[9px] sm:text-[10px]",
                            )}
                          >
                            <SelectValue />
                          </SelectTrigger>
                        </div>
                        <SelectContent>
                          {tipoSolicitudOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ) : null}

            </div>

            {showKpis ? (
              <div className="grid w-full gap-3 px-0 sm:px-1 md:grid-cols-2 xl:grid-cols-4">
                <MiniMetricCard
                  title="Compras del periodo"
                  count={currentComprasPeriodo.count}
                  amount={currentComprasPeriodo.amount}
                  variation={comprasPeriodoVariation}
                />
                <MiniTopProvidersCard rankingData={rankingData} />
                <MiniTrendCard data={periodTrendData} />
                <MiniPieCard data={dashboardData?.tipo_solicitud ?? []} />
              </div>
            ) : null}

          </CardHeader>
        </Card>
      </section>

      <section>
        <Card className="border-border/70 bg-gradient-to-br from-slate-50 via-white to-slate-100/70 shadow-sm">
          <CardHeader className="space-y-3 px-0 py-1.5 sm:px-5 sm:py-2.5">
            <div className="rounded-xl border border-border/60 bg-background/95 p-1 sm:p-2">
              <div className={`grid w-full grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 xl:grid-cols-5 ${dashboardLoading ? "animate-pulse" : ""}`}>
                {PO_DASHBOARD_KPI_CARDS.map((card) => {
                  const kpi = dashboardData?.kpis?.[card.key] ?? { count: 0, amount: 0 };
                  return (
                    <KpiCard
                      key={card.key}
                      title={card.title}
                      count={kpi.count}
                      amount={kpi.amount}
                      icon={card.icon}
                      accentClassName={KPI_ACCENT_CLASSES[card.key]}
                      iconClassName={KPI_ICON_CLASSES[card.key]}
                      selected={!selectedAlertKey && detailKpi === card.key}
                      onSelect={() => selectDetailKpi(card.key)}
                    />
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/95 p-1.5 sm:p-2">
              <section className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,58%)_260px]">
                <Accordion
                  type="multiple"
                  value={openSections}
                  onValueChange={setOpenSections}
                  className="h-full space-y-4"
                >
                  <AccordionItem
                    value="detalle"
                    className="h-full w-full rounded-xl border border-border/70 bg-card/80 px-2 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/50"
                  >
                    <div>
                      <AccordionTrigger className="rounded-lg px-4">
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-[13px] font-semibold">Detalle de ordenes</span>
                        </div>
                      </AccordionTrigger>
                    </div>
                    <AccordionContent className="pt-0">
                      <div className="px-2 pb-2 pt-0">
                        <div className="space-y-1.5">
                          <div className="space-y-1.5 lg:max-h-[260px] lg:overflow-y-auto lg:pr-1">
                            <div className="hidden items-center gap-1.5 px-2 text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:grid sm:grid-cols-[54px_54px_58px_88px_64px_56px_58px]">
                              <span>ID</span>
                              <span>Fecha</span>
                              <span>Proveedor</span>
                              <span>Titulo</span>
                              <span>Total</span>
                              <span>Estado</span>
                              <span>Solicitante</span>
                            </div>
                            {detailLoading ? (
                              <div className="rounded-lg border border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                                Cargando detalle...
                              </div>
                            ) : null}
                            {!detailLoading && detailData?.data?.length === 0 ? (
                              <div className="rounded-lg border border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                                No hay ordenes para mostrar.
                              </div>
                            ) : null}
                            {!detailLoading &&
                              detailData?.data?.map((item) => (
                                <DetailOrderCard
                                  key={`${item.order?.id}-${item.fecha_creacion}`}
                                  item={item}
                                  onClick={() => {
                                    if (!item.order?.id) return;
                                    navigate(`/po-orders/${item.order.id}`, { state: { returnTo } });
                                  }}
                                />
                              ))}
                          </div>

                          {!detailLoading && hasMoreDetail ? (
                            <div className="pt-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => setDetailPage((current) => current + 1)}
                              >
                                Ver mas
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <Card className="h-full border-border/70 bg-card/80 shadow-sm">
                  <CardContent className="space-y-2 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      <AlertTriangle className="h-3 w-3 text-amber-600" />
                      <span>Alarmas</span>
                    </div>
                    <div className="space-y-2">
                      {alertItems.map((alert) => {
                        const Icon = alert.icon;
                        return (
                          <button
                            key={alert.key}
                            type="button"
                            onClick={() => selectAlert(alert.key)}
                            className={cn(
                              "flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left text-[10px] font-medium transition-all",
                              selectedAlertKey === alert.key && "ring-2 ring-primary/30",
                              alert.className,
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <Icon className="h-3 w-3 shrink-0" />
                              <span className="truncate">{alert.label}</span>
                            </span>
                            <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold", alert.badgeClassName)}>
                              {formatInteger(alert.count)}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="border-t border-border/60 pt-2">
                      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        <Zap className="h-3 w-3 text-sky-600" />
                        <span>Acciones rapidas</span>
                      </div>
                      <div className="grid gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 justify-start gap-2 text-[10px]"
                          onClick={() => navigate("/po-orders-approval")}
                        >
                          <ClipboardCheck className="h-3 w-3" />
                          Aprobaciones
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 justify-start gap-2 text-[10px]"
                          onClick={() => navigate("/po-orders")}
                        >
                          <ClipboardList className="h-3 w-3" />
                          Ordenes
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 justify-start gap-2 text-[10px]"
                          onClick={() => navigate("/po-invoices")}
                        >
                          <Receipt className="h-3 w-3" />
                          Facturas
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 justify-start gap-2 text-[10px]"
                          onClick={() => navigate("/po-invoices-agenda")}
                        >
                          <CalendarDays className="h-3 w-3" />
                          Agenda pagos
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>
            </div>
          </CardHeader>
        </Card>
      </section>
    </div>
  );
}
