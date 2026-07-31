"use client";

import { Fragment, type ReactNode, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNotify } from "ra-core";
import { ChevronDown, ChevronLeft, ChevronRight, Copy, DollarSign, Download, Eye, MoreHorizontal, Plus, RefreshCw, RotateCcw, Trash2, Upload } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { CompactRadixSelect } from "@/components/forms/compact";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiUrl } from "@/lib/dataProvider";
import { cn } from "@/lib/utils";

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
  MovimientoConcepto,
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

const ResultAmountWithProfitability = ({
  amount,
  profitability,
  profitabilityTitle,
}: {
  amount: number;
  profitability: number | null;
  profitabilityTitle: string;
}) => (
  <span className="grid w-full grid-cols-[minmax(0,1fr)_30px] items-baseline gap-1 text-[9px] leading-none tabular-nums">
    <span className="min-w-0 truncate text-right">{formatCurrency(amount)}</span>
    <span
      className={cn(
        "min-w-0 truncate text-right text-[7px] leading-none",
        getNegativeOnlyColorClass(profitability),
      )}
      title={profitabilityTitle}
    >
      {formatPercent(profitability)}
    </span>
  </span>
);

type ConceptValueCellProps = {
  primary: ReactNode;
  secondary: ReactNode;
  variation: string;
  primaryTitle: string;
  secondaryTitle: string;
  variationTitle: string;
  primaryClassName?: string;
  secondaryValueClassName?: string;
  variationClassName?: string;
  cellClassName?: string;
  secondaryClassName?: string;
  linkTo?: string | null;
  onPrimaryClick?: () => void;
  primaryIconClassName?: string;
  primaryIconTitle?: string;
  total?: boolean;
  end?: boolean;
  compact?: boolean;
  narrow?: boolean;
  secondaryLabel?: string;
  showSecondaryLabel?: boolean;
  showVariation?: boolean;
};

const ConceptValueCell = ({
  primary,
  secondary,
  variation,
  primaryTitle,
  secondaryTitle,
  variationTitle,
  primaryClassName,
  secondaryValueClassName,
  variationClassName,
  cellClassName,
  secondaryClassName,
  linkTo,
  onPrimaryClick,
  primaryIconClassName,
  primaryIconTitle = "Consultar movimientos",
  total = false,
  end = false,
  compact = false,
  narrow = false,
  secondaryLabel = "Pres",
  showSecondaryLabel = true,
  showVariation = true,
}: ConceptValueCellProps) => {
  const content = (
    <div className={cn("flex w-full flex-col", compact ? "gap-0" : "gap-0.5")}>
      <div
        className={cn(
          "min-w-0 truncate text-right text-foreground",
          total && "font-semibold",
          primaryClassName,
        )}
        title={primaryTitle}
      >
        {onPrimaryClick ? (
          <span className="grid w-full grid-cols-[minmax(0,1fr)_14px] items-center gap-1">
            <span className="min-w-0 truncate text-right text-[9px] leading-none tabular-nums">
              {primary}
            </span>
            <button
              type="button"
              className={cn(
                "inline-flex size-3.5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-sky-50 hover:text-sky-700",
                primaryIconClassName,
              )}
              aria-label={primaryIconTitle}
              title={primaryIconTitle}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onPrimaryClick();
              }}
            >
              <Eye className="size-3" aria-hidden="true" />
            </button>
          </span>
        ) : (
          <span className="text-[9px] leading-none tabular-nums">{primary}</span>
        )}
      </div>
      {!compact ? (
        <div
          className={cn(
            "rounded-sm bg-muted/60 py-px pl-1 text-[8px] leading-none text-muted-foreground",
            onPrimaryClick || total || (!showSecondaryLabel && !showVariation)
              ? "pr-0"
              : "pr-1",
            secondaryClassName,
          )}
        >
          <div
            className={cn(
              "grid items-baseline gap-1",
              onPrimaryClick
                ? showSecondaryLabel || showVariation
                  ? "grid-cols-[auto_minmax(0,1fr)_14px]"
                  : "grid-cols-[minmax(0,1fr)_14px]"
                : showSecondaryLabel || showVariation
                  ? "grid-cols-[auto_minmax(0,1fr)]"
                  : "grid-cols-[minmax(0,1fr)]",
            )}
          >
            {showSecondaryLabel || showVariation ? (
              <span className="flex min-w-0 items-baseline gap-1 whitespace-nowrap text-left">
                {showSecondaryLabel ? <span>{secondaryLabel}</span> : null}
                {showVariation ? (
                  <span
                    className={cn(
                      "text-[7px]",
                      total && "font-semibold",
                      variationClassName,
                    )}
                    title={variationTitle}
                  >
                    {variation}
                  </span>
                ) : null}
              </span>
            ) : null}
            <span
              className={cn(
                "min-w-0 truncate text-right text-[9px] leading-none tabular-nums",
                total && "font-semibold",
                secondaryValueClassName,
              )}
              title={secondaryTitle}
            >
              {secondary}
            </span>
            {onPrimaryClick ? <span aria-hidden="true" /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <td
      className={cn(
        "overflow-hidden border-l border-border/40 px-1.5 text-right tabular-nums",
        narrow
          ? "w-[124px] min-w-[124px] max-w-[124px]"
          : "w-[132px] min-w-[132px] max-w-[132px]",
        compact ? "py-0.5 text-[8px]" : "py-1.5 text-[9px]",
        total && "font-semibold",
        end && "border-r",
        cellClassName,
      )}
    >
      {linkTo ? (
        <Link to={linkTo} className="block w-full hover:underline">
          {content}
        </Link>
      ) : (
        content
      )}
    </td>
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
  incomeReconciliation,
  onCellSave,
  onAddRubro,
  onAddCuenta,
  compact = false,
}: PresupuestoPanelRowProps) => {
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
        const realIngresos = Number(values.real_ingresos ?? 0);
        const realEgresos = Number(values.real_egresos ?? 0);
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
        const incomeReconciliationItem = incomeReconciliation?.[month];
        const openMovimientos = (concepto: MovimientoConcepto, conceptoLabel: string) => {
          onRealClick?.({
            ...movimientoContext,
            month,
            concepto,
            conceptoLabel,
          });
        };
        const openProjectIncome = () => {
          onBudgetIncome?.({
            ...movimientoContext,
            month,
          });
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
            <ConceptValueCell
              primary={formatCurrency(realIngresos)}
              secondary={
                isEditingIngresos ? (
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
                  formatCurrency(ingresos)
                )
              }
              variation={formatPercent(variacionIngresos)}
              primaryTitle={`Ingreso real: ${formatCurrency(realIngresos)}`}
              secondaryTitle={`Ingreso presupuesto: ${formatCurrency(ingresos)}`}
              variationTitle={`Variacion ingreso: ${formatPercent(variacionIngresos)}`}
              onPrimaryClick={
                level === 0 && onBudgetIncome
                  ? openProjectIncome
                  : onRealClick
                    ? () => openMovimientos("ingreso", "Ingreso")
                    : undefined
              }
              primaryIconClassName={
                incomeReconciliationItem?.mismatch
                  ? "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  : undefined
              }
              primaryIconTitle={
                incomeReconciliationItem?.mismatch
                  ? `Diferencia ingresos: movimientos ${formatCurrency(
                      incomeReconciliationItem.rubroReal,
                    )} / real ${formatCurrency(incomeReconciliationItem.projectReal)}`
                  : level === 0
                    ? "Consultar carga de ingresos"
                    : "Consultar movimientos"
              }
              compact={compact}
            />
            <ConceptValueCell
              primary={formatCurrency(realEgresos)}
              secondary={
                isEditingEgresos ? (
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
                  formatCurrency(egresos)
                )
              }
              variation={formatPercent(variacionEgresos)}
              primaryTitle={`Egreso real: ${formatCurrency(realEgresos)}`}
              secondaryTitle={`Egreso presupuesto: ${formatCurrency(egresos)}`}
              variationTitle={`Variacion egreso: ${formatPercent(variacionEgresos)}`}
              onPrimaryClick={onRealClick ? () => openMovimientos("egreso", "Egreso") : undefined}
              compact={compact}
            />
            <ConceptValueCell
              primary={
                <ResultAmountWithProfitability
                  amount={realResultado}
                  profitability={rentabilidadReal}
                  profitabilityTitle={`Rentabilidad real: ${formatPercent(rentabilidadReal)}`}
                />
              }
              secondary={
                listLink ? (
                  <Link
                    to={listLink}
                    className="block w-full truncate text-right hover:underline"
                  >
                    <ResultAmountWithProfitability
                      amount={resultado}
                      profitability={rentabilidadPres}
                      profitabilityTitle={`Rentabilidad presupuesto: ${formatPercent(rentabilidadPres)}`}
                    />
                  </Link>
                ) : (
                  <ResultAmountWithProfitability
                    amount={resultado}
                    profitability={rentabilidadPres}
                    profitabilityTitle={`Rentabilidad presupuesto: ${formatPercent(rentabilidadPres)}`}
                  />
                )
              }
              variation={formatPercent(variacionResultado)}
              primaryTitle={`Resultado real: ${formatCurrency(realResultado)}`}
              secondaryTitle={`Resultado presupuesto: ${formatCurrency(resultado)}`}
              variationTitle={`Variacion resultado: ${formatPercent(variacionResultado)}`}
              primaryClassName={getNegativeOnlyColorClass(realResultado)}
              secondaryValueClassName={getNegativeOnlyColorClass(resultado)}
              variationClassName={getNegativeOnlyColorClass(variacionResultado)}
              cellClassName={compact ? undefined : "bg-slate-50/50"}
              secondaryClassName={compact ? undefined : "bg-slate-100/70"}
              compact={compact}
              narrow
              showSecondaryLabel={false}
              showVariation={false}
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
                <DropdownMenuContent align="end" className="w-28 p-0.5">
                  <DropdownMenuItem
                    disabled={ingresos <= 0}
                    onSelect={() =>
                      onBudgetIncome?.({
                        ...movimientoContext,
                        month,
                      })
                    }
                    className="gap-1 px-1.5 py-0.5 text-[10px] leading-tight"
                  >
                    <DollarSign className="size-2.5" />
                    Ingresos
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

  const fechaDesde = useMemo(() => formatDateParam(startMonth), [startMonth]);
  const fechaHasta = useMemo(
    () => formatDateParam(getMonthEnd(addMonths(startMonth, MONTHS_VISIBLE - 1))),
    [startMonth],
  );

  const params = useMemo(() => {
    const search = new URLSearchParams();
    search.set("fecha_desde", fechaDesde);
    search.set("fecha_hasta", fechaHasta);
    if (selectedProjectId !== "all") {
      search.set("proyecto_id", selectedProjectId);
    }
    return search.toString();
  }, [fechaDesde, fechaHasta, selectedProjectId]);
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
    queryKey: ["erp-presupuestos-panel-proyectos"],
    queryFn: () =>
      fetchJsonWithAuth<PanelProjectsResponse>(
        `${apiUrl}/erp/presupuestos/panel/proyectos`,
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

  const handleRealIncomeConfirm = async (
    changes: Array<{ presupuestoId: number | null; cuentaId: number; value: number }>,
  ) => {
    if (!budgetIncomeRequest) return;
    for (const change of changes) {
      await postJsonWithAuth(`${apiUrl}/erp/presupuestos/panel/real-income`, {
        proyecto_id: budgetIncomeRequest.proyecto_id,
        periodo: budgetIncomeRequest.month,
        erp_cuenta_id: change.cuentaId,
        real_ingreso: change.value,
      });
    }
    notify(`Ingreso real actualizado (${changes.length})`, { type: "success" });
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
  const tableColSpan = 1 + months.length * 5;
  const hasExpandedProject = expandedProjects.size > 0;
  const totalsByMonth = useMemo(
    () =>
      months.reduce<Record<string, MonthValues>>((acc, month) => {
        acc[month] = rows.reduce<MonthValues>(
          (total, project) => {
            const values = project.months[month] ?? getEmptyMonthValues();
            return {
              ingresos: total.ingresos + Number(values.ingresos ?? 0),
              egresos: total.egresos + Number(values.egresos ?? 0),
              real_ingresos: total.real_ingresos + Number(values.real_ingresos ?? 0),
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
    [months, rows],
  );
  const navigationMonth = useMemo(
    () => formatMonthLabel(fechaDesde.slice(0, 7)),
    [fechaDesde],
  );
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

  return (
    <div className="max-w-[1400px] px-2 py-3 sm:p-6">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            ERP
          </p>
          <h1 className="text-xl font-semibold tracking-tight">Presupuestos ERP</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CompactRadixSelect
            label={false}
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            choices={[
              { id: "all", name: "Todos los proyectos" },
              ...(projectsData?.rows ?? []).map((project) => ({
                id: String(project.proyecto_id),
                name: project.proyecto_nombre,
              })),
            ]}
            placeholder="Proyecto"
            className="compact-filter w-[240px]"
            triggerClassName="!h-6 !min-h-6 !px-2 !py-0 !text-[10px] sm:!h-6 sm:!min-h-6 sm:!px-2 sm:!py-0 sm:!text-[10px] [&_*]:!text-[10px] [&_svg]:!size-3"
          />
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
            <div className="min-w-[132px] border-x border-slate-200 px-2 text-center leading-none">
              <div className="text-[11px] font-semibold text-slate-800">{navigationMonth}</div>
            </div>
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

      <div className="overflow-hidden rounded-md border border-border bg-background">
        <div className="overflow-auto">
          <table className="w-full min-w-[1124px] table-fixed border-collapse">
            <colgroup>
              <col className="w-[190px]" />
              {months.map((month) => (
                <Fragment key={`${month}-cols`}>
                  <col className="w-[34px]" />
                  <col className="w-[132px]" />
                  <col className="w-[132px]" />
                  <col className="w-[124px]" />
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
                  <th
                    key={month}
                    scope="col"
                    colSpan={5}
                    className={cn(
                      "border-r border-border px-1.5 py-1.5 text-center text-[10px] font-semibold",
                      monthIndex > 0 && "border-l-2 border-l-slate-300",
                    )}
                  >
                    {formatMonthLabel(month)}
                  </th>
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
                    <th
                      className={cn(
                        "w-[34px] min-w-[34px] max-w-[34px] border-l border-border/40 px-1 py-1 text-center text-[9px] font-semibold text-slate-700",
                        monthIndex > 0 && "border-l-2 border-l-slate-300",
                      )}
                      title="Empleados"
                    >
                      Emp.
                    </th>
                    <th
                      className="w-[132px] min-w-[132px] max-w-[132px] border-l border-border/40 px-1.5 py-1 text-center text-[9px] font-semibold text-slate-700"
                      title="Ingreso"
                    >
                      Ingreso
                    </th>
                    <th
                      className="w-[132px] min-w-[132px] max-w-[132px] border-l border-border/40 px-1.5 py-1 text-center text-[9px] font-semibold text-slate-700"
                      title="Egreso"
                    >
                      Egreso
                    </th>
                    <th
                      className="w-[124px] min-w-[124px] max-w-[124px] border-l border-border/40 bg-slate-100 px-1.5 py-1 text-center text-[9px] font-semibold text-slate-900"
                      title="Resultado"
                    >
                      Resultado
                    </th>
                    <th
                      className="w-[32px] min-w-[32px] max-w-[32px] border-l border-r border-border/40 px-1 py-1"
                      aria-label="Acciones"
                    />
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
                  const visibleRubros = project.rubros.filter((rubro) => !isHiddenRubro(rubro));
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
                        <ConceptValueCell
                          primary={formatCurrency(realIngresos)}
                          secondary={formatCurrency(values.ingresos)}
                          variation={formatPercent(variacionIngresos)}
                          primaryTitle={`Ingreso real: ${formatCurrency(realIngresos)}`}
                          secondaryTitle={`Ingreso presupuesto: ${formatCurrency(values.ingresos)}`}
                          variationTitle={`Variacion ingreso: ${formatPercent(variacionIngresos)}`}
                          total
                        />
                        <ConceptValueCell
                          primary={formatCurrency(realEgresos)}
                          secondary={formatCurrency(values.egresos)}
                          variation={formatPercent(variacionEgresos)}
                          primaryTitle={`Egreso real: ${formatCurrency(realEgresos)}`}
                          secondaryTitle={`Egreso presupuesto: ${formatCurrency(values.egresos)}`}
                          variationTitle={`Variacion egreso: ${formatPercent(variacionEgresos)}`}
                          total
                        />
                        <ConceptValueCell
                          primary={
                            <ResultAmountWithProfitability
                              amount={realResultado}
                              profitability={rentabilidadReal}
                              profitabilityTitle={`Rentabilidad real: ${formatPercent(rentabilidadReal)}`}
                            />
                          }
                          secondary={
                            <ResultAmountWithProfitability
                              amount={resultado}
                              profitability={rentabilidadPres}
                              profitabilityTitle={`Rentabilidad presupuesto: ${formatPercent(rentabilidadPres)}`}
                            />
                          }
                          variation={formatPercent(variacionResultado)}
                          primaryTitle={`Resultado real: ${formatCurrency(realResultado)}`}
                          secondaryTitle={`Resultado presupuesto: ${formatCurrency(resultado)}`}
                          variationTitle={`Variacion resultado: ${formatPercent(variacionResultado)}`}
                          primaryClassName={getNegativeOnlyColorClass(realResultado)}
                          secondaryValueClassName={getNegativeOnlyColorClass(resultado)}
                          variationClassName={getNegativeOnlyColorClass(variacionResultado)}
                          cellClassName="bg-slate-100 text-foreground"
                          secondaryClassName="bg-slate-200/70 text-foreground"
                          total
                          narrow
                          showSecondaryLabel={false}
                          showVariation={false}
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
        onConfirmRealIncome={handleRealIncomeConfirm}
        onOpenIncomeMovements={(request) => {
          setMovimientosRequest(request);
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
