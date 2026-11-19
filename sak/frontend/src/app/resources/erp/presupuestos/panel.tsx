"use client";

import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetList, useNotify } from "ra-core";
import { ArrowDownToLine, ArrowLeft, BarChart3, CalendarDays, CalendarRange, ChevronDown, ChevronLeft, ChevronRight, Copy, DollarSign, Download, Eye, MoreHorizontal, Pencil, Percent, Plus, Trash2, Upload } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FormProvider, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FinancialKpiCards } from "@/components/financial-kpi-cards";
import { CompactSelectInput } from "@/components/forms/form_order";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { apiUrl } from "@/lib/dataProvider";
import { cn } from "@/lib/utils";
import { PROYECTO_ESTADO_CHOICES } from "@/app/resources/constructora/proyectos/model";
import type { ErpCashPeriodo } from "@/app/resources/cashflow/periodos/model";
import type {
  AnnualValues as AccumulatedValues,
  RealProject,
  RealesPanelResponse,
} from "@/app/resources/erp/reales/model";

import { BudgetClearDialog } from "./panel/BudgetClearDialog";
import { BudgetCopyDialog } from "./panel/BudgetCopyDialog";
import { BudgetExportDialog } from "./panel/BudgetExportDialog";
import {
  BudgetFormDialog,
  type BudgetFormDialogRequest,
} from "./panel/BudgetFormDialog";
import { BudgetImportDialog } from "./panel/BudgetImportDialog";
import { BudgetIncomeDialog } from "./panel/BudgetIncomeDialog";
import { MovimientosDialog } from "./panel/MovimientosDialog";
import { getHistoricalTotals, sumHistoricalTotals, type HistoricalTotals } from "./panel/history";
import type {
  BudgetClearRequest,
  BudgetCopyRequest,
  BudgetExportRequest,
  BudgetIncomeRequest,
  EditableField,
  EditingCell,
  MonthValues,
  MovimientoContext,
  MovimientoRequest,
  MovimientoResponse,
  PanelProjectsResponse,
  PanelProject,
  PanelResponse,
  PresupuestoFilterContext,
} from "./panel/types";
import {
  addMonths,
  buildBudgetIncomeRows,
  buildBudgetIncomeRubroTotal,
  buildMovimientosUrl,
  buildPresupuestoListLink,
  deleteWithAuth,
  fetchJsonWithAuth,
  formatCurrency,
  formatDateParam,
  formatEmployees,
  formatMonthLabel,
  formatPercent,
  formatCuentaLabel,
  getEmptyMonthValues,
  getMonthEnd,
  getNegativeOnlyColorClass,
  getProfitabilityPercent,
  getVariationPercent,
  isHiddenRubro,
  patchJsonWithAuth,
  postJsonWithAuth,
  toStartOfMonth,
} from "./panel/utils";

const MONTHS_VISIBLE = 1;
const MONTH_NAVIGATION_STEP = 1;
const ANNUAL_START_YEAR = 2024;
const DEFAULT_PROJECT_ESTADO = "02-ejecucion";
const HONORARIOS_PROYECTO_CUENTA = "5.01.01.001";
const PROJECT_ESTADO_FILTER_CHOICES = [
  { id: "all", name: "Todos los estados" },
  ...PROYECTO_ESTADO_CHOICES,
];

const getContableRealIngresos = (
  project: PanelProject,
  month: string,
  includeGestion: boolean,
) => {
  const incomeRubro = project.rubros.find(isHiddenRubro);
  const contableRealIngresos = Number(
    incomeRubro?.months[month]?.real_ingresos ?? 0,
  );
  const gestionRealIngresos = Number(
    project.gestion_real_ingresos?.[month] ?? 0,
  );

  return contableRealIngresos - (includeGestion ? 0 : gestionRealIngresos);
};

type HeaderFilterChoice = {
  id: string | number;
  name: string;
};

type IncomeRealMode = "manual" | "contab";
type PanelViewMode = "monthly" | "annual";

type HeaderFiltersFormValues = {
  estado: string;
  proyecto: string;
};

const ErpPresupuestoPanelFilters = ({
  selectedEstado,
  selectedProjectId,
  projectChoices,
  onEstadoChange,
  onProjectChange,
}: {
  selectedEstado: string;
  selectedProjectId: string;
  projectChoices: HeaderFilterChoice[];
  onEstadoChange: (value: string) => void;
  onProjectChange: (value: string) => void;
}) => {
  const form = useForm<HeaderFiltersFormValues>({
    defaultValues: {
      estado: selectedEstado,
      proyecto: selectedProjectId,
    },
  });

  useEffect(() => {
    if (form.getValues("estado") !== selectedEstado) {
      form.setValue("estado", selectedEstado, { shouldDirty: false });
    }
  }, [form, selectedEstado]);

  useEffect(() => {
    if (form.getValues("proyecto") !== selectedProjectId) {
      form.setValue("proyecto", selectedProjectId, { shouldDirty: false });
    }
  }, [form, selectedProjectId]);

  return (
    <FormProvider {...form}>
      <div className="list-filters pointer-events-auto flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <div className="filter-field pointer-events-auto relative flex flex-row items-center gap-1 sm:gap-2">
          <CompactSelectInput
            source="estado"
            label="Estado"
            choices={PROJECT_ESTADO_FILTER_CHOICES}
            optionText="name"
            optionValue="id"
            disableClear
            className="w-[150px]"
            onSelectionChange={(value) => {
              onEstadoChange(value);
              onProjectChange("all");
            }}
          />
        </div>
        <div className="filter-field pointer-events-auto relative flex flex-row items-center gap-1 sm:gap-2">
          <CompactSelectInput
            source="proyecto"
            label="Proyecto"
            choices={projectChoices}
            optionText="name"
            optionValue="id"
            disableClear
            className="w-[260px]"
            onSelectionChange={onProjectChange}
          />
        </div>
      </div>
    </FormProvider>
  );
};

const parsePanelMonthParam = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return new Date(year, month - 1, 1);
};

const parseExpandedProjectParam = (value: string | null) =>
  new Set(
    (value ?? "")
      .split(",")
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0),
  );

const parseExpandedRubroParam = (value: string | null) =>
  new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );

const isPanelPeriodOpen = (month: string) => {
  const [year, monthIndex] = month.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return false;

  const closeDate = new Date(year, monthIndex, 15);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  closeDate.setHours(0, 0, 0, 0);
  return today < closeDate;
};

const IncomeRealModeSelector = ({
  value,
  onChange,
}: {
  value: IncomeRealMode;
  onChange: (value: IncomeRealMode) => void;
}) => (
  <span className="relative inline-flex h-9 items-center">
    <select
      value={value}
      className="h-9 w-[132px] appearance-none rounded-md border border-input bg-background py-0 pl-3 pr-7 text-[10px] font-medium leading-none text-slate-700 shadow-xs outline-none transition-colors hover:text-slate-900 focus:border-ring focus:text-slate-900"
      title="Origen ingreso real"
      aria-label="Origen ingreso real"
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.value as IncomeRealMode)}
    >
      <option value="contab">Ingreso Contable</option>
      <option value="manual">Ingreso Manual</option>
    </select>
    <ChevronDown className="pointer-events-none absolute right-2 size-3 text-slate-700" />
  </span>
);

type AnnualComparison = {
  real: number;
  budget: number;
};

type AnnualMonthComparison = AnnualComparison & {
  realCost: number;
  budgetCost: number;
};

const annualMillions = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatAnnualMillions = (value: number, showCurrency = true) =>
  `${showCurrency ? "$ " : ""}${annualMillions.format(Number(value || 0) / 1_000_000)} M`;

const annualMonthFormatter = new Intl.DateTimeFormat("es-AR", { month: "short" });

const formatAnnualMonth = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return annualMonthFormatter
    .format(new Date(year, monthNumber - 1, 1))
    .replace(".", "");
};

const summarizeAnnualValues = (
  monthValues: Record<string, MonthValues>,
  months: string[],
  getRealIncome?: (month: string, values: MonthValues) => number,
): AnnualMonthComparison =>
  months.reduce(
    (total, month) => {
      const values = monthValues[month] ?? getEmptyMonthValues();
      const realIncome = getRealIncome
        ? getRealIncome(month, values)
        : Number(values.real_ingresos ?? 0);
      total.real += realIncome - Number(values.real_egresos ?? 0);
      total.budget += Number(values.ingresos ?? 0) - Number(values.egresos ?? 0);
      total.realCost += Number(values.real_egresos ?? 0);
      total.budgetCost += Number(values.egresos ?? 0);
      return total;
    },
    { real: 0, budget: 0, realCost: 0, budgetCost: 0 },
  );

const monthsForYear = (year: number) =>
  Array.from({ length: 12 }, (_, month) => `${year}-${String(month + 1).padStart(2, "0")}`);

const AnnualComparisonCell = ({
  values,
  total = false,
  closed = false,
  active = false,
  useRealMargin,
  showMargin = false,
}: {
  values: AnnualMonthComparison;
  total?: boolean;
  closed?: boolean;
  active?: boolean;
  useRealMargin: boolean;
  showMargin?: boolean;
}) => (
  <td
    className={cn(
      "border-l border-border/50 px-1 py-1 text-right tabular-nums",
      closed && !total && "bg-muted/15 opacity-60",
      active && !total && "border-l-2 border-sky-300 bg-sky-50/80 dark:border-sky-800 dark:bg-sky-950/30",
      total && "border-l-2 border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800",
    )}
    title={`Real: ${formatAnnualMillions(values.real)} · Presupuestado: ${formatAnnualMillions(values.budget)}`}
  >
    <span className={cn("flex items-center justify-between gap-1 text-[9px] font-semibold leading-tight", getNegativeOnlyColorClass(values.real))}>
      <span className="text-[7px] font-medium text-muted-foreground">RE</span>
      <span>{formatAnnualMillions(values.real, false)}</span>
    </span>
    <span className={cn("mt-0.5 flex items-center justify-between gap-1 text-[9px] font-semibold leading-tight", getNegativeOnlyColorClass(values.budget))}>
      <span className="text-[7px] font-medium text-muted-foreground">PR</span>
      <span>{formatAnnualMillions(values.budget, false)}</span>
    </span>
    {showMargin && <span
      className="mt-0.5 flex items-center justify-between gap-1 text-[8px] font-medium leading-tight text-muted-foreground"
      title={`Margen sobre costo ${useRealMargin ? "real" : "presupuestado"}: resultado / egresos × 100`}
    >
      <span className="text-[7px]">MR</span>
      <span>{formatPercent(getProfitabilityPercent(
        useRealMargin ? values.real : values.budget,
        useRealMargin ? values.realCost : values.budgetCost,
      ))}</span>
    </span>}
  </td>
);

const AccumulatedCell = ({ values }: { values: AccumulatedValues }) => (
  <td
    className="border-l-2 border-slate-300 bg-slate-200/70 px-1 py-1 text-right tabular-nums dark:border-slate-700 dark:bg-slate-800"
    title={`Real: ${formatAnnualMillions(values.historico)} · Actualizado: ${formatAnnualMillions(values.actual)}`}
  >
    <span className={cn("flex items-center justify-between gap-1 text-[9px] font-semibold leading-tight", getNegativeOnlyColorClass(values.historico))}>
      <span className="text-[7px] font-medium text-muted-foreground">RE</span>
      <span>{formatAnnualMillions(values.historico)}</span>
    </span>
    <span className={cn("mt-0.5 flex items-center justify-between gap-1 text-[9px] font-semibold leading-tight", getNegativeOnlyColorClass(values.actual))}>
      <span className="text-[7px] font-medium text-muted-foreground">Ac</span>
      <span>{formatAnnualMillions(values.actual)}</span>
    </span>
  </td>
);

const AnnualTotalCell = ({
  values,
  projected,
}: {
  values: AnnualComparison;
  projected: number;
}) => (
  <td className="border-l-2 border-slate-300 bg-slate-100 px-1 py-1 text-right tabular-nums dark:border-slate-700 dark:bg-slate-800">
    {([
      ["RE", "Real", values.real],
      ["PR", "Presupuesto", values.budget],
      ["PY", "Proyectado", projected],
    ] as const).map(([label, description, value]) => (
      <span
        key={label}
        className={cn("flex items-center justify-between gap-1 text-[9px] font-semibold leading-tight", getNegativeOnlyColorClass(value))}
        title={`${description}: ${formatAnnualMillions(value)}`}
      >
        <span className="text-[7px] font-medium text-muted-foreground">{label}</span>
        <span>{formatAnnualMillions(value)}</span>
      </span>
    ))}
  </td>
);

const AnnualPanelRow = ({
  label,
  level,
  months,
  monthValues,
  expanded,
  expandable,
  onToggle,
  getRealIncome,
  closedMonths,
  activeMonth,
  realMarginMonths,
  accumulated,
}: {
  label: string;
  level: 0 | 1 | 2;
  months: string[];
  monthValues: Record<string, MonthValues>;
  expanded?: boolean;
  expandable?: boolean;
  onToggle?: () => void;
  getRealIncome?: (month: string, values: MonthValues) => number;
  closedMonths: ReadonlySet<string>;
  activeMonth: string | null;
  realMarginMonths: ReadonlySet<string>;
  accumulated: AccumulatedValues;
}) => {
  const periodValues = months.map((month) =>
    summarizeAnnualValues(monthValues, [month], getRealIncome),
  );
  const total = summarizeAnnualValues(
    monthValues,
    months,
    getRealIncome,
  );
  const projected = periodValues.reduce((value, period, index) => {
    const month = months[index];
    const useReal = activeMonth
      ? month <= activeMonth
      : closedMonths.has(month);
    return value + (useReal ? period.real : period.budget);
  }, 0);
  const rowClass = {
    0: "bg-background font-semibold hover:bg-muted/30",
    1: "bg-muted/20 font-medium hover:bg-muted/30",
    2: "bg-background text-muted-foreground hover:bg-muted/20",
  }[level];

  return (
    <tr className={cn("border-b border-border/60 transition-colors", rowClass)}>
      <td className="sticky left-0 z-[1] border-r border-border/60 bg-inherit px-1.5 py-1.5 text-[8px]">
        <div className="flex min-w-0 items-center" style={{ paddingLeft: level * 16 }}>
          {expandable ? (
            <button
              type="button"
              className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={onToggle}
              aria-label={expanded ? "Contraer" : "Expandir"}
            >
              {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
          ) : (
            <span className="block size-5 shrink-0" />
          )}
          <span className="truncate" title={label}>{label}</span>
        </div>
      </td>
      {periodValues.map((values, index) => (
        <AnnualComparisonCell
          key={months[index]}
          values={values}
          closed={closedMonths.has(months[index])}
          active={activeMonth === months[index]}
          useRealMargin={realMarginMonths.has(months[index])}
          showMargin={level === 0}
        />
      ))}
      <AnnualTotalCell values={total} projected={projected} />
      <AccumulatedCell values={accumulated} />
    </tr>
  );
};

const AnnualBudgetTable = ({
  rows,
  months,
  isLoading,
  isError,
  incomeRealMode,
  includeHonorarios,
  expandedProjects,
  expandedRubros,
  closedMonths,
  activeMonth,
  realMarginMonths,
  accumulatedRows,
  onToggleProject,
  onToggleRubro,
  onRetry,
}: {
  rows: PanelProject[];
  months: string[];
  isLoading: boolean;
  isError: boolean;
  incomeRealMode: IncomeRealMode;
  includeHonorarios: boolean;
  expandedProjects: Set<number>;
  expandedRubros: Set<string>;
  closedMonths: ReadonlySet<string>;
  activeMonth: string | null;
  realMarginMonths: ReadonlySet<string>;
  accumulatedRows: RealProject[];
  onToggleProject: (projectId: number) => void;
  onToggleRubro: (key: string) => void;
  onRetry: () => void;
}) => {
  const projectRealIncome = (project: PanelProject) =>
    (month: string, values: MonthValues) =>
      incomeRealMode === "contab"
        ? getContableRealIngresos(project, month, includeHonorarios)
        : Number(values.real_ingresos ?? 0);
  const detailRealIncome = (isContableIncomeSource: boolean) =>
    (_month: string, values: MonthValues) =>
      incomeRealMode === "contab" && !isContableIncomeSource
        ? 0
        : Number(values.real_ingresos ?? 0);
  const totalByMonth = months.map((month) =>
    rows.reduce(
      (total, project) => {
        const values = summarizeAnnualValues(
          project.months,
          [month],
          projectRealIncome(project),
        );
        total.real += values.real;
        total.budget += values.budget;
        total.realCost += values.realCost;
        total.budgetCost += values.budgetCost;
        return total;
      },
      { real: 0, budget: 0, realCost: 0, budgetCost: 0 },
    ),
  );
  const grandTotal = totalByMonth.reduce(
    (total, values) => ({
      real: total.real + values.real,
      budget: total.budget + values.budget,
    }),
    { real: 0, budget: 0 },
  );
  const accumulatedTotal = accumulatedRows.reduce(
    (total, project) => ({
      historico: total.historico + Number(project.total.historico ?? 0),
      actual: total.actual + Number(project.total.actual ?? 0),
    }),
    { historico: 0, actual: 0 },
  );
  const projectedTotal = totalByMonth.reduce((value, period, index) => {
    const month = months[index];
    const useReal = activeMonth
      ? month <= activeMonth
      : closedMonths.has(month);
    return value + (useReal ? period.real : period.budget);
  }, 0);
  const colSpan = months.length + 3;

  return (
    <table className="w-max table-fixed border-collapse">
      <colgroup>
        <col className="w-[220px]" />
        {months.map((month) => <col key={month} className="w-[68px]" />)}
        <col className="w-[100px]" />
        <col className="w-[100px]" />
      </colgroup>
      <thead>
        <tr className="border-b border-border bg-muted/30">
          <th className="sticky left-0 z-20 border-r border-border bg-muted/30 px-1.5 py-1.5 text-left text-[9px] font-semibold">
            Proyecto / Rubro / Cuenta
          </th>
          {months.map((month) => (
            <th
              key={month}
              className={cn(
                "border-l border-border/50 px-1 py-1 text-center text-[9px] font-semibold capitalize text-slate-700",
                closedMonths.has(month) && "bg-muted/15 text-muted-foreground opacity-60",
                activeMonth === month && "border-l-2 border-sky-300 bg-sky-100 text-sky-950 opacity-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
              )}
            >
              <span className="block">{formatAnnualMonth(month)}</span>
            </th>
          ))}
          <th className="border-l-2 border-slate-300 bg-slate-100 px-1 py-1 text-center text-[9px] font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800">
            <span className="block">Total Anual</span>
          </th>
          <th className="border-l-2 border-slate-300 bg-slate-200/70 px-1 py-1 text-center text-[9px] font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800">
            <span className="block">Total histórico</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {isLoading ? (
          <tr><td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-muted-foreground">Cargando panel...</td></tr>
        ) : isError ? (
          <tr>
            <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-muted-foreground">
              No se pudo cargar el panel.
              <Button type="button" variant="ghost" size="sm" className="ml-2 h-7 text-xs" onClick={onRetry}>Reintentar</Button>
            </td>
          </tr>
        ) : rows.length === 0 ? (
          <tr><td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-muted-foreground">Sin presupuestos ERP en el período.</td></tr>
        ) : rows.map((project) => {
          const projectExpanded = expandedProjects.has(project.proyecto_id);
          const accumulatedProject = accumulatedRows.find(
            (item) => item.proyecto_id === project.proyecto_id,
          );
          const visibleRubros = project.rubros.filter(
            (rubro) => incomeRealMode === "contab" || !isHiddenRubro(rubro),
          );
          return (
            <Fragment key={`annual-project-${project.proyecto_id}`}>
              <AnnualPanelRow
                label={project.proyecto_nombre}
                level={0}
                months={months}
                monthValues={project.months}
                getRealIncome={projectRealIncome(project)}
                expandable={visibleRubros.length > 0}
                expanded={projectExpanded}
                onToggle={() => onToggleProject(project.proyecto_id)}
                realMarginMonths={realMarginMonths}
                closedMonths={closedMonths}
                activeMonth={activeMonth}
                accumulated={accumulatedProject?.total ?? { historico: 0, actual: 0 }}
              />
              {projectExpanded ? visibleRubros.map((rubro) => {
                const rubroKey = `${project.proyecto_id}-${rubro.rubro_id}`;
                const rubroExpanded = expandedRubros.has(rubroKey);
                const accumulatedRubro = accumulatedProject?.rubros.find(
                  (item) => item.rubro_id === rubro.rubro_id,
                );
                return (
                  <Fragment key={`annual-rubro-${rubroKey}`}>
                    <AnnualPanelRow
                      label={rubro.rubro_nombre}
                      level={1}
                      months={months}
                      monthValues={rubro.months}
                      getRealIncome={detailRealIncome(isHiddenRubro(rubro))}
                      expandable={rubro.cuentas.length > 0}
                      expanded={rubroExpanded}
                      onToggle={() => onToggleRubro(rubroKey)}
                      realMarginMonths={realMarginMonths}
                      closedMonths={closedMonths}
                      activeMonth={activeMonth}
                      accumulated={accumulatedRubro?.total ?? { historico: 0, actual: 0 }}
                    />
                    {rubroExpanded ? rubro.cuentas.map((cuenta) => (
                      <AnnualPanelRow
                        key={`annual-account-${rubroKey}-${cuenta.cuenta_id}`}
                        label={formatCuentaLabel(cuenta)}
                        level={2}
                        months={months}
                        monthValues={cuenta.months}
                        getRealIncome={detailRealIncome(isHiddenRubro(rubro))}
                        realMarginMonths={realMarginMonths}
                        closedMonths={closedMonths}
                        activeMonth={activeMonth}
                        accumulated={
                          accumulatedRubro?.cuentas.find(
                            (item) => item.cuenta_id === cuenta.cuenta_id,
                          )?.total ?? { historico: 0, actual: 0 }
                        }
                      />
                    )) : null}
                  </Fragment>
                );
              }) : null}
            </Fragment>
          );
        })}
      </tbody>
      {!isLoading && !isError && rows.length > 0 ? (
        <tfoot>
          <tr className="border-t-2 border-slate-300 bg-muted/30 dark:border-slate-700">
            <th className="sticky left-0 z-10 border-r border-border bg-muted/30 px-1.5 py-2 text-left text-[10px] font-bold">Total</th>
            {totalByMonth.map((values, index) => (
              <AnnualComparisonCell
                key={months[index]}
                values={values}
                closed={closedMonths.has(months[index])}
                active={activeMonth === months[index]}
                useRealMargin={realMarginMonths.has(months[index])}
                showMargin
              />
            ))}
            <AnnualTotalCell values={grandTotal} projected={projectedTotal} />
            <AccumulatedCell values={accumulatedTotal} />
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
};

const metricCellClassName =
  "w-[84px] min-w-[84px] max-w-[84px] overflow-hidden border-l border-border/40 px-1.5 text-right tabular-nums";

const MetricAmountCell = ({
  value,
  title,
  children,
  className,
  valueClassName,
  compact = false,
  total = false,
}: {
  value?: number;
  title: string;
  children?: ReactNode;
  className?: string;
  valueClassName?: string;
  compact?: boolean;
  total?: boolean;
}) => (
  <td
    className={cn(
      metricCellClassName,
      compact ? "py-0 text-[8px]" : "py-0.5 text-[9px]",
      total && "font-semibold",
      className,
    )}
    title={title}
  >
    {children ?? (
      <span
        className={cn(
          "block truncate leading-none",
          total && "font-semibold",
          valueClassName,
        )}
      >
        {formatAnnualMillions(value ?? 0, false)}
      </span>
    )}
  </td>
);

const MarginPercentValue = ({ label, value, title, subdued = false }: {
  label: "V" | "C";
  value: number | null;
  title: string;
  subdued?: boolean;
}) => (
  <span
    className="grid min-w-0 grid-cols-[7px_minmax(0,1fr)] items-center gap-x-px border-l border-slate-200/70 pl-0.5 leading-3 dark:border-slate-700/60"
    title={`${title}: ${formatPercent(value)}`}
  >
    <span className="text-left text-[6px] font-semibold text-slate-400 dark:text-slate-500">{label}</span>
    <span className={cn("min-w-0 truncate text-right text-[7px] font-medium tabular-nums",
      getNegativeOnlyColorClass(value), subdued && (value === null || value >= 0) && "text-muted-foreground")}>
      {formatPercent(value)}
    </span>
  </span>
);

const MonthlyComparisonCell = ({
  real,
  budget,
  variation,
  title,
  compact = false,
  total = false,
  children,
  margins,
  budgetLabel = "Presu",
  showVariation = true,
  emphasized = true,
}: {
  real: number;
  budget: number;
  variation: number | null;
  title: string;
  compact?: boolean;
  total?: boolean;
  children?: ReactNode;
  budgetLabel?: string;
  showVariation?: boolean;
  emphasized?: boolean;
  margins?: {
    realIncome: number | null;
    realCost: number | null;
    budgetIncome: number | null;
    budgetCost: number | null;
  };
}) => (
  <MetricAmountCell
    title={`${title}: real ${formatCurrency(real)} · ${budgetLabel} ${formatCurrency(budget)}${showVariation ? ` · variación ${formatPercent(variation)}` : ""}`}
    compact={compact}
    total={total}
    className={cn(margins
      ? "w-[188px] min-w-[188px] max-w-[188px] align-top"
      : "w-[160px] min-w-[160px] max-w-[160px] align-top",
      emphasized
        ? margins
          ? "bg-sky-100/50 dark:bg-sky-950/25"
          : "bg-sky-50/50 dark:bg-sky-950/10"
        : "border-l-2 border-l-slate-200 bg-slate-50/70 dark:border-l-slate-700 dark:bg-slate-900/40")}
  >
    <span className={cn("grid items-center gap-x-1 gap-y-0 leading-[1.1]",
      compact ? "auto-rows-[minmax(11px,auto)]" : "auto-rows-[minmax(12px,auto)]",
      margins ? "grid-cols-[26px_minmax(0,1fr)_36px_36px]" : "grid-cols-[26px_minmax(0,1fr)]")}>
      <span className={cn("text-left font-medium text-muted-foreground", emphasized ? "text-[8px]" : "text-[7px]")}>Real</span>
      <span className={cn("min-w-0 truncate", getNegativeOnlyColorClass(real),
        emphasized ? "text-[10px] font-semibold tabular-nums" : "text-[8px] font-medium",
        !emphasized && real >= 0 && "text-muted-foreground")}>{formatAnnualMillions(real, false)}</span>
      {margins && <>
        <MarginPercentValue label="V" value={margins.realIncome} title="Margen real sobre ventas" subdued={!emphasized} />
        <MarginPercentValue label="C" value={margins.realCost} title="Margen real sobre costo" subdued={!emphasized} />
      </>}
      <span className={cn("text-left font-medium text-muted-foreground", emphasized ? "text-[8px]" : "text-[7px]")}>{budgetLabel}</span>
      <span className={cn("min-w-0 truncate", getNegativeOnlyColorClass(budget),
        emphasized ? "text-[10px] font-semibold tabular-nums" : "text-[8px] font-medium",
        !emphasized && budget >= 0 && "text-muted-foreground")}>
        {children ?? formatAnnualMillions(budget, false)}
      </span>
      {margins && <>
        <MarginPercentValue label="V" value={margins.budgetIncome} title={`Margen ${budgetLabel === "Ajust" ? "ajustado" : "presupuestado"} sobre ventas`} subdued={!emphasized} />
        <MarginPercentValue label="C" value={margins.budgetCost} title={`Margen ${budgetLabel === "Ajust" ? "ajustado" : "presupuestado"} sobre costo`} subdued={!emphasized} />
      </>}
      {showVariation && <>
        <span className="text-left text-[7px] font-medium text-muted-foreground">Var</span>
        <span className={cn("text-[8px] font-medium", getNegativeOnlyColorClass(variation))}>{formatPercent(variation)}</span>
        {margins && <span className="col-span-2" />}
      </>}
    </span>
  </MetricAmountCell>
);

const HistoricalComparisonCell = ({ values, compact = false, total = false }: {
  values: HistoricalTotals;
  compact?: boolean;
  total?: boolean;
}) => {
  const realResult = values.real.income - values.real.cost;
  const adjustedResult = values.adjusted.income - values.adjusted.cost;
  return (
    <MonthlyComparisonCell
      real={realResult}
      budget={adjustedResult}
      budgetLabel="Ajust"
      variation={null}
      showVariation={false}
      emphasized={false}
      title="Total histórico"
      compact={compact}
      total={total}
      margins={{
        realIncome: getProfitabilityPercent(realResult, values.real.income),
        realCost: getProfitabilityPercent(realResult, values.real.cost),
        budgetIncome: getProfitabilityPercent(adjustedResult, values.adjusted.income),
        budgetCost: getProfitabilityPercent(adjustedResult, values.adjusted.cost),
      }}
    />
  );
};

type PresupuestoPanelRowProps = {
  id: string;
  label: string;
  onLabelClick?: () => void;
  level: 0 | 1 | 2;
  months: string[];
  monthValues: Record<string, MonthValues>;
  expanded?: boolean;
  expandable?: boolean;
  onToggle?: () => void;
  editable?: boolean;
  filterContext?: PresupuestoFilterContext;
  movimientoContext: MovimientoContext;
  onRealClick?: (request: MovimientoRequest) => void;
  onExportBudget?: (request: BudgetExportRequest) => void;
  onImportBudget?: (request: BudgetExportRequest) => void;
  onCopyBudget?: (request: BudgetCopyRequest) => void;
  onClearBudget?: (request: BudgetClearRequest) => void;
  onBudgetIncome?: (request: BudgetIncomeRequest) => void;
  incomeRealMode?: IncomeRealMode;
  isContableIncomeSource?: boolean;
  incomeReconciliation?: Record<
    string,
      {
        mismatch: boolean;
        rubroReal: number;
        projectReal: number;
      }
  >;
  onCellSave?: (
    presupuestoId: number,
    field: EditableField,
    value: number,
  ) => Promise<void>;
  onAddRubro?: () => void;
  onAddCuenta?: () => void;
  compact?: boolean;
  historical: HistoricalTotals;
};

const PresupuestoPanelRow = ({
  id,
  label,
  onLabelClick,
  level,
  months,
  monthValues,
  expanded = false,
  expandable = false,
  onToggle,
  editable = false,
  filterContext,
  movimientoContext,
  onRealClick,
  onExportBudget,
  onImportBudget,
  onCopyBudget,
  onClearBudget,
  onBudgetIncome,
  incomeRealMode = "manual",
  isContableIncomeSource = false,
  incomeReconciliation,
  onCellSave,
  onAddRubro,
  onAddCuenta,
  compact = false,
  historical,
}: PresupuestoPanelRowProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const ToggleIcon = expanded ? ChevronDown : ChevronRight;
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [draftValue, setDraftValue] = useState("");
  const [savingCell, setSavingCell] = useState<EditingCell>(null);

  const startEditing = (month: string, field: EditableField, value: number) => {
    setEditingCell({ month, field });
    setDraftValue(String(field === "ingres" ? value : Math.abs(value)));
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setDraftValue("");
  };

  const saveEditing = async (values: MonthValues) => {
    if (!editingCell || !values.presupuesto_id || !onCellSave) return;
    const normalized = Number(String(draftValue).replace(",", "."));
    const allowsNegative = editingCell.field === "ingres";
    if (!Number.isFinite(normalized) || (!allowsNegative && normalized < 0)) {
      cancelEditing();
      return;
    }

    setSavingCell(editingCell);
    try {
      await onCellSave(
        values.presupuesto_id,
        editingCell.field,
        allowsNegative ? normalized : Math.abs(normalized),
      );
    } finally {
      setSavingCell(null);
      cancelEditing();
    }
  };

  return (
    <tr
      className={cn(
        "group border-b border-border/60 transition-colors hover:bg-muted/30",
        level === 0 && "bg-background",
        level === 0 &&
          expanded &&
          "border-y border-sky-200 bg-sky-50 hover:bg-sky-50",
        level === 1 && "bg-muted/20",
        level === 2 && "bg-white text-muted-foreground dark:bg-slate-950",
      )}
    >
      <th
        scope="row"
        className={cn(
          "sticky left-0 z-10 min-w-[190px] max-w-[190px] border-l-4 border-l-transparent border-r border-border/60 bg-inherit px-1.5 py-1 text-left text-[10px] font-medium",
          level === 0 && "text-[10px] font-semibold",
          level === 0 &&
            expanded &&
            "border-l-sky-500 bg-sky-50 font-semibold text-foreground",
          level === 1 && "border-l-slate-200 bg-muted/10 pl-5",
          level === 2 && "border-l-slate-100 pl-8 text-[9px] font-normal text-muted-foreground",
          compact && "py-0.5 text-[9px]",
        )}
      >
        <div className="flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {expandable ? (
              <button
                type="button"
                onClick={onToggle}
                className={cn(
                  "inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
                  level === 0 && expanded && "text-slate-900",
                  compact && "size-4",
                )}
                aria-expanded={expanded}
                aria-controls={id}
              >
                <ToggleIcon className={cn("size-3.5", compact && "size-3")} />
              </button>
            ) : (
              <span className={cn("size-5 shrink-0", compact && "size-4")} />
            )}
            {onLabelClick ? (
              <button
                type="button"
                onClick={onLabelClick}
                className="min-w-0 truncate text-left transition-colors hover:text-sky-700 hover:underline"
                title="Editar presupuesto"
              >
                {label}
              </button>
            ) : (
              <span className="min-w-0 truncate">{label}</span>
            )}
          </div>
          {onAddRubro || onAddCuenta ? (
            <div className="flex shrink-0 items-center gap-0.5">
              {onAddRubro ? (
                <button
                  type="button"
                  onClick={onAddRubro}
                  className="inline-flex h-5 items-center gap-0.5 rounded-sm border border-transparent px-1 text-[9px] font-medium text-slate-500 transition-colors hover:border-slate-200 hover:bg-white hover:text-slate-900"
                  title="Agregar presupuesto en otro rubro"
                >
                  <span>Rubro</span>
                  <Plus className="size-2.5" />
                </button>
              ) : null}
              {onAddCuenta ? (
                <button
                  type="button"
                  onClick={onAddCuenta}
                  className="inline-flex h-5 items-center gap-0.5 rounded-sm border border-transparent px-1 text-[9px] font-medium text-slate-500 transition-colors hover:border-slate-200 hover:bg-white hover:text-slate-900"
                  title="Agregar cuenta"
                >
                  <span>Cuenta</span>
                  <Plus className="size-2.5" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </th>
      {months.map((month, monthIndex) => {
        const values = monthValues[month] ?? getEmptyMonthValues();
        const ingresos = Number(values.ingresos ?? 0);
        const egresos = Number(values.egresos ?? 0);
        const manualRealIngresos = Number(values.real_ingresos ?? 0);
        const realEgresos = Number(values.real_egresos ?? 0);
        const incomeReconciliationItem = incomeReconciliation?.[month];
        const realIngresos =
          level === 0 && incomeRealMode === "contab"
            ? Number(incomeReconciliationItem?.rubroReal ?? 0)
            : incomeRealMode === "contab" && !isContableIncomeSource
              ? 0
            : manualRealIngresos;
        const empleados = Number(values.empleados ?? 0);
        const resultado = ingresos - egresos;
        const realResultado = realIngresos - realEgresos;
        const variacionEgresos = getVariationPercent(realEgresos, egresos);
        const variacionIngresos = getVariationPercent(realIngresos, ingresos);
        const variacionResultado = getVariationPercent(realResultado, resultado);
        const rentabilidadReal = getProfitabilityPercent(realResultado, realIngresos);
        const rentabilidadPres = getProfitabilityPercent(resultado, ingresos);
        const margenCostoReal = getProfitabilityPercent(realResultado, realEgresos);
        const margenCostoPres = getProfitabilityPercent(resultado, egresos);
        const recordCount = Number(values.record_count ?? 0);
        const canEdit = editable && Boolean(values.presupuesto_id) && recordCount === 1;
        const listLink =
          editable && !canEdit && recordCount > 0
            ? buildPresupuestoListLink(month, filterContext)
            : null;
        const isEditingIngresos =
          editingCell?.month === month && editingCell.field === "ingres";
        const isEditingEgresos =
          editingCell?.month === month && editingCell.field === "egreso";
        const isEditingEmpleados =
          editingCell?.month === month && editingCell.field === "obreros_cantidad";
        const isSavingIngresos =
          savingCell?.month === month && savingCell.field === "ingres";
        const isSavingEgresos =
          savingCell?.month === month && savingCell.field === "egreso";
        const isSavingEmpleados =
          savingCell?.month === month && savingCell.field === "obreros_cantidad";
        const editProject = () => {
          const returnTo = `${location.pathname}${location.search}`;
          navigate(
            `/proyectos/${movimientoContext.proyecto_id}?returnTo=${encodeURIComponent(returnTo)}`,
          );
        };
        return (
          <Fragment key={`${id}-${month}`}>
            <td
              className={cn(
                "w-[34px] min-w-[34px] max-w-[34px] overflow-hidden whitespace-nowrap border-l border-border/40 px-1 text-center tabular-nums text-muted-foreground",
                monthIndex > 0 && "border-l-2 border-l-slate-300",
                compact ? "py-0.5 text-[8px]" : "py-1.5 text-[9px]",
              )}
              title={formatEmployees(empleados)}
            >
              {isEditingEmpleados ? (
                <input
                  autoFocus
                  type="number"
                  min={0}
                  step="0.01"
                  value={draftValue}
                  disabled={isSavingEmpleados}
                  className="h-5 w-full rounded border border-primary/30 bg-background px-1 text-center text-[9px] tabular-nums text-foreground outline-none focus:border-primary"
                  onChange={(event) => setDraftValue(event.target.value)}
                  onBlur={() => void saveEditing(values)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void saveEditing(values);
                    if (event.key === "Escape") cancelEditing();
                  }}
                />
              ) : canEdit ? (
                <button
                  type="button"
                  className="w-full text-center hover:underline"
                  onClick={() => startEditing(month, "obreros_cantidad", empleados)}
                >
                  {formatEmployees(empleados)}
                </button>
              ) : listLink ? (
                <Link
                  to={listLink}
                  className="block w-full text-center hover:underline"
                >
                  {formatEmployees(empleados)}
                </Link>
              ) : (
                formatEmployees(empleados)
              )}
            </td>
            <MonthlyComparisonCell
              real={realIngresos}
              budget={ingresos}
              variation={variacionIngresos}
              title="Ingresos"
              compact={compact}
            >
              {isEditingIngresos ? (
                <input
                  autoFocus
                  type="number"
                  step="0.01"
                  value={draftValue}
                  disabled={isSavingIngresos}
                  className="h-5 w-full rounded border border-primary/30 bg-background px-1 text-right text-[9px] tabular-nums text-foreground outline-none focus:border-primary"
                  onChange={(event) => setDraftValue(event.target.value)}
                  onBlur={() => void saveEditing(values)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void saveEditing(values);
                    if (event.key === "Escape") cancelEditing();
                  }}
                />
              ) : canEdit ? (
                <button
                  type="button"
                  className="w-full truncate text-right hover:underline"
                  onClick={() => startEditing(month, "ingres", ingresos)}
                >
                  {formatAnnualMillions(ingresos, false)}
                </button>
              ) : listLink ? (
                <Link
                  to={listLink}
                  className="block w-full truncate text-right hover:underline"
                >
                  {formatAnnualMillions(ingresos, false)}
                </Link>
              ) : (
                <span className="block truncate leading-none">{formatAnnualMillions(ingresos, false)}</span>
              )}
            </MonthlyComparisonCell>
            <MonthlyComparisonCell
              real={realEgresos}
              budget={egresos}
              variation={variacionEgresos}
              title="Egresos"
              compact={compact}
            >
              {isEditingEgresos ? (
                <input
                  autoFocus
                  type="number"
                  min={0}
                  step="0.01"
                  value={draftValue}
                  disabled={isSavingEgresos}
                  className="h-5 w-full rounded border border-primary/30 bg-background px-1 text-right text-[9px] tabular-nums text-foreground outline-none focus:border-primary"
                  onChange={(event) => setDraftValue(event.target.value)}
                  onBlur={() => void saveEditing(values)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void saveEditing(values);
                    if (event.key === "Escape") cancelEditing();
                  }}
                />
              ) : canEdit ? (
                <button
                  type="button"
                  className="w-full truncate text-right hover:underline"
                  onClick={() => startEditing(month, "egreso", egresos)}
                >
                  {formatAnnualMillions(egresos, false)}
                </button>
              ) : listLink ? (
                <Link
                  to={listLink}
                  className="block w-full truncate text-right hover:underline"
                >
                  {formatAnnualMillions(egresos, false)}
                </Link>
              ) : (
                <span className="block truncate leading-none">{formatAnnualMillions(egresos, false)}</span>
              )}
            </MonthlyComparisonCell>
            <MonthlyComparisonCell
              real={realResultado}
              budget={resultado}
              variation={variacionResultado}
              title="Resultado"
              margins={{
                realIncome: rentabilidadReal,
                realCost: margenCostoReal,
                budgetIncome: rentabilidadPres,
                budgetCost: margenCostoPres,
              }}
              compact={compact}
            />
            <td
              className={cn(
                "w-[32px] min-w-[32px] max-w-[32px] border-l border-r border-border/40 px-1 text-center",
                compact ? "py-0.5" : "py-1.5",
              )}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground opacity-30 hover:text-foreground hover:opacity-100 group-hover:opacity-100"
                    aria-label="Acciones"
                    title="Acciones"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32 p-0.5">
                  <DropdownMenuItem
                    onSelect={editProject}
                    className="gap-1 px-1.5 py-0.5 text-[10px] leading-tight"
                  >
                    <Pencil className="size-2.5" />
                    Editar proyecto
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-0.5" />
                  <DropdownMenuItem
                    disabled={!onBudgetIncome}
                    onSelect={() =>
                      onBudgetIncome?.({
                        ...movimientoContext,
                        month,
                      })
                    }
                    className="gap-1 px-1.5 py-0.5 text-[10px] leading-tight"
                  >
                    <DollarSign className="size-2.5" />
                    Cuentas
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!onRealClick}
                    onSelect={() =>
                      onRealClick?.({
                        ...movimientoContext,
                        month,
                        concepto: "egreso",
                        conceptoLabel: "Asientos",
                      })
                    }
                    className="gap-1 px-1.5 py-0.5 text-[10px] leading-tight"
                  >
                    <Eye className="size-2.5" />
                    Asientos
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-0.5" />
                  <DropdownMenuItem
                    onSelect={() =>
                      onExportBudget?.({
                        ...movimientoContext,
                        month,
                      })
                    }
                    className="gap-1 px-1.5 py-0.5 text-[10px] leading-tight"
                  >
                    <Download className="size-2.5" />
                    Exportar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      onImportBudget?.({
                        ...movimientoContext,
                        month,
                      })
                    }
                    className="gap-1 px-1.5 py-0.5 text-[10px] leading-tight"
                  >
                    <Upload className="size-2.5" />
                    Importar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      onCopyBudget?.({
                        ...movimientoContext,
                        month,
                      })
                    }
                    className="gap-1 px-1.5 py-0.5 text-[10px] leading-tight"
                  >
                    <Copy className="size-2.5" />
                    Copiar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-0.5" />
                  <DropdownMenuItem
                    onSelect={() =>
                      onClearBudget?.({
                        ...movimientoContext,
                        month,
                      })
                    }
                    className="gap-1 px-1.5 py-0.5 text-[10px] leading-tight text-rose-700 focus:text-rose-700"
                  >
                    <Trash2 className="size-2.5" />
                    Limpiar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </td>
          </Fragment>
        );
      })}
      <HistoricalComparisonCell values={historical} compact={compact} />
    </tr>
  );
};

export const ErpPresupuestoPanel = () => {
  const notify = useNotify();
  const location = useLocation();
  const navigate = useNavigate();
  const todayStart = useMemo(() => toStartOfMonth(new Date()), []);
  const initialPanelMonth = useMemo(
    () => parsePanelMonthParam(new URLSearchParams(location.search).get("panel_mes")),
    [location.search],
  );
  const closedPeriodDefaultApplied = useRef(Boolean(initialPanelMonth));
  const [startMonth, setStartMonth] = useState(
    () => initialPanelMonth ?? todayStart,
  );
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(() =>
    parseExpandedProjectParam(new URLSearchParams(location.search).get("open_projects")),
  );
  const [expandedRubros, setExpandedRubros] = useState<Set<string>>(() =>
    parseExpandedRubroParam(new URLSearchParams(location.search).get("open_rubros")),
  );
  const [movimientosRequest, setMovimientosRequest] =
    useState<MovimientoRequest | null>(null);
  const [budgetExportRequest, setBudgetExportRequest] =
    useState<BudgetExportRequest | null>(null);
  const [budgetImportRequest, setBudgetImportRequest] =
    useState<BudgetExportRequest | null>(null);
  const [budgetCopyRequest, setBudgetCopyRequest] =
    useState<BudgetCopyRequest | null>(null);
  const [budgetClearRequest, setBudgetClearRequest] =
    useState<BudgetClearRequest | null>(null);
  const [budgetIncomeRequest, setBudgetIncomeRequest] =
    useState<BudgetIncomeRequest | null>(null);
  const [budgetFormRequest, setBudgetFormRequest] =
    useState<BudgetFormDialogRequest | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState(
    () => new URLSearchParams(location.search).get("panel_proyecto") ?? "all",
  );
  const [selectedEstado, setSelectedEstado] = useState(
    () =>
      new URLSearchParams(location.search).get("panel_estado") ??
      DEFAULT_PROJECT_ESTADO,
  );
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<PanelViewMode>("monthly");
  const [incomeRealMode, setIncomeRealMode] = useState<IncomeRealMode>("contab");
  const [includeHonorarios, setIncludeHonorarios] = useState(true);

  const { data: cashPeriods = [], isPending: cashPeriodsPending } =
    useGetList<ErpCashPeriodo>("erp/cash/periodos", {
      pagination: { page: 1, perPage: 240 },
      sort: { field: "fecha_periodo", order: "DESC" },
      filter: {},
    });
  const defaultMonthlyPeriod = useMemo(
    () => {
      const latestClosedMonth = parsePanelMonthParam(
        cashPeriods.find((period) => period.estado === "CERRADO")
          ?.fecha_periodo?.slice(0, 7) ?? null,
      );
      return latestClosedMonth ? addMonths(latestClosedMonth, 1) : null;
    },
    [cashPeriods],
  );
  const closedMonthKeys = useMemo(
    () =>
      new Set(
        cashPeriods
          .filter((period) => period.estado === "CERRADO")
          .map((period) => period.fecha_periodo.slice(0, 7)),
      ),
    [cashPeriods],
  );

  const realMarginMonthKeys = useMemo(
    () => new Set(cashPeriods
      .filter((period) => period.estado === "CERRADO" || period.estado === "EN_CIERRE")
      .map((period) => period.fecha_periodo.slice(0, 7))),
    [cashPeriods],
  );

  useEffect(() => {
    if (closedPeriodDefaultApplied.current || cashPeriodsPending) return;
    closedPeriodDefaultApplied.current = true;
    if (defaultMonthlyPeriod) setStartMonth(defaultMonthlyPeriod);
  }, [cashPeriodsPending, defaultMonthlyPeriod]);

  const annualSelectedYear = Math.max(ANNUAL_START_YEAR, startMonth.getFullYear());
  const fechaDesde = useMemo(
    () =>
      viewMode === "annual"
        ? `${annualSelectedYear}-01-01`
        : formatDateParam(startMonth),
    [annualSelectedYear, startMonth, viewMode],
  );
  const fechaHasta = useMemo(
    () =>
      viewMode === "annual"
        ? `${annualSelectedYear}-12-31`
        : formatDateParam(getMonthEnd(addMonths(startMonth, MONTHS_VISIBLE - 1))),
    [annualSelectedYear, startMonth, viewMode],
  );

  const params = useMemo(() => {
    const search = new URLSearchParams();
    search.set("fecha_desde", fechaDesde);
    search.set("fecha_hasta", fechaHasta);
    search.set("estado", selectedEstado);
    search.set("incluir_honorarios", String(includeHonorarios));
    if (selectedProjectId !== "all") {
      search.set("proyecto_id", selectedProjectId);
    }
    return search.toString();
  }, [fechaDesde, fechaHasta, includeHonorarios, selectedEstado, selectedProjectId]);
  const openPeriodBudgetForm = (month: string) => {
    setBudgetFormRequest({
      mode: "create",
      month,
      label: "Nuevo presupuesto",
      initialValues: {
        fecha: `${month}-01`,
      },
    });
  };
  const openProjectBudgetForm = (
    projectId: number,
    month: string,
    label: string,
  ) => {
    setBudgetFormRequest({
      mode: "create",
      month,
      label,
      initialValues: {
        fecha: `${month}-01`,
        proyecto_id: projectId,
      },
    });
  };
  const openRubroBudgetForm = (
    projectId: number,
    rubroId: number,
    month: string,
    label: string,
  ) => {
    setBudgetFormRequest({
      mode: "create",
      month,
      label,
      initialValues: {
        fecha: `${month}-01`,
        proyecto_id: projectId,
        rubro_id: rubroId,
      },
    });
  };
  const openPresupuestoEditForm = (
    presupuestoId: number,
    month: string,
    label: string,
  ) => {
    setBudgetFormRequest({
      mode: "edit",
      id: presupuestoId,
      month,
      label,
    });
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["erp-presupuestos-panel", params],
    queryFn: () =>
      fetchJsonWithAuth<PanelResponse>(
        `${apiUrl}/erp/presupuestos/panel?${params}`,
      ),
  });

  const accumulatedParams = useMemo(() => {
    const search = new URLSearchParams();
    search.set("anio_desde", String(ANNUAL_START_YEAR));
    search.set("anio_hasta", String(annualSelectedYear));
    search.set("estado", selectedEstado);
    if (selectedProjectId !== "all") {
      search.set("proyecto_id", selectedProjectId);
    }
    return search.toString();
  }, [annualSelectedYear, selectedEstado, selectedProjectId]);
  const {
    data: accumulatedData,
    isLoading: accumulatedLoading,
    isError: accumulatedError,
    refetch: refetchAccumulated,
  } = useQuery({
    queryKey: ["erp-libro-mayor-accumulated", accumulatedParams],
    queryFn: () =>
      fetchJsonWithAuth<RealesPanelResponse>(
        `${apiUrl}/erp/libro-mayor/panel?${accumulatedParams}`,
      ),
  });

  const { data: projectsData } = useQuery({
    queryKey: ["erp-presupuestos-panel-proyectos", selectedEstado],
    queryFn: () =>
      fetchJsonWithAuth<PanelProjectsResponse>(
        `${apiUrl}/erp/presupuestos/panel/proyectos?estado=${encodeURIComponent(
          selectedEstado,
        )}`,
      ),
  });

  const {
    data: movimientosData,
    isLoading: movimientosLoading,
    isError: movimientosError,
  } = useQuery({
    queryKey: ["erp-presupuestos-panel-movimientos", movimientosRequest],
    queryFn: () =>
      fetchJsonWithAuth<MovimientoResponse>(
        buildMovimientosUrl(movimientosRequest as MovimientoRequest),
      ),
    enabled: Boolean(movimientosRequest),
  });

  const handleCellSave = async (
    presupuestoId: number,
    field: EditableField,
    value: number,
  ) => {
    await patchJsonWithAuth(`${apiUrl}/erp/presupuestos/${presupuestoId}`, {
      [field]: value,
    });
    notify("Registro actualizado", { type: "success" });
    await refetch();
  };

  const handleBudgetIncomeConfirm = async (
    changes: Array<{
      field: "obreros" | "egreso_presupuesto" | "ingreso_presupuesto" | "ingreso_real";
      presupuestoId: number | null;
      cuentaId: number;
      value: number;
    }>,
  ) => {
    if (!budgetIncomeRequest) return;
    for (const change of changes) {
      if (change.field === "ingreso_real") {
        await postJsonWithAuth(`${apiUrl}/erp/presupuestos/panel/real-income`, {
          proyecto_id: budgetIncomeRequest.proyecto_id,
          periodo: budgetIncomeRequest.month,
          erp_cuenta_id: change.cuentaId,
          real_ingreso: change.value,
        });
        continue;
      }

      if (!change.presupuestoId) continue;
      const field =
        change.field === "ingreso_presupuesto"
          ? "ingres"
          : change.field === "egreso_presupuesto"
            ? "egreso"
            : "obreros_cantidad";
      await patchJsonWithAuth(`${apiUrl}/erp/presupuestos/${change.presupuestoId}`, {
        [field]: change.value,
      });
    }
    notify(`Cuentas actualizadas (${changes.length})`, { type: "success" });
    await refetch();
  };

  const handleBudgetIncomeDelete = async (presupuestoId: number) => {
    await deleteWithAuth(`${apiUrl}/erp/presupuestos/${presupuestoId}`);
    notify("Cuenta eliminada", { type: "success" });
    await refetch();
  };

  const months = useMemo(() => data?.months ?? [], [data?.months]);
  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const budgetIncomeRows = useMemo(
    () => buildBudgetIncomeRows(rows, budgetIncomeRequest),
    [rows, budgetIncomeRequest],
  );
  const budgetIncomeRubroTotal = useMemo(
    () => buildBudgetIncomeRubroTotal(rows, budgetIncomeRequest),
    [rows, budgetIncomeRequest],
  );
  const monthlyHistoricalByProject = useMemo(() => new Map(rows.map((project) => [
    project.proyecto_id,
    getHistoricalTotals(accumulatedData?.rows.find((item) => item.proyecto_id === project.proyecto_id)),
  ])), [rows, accumulatedData]);
  const monthlyHistoricalTotal = useMemo(
    () => sumHistoricalTotals([...monthlyHistoricalByProject.values()]),
    [monthlyHistoricalByProject],
  );
  const tableColSpan = 2 + months.length * 5;
  const hasExpandedProject = expandedProjects.size > 0;
  const totalsByMonth = useMemo(
    () =>
      months.reduce<Record<string, MonthValues>>((acc, month) => {
        acc[month] = rows.reduce<MonthValues>(
          (total, project) => {
            const values = project.months[month] ?? getEmptyMonthValues();
            const realIngresos =
              incomeRealMode === "contab"
                ? getContableRealIngresos(project, month, includeHonorarios)
                : Number(values.real_ingresos ?? 0);
            return {
              ingresos: total.ingresos + Number(values.ingresos ?? 0),
              egresos: total.egresos + Number(values.egresos ?? 0),
              real_ingresos: total.real_ingresos + realIngresos,
              real_egresos: total.real_egresos + Number(values.real_egresos ?? 0),
              empleados: total.empleados + Number(values.empleados ?? 0),
              presupuesto_id: null,
              record_count: total.record_count ?? 0,
            };
          },
          getEmptyMonthValues(),
        );
        return acc;
      }, {}),
    [includeHonorarios, incomeRealMode, months, rows],
  );
  const panelKpis = useMemo(
    () =>
      months.reduce(
        (acc, month) => {
          const values = totalsByMonth[month] ?? getEmptyMonthValues();
          const ingresos = Number(values.ingresos ?? 0);
          const egresos = Number(values.egresos ?? 0);
          const realIngresos = Number(values.real_ingresos ?? 0);
          const realEgresos = Number(values.real_egresos ?? 0);
          return {
            ingresos: acc.ingresos + realIngresos,
            egresos: acc.egresos + realEgresos,
            resultado: acc.resultado + realIngresos - realEgresos,
            presupuestoIngresos: acc.presupuestoIngresos + ingresos,
            presupuestoEgresos: acc.presupuestoEgresos + egresos,
            presupuestoResultado: acc.presupuestoResultado + ingresos - egresos,
            empleados: acc.empleados + Number(values.empleados ?? 0),
          };
        },
        {
          ingresos: 0,
          egresos: 0,
          resultado: 0,
          presupuestoIngresos: 0,
          presupuestoEgresos: 0,
          presupuestoResultado: 0,
          empleados: 0,
        },
      ),
    [months, totalsByMonth],
  );
  const panelMargin = getProfitabilityPercent(panelKpis.resultado, panelKpis.ingresos) ?? 0;
  const panelBudgetMargin =
    getProfitabilityPercent(
      panelKpis.presupuestoResultado,
      panelKpis.presupuestoIngresos,
    ) ?? 0;
  const panelCostMargin =
    getProfitabilityPercent(panelKpis.resultado, panelKpis.egresos) ?? 0;
  const navigationLabel = useMemo(
    () =>
      viewMode === "annual"
        ? String(annualSelectedYear)
        : formatMonthLabel(fechaDesde.slice(0, 7)),
    [annualSelectedYear, fechaDesde, viewMode],
  );
  const selectedMonthKey = fechaDesde.slice(0, 7);
  const annualMonths = useMemo(
    () => monthsForYear(annualSelectedYear),
    [annualSelectedYear],
  );
  const activeCashMonth = useMemo(() => {
    const periods = [...cashPeriods].sort((left, right) =>
      left.fecha_periodo.localeCompare(right.fecha_periodo),
    );
    const activePeriod = periods.find((period) => period.estado === "EN_CIERRE")
      ?? periods.find((period) => period.estado === "ABIERTO");
    return activePeriod?.fecha_periodo.slice(0, 7) ?? null;
  }, [cashPeriods]);
  const annualYearOptions = useMemo(() => {
    const lastYear = Math.max(new Date().getFullYear(), annualSelectedYear);
    return Array.from(
      { length: lastYear - ANNUAL_START_YEAR + 1 },
      (_, index) => ANNUAL_START_YEAR + index,
    );
  }, [annualSelectedYear]);
  const visibleYearMonths = useMemo(() => {
    const year = startMonth.getFullYear();
    return Array.from({ length: 12 }, (_, monthIndex) => {
      const monthStart = new Date(year, monthIndex, 1);
      const monthKey = formatDateParam(monthStart).slice(0, 7);
      return {
        date: monthStart,
        key: monthKey,
        label: formatMonthLabel(monthKey),
      };
    });
  }, [startMonth]);
  const moveVisiblePeriod = (direction: -1 | 1) => {
    setStartMonth((current) =>
      addMonths(
        current,
        direction * (viewMode === "annual" ? 12 : MONTH_NAVIGATION_STEP),
      ),
    );
  };

  const toggleProject = (projectId: number) => {
    setExpandedProjects((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const toggleRubro = (key: string) => {
    setExpandedRubros((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleBack = () => {
    const returnTo = new URLSearchParams(location.search).get("returnTo");
    if (returnTo) {
      navigate(returnTo);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/erp/presupuestos");
  };

  return (
    <div className="max-w-[1400px] px-2 py-3 sm:p-6">
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              className="h-8 px-2 text-sm font-medium text-primary"
              onClick={handleBack}
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Volver
            </Button>
            <h1 className="text-xl font-semibold tracking-tight">Presupuestos ERP</h1>
          </div>
        </div>
        <div className="mb-1 w-full min-w-0 rounded-lg bg-muted/30 p-1 sm:mb-2 sm:p-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <ErpPresupuestoPanelFilters
              selectedEstado={selectedEstado}
              selectedProjectId={selectedProjectId}
              onEstadoChange={setSelectedEstado}
              onProjectChange={setSelectedProjectId}
              projectChoices={[
                { id: "all", name: "Todos los proyectos" },
                ...(projectsData?.rows ?? []).map((project) => ({
                  id: String(project.proyecto_id),
                  name: project.proyecto_nombre,
                })),
              ]}
            />
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-9 items-center rounded-md border border-primary/30 bg-primary/5 p-0.5 shadow-sm">
                <Button
                  type="button"
                  variant={viewMode === "monthly" ? "default" : "ghost"}
                  className="h-7 rounded px-2.5 text-[10px]"
                  onClick={() => {
                    setViewMode("monthly");
                    setIsMonthPickerOpen(false);
                    if (defaultMonthlyPeriod) setStartMonth(defaultMonthlyPeriod);
                  }}
                >
                  <CalendarDays className="size-3.5" />
                  Mensual
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "annual" ? "default" : "ghost"}
                  className="h-7 rounded px-2.5 text-[10px]"
                  onClick={() => {
                    setViewMode("annual");
                    setIsMonthPickerOpen(false);
                    setStartMonth(todayStart);
                  }}
                >
                  <CalendarRange className="size-3.5" />
                  Anual
                </Button>
              </div>
              <div className="flex h-9 items-center rounded-md border border-input bg-background shadow-xs">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-7 rounded-r-none"
                  onClick={() => moveVisiblePeriod(-1)}
                  disabled={viewMode === "annual" && annualSelectedYear <= ANNUAL_START_YEAR}
                  aria-label={viewMode === "annual" ? "Año anterior" : "Mes anterior"}
                  title={viewMode === "annual" ? "Año anterior" : "Mes anterior"}
                >
                  <ChevronLeft className="size-3" />
                </Button>
                <Popover open={isMonthPickerOpen} onOpenChange={setIsMonthPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 min-w-[132px] rounded-none border-x border-input px-2 text-[11px] font-semibold text-slate-800 hover:bg-muted/50"
                      aria-label={viewMode === "annual" ? "Seleccionar año final" : "Seleccionar mes"}
                      title={viewMode === "annual" ? "Seleccionar año final" : "Seleccionar mes"}
                    >
                      {navigationLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="center" className="w-[210px] p-2">
                    {viewMode === "annual" ? (
                      <div className="grid grid-cols-3 gap-1">
                        {annualYearOptions.map((year) => (
                          <Button
                            key={year}
                            type="button"
                            variant={year === annualSelectedYear ? "default" : "ghost"}
                            className="h-7 justify-center px-2 text-[11px]"
                            onClick={() => {
                              setStartMonth((current) => new Date(year, current.getMonth(), 1));
                              setIsMonthPickerOpen(false);
                            }}
                          >
                            {year}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-1">
                        {visibleYearMonths.map((monthOption) => (
                          <Button
                            key={monthOption.key}
                            type="button"
                            variant={monthOption.key === selectedMonthKey ? "default" : "ghost"}
                            className="h-7 justify-center px-2 text-[11px] capitalize"
                            onClick={() => {
                              setStartMonth(monthOption.date);
                              setIsMonthPickerOpen(false);
                            }}
                          >
                            {monthOption.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-7 rounded-l-none"
                  onClick={() => moveVisiblePeriod(1)}
                  aria-label={viewMode === "annual" ? "Año siguiente" : "Mes siguiente"}
                  title={viewMode === "annual" ? "Año siguiente" : "Mes siguiente"}
                >
                  <ChevronRight className="size-3" />
                </Button>
              </div>
              <label
                htmlFor="incluir-honorarios-proyecto"
                className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium text-slate-700 shadow-xs"
                title={`Incluir o excluir la cuenta ${HONORARIOS_PROYECTO_CUENTA} de todos los totales del panel`}
              >
                <Switch
                  id="incluir-honorarios-proyecto"
                  checked={includeHonorarios}
                  onCheckedChange={setIncludeHonorarios}
                  aria-label={`Incluir cuenta ${HONORARIOS_PROYECTO_CUENTA}`}
                />
                <span>Gestión</span>
              </label>
              <IncomeRealModeSelector
                value={incomeRealMode}
                onChange={setIncomeRealMode}
              />
            </div>
          </div>
        </div>
        <FinancialKpiCards
          items={[
            {
              key: "ingresos",
              title: "Ingresos",
              value: panelKpis.ingresos,
              budget: panelKpis.presupuestoIngresos,
              emphasizeBudget: true,
              deviation: panelKpis.ingresos - panelKpis.presupuestoIngresos,
              icon: DollarSign,
              iconClassName: "bg-emerald-600",
            },
            {
              key: "egresos",
              title: "Egresos",
              value: panelKpis.egresos,
              detail: `${formatEmployees(panelKpis.empleados)} personas`,
              detailTitle: `Total personas: ${formatEmployees(panelKpis.empleados)}`,
              budget: panelKpis.presupuestoEgresos,
              emphasizeBudget: true,
              deviation: panelKpis.egresos - panelKpis.presupuestoEgresos,
              icon: ArrowDownToLine,
              iconClassName: "bg-rose-600",
            },
            {
              key: "resultado",
              title: "Resultado",
              value: panelKpis.resultado,
              budget: panelKpis.presupuestoResultado,
              emphasizeBudget: true,
              deviation: panelKpis.resultado - panelKpis.presupuestoResultado,
              icon: BarChart3,
              iconClassName: "bg-indigo-700",
            },
            {
              key: "margen",
              title: "Margen / ingreso",
              value: panelMargin,
              valueType: "percent",
              secondaryMetric: {
                title: "Margen / costo",
                value: panelCostMargin,
                valueType: "percent",
              },
              budget: panelBudgetMargin,
              budgetValueType: "percent",
              deviation: panelMargin - panelBudgetMargin,
              deviationType: "points",
              showDeviationPercent: false,
              icon: Percent,
              iconClassName: "bg-amber-500",
            },
          ]}
        />
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-background">
        <div className="overflow-auto">
          {viewMode === "annual" ? (
            <AnnualBudgetTable
              rows={rows}
              months={annualMonths}
              isLoading={isLoading || accumulatedLoading}
              isError={isError || accumulatedError}
              incomeRealMode={incomeRealMode}
              includeHonorarios={includeHonorarios}
              expandedProjects={expandedProjects}
              expandedRubros={expandedRubros}
              closedMonths={closedMonthKeys}
              realMarginMonths={realMarginMonthKeys}
              activeMonth={activeCashMonth}
              accumulatedRows={accumulatedData?.rows ?? []}
              onToggleProject={toggleProject}
              onToggleRubro={toggleRubro}
              onRetry={() => {
                void refetch();
                void refetchAccumulated();
              }}
            />
          ) : (
          <table className="w-[952px] table-fixed border-collapse">
            <colgroup>
              <col className="w-[190px]" />
              {months.map((month) => (
                <Fragment key={`${month}-cols`}>
                  <col className="w-[34px]" />
                  <col className="w-[160px]" />
                  <col className="w-[160px]" />
                  <col className="w-[188px]" />
                  <col className="w-[32px]" />
                </Fragment>
              ))}
              <col className="w-[188px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th
                  scope="col"
                  className="sticky left-0 z-20 w-[190px] min-w-[190px] max-w-[190px] border-r border-border bg-muted/30 px-1.5 py-1.5 text-left text-[10px] font-semibold"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>Proyecto</span>
                    {months[0] ? (
                      <button
                        type="button"
                        onClick={() => openPeriodBudgetForm(months[0])}
                        className="inline-flex h-5 shrink-0 items-center gap-0.5 rounded-sm border border-transparent px-1 text-[9px] font-medium text-slate-500 transition-colors hover:border-slate-200 hover:bg-white hover:text-slate-900"
                        title="Agregar presupuesto en otro proyecto"
                      >
                        <span>Agregar</span>
                        <Plus className="size-2.5" />
                      </button>
                    ) : null}
                  </div>
                </th>
                {months.map((month, monthIndex) => (
                  <Fragment key={`${month}-group-headers`}>
                    <th
                      scope="col"
                      className={cn(
                        "w-[34px] min-w-[34px] max-w-[34px] border-l border-border/40 px-1 py-1.5 text-center text-[9px] font-semibold text-slate-700",
                        monthIndex > 0 && "border-l-2 border-l-slate-300",
                      )}
                      title={`Empleados - ${formatMonthLabel(month)}`}
                    >
                      Emp.
                    </th>
                    <th
                      scope="col"
                      className="border-b-2 border-l border-border/40 border-b-sky-200 bg-sky-50/70 px-1.5 py-2 text-center text-[11px] font-bold text-slate-900 dark:border-b-sky-800 dark:bg-sky-950/20 dark:text-slate-100"
                      title={`Ingresos - ${formatMonthLabel(month)}`}
                    >
                      Ingresos
                    </th>
                    <th
                      scope="col"
                      className="border-b-2 border-l border-border/40 border-b-sky-200 bg-sky-50/70 px-1.5 py-2 text-center text-[11px] font-bold text-slate-900 dark:border-b-sky-800 dark:bg-sky-950/20 dark:text-slate-100"
                      title={`Egresos - ${formatMonthLabel(month)}`}
                    >
                      Egresos
                    </th>
                    <th
                      scope="col"
                      className="border-b-2 border-l border-border/40 border-b-sky-300 bg-sky-100/70 px-1.5 py-2 text-center text-[11px] font-bold text-slate-900 dark:border-b-sky-700 dark:bg-sky-950/40 dark:text-slate-100"
                      title={`Resultado - ${formatMonthLabel(month)}`}
                    >
                      <span className="block leading-none">Resultado</span>
                      <span className="mt-px block text-[8px] font-medium leading-none text-slate-500 dark:text-slate-400">
                        <span className="capitalize">{formatAnnualMonth(month)}</span> {month.slice(2, 4)}
                      </span>
                    </th>

                    <th
                      scope="col"
                      className="w-[32px] min-w-[32px] max-w-[32px] border-l border-r border-border/40 px-1 py-1"
                      aria-label="Acciones"
                    />
                  </Fragment>
                ))}
                <th scope="col" className="border-l-2 border-slate-200 bg-slate-50 px-1.5 py-1.5 text-center text-[9px] font-medium text-muted-foreground dark:border-slate-700 dark:bg-slate-900/40">
                  Total histórico
                </th>
              </tr>

            </thead>
            <tbody>
              {isLoading || accumulatedLoading ? (
                <tr>
                  <td
                    colSpan={tableColSpan}
                    className="px-3 py-8 text-center text-sm text-muted-foreground"
                  >
                    Cargando panel...
                  </td>
                </tr>
              ) : isError || accumulatedError ? (
                <tr>
                  <td
                    colSpan={tableColSpan}
                    className="px-3 py-8 text-center text-sm text-muted-foreground"
                  >
                    No se pudo cargar el panel.
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-2 h-7 text-xs"
                      onClick={() => { void refetch(); void refetchAccumulated(); }}
                    >
                      Reintentar
                    </Button>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableColSpan}
                    className="px-3 py-8 text-center text-sm text-muted-foreground"
                  >
                    Sin presupuestos ERP en el periodo.
                  </td>
                </tr>
              ) : (
                rows.map((project) => {
                  const projectExpanded = expandedProjects.has(project.proyecto_id);
                  const compactProject = hasExpandedProject && !projectExpanded;
                  const historicalProject = accumulatedData?.rows.find(
                    (item) => item.proyecto_id === project.proyecto_id,
                  );
                  const visibleRubros = project.rubros.filter(
                    (rubro) =>
                      incomeRealMode === "contab" || !isHiddenRubro(rubro),
                  );
                  const incomeReconciliation = months.reduce<
                    Record<
                      string,
                      {
                        mismatch: boolean;
                        rubroReal: number;
                        projectReal: number;
                      }
                    >
                  >((acc, month) => {
                    const rubroReal = getContableRealIngresos(
                      project,
                      month,
                      includeHonorarios,
                    );
                    const projectReal = Number(
                      project.months[month]?.real_ingresos ?? 0,
                    );
                    acc[month] = {
                      mismatch: Math.abs(rubroReal - projectReal) >= 1,
                      rubroReal,
                      projectReal,
                    };
                    return acc;
                  }, {});
                  return (
                    <Fragment key={`project-group-${project.proyecto_id}`}>
                      <PresupuestoPanelRow
                        key={`project-${project.proyecto_id}`}
                        id={`project-${project.proyecto_id}`}
                        label={project.proyecto_nombre}
                        level={0}
                        historical={monthlyHistoricalByProject.get(project.proyecto_id)!}
                        months={months}
                        monthValues={project.months}
                        movimientoContext={{
                          proyecto_id: project.proyecto_id,
                          projectName: project.proyecto_nombre,
                          label: project.proyecto_nombre,
                        }}
                        onRealClick={setMovimientosRequest}
                        onExportBudget={setBudgetExportRequest}
                        onImportBudget={setBudgetImportRequest}
                        onCopyBudget={setBudgetCopyRequest}
                        onClearBudget={setBudgetClearRequest}
                        onBudgetIncome={setBudgetIncomeRequest}
                        incomeRealMode={incomeRealMode}
                        incomeReconciliation={incomeReconciliation}
                        expandable={visibleRubros.length > 0}
                        expanded={projectExpanded}
                        onToggle={() => toggleProject(project.proyecto_id)}
                        onAddRubro={
                          projectExpanded && months[0]
                            ? () =>
                                openProjectBudgetForm(
                                  project.proyecto_id,
                                  months[0],
                                  project.proyecto_nombre,
                                )
                            : undefined
                        }
                        compact={compactProject}
                      />
                      {projectExpanded
                        ? visibleRubros.map((rubro) => {
                            const rubroKey = `${project.proyecto_id}-${rubro.rubro_id}`;
                            const rubroExpanded = expandedRubros.has(rubroKey);
                            return (
                              <Fragment key={`rubro-group-${rubroKey}`}>
                                <PresupuestoPanelRow
                                  key={`rubro-${rubroKey}`}
                                  id={`rubro-${rubroKey}`}
                                  label={rubro.rubro_nombre}
                                  level={1}
                                  historical={getHistoricalTotals(historicalProject, rubro.rubro_id)}
                                  months={months}
                                  monthValues={rubro.months}
                                  movimientoContext={{
                                    proyecto_id: project.proyecto_id,
                                    projectName: project.proyecto_nombre,
                                    rubro_id: rubro.rubro_id,
                                    label: `${project.proyecto_nombre} / ${rubro.rubro_nombre}`,
                                  }}
                                  onRealClick={setMovimientosRequest}
                                  onExportBudget={setBudgetExportRequest}
                                  onImportBudget={setBudgetImportRequest}
                                  onCopyBudget={setBudgetCopyRequest}
                                  onClearBudget={setBudgetClearRequest}
                                  onBudgetIncome={setBudgetIncomeRequest}
                                  incomeRealMode={incomeRealMode}
                                  isContableIncomeSource={isHiddenRubro(rubro)}
                                  expandable={rubro.cuentas.length > 0}
                                  expanded={rubroExpanded}
                                  onToggle={() => toggleRubro(rubroKey)}
                                  onAddCuenta={
                                    rubroExpanded && months[0]
                                      ? () =>
                                          openRubroBudgetForm(
                                            project.proyecto_id,
                                            rubro.rubro_id,
                                            months[0],
                                            `${project.proyecto_nombre} / ${rubro.rubro_nombre}`,
                                          )
                                      : undefined
                                  }
                                />
                                {rubroExpanded
                                  ? rubro.cuentas.map((cuenta) => (
                                      <PresupuestoPanelRow
                                        key={`cuenta-${rubroKey}-${cuenta.cuenta_id}`}
                                        id={`cuenta-${rubroKey}-${cuenta.cuenta_id}`}
                                        label={formatCuentaLabel(cuenta)}
                                        onLabelClick={
                                          months[0] &&
                                          cuenta.months[months[0]]?.presupuesto_id
                                            ? () =>
                                                openPresupuestoEditForm(
                                                  Number(
                                                    cuenta.months[months[0]]
                                                      .presupuesto_id,
                                                  ),
                                                  months[0],
                                                  `${project.proyecto_nombre} / ${rubro.rubro_nombre} / ${formatCuentaLabel(cuenta)}`,
                                                )
                                            : undefined
                                        }
                                        level={2}
                                        historical={getHistoricalTotals(historicalProject, rubro.rubro_id, cuenta.cuenta_id)}
                                        months={months}
                                        monthValues={cuenta.months}
                                        movimientoContext={{
                                          proyecto_id: project.proyecto_id,
                                          projectName: project.proyecto_nombre,
                                          rubro_id: rubro.rubro_id,
                                          erp_cuenta_id: cuenta.cuenta_id,
                                          label: `${project.proyecto_nombre} / ${rubro.rubro_nombre} / ${formatCuentaLabel(cuenta)}`,
                                        }}
                                        onRealClick={setMovimientosRequest}
                                        onExportBudget={setBudgetExportRequest}
                                        onImportBudget={setBudgetImportRequest}
                                        onCopyBudget={setBudgetCopyRequest}
                                        onClearBudget={setBudgetClearRequest}
                                        onBudgetIncome={setBudgetIncomeRequest}
                                        incomeRealMode={incomeRealMode}
                                        isContableIncomeSource={isHiddenRubro(rubro)}
                                        editable
                                        filterContext={{
                                          proyecto_id: project.proyecto_id,
                                          erp_cuenta_id: cuenta.cuenta_id,
                                        }}
                                        onCellSave={handleCellSave}
                                      />
                                    ))
                                  : null}
                              </Fragment>
                            );
                          })
                        : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
            {!isLoading && !accumulatedLoading && !isError && !accumulatedError && rows.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60">
                  <th className="sticky left-0 z-10 w-[190px] min-w-[190px] max-w-[190px] border-r border-border bg-muted/30 px-1.5 py-1.5 text-left text-[10px] font-semibold">
                    Total
                  </th>
                  {months.map((month, monthIndex) => {
                    const values = totalsByMonth[month] ?? getEmptyMonthValues();
                    const resultado = Number(values.ingresos ?? 0) - Number(values.egresos ?? 0);
                    const realIngresos = Number(values.real_ingresos ?? 0);
                    const realEgresos = Number(values.real_egresos ?? 0);
                    const realResultado = realIngresos - realEgresos;
                    const variacionEgresos = getVariationPercent(
                      realEgresos,
                      Number(values.egresos ?? 0),
                    );
                    const variacionIngresos = getVariationPercent(
                      realIngresos,
                      Number(values.ingresos ?? 0),
                    );
                    const variacionResultado = getVariationPercent(realResultado, resultado);
                    const rentabilidadReal = getProfitabilityPercent(realResultado, realIngresos);
                    const rentabilidadPres = getProfitabilityPercent(
                      resultado,
                      Number(values.ingresos ?? 0),
                    );
                    const margenCostoReal = getProfitabilityPercent(
                      realResultado,
                      realEgresos,
                    );
                    const margenCostoPres = getProfitabilityPercent(
                      resultado,
                      Number(values.egresos ?? 0),
                    );
                    return (
                      <Fragment key={`total-${month}`}>
                        <td
                          className={cn(
                            "w-[34px] min-w-[34px] max-w-[34px] overflow-hidden whitespace-nowrap border-l border-border/40 px-1 py-1.5 text-center text-[9px] font-semibold tabular-nums text-muted-foreground",
                            monthIndex > 0 && "border-l-2 border-l-slate-300",
                          )}
                          title={formatEmployees(values.empleados)}
                        >
                          {formatEmployees(values.empleados)}
                        </td>
                        <MonthlyComparisonCell
                          real={realIngresos}
                          budget={Number(values.ingresos ?? 0)}
                          variation={variacionIngresos}
                          title="Ingresos"
                          total
                        />
                        <MonthlyComparisonCell
                          real={realEgresos}
                          budget={Number(values.egresos ?? 0)}
                          variation={variacionEgresos}
                          title="Egresos"
                          total
                        />
                        <MonthlyComparisonCell
                          real={realResultado}
                          budget={resultado}
                          variation={variacionResultado}
                          title="Resultado"
                          margins={{
                            realIncome: rentabilidadReal,
                            realCost: margenCostoReal,
                            budgetIncome: rentabilidadPres,
                            budgetCost: margenCostoPres,
                          }}
                          total
                        />
                        <td className="w-[32px] min-w-[32px] max-w-[32px] border-l border-r border-border/40 px-1 py-1.5" />
                      </Fragment>
                    );
                  })}
                  <HistoricalComparisonCell values={monthlyHistoricalTotal} total />
                </tr>
              </tfoot>
            ) : null}
          </table>
          )}
        </div>
      </div>

      <MovimientosDialog
        request={movimientosRequest}
        data={movimientosData}
        isLoading={movimientosLoading}
        isError={movimientosError}
        onOpenChange={(open) => {
          if (!open) setMovimientosRequest(null);
        }}
      />

      <BudgetIncomeDialog
        request={budgetIncomeRequest}
        rows={budgetIncomeRows}
        incomeRubroTotal={budgetIncomeRubroTotal}
        isOpenPeriod={
          budgetIncomeRequest ? isPanelPeriodOpen(budgetIncomeRequest.month) : false
        }
        onConfirmChanges={handleBudgetIncomeConfirm}
        onOpenIncomeMovements={(request) => {
          setMovimientosRequest(request);
        }}
        onCreateBudgetAccount={(request) => {
          setBudgetFormRequest({
            mode: "create",
            month: request.month,
            label: request.label,
            initialValues: {
              fecha: `${request.month}-01`,
              proyecto_id: request.proyecto_id,
            },
          });
        }}
        onEditBudgetAccount={(row, request) => {
          if (!row.presupuesto_id) return;
          setBudgetFormRequest({
            mode: "edit",
            id: row.presupuesto_id,
            month: request.month,
            label: row.cuenta_label,
          });
        }}
        onDeleteBudgetAccount={async (row) => {
          if (!row.presupuesto_id) return;
          await handleBudgetIncomeDelete(row.presupuesto_id);
        }}
        onOpenChange={(open) => {
          if (!open) setBudgetIncomeRequest(null);
        }}
      />

      <BudgetFormDialog
        request={budgetFormRequest}
        onSaved={async () => {
          await refetch();
        }}
        onOpenChange={(open) => {
          if (!open) setBudgetFormRequest(null);
        }}
      />

      <BudgetImportDialog
        request={budgetImportRequest}
        onImported={async () => {
          await refetch();
        }}
        onOpenChange={(open) => {
          if (!open) setBudgetImportRequest(null);
        }}
      />

      <BudgetCopyDialog
        request={budgetCopyRequest}
        onCopied={async () => {
          await refetch();
        }}
        onOpenChange={(open) => {
          if (!open) setBudgetCopyRequest(null);
        }}
      />

      <BudgetClearDialog
        request={budgetClearRequest}
        onCleared={async () => {
          await refetch();
        }}
        onOpenChange={(open) => {
          if (!open) setBudgetClearRequest(null);
        }}
      />

      <BudgetExportDialog
        request={budgetExportRequest}
        onOpenChange={(open) => {
          if (!open) setBudgetExportRequest(null);
        }}
      />
    </div>
  );
};
