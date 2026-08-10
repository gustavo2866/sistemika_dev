"use client";

import { useEffect, useState } from "react";
import { Copy, Eye, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import type {
  BudgetIncomeRequest,
  BudgetIncomeRow,
  BudgetIncomeRubroTotal,
  MovimientoRequest,
} from "./types";
import { formatCurrency, formatEmployees, formatMonthLabel } from "./utils";

type BudgetIncomeDialogProps = {
  request: BudgetIncomeRequest | null;
  rows: BudgetIncomeRow[];
  incomeRubroTotal: BudgetIncomeRubroTotal;
  isOpenPeriod: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmChanges: (
    changes: Array<{
      field: EditableIncomeField;
      presupuestoId: number | null;
      cuentaId: number;
      value: number;
    }>,
  ) => Promise<void>;
  onOpenIncomeMovements: (request: MovimientoRequest) => void;
  onCreateBudgetAccount: (request: BudgetIncomeRequest) => void;
  onEditBudgetAccount: (row: BudgetIncomeRow, request: BudgetIncomeRequest) => void;
  onDeleteBudgetAccount: (row: BudgetIncomeRow) => Promise<void>;
};

type IncomeRowsDisplayMode = "withBudget" | "all";
type EditableIncomeField =
  | "obreros"
  | "egreso_presupuesto"
  | "ingreso_presupuesto"
  | "ingreso_real";

const getIncomeRowKey = (row: BudgetIncomeRow) =>
  row.presupuesto_id ? String(row.presupuesto_id) : `cuenta-${row.cuenta_id}`;
const getEditableKey = (row: BudgetIncomeRow, field: EditableIncomeField) =>
  `${getIncomeRowKey(row)}:${field}`;
const getEditableValue = (row: BudgetIncomeRow, field: EditableIncomeField) => {
  if (field === "obreros") return Number(row.obreros ?? 0);
  if (field === "egreso_presupuesto") return Number(row.egreso_presupuesto ?? 0);
  if (field === "ingreso_presupuesto") return Number(row.ingreso_presupuesto ?? 0);
  return Number(row.ingreso_real ?? 0);
};

export const BudgetIncomeDialog = ({
  request,
  rows,
  incomeRubroTotal,
  isOpenPeriod,
  onOpenChange,
  onConfirmChanges,
  onOpenIncomeMovements,
  onCreateBudgetAccount,
  onEditBudgetAccount,
  onDeleteBudgetAccount,
}: BudgetIncomeDialogProps) => {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [committedDrafts, setCommittedDrafts] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [displayMode, setDisplayMode] =
    useState<IncomeRowsDisplayMode>("withBudget");
  const hasBudgetedIncomeRows = rows.some(
    (row) => Number(row.ingreso_presupuesto ?? 0) > 0,
  );

  useEffect(() => {
    if (!request) {
      setDrafts({});
      setCommittedDrafts({});
      setEditingKey(null);
      setIsSaving(false);
      setDisplayMode("withBudget");
      return;
    }

    setDisplayMode(hasBudgetedIncomeRows ? "withBudget" : "all");
    const nextDrafts = Object.fromEntries(
      rows.flatMap((row) =>
        (["obreros", "egreso_presupuesto", "ingreso_presupuesto", "ingreso_real"] as const).map(
          (field) => [getEditableKey(row, field), String(getEditableValue(row, field))],
        ),
      ),
    );
    setDrafts(nextDrafts);
    setCommittedDrafts(nextDrafts);
  }, [hasBudgetedIncomeRows, request, rows]);

  const visibleRows =
    displayMode === "withBudget"
      ? rows.filter(
          (row) => {
            const committed = committedDrafts[getEditableKey(row, "ingreso_real")];
            const parsedReal = Number(
              String(committed ?? row.ingreso_real).replace(",", "."),
            );
            const committedBudget = committedDrafts[getEditableKey(row, "ingreso_presupuesto")];
            const parsedBudget = Number(
              String(committedBudget ?? row.ingreso_presupuesto).replace(",", "."),
            );
            return (
              (Number.isFinite(parsedBudget)
                ? parsedBudget
                : Number(row.ingreso_presupuesto ?? 0)) > 0 ||
              (Number.isFinite(parsedReal)
                ? parsedReal
                : Number(row.ingreso_real ?? 0)) > 0
            );
          },
        )
      : rows;

  const totalPresupuesto = visibleRows.reduce(
    (total, row) => {
      const parsed = Number(
        String(
          committedDrafts[getEditableKey(row, "ingreso_presupuesto")] ??
            row.ingreso_presupuesto,
        ).replace(",", "."),
      );
      return total + (Number.isFinite(parsed) ? parsed : Number(row.ingreso_presupuesto ?? 0));
    },
    0,
  );
  const totalEgresoPresupuesto = visibleRows.reduce(
    (total, row) => {
      const parsed = Number(
        String(
          committedDrafts[getEditableKey(row, "egreso_presupuesto")] ??
            row.egreso_presupuesto,
        ).replace(",", "."),
      );
      return total + (Number.isFinite(parsed) ? parsed : Number(row.egreso_presupuesto ?? 0));
    },
    0,
  );
  const totalEgresoReal = visibleRows.reduce(
    (total, row) => total + Number(row.egreso_real ?? 0),
    0,
  );
  const totalObreros = visibleRows.reduce(
    (total, row) => {
      const parsed = Number(
        String(committedDrafts[getEditableKey(row, "obreros")] ?? row.obreros).replace(",", "."),
      );
      return total + (Number.isFinite(parsed) ? parsed : Number(row.obreros ?? 0));
    },
    0,
  );
  const totalReal = visibleRows.reduce((total, row) => {
    const draft = committedDrafts[getEditableKey(row, "ingreso_real")];
    const parsed = Number(String(draft ?? row.ingreso_real).replace(",", "."));
    return total + (Number.isFinite(parsed) ? parsed : Number(row.ingreso_real ?? 0));
  }, 0);
  const realDifference = Number(incomeRubroTotal.real_ingreso ?? 0) - totalReal;

  const changes = rows
    .flatMap((row) =>
      (["obreros", "egreso_presupuesto", "ingreso_presupuesto", "ingreso_real"] as const).map((field) => {
        const key = getEditableKey(row, field);
        const parsed = Number(String(drafts[key] ?? getEditableValue(row, field)).replace(",", "."));
        const requiresRecord = field !== "ingreso_real";
        return {
          row,
          key,
          field,
          value: parsed,
          valid:
            Number.isFinite(parsed) &&
            parsed >= 0 &&
            (!requiresRecord || row.presupuesto_id !== null),
          changed: parsed !== getEditableValue(row, field),
        };
      }),
    );
  const hasInvalidChanges = changes.some((change) => change.changed && !change.valid);
  const pendingChanges = changes.filter((change) => change.valid && change.changed);
  const canConfirm =
    isOpenPeriod && pendingChanges.length > 0 && !hasInvalidChanges && !isSaving;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setCommittedDrafts(drafts);
    setIsSaving(true);
    try {
      await onConfirmChanges(
        pendingChanges.map((change) => ({
          field: change.field,
          presupuestoId: change.row.presupuesto_id,
          cuentaId: change.row.cuenta_id,
          value: change.value,
        })),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openIncomeMovements = () => {
    if (!request) return;
    onOpenIncomeMovements({
      proyecto_id: request.proyecto_id,
      projectName: request.projectName,
      rubro_id: incomeRubroTotal.rubro_id,
      label: `${request.projectName ?? request.label} / Ingresos`,
      month: request.month,
      concepto: "ingreso",
      conceptoLabel: "Ingreso",
    });
  };

  const copyBudgetToReal = (key: string, value: number) => {
    if (!isOpenPeriod) return;
    const nextValue = String(Math.round(Number(value ?? 0)));
    setDrafts((current) => ({
      ...current,
      [key]: nextValue,
    }));
    setCommittedDrafts((current) => ({
      ...current,
      [key]: nextValue,
    }));
    setEditingKey(null);
  };

  const commitEditingValue = (key: string) => {
    setCommittedDrafts((current) => ({
      ...current,
      [key]: drafts[key] ?? "",
    }));
    setEditingKey(null);
  };

  const renderEditableAmount = (
    row: BudgetIncomeRow,
    field: EditableIncomeField,
    title: string,
    className?: string,
  ) => {
    const key = getEditableKey(row, field);
    const canEdit = isOpenPeriod && (field === "ingreso_real" || row.presupuesto_id !== null);
    const rawValue = drafts[key] ?? String(getEditableValue(row, field));
    const numericValue = Number(String(rawValue).replace(",", "."));

    if (editingKey === key && canEdit) {
      return (
        <Input
          autoFocus
          type="number"
          min={0}
          step="0.01"
          value={rawValue}
          disabled={isSaving}
          className={cn("ml-auto h-[22px] w-[92px] px-1.5 text-right text-[10px] font-semibold tabular-nums", className)}
          title={title}
          onBlur={() => commitEditingValue(key)}
          onChange={(event) =>
            setDrafts((current) => ({
              ...current,
              [key]: event.target.value,
            }))
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitEditingValue(key);
            }
            if (event.key === "Escape") {
              const originalValue = String(getEditableValue(row, field));
              setDrafts((current) => ({ ...current, [key]: originalValue }));
              setCommittedDrafts((current) => ({ ...current, [key]: originalValue }));
              setEditingKey(null);
            }
          }}
        />
      );
    }

    if (!canEdit) {
      return (
        <span
          className={cn("block whitespace-nowrap text-right tabular-nums", className)}
          title={!isOpenPeriod ? "Periodo cerrado" : title}
        >
          {formatCurrency(Number.isFinite(numericValue) ? numericValue : getEditableValue(row, field))}
        </span>
      );
    }

    return (
      <button
        type="button"
        disabled={isSaving}
        className={cn(
          "inline-flex h-[22px] min-w-[92px] items-center justify-end rounded-sm px-1.5 text-right font-semibold tabular-nums text-foreground transition-colors hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent",
          className,
        )}
        title={title}
        onClick={() => setEditingKey(key)}
      >
        {formatCurrency(Number.isFinite(numericValue) ? numericValue : getEditableValue(row, field))}
      </button>
    );
  };

  const renderEditableEmployees = (row: BudgetIncomeRow) => {
    const key = getEditableKey(row, "obreros");
    const canEdit = isOpenPeriod && row.presupuesto_id !== null;
    const rawValue = drafts[key] ?? String(getEditableValue(row, "obreros"));
    const numericValue = Number(String(rawValue).replace(",", "."));

    if (editingKey === key && canEdit) {
      return (
        <Input
          autoFocus
          type="number"
          min={0}
          step="0.01"
          value={rawValue}
          disabled={isSaving}
          className="ml-auto h-[22px] w-[48px] px-1 text-right text-[9px] font-semibold tabular-nums"
          title="Editar obreros"
          onBlur={() => commitEditingValue(key)}
          onChange={(event) =>
            setDrafts((current) => ({
              ...current,
              [key]: event.target.value,
            }))
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitEditingValue(key);
            }
            if (event.key === "Escape") {
              const originalValue = String(getEditableValue(row, "obreros"));
              setDrafts((current) => ({ ...current, [key]: originalValue }));
              setCommittedDrafts((current) => ({ ...current, [key]: originalValue }));
              setEditingKey(null);
            }
          }}
        />
      );
    }

    if (!canEdit) {
      return (
        <span
          className="block whitespace-nowrap text-right tabular-nums"
          title={!isOpenPeriod ? "Periodo cerrado" : "Requiere presupuesto creado"}
        >
          {formatEmployees(Number.isFinite(numericValue) ? numericValue : getEditableValue(row, "obreros"))}
        </span>
      );
    }

    return (
      <button
        type="button"
        disabled={isSaving}
        className="inline-flex h-[22px] min-w-[48px] items-center justify-end rounded-sm px-1 text-right font-semibold tabular-nums text-foreground transition-colors hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
        title="Editar obreros"
        onClick={() => setEditingKey(key)}
      >
        {formatEmployees(Number.isFinite(numericValue) ? numericValue : getEditableValue(row, "obreros"))}
      </button>
    );
  };

  return (
    <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[min(88vh,548px)] w-[min(96vw,980px)] max-w-[980px] grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-2 p-3 sm:max-w-[980px]"
        overlayClassName="bg-transparent backdrop-blur-none"
      >
        <DialogHeader className="gap-1">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="min-w-0">
              <DialogTitle className="text-sm">Cuentas</DialogTitle>
              <div className="truncate text-[10px] text-muted-foreground">
                {request ? `${formatMonthLabel(request.month)} - ${request.label}` : ""}
              </div>
              {request ? (
                <div className={cn("text-[9px] font-medium", isOpenPeriod ? "text-emerald-700" : "text-amber-700")}>
                  {isOpenPeriod ? "Periodo abierto" : "Periodo cerrado"}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-[10px]"
                disabled={!request || isSaving}
                onClick={() => request && onCreateBudgetAccount(request)}
              >
                <Plus className="size-3" />
                Cuenta
              </Button>
              <div className="grid gap-0.5">
                <span className="text-[8px] font-medium leading-none text-primary">
                  Cuentas
                </span>
                <div className="inline-flex h-7 items-center rounded-md border border-border bg-background p-0.5 text-[9px]">
                  {[
                    ["withBudget", "Ingresos"],
                    ["all", "Todas"],
                  ].map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={cn(
                        "h-5 rounded-sm px-2 text-muted-foreground transition-colors hover:text-foreground",
                        displayMode === mode &&
                          "bg-muted text-foreground shadow-xs",
                      )}
                      onClick={() => setDisplayMode(mode as IncomeRowsDisplayMode)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto rounded-t-md border-x border-t border-border">
          <table className="w-full table-fixed border-collapse text-[10px]">
            <colgroup>
              <col className="w-[104px]" />
              <col className="w-[264px]" />
              <col className="w-[52px]" />
              <col className="w-[92px]" />
              <col className="w-[92px]" />
              <col className="w-[112px]" />
              <col className="w-[24px]" />
              <col className="w-[108px]" />
              <col className="w-[28px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-muted">
              <tr className="border-b border-border">
                <th className="w-[104px] px-1.5 py-1 text-left font-medium">
                  Rubro
                </th>
                <th className="w-[264px] px-1.5 py-1 text-left font-medium">
                  Cuenta
                </th>
                <th className="w-[52px] px-1.5 py-1 text-right text-[9px] font-medium text-muted-foreground">
                  Obreros
                </th>
                <th className="w-[92px] px-1.5 py-1 text-right text-[9px] font-medium text-muted-foreground">
                  Egreso Pres.
                </th>
                <th className="w-[92px] px-1.5 py-1 text-right text-[9px] font-medium text-muted-foreground">
                  Egreso Real
                </th>
                <th className="w-[112px] border-l border-border/60 px-1.5 py-1 text-right text-[9px] font-medium text-muted-foreground">
                  Ingreso Pres.
                </th>
                <th className="w-[24px] px-0.5 py-1" aria-label="Copiar" />
                <th className="w-[108px] px-1.5 py-1 text-right text-[10px] font-semibold text-foreground">
                  Ingreso Real
                </th>
                <th className="w-[28px] px-0.5 py-1" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-2 py-8 text-center text-muted-foreground">
                    {displayMode === "withBudget"
                      ? "Sin cuentas con ingresos."
                      : "Sin cuentas para mostrar."}
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const key = getIncomeRowKey(row);
                  return (
                    <tr key={key} className="border-b border-border/50">
                      <td
                        className="truncate px-1.5 py-1"
                        title={row.rubro_nombre}
                      >
                        {row.rubro_nombre}
                      </td>
                      <td
                        className="truncate px-1.5 py-1"
                        title={`${row.rubro_nombre} - ${row.cuenta_label}`}
                      >
                        {row.presupuesto_id && request ? (
                          <button
                            type="button"
                            className="max-w-full truncate text-left text-sky-700 underline-offset-2 hover:underline"
                            title="Editar presupuesto"
                            onClick={() => onEditBudgetAccount(row, request)}
                          >
                            {row.cuenta_label}
                          </button>
                        ) : (
                          row.cuenta_label
                        )}
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-1 text-right text-[9px] tabular-nums text-muted-foreground">
                        {renderEditableEmployees(row)}
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-1 text-right text-[9px] tabular-nums text-muted-foreground/75">
                        {renderEditableAmount(
                          row,
                          "egreso_presupuesto",
                          "Editar egreso presupuesto",
                          "text-[9px]",
                        )}
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-1 text-right text-[9px] tabular-nums text-muted-foreground/75">
                        {formatCurrency(row.egreso_real)}
                      </td>
                      <td className="whitespace-nowrap border-l border-border/60 px-1.5 py-1 text-right text-[9px] tabular-nums text-muted-foreground">
                        {renderEditableAmount(
                          row,
                          "ingreso_presupuesto",
                          "Editar ingreso presupuesto",
                          "text-[9px]",
                        )}
                      </td>
                      <td className="px-0.5 py-1 text-center">
                        <button
                          type="button"
                          disabled={isSaving || !isOpenPeriod}
                          className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground opacity-45 transition-colors hover:bg-sky-50 hover:text-sky-700 hover:opacity-100 disabled:cursor-default disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                          title="Copiar presupuesto a real"
                          aria-label="Copiar presupuesto a real"
                          onClick={() =>
                            copyBudgetToReal(
                              getEditableKey(row, "ingreso_real"),
                              Number(
                                String(
                                  drafts[getEditableKey(row, "ingreso_presupuesto")] ??
                                    row.ingreso_presupuesto,
                                ).replace(",", "."),
                              ),
                            )
                          }
                        >
                          <Copy className="size-3" aria-hidden="true" />
                        </button>
                      </td>
                      <td className="px-1.5 py-1 text-right tabular-nums">
                        {renderEditableAmount(row, "ingreso_real", "Editar ingreso real", "text-[10px]")}
                      </td>
                      <td className="px-0.5 py-1 text-center">
                        {row.presupuesto_id ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                type="button"
                                disabled={isSaving || !isOpenPeriod}
                                className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground opacity-55 transition-colors hover:bg-rose-50 hover:text-rose-700 hover:opacity-100 disabled:cursor-default disabled:opacity-20"
                                title={isOpenPeriod ? "Eliminar cuenta" : "Periodo cerrado"}
                                aria-label="Eliminar cuenta"
                              >
                                <Trash2 className="size-3" aria-hidden="true" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="max-w-[360px] gap-3 p-4">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-sm">
                                  Eliminar cuenta
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-xs">
                                  Se eliminara el presupuesto de {row.cuenta_label} para este periodo.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="h-7 px-2.5 text-[10px]">
                                  Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  className="h-7 bg-rose-600 px-2.5 text-[10px] hover:bg-rose-700"
                                  onClick={() => void onDeleteBudgetAccount(row)}
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="shrink-0 overflow-hidden rounded-b-md border-x border-b border-border bg-background">
          <table className="w-full table-fixed border-collapse text-[10px]">
            <colgroup>
              <col className="w-[104px]" />
              <col className="w-[264px]" />
              <col className="w-[52px]" />
              <col className="w-[92px]" />
              <col className="w-[92px]" />
              <col className="w-[112px]" />
              <col className="w-[24px]" />
              <col className="w-[108px]" />
              <col className="w-[28px]" />
            </colgroup>
            <tfoot>
              {visibleRows.length > 0 ? (
                <tr className="border-t border-border/80 bg-muted/70">
                  <th className="px-1.5 py-1" colSpan={2} aria-label="Totales" />
                  <td className="whitespace-nowrap px-1.5 py-1 text-right text-[9px] font-medium tabular-nums text-muted-foreground">
                    {formatEmployees(totalObreros)}
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-1 text-right text-[9px] font-medium tabular-nums text-muted-foreground">
                    {formatCurrency(totalEgresoPresupuesto)}
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-1 text-right text-[9px] font-medium tabular-nums text-muted-foreground">
                    {formatCurrency(totalEgresoReal)}
                  </td>
                  <td className="whitespace-nowrap border-l border-border/60 px-1.5 py-1 text-right text-[9px] font-medium tabular-nums text-muted-foreground">
                    {formatCurrency(totalPresupuesto)}
                  </td>
                  <td className="px-0.5 py-1" />
                  <td className="whitespace-nowrap px-1.5 py-1 text-right text-[10px] font-semibold tabular-nums text-foreground">
                    {formatCurrency(totalReal)}
                  </td>
                  <td className="px-0.5 py-1" />
                </tr>
              ) : null}
              <tr aria-hidden="true">
                <td className="h-1 border-t border-border/40 bg-background p-0" colSpan={9} />
              </tr>
              <tr className="bg-background">
                <th className="px-1.5 py-1" colSpan={5} aria-label="Ingresos contables" />
                <td
                  className="border-l border-y border-r border-border/60 bg-muted/20 px-1.5 py-1"
                  colSpan={4}
                >
                  <div className="grid min-h-6 grid-cols-[minmax(0,1fr)_auto] grid-rows-[14px_8px] items-start gap-x-2">
                    <div className="flex h-[14px] min-w-0 items-center justify-end gap-1 text-[9px] font-medium leading-[9px] text-muted-foreground">
                      <span className="truncate">Ingresos contables</span>
                      <button
                        type="button"
                        className="inline-flex size-3.5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-sky-50 hover:text-sky-700"
                        aria-label="Consultar movimientos de ingresos"
                        title="Consultar movimientos de ingresos"
                        onClick={openIncomeMovements}
                      >
                        <Eye className="size-3" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="flex h-[14px] items-center justify-end whitespace-nowrap text-right text-[10px] font-semibold leading-[10px] text-foreground tabular-nums">
                      {formatCurrency(incomeRubroTotal.real_ingreso)}
                    </div>
                    <div className="col-start-2 row-start-2 whitespace-nowrap text-right text-[7px] leading-[7px] text-muted-foreground tabular-nums">
                      Dif. {formatCurrency(realDifference)}
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] text-muted-foreground">
            {hasInvalidChanges
              ? "Hay importes invalidos."
              : pendingChanges.length > 0
                ? `${pendingChanges.length} cambio(s) pendiente(s).`
                : "Sin cambios pendientes."}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[10px]"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 px-2.5 text-[10px]"
              disabled={!canConfirm}
              onClick={() => void handleConfirm()}
            >
              {isSaving ? "Confirmando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
