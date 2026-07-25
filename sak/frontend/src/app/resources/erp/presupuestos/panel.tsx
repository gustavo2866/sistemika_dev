"use client";

import { Fragment, type ReactNode, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchUtils, useNotify } from "ra-core";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/dataProvider";
import { cn } from "@/lib/utils";

type MonthValues = {
  ingresos: number;
  egresos: number;
  real_ingresos: number;
  real_egresos: number;
  empleados: number;
  presupuesto_id?: number | null;
  record_count?: number;
};

type EditableField = "obreros_cantidad" | "egreso" | "ingres";
type EditingCell = {
  month: string;
  field: EditableField;
} | null;

type PresupuestoFilterContext = {
  proyecto_id: number;
  erp_cuenta_id: number;
};

type PanelCuenta = {
  cuenta_id: number;
  cuenta_codigo?: string | null;
  cuenta_nombre: string;
  months: Record<string, MonthValues>;
};

type PanelRubro = {
  rubro_id: number;
  rubro_nombre: string;
  months: Record<string, MonthValues>;
  cuentas: PanelCuenta[];
};

type PanelProject = {
  proyecto_id: number;
  proyecto_nombre: string;
  months: Record<string, MonthValues>;
  rubros: PanelRubro[];
};

type PanelResponse = {
  fecha_desde: string;
  fecha_hasta: string;
  estado: string;
  months: string[];
  rows: PanelProject[];
};

const MONTHS_VISIBLE = 3;

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

const toStartOfQuarter = (date: Date) =>
  new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);

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

const buildPresupuestoListLink = (
  monthKey: string,
  context?: PresupuestoFilterContext,
) => {
  if (!context) return null;
  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = getMonthEnd(monthStart);
  const params = new URLSearchParams();
  params.set(
    "filter",
    JSON.stringify({
      ...context,
      fecha: {
        gte: formatDateParam(monthStart),
        lte: formatDateParam(monthEnd),
      },
    }),
  );
  return `/erp/presupuestos?${params.toString()}`;
};

const formatCurrency = (value?: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const formatEmployees = (value?: number) =>
  new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 1,
  }).format(value ?? 0);

const getEmptyMonthValues = (): MonthValues => ({
  ingresos: 0,
  egresos: 0,
  real_ingresos: 0,
  real_egresos: 0,
  empleados: 0,
  presupuesto_id: null,
  record_count: 0,
});

const formatCuentaLabel = (cuenta: PanelCuenta) =>
  [cuenta.cuenta_codigo, cuenta.cuenta_nombre].filter(Boolean).join(" - ") ||
  `#${cuenta.cuenta_id}`;

const AmountStack = ({
  budget,
  real,
  budgetClassName,
  realClassName,
}: {
  budget: ReactNode;
  real: ReactNode;
  budgetClassName?: string;
  realClassName?: string;
}) => (
  <div className="flex w-full flex-col gap-0.5 leading-tight">
    <div className="grid w-full grid-cols-[24px_minmax(0,1fr)] items-baseline gap-1">
      <span className="text-left text-[7px] font-medium text-muted-foreground">
        Ppto.
      </span>
      <div className={cn("min-w-0 truncate text-right text-foreground", budgetClassName)}>
        {budget}
      </div>
    </div>
    <div className="grid w-full grid-cols-[24px_minmax(0,1fr)] items-baseline gap-1 border-t border-border/30 pt-0.5">
      <span className="text-left text-[7px] font-medium text-muted-foreground">
        Real
      </span>
      <div className={cn("min-w-0 truncate text-right text-foreground", realClassName)}>
        {real}
      </div>
    </div>
  </div>
);

type PresupuestoPanelRowProps = {
  id: string;
  label: string;
  level: 0 | 1 | 2;
  months: string[];
  monthValues: Record<string, MonthValues>;
  expanded?: boolean;
  expandable?: boolean;
  onToggle?: () => void;
  editable?: boolean;
  filterContext?: PresupuestoFilterContext;
  onCellSave?: (
    presupuestoId: number,
    field: EditableField,
    value: number,
  ) => Promise<void>;
};

const PresupuestoPanelRow = ({
  id,
  label,
  level,
  months,
  monthValues,
  expanded = false,
  expandable = false,
  onToggle,
  editable = false,
  filterContext,
  onCellSave,
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
        "border-b border-border/60 transition-colors hover:bg-muted/30",
        level === 0 && "bg-background",
        level === 1 && "bg-muted/20",
        level === 2 && "bg-muted/10 text-muted-foreground",
      )}
    >
      <th
        scope="row"
        className={cn(
          "sticky left-0 z-10 min-w-[190px] max-w-[190px] border-r border-border/60 bg-inherit px-1.5 py-2 text-left text-[10px] font-medium",
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
        const values = monthValues[month] ?? getEmptyMonthValues();
        const ingresos = Number(values.ingresos ?? 0);
        const egresos = Number(values.egresos ?? 0);
        const realIngresos = Number(values.real_ingresos ?? 0);
        const realEgresos = Number(values.real_egresos ?? 0);
        const empleados = Number(values.empleados ?? 0);
        const resultado = ingresos - egresos;
        const realResultado = realIngresos - realEgresos;
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

        return (
          <Fragment key={`${id}-${month}`}>
            <td
              className="w-[34px] min-w-[34px] max-w-[34px] overflow-hidden whitespace-nowrap border-l border-border/40 px-1 py-1.5 text-right text-[9px] tabular-nums text-muted-foreground"
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
                  className="w-full text-right hover:underline"
                  onClick={() => startEditing(month, "obreros_cantidad", empleados)}
                >
                  {formatEmployees(empleados)}
                </button>
              ) : listLink ? (
                <Link
                  to={listLink}
                  className="block w-full text-right hover:underline"
                >
                  {formatEmployees(empleados)}
                </Link>
              ) : (
                formatEmployees(empleados)
              )}
            </td>
            <td
              className="w-[104px] min-w-[104px] max-w-[104px] overflow-hidden border-l border-border/40 px-1.5 py-1.5 text-right text-[9px] tabular-nums text-foreground"
              title={`Egresos: ${formatCurrency(egresos)} | Real egreso: ${formatCurrency(realEgresos)}`}
            >
              {isEditingEgresos ? (
                <AmountStack
                  budget={
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
                  }
                  real={formatCurrency(realEgresos)}
                />
              ) : canEdit ? (
                <AmountStack
                  budget={
                  <button
                    type="button"
                    className="w-full truncate text-right hover:underline"
                    onClick={() => startEditing(month, "egreso", egresos)}
                  >
                    {formatCurrency(egresos)}
                  </button>
                  }
                  real={formatCurrency(realEgresos)}
                />
              ) : listLink ? (
                <Link
                  to={listLink}
                  className="block w-full hover:underline"
                >
                  <AmountStack
                    budget={formatCurrency(egresos)}
                    real={formatCurrency(realEgresos)}
                  />
                </Link>
              ) : (
                <AmountStack
                  budget={formatCurrency(egresos)}
                  real={formatCurrency(realEgresos)}
                />
              )}
            </td>
            <td
              className="w-[104px] min-w-[104px] max-w-[104px] overflow-hidden border-l border-border/40 px-1.5 py-1.5 text-right text-[9px] tabular-nums text-foreground"
              title={`Ingresos: ${formatCurrency(ingresos)} | Real ingreso: ${formatCurrency(realIngresos)}`}
            >
              {isEditingIngresos ? (
                <AmountStack
                  budget={
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
                  }
                  real={formatCurrency(realIngresos)}
                />
              ) : canEdit ? (
                <AmountStack
                  budget={
                  <button
                    type="button"
                    className="w-full truncate text-right hover:underline"
                    onClick={() => startEditing(month, "ingres", ingresos)}
                  >
                    {formatCurrency(ingresos)}
                  </button>
                  }
                  real={formatCurrency(realIngresos)}
                />
              ) : listLink ? (
                <Link
                  to={listLink}
                  className="block w-full hover:underline"
                >
                  <AmountStack
                    budget={formatCurrency(ingresos)}
                    real={formatCurrency(realIngresos)}
                  />
                </Link>
              ) : (
                <AmountStack
                  budget={formatCurrency(ingresos)}
                  real={formatCurrency(realIngresos)}
                />
              )}
            </td>
            <td
              className="w-[104px] min-w-[104px] max-w-[104px] overflow-hidden border-l border-r border-border/40 px-1.5 py-1.5 text-right text-[9px] tabular-nums"
              title={`Resultado: ${formatCurrency(resultado)} | Real resultado: ${formatCurrency(realResultado)}`}
            >
              <AmountStack
                budget={formatCurrency(resultado)}
                real={formatCurrency(realResultado)}
                budgetClassName={resultado < 0 ? "text-rose-700" : "text-emerald-700"}
                realClassName={realResultado < 0 ? "text-rose-700" : "text-emerald-700"}
              />
            </td>
          </Fragment>
        );
      })}
    </tr>
  );
};

export const ErpPresupuestoPanel = () => {
  const notify = useNotify();
  const todayStart = useMemo(() => toStartOfQuarter(new Date()), []);
  const [startMonth, setStartMonth] = useState(todayStart);
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(() => new Set());
  const [expandedRubros, setExpandedRubros] = useState<Set<string>>(() => new Set());

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
    queryKey: ["erp-presupuestos-panel", params],
    queryFn: () =>
      fetchJsonWithAuth<PanelResponse>(
        `${apiUrl}/erp/presupuestos/panel?${params}`,
      ),
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

  const months = useMemo(() => data?.months ?? [], [data?.months]);
  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const tableColSpan = 1 + months.length * 4;
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
          <div className="flex items-center rounded-md border border-slate-200 bg-white shadow-xs">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-r-none"
              onClick={() => setStartMonth((current) => addMonths(current, -MONTHS_VISIBLE))}
              aria-label="Trimestre anterior"
              title="Trimestre anterior"
            >
              <ChevronLeft className="size-3" />
            </Button>
            <div className="min-w-[132px] border-x border-slate-200 px-2 text-center">
              <div className="text-[10px] font-semibold text-slate-700">Trimestre</div>
              <div className="text-[8px] text-slate-500">{navigationRange}</div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-l-none"
              onClick={() => setStartMonth((current) => addMonths(current, MONTHS_VISIBLE))}
              aria-label="Trimestre siguiente"
              title="Trimestre siguiente"
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
            <Link to="/erp/presupuestos/create">
              <Plus className="mr-1 size-3.5" />
              Crear
            </Link>
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-background">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-muted/10 px-2 py-1.5 text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">Lectura de importes</span>
          <span>
            <span className="font-semibold text-foreground">Ppto.</span> presupuesto
          </span>
          <span>
            <span className="font-semibold text-foreground">Real</span> ejecutado
          </span>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[1160px] table-fixed border-collapse">
            <colgroup>
              <col className="w-[190px]" />
              {months.map((month) => (
                <Fragment key={`${month}-cols`}>
                  <col className="w-[34px]" />
                  <col className="w-[104px]" />
                  <col className="w-[104px]" />
                  <col className="w-[104px]" />
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
                {months.map((month) => (
                  <th
                    key={month}
                    scope="col"
                    colSpan={4}
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
                    <th
                      className="w-[34px] min-w-[34px] max-w-[34px] border-l border-border/40 px-1 py-1 text-right text-[9px] font-medium text-muted-foreground"
                      title="Empleados"
                    >
                      Emp.
                    </th>
                    <th
                      className="w-[104px] min-w-[104px] max-w-[104px] border-l border-border/40 px-1.5 py-1 text-right text-[9px] font-medium text-muted-foreground"
                      title="Egresos"
                    >
                      Egr.
                    </th>
                    <th
                      className="w-[104px] min-w-[104px] max-w-[104px] border-l border-border/40 px-1.5 py-1 text-right text-[9px] font-medium text-muted-foreground"
                      title="Ingresos"
                    >
                      Ing.
                    </th>
                    <th
                      className="w-[104px] min-w-[104px] max-w-[104px] border-l border-r border-border/40 px-1.5 py-1 text-right text-[9px] font-medium text-muted-foreground"
                      title="Resultado"
                    >
                      Res.
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
                    Sin presupuestos ERP en el periodo.
                  </td>
                </tr>
              ) : (
                rows.map((project) => {
                  const projectExpanded = expandedProjects.has(project.proyecto_id);
                  return (
                    <Fragment key={`project-group-${project.proyecto_id}`}>
                      <PresupuestoPanelRow
                        key={`project-${project.proyecto_id}`}
                        id={`project-${project.proyecto_id}`}
                        label={project.proyecto_nombre}
                        level={0}
                        months={months}
                        monthValues={project.months}
                        expandable={project.rubros.length > 0}
                        expanded={projectExpanded}
                        onToggle={() => toggleProject(project.proyecto_id)}
                      />
                      {projectExpanded
                        ? project.rubros.map((rubro) => {
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
                                  expandable={rubro.cuentas.length > 0}
                                  expanded={rubroExpanded}
                                  onToggle={() => toggleRubro(rubroKey)}
                                />
                                {rubroExpanded
                                  ? rubro.cuentas.map((cuenta) => (
                                      <PresupuestoPanelRow
                                        key={`cuenta-${rubroKey}-${cuenta.cuenta_id}`}
                                        id={`cuenta-${rubroKey}-${cuenta.cuenta_id}`}
                                        label={formatCuentaLabel(cuenta)}
                                        level={2}
                                        months={months}
                                        monthValues={cuenta.months}
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
                  {months.map((month) => {
                    const values = totalsByMonth[month] ?? getEmptyMonthValues();
                    const resultado = Number(values.ingresos ?? 0) - Number(values.egresos ?? 0);
                    const realIngresos = Number(values.real_ingresos ?? 0);
                    const realEgresos = Number(values.real_egresos ?? 0);
                    const realResultado = realIngresos - realEgresos;
                    return (
                      <Fragment key={`total-${month}`}>
                        <td
                          className="w-[34px] min-w-[34px] max-w-[34px] overflow-hidden whitespace-nowrap border-l border-border/40 px-1 py-1.5 text-right text-[9px] font-semibold tabular-nums text-muted-foreground"
                          title={formatEmployees(values.empleados)}
                        >
                          {formatEmployees(values.empleados)}
                        </td>
                        <td
                          className="w-[104px] min-w-[104px] max-w-[104px] overflow-hidden border-l border-border/40 px-1.5 py-1.5 text-right text-[9px] font-semibold tabular-nums text-foreground"
                          title={`Egresos: ${formatCurrency(values.egresos)} | Real egreso: ${formatCurrency(realEgresos)}`}
                        >
                          <AmountStack
                            budget={formatCurrency(values.egresos)}
                            real={formatCurrency(realEgresos)}
                          />
                        </td>
                        <td
                          className="w-[104px] min-w-[104px] max-w-[104px] overflow-hidden border-l border-border/40 px-1.5 py-1.5 text-right text-[9px] font-semibold tabular-nums text-foreground"
                          title={`Ingresos: ${formatCurrency(values.ingresos)} | Real ingreso: ${formatCurrency(realIngresos)}`}
                        >
                          <AmountStack
                            budget={formatCurrency(values.ingresos)}
                            real={formatCurrency(realIngresos)}
                          />
                        </td>
                        <td
                          className="w-[104px] min-w-[104px] max-w-[104px] overflow-hidden border-l border-r border-border/40 px-1.5 py-1.5 text-right text-[9px] font-semibold tabular-nums"
                          title={`Resultado: ${formatCurrency(resultado)} | Real resultado: ${formatCurrency(realResultado)}`}
                        >
                          <AmountStack
                            budget={formatCurrency(resultado)}
                            real={formatCurrency(realResultado)}
                            budgetClassName={resultado < 0 ? "text-rose-700" : "text-emerald-700"}
                            realClassName={realResultado < 0 ? "text-rose-700" : "text-emerald-700"}
                          />
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
