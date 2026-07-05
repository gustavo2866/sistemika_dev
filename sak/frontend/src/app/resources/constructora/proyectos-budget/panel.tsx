"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchUtils, useNotify } from "ra-core";
import { ChevronDown, ChevronRight, ChevronLeft, Plus, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/dataProvider";
import { cn } from "@/lib/utils";

type MonthValues = {
  importe_neto: number;
  empleados: number;
  budget_id?: number | null;
  record_count?: number;
};

type EditableField = "importe" | "empleados";
type EditingCell = {
  month: string;
  field: EditableField;
} | null;

type PanelMacrorubro = {
  macrorubro_id: number;
  macrorubro_nombre: string;
  months: Record<string, MonthValues>;
};

type PanelConcepto = {
  concepto_id: number;
  concepto_nombre: string;
  months: Record<string, MonthValues>;
  macrorubros: PanelMacrorubro[];
};

type PanelProject = {
  proyecto_id: number;
  proyecto_nombre: string;
  months: Record<string, MonthValues>;
  conceptos: PanelConcepto[];
};

type PanelResponse = {
  fecha_desde: string;
  fecha_hasta: string;
  estado: string;
  months: string[];
  rows: PanelProject[];
};

const MONTHS_VISIBLE = 4;

const fetchJsonWithAuth = async <T,>(url: string): Promise<T> => {
  const { json } = await fetchUtils.fetchJson(url, {
    headers: new Headers(
      typeof window !== "undefined" && localStorage.getItem("auth_token")
        ? { Authorization: `Bearer ${localStorage.getItem("auth_token")}` }
        : {},
    ),
  });
  return json as T;
};

const patchJsonWithAuth = async <T,>(
  url: string,
  payload: Record<string, unknown>,
): Promise<T> => {
  const { json } = await fetchUtils.fetchJson(url, {
    method: "PATCH",
    body: JSON.stringify(payload),
    headers: new Headers({
      "Content-Type": "application/json",
      ...(typeof window !== "undefined" && localStorage.getItem("auth_token")
        ? { Authorization: `Bearer ${localStorage.getItem("auth_token")}` }
        : {}),
    }),
  });
  return json as T;
};

const toStartOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);

const formatDateParam = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getMonthEnd = (monthStart: Date) =>
  new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", {
    month: "short",
    year: "2-digit",
  }).format(new Date(year, month - 1, 1));
};

const formatMonthRangeLabel = (startDate: Date, endDate: Date) => {
  const formatter = new Intl.DateTimeFormat("es-AR", {
    month: "short",
    year: "2-digit",
  });
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
};

const formatCurrency = (value?: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const formatEmployees = (value?: number) =>
  new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(value ?? 0);

type BudgetPanelRowProps = {
  id: string;
  label: string;
  level: 0 | 1 | 2;
  months: string[];
  monthValues: Record<string, MonthValues>;
  expanded?: boolean;
  expandable?: boolean;
  onToggle?: () => void;
  editable?: boolean;
  onCellSave?: (
    budgetId: number,
    field: EditableField,
    value: number,
  ) => Promise<void>;
};

const BudgetPanelRow = ({
  id,
  label,
  level,
  months,
  monthValues,
  expanded = false,
  expandable = false,
  onToggle,
  editable = false,
  onCellSave,
}: BudgetPanelRowProps) => {
  const ToggleIcon = expanded ? ChevronDown : ChevronRight;
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [draftValue, setDraftValue] = useState("");
  const [savingCell, setSavingCell] = useState<EditingCell>(null);

  const startEditing = (month: string, field: EditableField, value: number) => {
    setEditingCell({ month, field });
    setDraftValue(String(field === "importe" ? Math.abs(value) : value));
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setDraftValue("");
  };

  const saveEditing = async (values: MonthValues) => {
    if (!editingCell || !values.budget_id || !onCellSave) return;
    const normalized = Number(String(draftValue).replace(",", "."));
    if (!Number.isFinite(normalized) || normalized < 0) {
      cancelEditing();
      return;
    }
    const value =
      editingCell.field === "empleados"
        ? Math.round(normalized)
        : Math.abs(normalized);
    setSavingCell(editingCell);
    await onCellSave(values.budget_id, editingCell.field, value);
    setSavingCell(null);
    cancelEditing();
  };

  return (
    <tr
      className={cn(
        "border-b border-border/60 transition-colors hover:bg-muted/30",
        level === 0 && "bg-background",
        level === 1 && "bg-muted/20",
        level === 2 && "bg-muted/10 text-muted-foreground",
      )}
    >
      <th
        scope="row"
        className={cn(
          "sticky left-0 z-10 min-w-[190px] border-r border-border/60 bg-inherit px-1.5 py-1 text-left text-[10px] font-medium",
          level === 1 && "pl-5",
          level === 2 && "pl-8 font-normal",
        )}
      >
        <div className="flex items-center gap-1.5">
          {expandable ? (
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-expanded={expanded}
              aria-controls={id}
            >
              <ToggleIcon className="size-3.5" />
            </button>
          ) : (
            <span className="size-5 shrink-0" />
          )}
          <span className="truncate">{label}</span>
        </div>
      </th>
      {months.map((month) => {
        const values = monthValues[month] ?? { importe_neto: 0, empleados: 0, budget_id: null, record_count: 0 };
        const amount = Number(values.importe_neto ?? 0);
        const canEdit = editable && Boolean(values.budget_id) && Number(values.record_count ?? 0) === 1;
        const isEditingAmount =
          editingCell?.month === month && editingCell.field === "importe";
        const isEditingEmployees =
          editingCell?.month === month && editingCell.field === "empleados";
        const isSavingAmount =
          savingCell?.month === month && savingCell.field === "importe";
        const isSavingEmployees =
          savingCell?.month === month && savingCell.field === "empleados";

        return (
          <Fragment key={`${id}-${month}`}>
            <td
              className={cn(
                "min-w-[78px] border-l border-border/40 px-1.5 py-1 text-right text-[10px] tabular-nums",
                amount < 0 ? "text-rose-700" : "text-foreground",
              )}
            >
              {isEditingAmount ? (
                <input
                  autoFocus
                  type="number"
                  min={0}
                  step="0.01"
                  value={draftValue}
                  disabled={isSavingAmount}
                  className="h-5 w-full rounded border border-primary/30 bg-background px-1 text-right text-[10px] tabular-nums outline-none focus:border-primary"
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
                  className="w-full text-right hover:underline"
                  onClick={() => startEditing(month, "importe", amount)}
                >
                  {formatCurrency(amount)}
                </button>
              ) : (
                formatCurrency(amount)
              )}
            </td>
            <td className="min-w-[42px] border-l border-r border-border/40 px-1.5 py-1 text-right text-[10px] tabular-nums text-muted-foreground">
              {isEditingEmployees ? (
                <input
                  autoFocus
                  type="number"
                  min={0}
                  step="1"
                  value={draftValue}
                  disabled={isSavingEmployees}
                  className="h-5 w-full rounded border border-primary/30 bg-background px-1 text-right text-[10px] tabular-nums text-foreground outline-none focus:border-primary"
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
                  className="w-full text-right hover:underline"
                  onClick={() => startEditing(month, "empleados", Number(values.empleados ?? 0))}
                >
                  {formatEmployees(values.empleados)}
                </button>
              ) : (
                formatEmployees(values.empleados)
              )}
            </td>
          </Fragment>
        );
      })}
    </tr>
  );
};

export const ProyectosBudgetPanel = () => {
  const notify = useNotify();
  const todayStart = useMemo(() => toStartOfMonth(new Date()), []);
  const [startMonth, setStartMonth] = useState(todayStart);
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(() => new Set());
  const [expandedConcepts, setExpandedConcepts] = useState<Set<string>>(() => new Set());

  const fechaDesde = useMemo(() => formatDateParam(startMonth), [startMonth]);
  const fechaHasta = useMemo(
    () => formatDateParam(getMonthEnd(addMonths(startMonth, MONTHS_VISIBLE - 1))),
    [startMonth],
  );

  const params = useMemo(() => {
    const search = new URLSearchParams();
    search.set("fecha_desde", fechaDesde);
    search.set("fecha_hasta", fechaHasta);
    return search.toString();
  }, [fechaDesde, fechaHasta]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["proyectos-budget-panel", params],
    queryFn: () =>
      fetchJsonWithAuth<PanelResponse>(
        `${apiUrl}/constructora/proyectos-budget/panel?${params}`,
      ),
  });

  const handleCellSave = async (
    budgetId: number,
    field: EditableField,
    value: number,
  ) => {
    await patchJsonWithAuth(`${apiUrl}/constructora/proyectos-budget/${budgetId}`, {
      [field]: value,
    });
    notify("Registro actualizado", { type: "success" });
    await refetch();
  };

  const months = useMemo(() => data?.months ?? [], [data?.months]);
  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const tableColSpan = 1 + months.length * 2;
  const totalsByMonth = useMemo(
    () =>
      months.reduce<Record<string, MonthValues>>((acc, month) => {
        acc[month] = rows.reduce<MonthValues>(
          (total, project) => {
            const values = project.months[month] ?? { importe_neto: 0, empleados: 0 };
            return {
              importe_neto: total.importe_neto + Number(values.importe_neto ?? 0),
              empleados: total.empleados + Number(values.empleados ?? 0),
              budget_id: null,
              record_count: total.record_count ?? 0,
            };
          },
          { importe_neto: 0, empleados: 0, budget_id: null, record_count: 0 },
        );
        return acc;
      }, {}),
    [months, rows],
  );
  const navigationRange = useMemo(
    () => formatMonthRangeLabel(startMonth, getMonthEnd(addMonths(startMonth, MONTHS_VISIBLE - 1))),
    [startMonth],
  );

  const toggleProject = (projectId: number) => {
    setExpandedProjects((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const toggleConcept = (key: string) => {
    setExpandedConcepts((current) => {
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
            Constructora
          </p>
          <h1 className="text-xl font-semibold tracking-tight">Budget proyectos</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border border-slate-200 bg-white shadow-xs">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-r-none"
              onClick={() => setStartMonth((current) => addMonths(current, -MONTHS_VISIBLE))}
              aria-label="Cuatrimestre anterior"
              title="Cuatrimestre anterior"
            >
              <ChevronLeft className="size-3" />
            </Button>
            <div className="min-w-[132px] border-x border-slate-200 px-2 text-center">
              <div className="text-[10px] font-semibold text-slate-700">Cuatrimestre</div>
              <div className="text-[8px] text-slate-500">{navigationRange}</div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-l-none"
              onClick={() => setStartMonth((current) => addMonths(current, MONTHS_VISIBLE))}
              aria-label="Cuatrimestre siguiente"
              title="Cuatrimestre siguiente"
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
          <Button asChild size="sm" className="h-8 px-2 text-xs">
            <Link to="/constructora/proyectos-budget/create">
              <Plus className="mr-1 size-3.5" />
              Registro
            </Link>
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-background">
        <div className="overflow-auto">
          <table className="w-full min-w-[690px] border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th
                  scope="col"
                  className="sticky left-0 z-20 min-w-[190px] border-r border-border bg-muted/30 px-1.5 py-1.5 text-left text-[10px] font-semibold"
                >
                  Proyecto
                </th>
                {months.map((month) => (
                  <th
                    key={month}
                    scope="col"
                    colSpan={2}
                    className="border-r border-border px-1.5 py-1.5 text-center text-[10px] font-semibold"
                  >
                    {formatMonthLabel(month)}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-border bg-muted/20">
                <th className="sticky left-0 z-20 border-r border-border bg-muted/20 px-1.5 py-1 text-left text-[9px] font-medium text-muted-foreground">
                  Apertura
                </th>
                {months.map((month) => (
                  <Fragment key={`${month}-headers`}>
                    <th className="min-w-[78px] border-l border-border/40 px-1.5 py-1 text-right text-[9px] font-medium text-muted-foreground">
                      Neto
                    </th>
                    <th className="min-w-[42px] border-l border-r border-border/40 px-1.5 py-1 text-right text-[9px] font-medium text-muted-foreground">
                      Emp.
                    </th>
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
                    Sin budget para proyectos en ejecucion en el periodo.
                  </td>
                </tr>
              ) : (
                rows.map((project) => {
                  const projectExpanded = expandedProjects.has(project.proyecto_id);
                  return (
                    <Fragment key={`project-group-${project.proyecto_id}`}>
                      <BudgetPanelRow
                        key={`project-${project.proyecto_id}`}
                        id={`project-${project.proyecto_id}`}
                        label={project.proyecto_nombre}
                        level={0}
                        months={months}
                        monthValues={project.months}
                        expandable={project.conceptos.length > 0}
                        expanded={projectExpanded}
                        onToggle={() => toggleProject(project.proyecto_id)}
                      />
                      {projectExpanded
                        ? project.conceptos.map((concept) => {
                            const conceptKey = `${project.proyecto_id}-${concept.concepto_id}`;
                            const conceptExpanded = expandedConcepts.has(conceptKey);
                            return (
                              <Fragment key={`concept-group-${conceptKey}`}>
                                <BudgetPanelRow
                                  key={`concept-${conceptKey}`}
                                  id={`concept-${conceptKey}`}
                                  label={concept.concepto_nombre}
                                  level={1}
                                  months={months}
                                  monthValues={concept.months}
                                  expandable={concept.macrorubros.length > 0}
                                  expanded={conceptExpanded}
                                  onToggle={() => toggleConcept(conceptKey)}
                                />
                                {conceptExpanded
                                  ? concept.macrorubros.map((macro) => (
                                      <BudgetPanelRow
                                        key={`macro-${conceptKey}-${macro.macrorubro_id}`}
                                        id={`macro-${conceptKey}-${macro.macrorubro_id}`}
                                        label={macro.macrorubro_nombre}
                                        level={2}
                                        months={months}
                                        monthValues={macro.months}
                                        editable
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
                  <th className="sticky left-0 z-10 border-r border-border bg-muted/30 px-1.5 py-1.5 text-left text-[10px] font-semibold">
                    Total
                  </th>
                  {months.map((month) => {
                    const values = totalsByMonth[month] ?? { importe_neto: 0, empleados: 0 };
                    const amount = Number(values.importe_neto ?? 0);
                    return (
                      <Fragment key={`total-${month}`}>
                        <td
                          className={cn(
                            "border-l border-border/40 px-1.5 py-1.5 text-right text-[10px] font-semibold tabular-nums",
                            amount < 0 ? "text-rose-700" : "text-foreground",
                          )}
                        >
                          {formatCurrency(amount)}
                        </td>
                        <td className="border-l border-r border-border/40 px-1.5 py-1.5 text-right text-[10px] font-semibold tabular-nums text-muted-foreground">
                          {formatEmployees(values.empleados)}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  );
};
