"use client";

import { Fragment, type ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNotify } from "ra-core";
import { ArrowDownToLine, ArrowLeft, BarChart3, ChevronDown, ChevronLeft, ChevronRight, Copy, DollarSign, Download, Eye, MoreHorizontal, Pencil, Percent, Plus, RefreshCw, RotateCcw, Trash2, Upload } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FormProvider, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
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
  PanelResponse,
  PresupuestoFilterContext,
  SyncRangeResponse,
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
const DEFAULT_PROJECT_ESTADO = "02-ejecucion";
const PROJECT_ESTADO_FILTER_CHOICES = [
  { id: "all", name: "Todos los estados" },
  ...PROYECTO_ESTADO_CHOICES,
];

type HeaderFilterChoice = {
  id: string | number;
  name: string;
};

type IncomeRealMode = "manual" | "contab";

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
  <span className="relative inline-flex h-4 items-center">
    <select
      value={value}
      className="h-4 w-[92px] appearance-none rounded-sm border-0 bg-transparent py-0 pl-1 pr-3 text-[9px] font-semibold leading-none text-slate-700 outline-none transition-colors hover:text-slate-900 focus:text-slate-900"
      title="Origen ingreso real"
      aria-label="Origen ingreso real"
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.value as IncomeRealMode)}
    >
      <option value="contab">Ingreso Contable</option>
      <option value="manual">Ingreso Manual</option>
    </select>
    <ChevronDown className="pointer-events-none absolute right-0 size-3 text-slate-700" />
  </span>
);

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
      compact ? "py-0.5 text-[8px]" : "py-1.5 text-[9px]",
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
        {formatCurrency(value ?? 0)}
      </span>
    )}
  </td>
);

const MetricVariationCell = ({
  value,
  title,
  className,
  compact = false,
  total = false,
}: {
  value: number | null;
  title: string;
  className?: string;
  compact?: boolean;
  total?: boolean;
}) => (
  <td
    className={cn(
      "w-[48px] min-w-[48px] max-w-[48px] overflow-hidden border-l border-border/40 px-1 text-right tabular-nums",
      compact ? "py-0.5 text-[8px]" : "py-1.5 text-[9px]",
      total && "font-semibold",
      getNegativeOnlyColorClass(value),
      className,
    )}
    title={title}
  >
    <span className="block truncate leading-none">{formatPercent(value)}</span>
  </td>
);

const ResultAmountWithMargin = ({
  amount,
  margin,
}: {
  amount: number;
  margin: number | null;
}) => (
  <span className="grid w-full grid-cols-[minmax(0,1fr)_34px] items-baseline gap-1 leading-none">
    <span className="min-w-0 truncate text-right">{formatCurrency(amount)}</span>
    <span
      className={cn(
        "min-w-0 truncate text-right text-[7px] tabular-nums",
        getNegativeOnlyColorClass(margin),
      )}
    >
      {formatPercent(margin)}
    </span>
  </span>
);

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
  incomeReconciliation,
  onCellSave,
  onAddRubro,
  onAddCuenta,
  compact = false,
}: PresupuestoPanelRowProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const ToggleIcon = expanded ? ChevronDown : ChevronRight;
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [draftValue, setDraftValue] = useState("");
  const [savingCell, setSavingCell] = useState<EditingCell>(null);

  const startEditing = (month: string, field: EditableField, value: number) => {
    setEditingCell({ month, field });
    setDraftValue(String(Math.abs(value)));
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setDraftValue("");
  };

  const saveEditing = async (values: MonthValues) => {
    if (!editingCell || !values.presupuesto_id || !onCellSave) return;
    const normalized = Number(String(draftValue).replace(",", "."));
    if (!Number.isFinite(normalized) || normalized < 0) {
      cancelEditing();
      return;
    }

    setSavingCell(editingCell);
    try {
      await onCellSave(values.presupuesto_id, editingCell.field, Math.abs(normalized));
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
        level === 2 && "bg-white text-muted-foreground",
      )}
    >
      <th
        scope="row"
        className={cn(
          "sticky left-0 z-10 min-w-[190px] max-w-[190px] border-l-4 border-l-transparent border-r border-border/60 bg-inherit px-1.5 py-2 text-left text-[10px] font-medium",
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
            : manualRealIngresos;
        const empleados = Number(values.empleados ?? 0);
        const resultado = ingresos - egresos;
        const realResultado = realIngresos - realEgresos;
        const variacionEgresos = getVariationPercent(realEgresos, egresos);
        const variacionIngresos = getVariationPercent(realIngresos, ingresos);
        const variacionResultado = getVariationPercent(realResultado, resultado);
        const rentabilidadReal = getProfitabilityPercent(realResultado, realIngresos);
        const rentabilidadPres = getProfitabilityPercent(resultado, ingresos);
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
            <MetricAmountCell
              value={realIngresos}
              title={`Ingreso real: ${formatCurrency(realIngresos)}`}
              compact={compact}
            />
            <MetricAmountCell
              title={`Ingreso presupuesto: ${formatCurrency(ingresos)}`}
              compact={compact}
              className="bg-muted/20"
            >
              {isEditingIngresos ? (
                <input
                  autoFocus
                  type="number"
                  min={0}
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
                  {formatCurrency(ingresos)}
                </button>
              ) : listLink ? (
                <Link
                  to={listLink}
                  className="block w-full truncate text-right hover:underline"
                >
                  {formatCurrency(ingresos)}
                </Link>
              ) : (
                <span className="block truncate leading-none">{formatCurrency(ingresos)}</span>
              )}
            </MetricAmountCell>
            <MetricVariationCell
              value={variacionIngresos}
              title={`Variacion ingreso: ${formatPercent(variacionIngresos)}`}
              compact={compact}
            />
            <MetricAmountCell
              value={realEgresos}
              title={`Egreso real: ${formatCurrency(realEgresos)}`}
              compact={compact}
            />
            <MetricAmountCell
              title={`Egreso presupuesto: ${formatCurrency(egresos)}`}
              compact={compact}
              className="bg-muted/20"
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
                  {formatCurrency(egresos)}
                </button>
              ) : listLink ? (
                <Link
                  to={listLink}
                  className="block w-full truncate text-right hover:underline"
                >
                  {formatCurrency(egresos)}
                </Link>
              ) : (
                <span className="block truncate leading-none">{formatCurrency(egresos)}</span>
              )}
            </MetricAmountCell>
            <MetricVariationCell
              value={variacionEgresos}
              title={`Variacion egreso: ${formatPercent(variacionEgresos)}`}
              compact={compact}
            />
            <MetricAmountCell
              title={`Resultado real: ${formatCurrency(realResultado)} - Rentabilidad real: ${formatPercent(rentabilidadReal)}`}
              compact={compact}
              className={compact ? undefined : "bg-slate-50/50"}
              valueClassName={getNegativeOnlyColorClass(realResultado)}
            >
              <ResultAmountWithMargin amount={realResultado} margin={rentabilidadReal} />
            </MetricAmountCell>
            <MetricAmountCell
              title={`Resultado presupuesto: ${formatCurrency(resultado)} - Rentabilidad presupuesto: ${formatPercent(rentabilidadPres)}`}
              compact={compact}
              className={compact ? "bg-muted/20" : "bg-slate-100/70"}
              valueClassName={getNegativeOnlyColorClass(resultado)}
            >
              <ResultAmountWithMargin amount={resultado} margin={rentabilidadPres} />
            </MetricAmountCell>
            <MetricVariationCell
              value={variacionResultado}
              title={`Variacion resultado: ${formatPercent(variacionResultado)}`}
              compact={compact}
              className={compact ? undefined : "bg-slate-50/50"}
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
    </tr>
  );
};

export const ErpPresupuestoPanel = () => {
  const notify = useNotify();
  const location = useLocation();
  const navigate = useNavigate();
  const todayStart = useMemo(() => toStartOfMonth(new Date()), []);
  const [startMonth, setStartMonth] = useState(
    () =>
      parsePanelMonthParam(new URLSearchParams(location.search).get("panel_mes")) ??
      todayStart,
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(
    () => new URLSearchParams(location.search).get("panel_proyecto") ?? "all",
  );
  const [selectedEstado, setSelectedEstado] = useState(
    () =>
      new URLSearchParams(location.search).get("panel_estado") ??
      DEFAULT_PROJECT_ESTADO,
  );
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [incomeRealMode, setIncomeRealMode] = useState<IncomeRealMode>("manual");

  const fechaDesde = useMemo(() => formatDateParam(startMonth), [startMonth]);
  const fechaHasta = useMemo(
    () => formatDateParam(getMonthEnd(addMonths(startMonth, MONTHS_VISIBLE - 1))),
    [startMonth],
  );

  const params = useMemo(() => {
    const search = new URLSearchParams();
    search.set("fecha_desde", fechaDesde);
    search.set("fecha_hasta", fechaHasta);
    search.set("estado", selectedEstado);
    if (selectedProjectId !== "all") {
      search.set("proyecto_id", selectedProjectId);
    }
    return search.toString();
  }, [fechaDesde, fechaHasta, selectedEstado, selectedProjectId]);
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

  const handleSyncLastSixMonths = async () => {
    const periodoDesde = addMonths(todayStart, -5);
    const periodoHasta = todayStart;

    setIsSyncing(true);
    try {
      const result = await postJsonWithAuth<SyncRangeResponse>(
        `${apiUrl}/erp/libro-diario/sync-range`,
        {
          periodo_desde: formatDateParam(periodoDesde).slice(0, 7),
          periodo_hasta: formatDateParam(periodoHasta).slice(0, 7),
        },
      );
      const rowsInserted = result.resultados.reduce(
        (total, item) => total + Number(item.rows_inserted ?? 0),
        0,
      );
      notify(
        `Sincronizados ${result.periodos.length} meses (${rowsInserted} movimientos)`,
        { type: "success" },
      );
      await refetch();
    } catch {
      notify("No se pudo sincronizar libro diario", { type: "error" });
    } finally {
      setIsSyncing(false);
    }
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
  const tableColSpan = 1 + months.length * 11;
  const hasExpandedProject = expandedProjects.size > 0;
  const totalsByMonth = useMemo(
    () =>
      months.reduce<Record<string, MonthValues>>((acc, month) => {
        acc[month] = rows.reduce<MonthValues>(
          (total, project) => {
            const values = project.months[month] ?? getEmptyMonthValues();
            const incomeRubro = project.rubros.find(isHiddenRubro);
            const realIngresos =
              incomeRealMode === "contab"
                ? Number(incomeRubro?.months[month]?.real_ingresos ?? 0)
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
    [incomeRealMode, months, rows],
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
  const navigationMonth = useMemo(
    () => formatMonthLabel(fechaDesde.slice(0, 7)),
    [fechaDesde],
  );
  const selectedMonthKey = fechaDesde.slice(0, 7);
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
  const moveVisibleMonth = (direction: -1 | 1) => {
    setStartMonth((current) => addMonths(current, direction * MONTH_NAVIGATION_STEP));
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-md border border-slate-200 bg-white shadow-xs">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-r-none"
                onClick={() => moveVisibleMonth(-1)}
                aria-label="Mes anterior"
                title="Mes anterior"
              >
                <ChevronLeft className="size-3" />
              </Button>
              <Popover open={isMonthPickerOpen} onOpenChange={setIsMonthPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-6 min-w-[132px] rounded-none border-x border-slate-200 px-2 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
                    aria-label="Seleccionar mes"
                    title="Seleccionar mes"
                  >
                    {navigationMonth}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="center" className="w-[210px] p-2">
                  <div className="grid grid-cols-3 gap-1">
                    {visibleYearMonths.map((monthOption) => (
                      <Button
                        key={monthOption.key}
                        type="button"
                        variant={
                          monthOption.key === selectedMonthKey
                            ? "default"
                            : "ghost"
                        }
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
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-l-none"
                onClick={() => moveVisibleMonth(1)}
                aria-label="Mes siguiente"
                title="Mes siguiente"
              >
                <ChevronRight className="size-3" />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => setStartMonth(todayStart)}
            >
              <RotateCcw className="mr-1 size-3.5" />
              Hoy
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={handleSyncLastSixMonths}
              disabled={isSyncing}
            >
              <RefreshCw className={cn("mr-1 size-3.5", isSyncing && "animate-spin")} />
              {isSyncing ? "Sincronizando" : "Sincronizar"}
            </Button>
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
          </div>
        </div>
        <FinancialKpiCards
          items={[
            {
              key: "ingresos",
              title: "Ingresos",
              value: panelKpis.ingresos,
              budget: panelKpis.presupuestoIngresos,
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
              deviation: panelKpis.egresos - panelKpis.presupuestoEgresos,
              icon: ArrowDownToLine,
              iconClassName: "bg-rose-600",
            },
            {
              key: "resultado",
              title: "Resultado",
              value: panelKpis.resultado,
              budget: panelKpis.presupuestoResultado,
              deviation: panelKpis.resultado - panelKpis.presupuestoResultado,
              icon: BarChart3,
              iconClassName: "bg-indigo-700",
            },
            {
              key: "margen",
              title: "Margen",
              value: panelMargin,
              valueType: "percent",
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
          <table className="w-full min-w-[1124px] table-fixed border-collapse">
            <colgroup>
              <col className="w-[190px]" />
              {months.map((month) => (
                <Fragment key={`${month}-cols`}>
                  <col className="w-[34px]" />
                  <col className="w-[84px]" />
                  <col className="w-[84px]" />
                  <col className="w-[48px]" />
                  <col className="w-[84px]" />
                  <col className="w-[84px]" />
                  <col className="w-[48px]" />
                  <col className="w-[84px]" />
                  <col className="w-[84px]" />
                  <col className="w-[48px]" />
                  <col className="w-[32px]" />
                </Fragment>
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th
                  scope="col"
                  className="sticky left-0 z-20 w-[190px] min-w-[190px] max-w-[190px] border-r border-border bg-muted/30 px-1.5 py-1.5 text-left text-[10px] font-semibold"
                >
                  Proyecto
                </th>
                {months.map((month, monthIndex) => (
                  <Fragment key={`${month}-group-headers`}>
                    <th
                      scope="col"
                      rowSpan={2}
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
                      colSpan={3}
                      className="border-l border-border/40 px-1.5 py-1.5 text-center text-[10px] font-semibold text-slate-700"
                      title={`Ingresos - ${formatMonthLabel(month)}`}
                    >
                      <div className="flex items-center justify-center">
                        <IncomeRealModeSelector
                          value={incomeRealMode}
                          onChange={setIncomeRealMode}
                        />
                      </div>
                    </th>
                    <th
                      scope="col"
                      colSpan={3}
                      className="border-l border-border/40 px-1.5 py-1.5 text-center text-[10px] font-semibold text-slate-700"
                      title={`Egresos - ${formatMonthLabel(month)}`}
                    >
                      Egresos
                    </th>
                    <th
                      scope="col"
                      colSpan={3}
                      className="border-l border-border/40 bg-slate-100 px-1.5 py-1.5 text-center text-[10px] font-semibold text-slate-900"
                      title={`Resultado - ${formatMonthLabel(month)}`}
                    >
                      Resultado
                    </th>
                    <th
                      scope="col"
                      rowSpan={2}
                      className="w-[32px] min-w-[32px] max-w-[32px] border-l border-r border-border/40 px-1 py-1"
                      aria-label="Acciones"
                    />
                  </Fragment>
                ))}
              </tr>
              <tr className="border-b border-border bg-muted/20">
                <th className="sticky left-0 z-20 border-r border-border bg-muted/20 px-1.5 py-1 text-left text-[9px] font-medium text-muted-foreground">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="min-w-0 truncate">Apertura</span>
                    {months[0] ? (
                      <button
                        type="button"
                        onClick={() => openPeriodBudgetForm(months[0])}
                        className="inline-flex h-5 shrink-0 items-center gap-0.5 rounded-sm border border-transparent px-1 text-[9px] font-medium text-slate-500 transition-colors hover:border-slate-200 hover:bg-white hover:text-slate-900"
                        title="Agregar presupuesto en otro proyecto"
                      >
                        <span>Proyecto</span>
                        <Plus className="size-2.5" />
                      </button>
                    ) : null}
                  </div>
                </th>
                {months.map((month, monthIndex) => (
                  <Fragment key={`${month}-headers`}>
                    <th className={cn("border-l border-border/40 px-1 py-1 text-right text-[9px] font-semibold text-slate-600", monthIndex > 0 && "border-l-2 border-l-slate-300")}>Real</th>
                    <th className="border-l border-border/40 px-1 py-1 text-right text-[9px] font-semibold text-slate-600">Presup</th>
                    <th className="border-l border-border/40 px-1 py-1 text-right text-[9px] font-semibold text-slate-600">Var.</th>
                    <th className="border-l border-border/40 px-1 py-1 text-right text-[9px] font-semibold text-slate-600">Real</th>
                    <th className="border-l border-border/40 px-1 py-1 text-right text-[9px] font-semibold text-slate-600">Presup</th>
                    <th className="border-l border-border/40 px-1 py-1 text-right text-[9px] font-semibold text-slate-600">Var.</th>
                    <th className="border-l border-border/40 bg-slate-100 px-1 py-1 text-right text-[9px] font-semibold text-slate-700">Real</th>
                    <th className="border-l border-border/40 bg-slate-100 px-1 py-1 text-right text-[9px] font-semibold text-slate-700">Presup</th>
                    <th className="border-l border-border/40 bg-slate-100 px-1 py-1 text-right text-[9px] font-semibold text-slate-700">Var.</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={tableColSpan}
                    className="px-3 py-8 text-center text-sm text-muted-foreground"
                  >
                    Cargando panel...
                  </td>
                </tr>
              ) : isError ? (
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
                      onClick={() => void refetch()}
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
                  const visibleRubros = project.rubros.filter(
                    (rubro) =>
                      incomeRealMode === "contab" || !isHiddenRubro(rubro),
                  );
                  const incomeRubro = project.rubros.find(isHiddenRubro);
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
                    const rubroReal = Number(
                      incomeRubro?.months[month]?.real_ingresos ?? 0,
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
            {!isLoading && !isError && rows.length > 0 ? (
              <tfoot>
                <tr className="border-t border-border bg-muted/30">
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
                        <MetricAmountCell
                          value={realIngresos}
                          title={`Ingreso real: ${formatCurrency(realIngresos)}`}
                          total
                        />
                        <MetricAmountCell
                          value={Number(values.ingresos ?? 0)}
                          title={`Ingreso presupuesto: ${formatCurrency(values.ingresos)}`}
                          className="bg-muted/20"
                          total
                        />
                        <MetricVariationCell
                          value={variacionIngresos}
                          title={`Variacion ingreso: ${formatPercent(variacionIngresos)}`}
                          total
                        />
                        <MetricAmountCell
                          value={realEgresos}
                          title={`Egreso real: ${formatCurrency(realEgresos)}`}
                          total
                        />
                        <MetricAmountCell
                          value={Number(values.egresos ?? 0)}
                          title={`Egreso presupuesto: ${formatCurrency(values.egresos)}`}
                          className="bg-muted/20"
                          total
                        />
                        <MetricVariationCell
                          value={variacionEgresos}
                          title={`Variacion egreso: ${formatPercent(variacionEgresos)}`}
                          total
                        />
                        <MetricAmountCell
                          title={`Resultado real: ${formatCurrency(realResultado)} - Rentabilidad real: ${formatPercent(rentabilidadReal)}`}
                          className="bg-slate-100 text-foreground"
                          valueClassName={getNegativeOnlyColorClass(realResultado)}
                          total
                        >
                          <ResultAmountWithMargin
                            amount={realResultado}
                            margin={rentabilidadReal}
                          />
                        </MetricAmountCell>
                        <MetricAmountCell
                          title={`Resultado presupuesto: ${formatCurrency(resultado)} - Rentabilidad presupuesto: ${formatPercent(rentabilidadPres)}`}
                          className="bg-slate-200/70 text-foreground"
                          valueClassName={getNegativeOnlyColorClass(resultado)}
                          total
                        >
                          <ResultAmountWithMargin
                            amount={resultado}
                            margin={rentabilidadPres}
                          />
                        </MetricAmountCell>
                        <MetricVariationCell
                          value={variacionResultado}
                          title={`Variacion resultado: ${formatPercent(variacionResultado)}`}
                          className="bg-slate-100"
                          total
                        />
                        <td className="w-[32px] min-w-[32px] max-w-[32px] border-l border-r border-border/40 px-1 py-1.5" />
                      </Fragment>
                    );
                  })}
                </tr>
              </tfoot>
            ) : null}
          </table>
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
