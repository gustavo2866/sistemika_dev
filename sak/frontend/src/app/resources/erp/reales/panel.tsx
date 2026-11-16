"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ChevronRight,
  DollarSign,
  History,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FormProvider, useForm } from "react-hook-form";

import { PROYECTO_ESTADO_CHOICES } from "@/app/resources/constructora/proyectos/model";
import { FinancialKpiCards } from "@/components/financial-kpi-cards";
import { CompactSelectInput } from "@/components/forms/form_order";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/dataProvider";
import { cn } from "@/lib/utils";

import type {
  AnnualValues,
  ProjectOptionsResponse,
  RealesPanelResponse,
} from "./model";

const START_YEAR = 2024;
const currentYear = new Date().getFullYear();
const stateOptions = [
  { id: "all", name: "Todos los estados" },
  ...PROYECTO_ESTADO_CHOICES,
];

type PanelFilterValues = {
  estado: string;
  proyecto: string;
};

const HistoricalPanelFilters = ({
  estado,
  proyectoId,
  projectChoices,
  onEstadoChange,
  onProjectChange,
}: {
  estado: string;
  proyectoId: string;
  projectChoices: Array<{ id: string; name: string }>;
  onEstadoChange: (value: string) => void;
  onProjectChange: (value: string) => void;
}) => {
  const form = useForm<PanelFilterValues>({
    defaultValues: { estado, proyecto: proyectoId },
  });

  useEffect(() => {
    form.setValue("estado", estado, { shouldDirty: false });
  }, [estado, form]);
  useEffect(() => {
    form.setValue("proyecto", proyectoId, { shouldDirty: false });
  }, [form, proyectoId]);

  return (
    <FormProvider {...form}>
      <div className="list-filters flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <CompactSelectInput
          source="estado"
          label="Estado"
          choices={stateOptions}
          optionText="name"
          optionValue="id"
          disableClear
          className="w-[150px]"
          onSelectionChange={(value) => {
            onEstadoChange(value);
            onProjectChange("all");
          }}
        />
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
    </FormProvider>
  );
};

const fetchJson = async <T,>(url: string): Promise<T> => {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.detail === "string" ? payload.detail : "No se pudo cargar el panel",
    );
  }
  return payload as T;
};

const money = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatMoney = (value: number) => money.format(Number(value || 0) / 1_000_000);

const amountTone = (value: number) =>
  value < 0
    ? "text-rose-700 dark:text-rose-300"
    : "";

const AnnualCells = ({
  years,
  values,
  initial,
  total,
  level,
}: {
  years: number[];
  values: Record<string, AnnualValues>;
  initial: AnnualValues;
  total: AnnualValues;
  level: "project" | "category" | "account" | "total";
}) => {
  const historicalClass = {
    project: "bg-background font-semibold text-foreground",
    category: "bg-muted/20 font-medium text-foreground",
    account: "bg-white text-muted-foreground dark:bg-background",
    total: "bg-slate-100 font-bold text-foreground dark:bg-slate-800",
  }[level];
  const currentClass = {
    project: "bg-slate-50 font-semibold text-foreground dark:bg-slate-900/60",
    category: "bg-slate-100/70 font-medium text-foreground dark:bg-slate-900/40",
    account: "bg-slate-50/70 text-muted-foreground dark:bg-slate-900/30",
    total: "bg-slate-200/80 font-bold text-foreground dark:bg-slate-700",
  }[level];

  return (
    <>
      <td className={cn("border-l-2 border-border/60 bg-background px-1 py-1.5 text-right font-semibold tabular-nums", level === "total" && historicalClass, amountTone(initial.historico))}>
        {formatMoney(initial.historico)}
      </td>
      <td className={cn("bg-slate-50 px-1 py-1.5 text-right font-semibold tabular-nums dark:bg-slate-900/60", level === "total" && currentClass, amountTone(initial.actual))}>
        {formatMoney(initial.actual)}
      </td>
      {years.map((year) => {
        const item = values[String(year)] ?? { historico: 0, actual: 0 };
        return (
          <Fragment key={year}>
            <td className={cn("border-l border-border/40 px-1 py-1.5 text-right tabular-nums", historicalClass, amountTone(item.historico))}>
              {formatMoney(item.historico)}
            </td>
            <td className={cn("px-1 py-1.5 text-right tabular-nums", currentClass, amountTone(item.actual))}>
              {formatMoney(item.actual)}
            </td>
          </Fragment>
        );
      })}
      <td className={cn("border-l-2 border-slate-300 bg-slate-100 px-1 py-1.5 text-right font-bold tabular-nums text-foreground dark:border-slate-700 dark:bg-slate-800", level === "account" && "font-semibold", amountTone(total.historico))}>
        {formatMoney(total.historico)}
      </td>
      <td className={cn("bg-slate-200/80 px-1 py-1.5 text-right font-bold tabular-nums text-foreground dark:bg-slate-700", level === "account" && "font-semibold", amountTone(total.actual))}>
        {formatMoney(total.actual)}
      </td>
    </>
  );
};

export const ErpRealesPanel = () => {
  const navigate = useNavigate();
  const [estado, setEstado] = useState("02-ejecucion");
  const [proyectoId, setProyectoId] = useState("all");
  const [anioDesde, setAnioDesde] = useState(START_YEAR);
  const [anioHasta, setAnioHasta] = useState(currentYear);
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const params = useMemo(() => {
    const query = new URLSearchParams({
      anio_desde: String(anioDesde),
      anio_hasta: String(anioHasta),
      estado,
    });
    if (proyectoId !== "all") query.set("proyecto_id", proyectoId);
    return query.toString();
  }, [anioDesde, anioHasta, estado, proyectoId]);

  const panelQuery = useQuery({
    queryKey: ["erp-libro-mayor-reales-panel", params],
    queryFn: () => fetchJson<RealesPanelResponse>(`${apiUrl}/erp/libro-mayor/panel?${params}`),
  });
  const projectsQuery = useQuery({
    queryKey: ["erp-libro-mayor-reales-projects", estado],
    queryFn: () =>
      fetchJson<ProjectOptionsResponse>(
        `${apiUrl}/erp/presupuestos/panel/proyectos?estado=${encodeURIComponent(estado)}`,
      ),
  });

  const toggleProject = (id: number) => {
    setExpandedProjects((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleCategory = (key: string) => {
    setExpandedCategories((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const years = useMemo(() => panelQuery.data?.years ?? [], [panelQuery.data]);
  const projects = useMemo(() => panelQuery.data?.rows ?? [], [panelQuery.data]);
  const reportContentWidth = Math.max(1120, 300 + 140 + years.length * 132 + 150);
  const panelKpis = useMemo(
    () =>
      projects.reduce(
        (totals, project) => {
          totals.saldoInicialHistorico += Number(project.saldo_inicial.historico ?? 0);
          totals.saldoInicialActual += Number(project.saldo_inicial.actual ?? 0);
          totals.totalHistorico += Number(project.total.historico ?? 0);
          totals.totalActual += Number(project.total.actual ?? 0);
          for (const rubro of project.rubros) {
            const isIncome = rubro.rubro_nombre.trim().toLowerCase() === "ingresos";
            for (const year of years) {
              const values = rubro.years[String(year)];
              if (isIncome) {
                totals.ingresosHistoricos += Number(values?.historico ?? 0);
                totals.ingresosActuales += Number(values?.actual ?? 0);
              } else {
                totals.egresosHistoricos -= Number(values?.historico ?? 0);
                totals.egresosActuales -= Number(values?.actual ?? 0);
              }
            }
          }
          return totals;
        },
        {
          saldoInicialHistorico: 0,
          saldoInicialActual: 0,
          ingresosHistoricos: 0,
          ingresosActuales: 0,
          egresosHistoricos: 0,
          egresosActuales: 0,
          totalHistorico: 0,
          totalActual: 0,
        },
      ),
    [projects, years],
  );
  const gridTotals = useMemo(
    () =>
      projects.reduce(
        (totals, project) => {
          totals.saldo_inicial.historico += Number(project.saldo_inicial.historico ?? 0);
          totals.saldo_inicial.actual += Number(project.saldo_inicial.actual ?? 0);
          totals.total.historico += Number(project.total.historico ?? 0);
          totals.total.actual += Number(project.total.actual ?? 0);
          for (const year of years) {
            const values = project.years[String(year)];
            totals.years[String(year)].historico += Number(values?.historico ?? 0);
            totals.years[String(year)].actual += Number(values?.actual ?? 0);
          }
          return totals;
        },
        {
          saldo_inicial: { historico: 0, actual: 0 },
          years: Object.fromEntries(
            years.map((year) => [String(year), { historico: 0, actual: 0 }]),
          ) as Record<string, AnnualValues>,
          total: { historico: 0, actual: 0 },
        },
      ),
    [projects, years],
  );

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
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
            <h1 className="text-xl font-semibold tracking-tight">ERP Histórico</h1>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => panelQuery.refetch()}
            disabled={panelQuery.isFetching}
          >
            <RefreshCw className={cn("mr-1 size-3.5", panelQuery.isFetching && "animate-spin")} />
            Actualizar
          </Button>
        </div>
        <div className="mb-1 w-full min-w-0 rounded-lg bg-muted/30 p-1 sm:mb-2 sm:p-2">
          <div className="flex flex-wrap items-end gap-3">
            <HistoricalPanelFilters
              estado={estado}
              proyectoId={proyectoId}
              onEstadoChange={setEstado}
              onProjectChange={setProyectoId}
              projectChoices={[
                { id: "all", name: "Todos los proyectos" },
                ...(projectsQuery.data?.rows ?? []).map((project) => ({
                  id: String(project.proyecto_id),
                  name: project.proyecto_nombre,
                })),
              ]}
            />
            <label className="grid gap-1 text-[10px] text-muted-foreground">
              Año desde
              <input
                type="number"
                min={START_YEAR}
                max={anioHasta}
                value={anioDesde}
                onChange={(event) => setAnioDesde(Math.max(START_YEAR, Number(event.target.value)))}
                className="h-8 w-[82px] rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-xs"
              />
            </label>
            <label className="grid gap-1 text-[10px] text-muted-foreground">
              Año hasta
              <input
                type="number"
                min={anioDesde}
                value={anioHasta}
                onChange={(event) => setAnioHasta(Math.max(anioDesde, Number(event.target.value)))}
                className="h-8 w-[82px] rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-xs"
              />
            </label>
          </div>
        </div>
        <div className="max-w-full" style={{ width: reportContentWidth }}>
          <FinancialKpiCards
            compact
            items={[
            {
              key: "saldo-inicial",
              title: "Saldo inicial · Histórico",
              value: panelKpis.saldoInicialHistorico,
              secondaryMetric: {
                title: "Actualizado",
                value: panelKpis.saldoInicialActual,
              },
              icon: History,
              iconClassName: "bg-slate-600",
            },
            {
              key: "ingresos",
              title: "Ingresos · Histórico",
              value: panelKpis.ingresosHistoricos,
              secondaryMetric: {
                title: "Actualizado",
                value: panelKpis.ingresosActuales,
              },
              icon: DollarSign,
              iconClassName: "bg-emerald-600",
            },
            {
              key: "egresos",
              title: "Egresos · Histórico",
              value: panelKpis.egresosHistoricos,
              secondaryMetric: {
                title: "Actualizado",
                value: panelKpis.egresosActuales,
              },
              icon: ArrowDownToLine,
              iconClassName: "bg-rose-600",
            },
            {
              key: "saldo-final",
              title: "Saldo final · Histórico",
              value: panelKpis.totalHistorico,
              secondaryMetric: {
                title: "Actualizado",
                value: panelKpis.totalActual,
              },
              icon: BarChart3,
              iconClassName: "bg-indigo-700",
            },
            ]}
          />
        </div>
      </div>

      <div
        className="max-w-full overflow-hidden rounded-md border border-border bg-background"
        style={{ width: reportContentWidth }}
      >
        <div className="overflow-auto">
        {panelQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Cargando reales…</div>
        ) : panelQuery.error ? (
          <div className="p-8 text-center text-sm text-destructive">
            {panelQuery.error instanceof Error ? panelQuery.error.message : "No se pudo cargar el panel"}
          </div>
        ) : projects.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No hay datos para los filtros seleccionados.</div>
        ) : (
          <table className="w-full table-fixed border-collapse text-[9px]">
            <colgroup>
              <col className="w-[240px]" />
              <col />
              <col />
              {years.map((year) => (
                <Fragment key={year}>
                  <col />
                  <col />
                </Fragment>
              ))}
              <col />
              <col />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th rowSpan={2} className="sticky left-0 z-20 w-[240px] border-r border-border bg-muted/30 px-1.5 py-1.5 text-left text-[10px] font-semibold">Proyecto / Rubro / Cuenta <span className="font-normal text-muted-foreground">($ MM)</span></th>
                <th colSpan={2} className="border-l-2 border-border/60 px-1 py-1.5 text-center text-[10px] font-semibold text-slate-700">Saldo inicial</th>
                {years.map((year) => <th key={year} colSpan={2} className="border-l border-border/40 px-1 py-1.5 text-center text-[10px] font-semibold text-slate-700">{year}</th>)}
                <th colSpan={2} className="border-l-2 border-slate-300 bg-slate-100 px-1 py-1.5 text-center text-[10px] font-semibold text-slate-900">Total acumulado</th>
              </tr>
              <tr className="border-b border-border bg-muted/20">
                <th className="border-l-2 border-border/60 px-1 py-1 text-right font-semibold text-slate-600">Hist.</th>
                <th className="border-l border-border/40 bg-slate-50 px-1 py-1 text-right font-semibold text-slate-600">Actual</th>
                {years.map((year) => (
                  <Fragment key={year}>
                    <th className="border-l border-border/40 px-1 py-1 text-right font-semibold text-slate-600">Hist.</th>
                    <th className="border-l border-border/40 bg-slate-50 px-1 py-1 text-right font-semibold text-slate-600">Act. ICC</th>
                  </Fragment>
                ))}
                <th className="border-l-2 border-slate-300 bg-slate-100 px-1 py-1 text-right font-semibold text-slate-700">Hist.</th>
                <th className="border-l border-border/40 bg-slate-100 px-1 py-1 text-right font-semibold text-slate-700">Act. ICC</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const projectOpen = expandedProjects.has(project.proyecto_id);
                return (
                  <Fragment key={project.proyecto_id}>
                    <tr className={cn("group border-b border-border/60 bg-background transition-colors hover:bg-muted/30", projectOpen && "border-y border-sky-200 bg-sky-50 hover:bg-sky-50")}>
                      <td className={cn("sticky left-0 z-[1] max-w-[240px] border-l-4 border-l-transparent border-r border-border/60 bg-inherit px-1.5 py-2 font-medium", projectOpen && "border-l-sky-500 font-semibold text-foreground")}>
                        <button type="button" className="flex w-full items-center gap-1 text-left" onClick={() => toggleProject(project.proyecto_id)}>
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                            {projectOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          </span>
                          <span className="truncate">{project.proyecto_nombre}</span>
                        </button>
                      </td>
                      <AnnualCells years={years} values={project.years} initial={project.saldo_inicial} total={project.total} level="project" />
                    </tr>
                    {projectOpen && project.rubros.map((category) => {
                      const categoryKey = `${project.proyecto_id}-${category.rubro_id}`;
                      const categoryOpen = expandedCategories.has(categoryKey);
                      return (
                        <Fragment key={categoryKey}>
                          <tr className="group border-b border-border/60 bg-muted/20 transition-colors hover:bg-muted/30">
                            <td className="sticky left-0 z-[1] max-w-[240px] border-l-4 border-l-slate-200 border-r border-border/60 bg-inherit px-1.5 py-2 font-medium">
                              <button type="button" className="flex w-full items-center gap-1 pl-4 text-left" onClick={() => toggleCategory(categoryKey)}>
                                <span className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">
                                  {categoryOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                                </span>
                                <span className="truncate">{category.rubro_nombre}</span>
                              </button>
                            </td>
                            <AnnualCells years={years} values={category.years} initial={category.saldo_inicial} total={category.total} level="category" />
                          </tr>
                          {categoryOpen && category.cuentas.map((account) => (
                            <tr key={account.cuenta_id} className="group border-b border-border/60 bg-white text-muted-foreground transition-colors hover:bg-muted/20 dark:bg-background">
                              <td className="sticky left-0 z-[1] max-w-[240px] border-l-4 border-l-slate-100 border-r border-border/60 bg-inherit px-1.5 py-2 text-[9px] font-normal text-muted-foreground">
                                <span className="block truncate pl-10" title={[account.cuenta_numero, account.cuenta_nombre].filter(Boolean).join(" · ")}>
                                  {[account.cuenta_numero, account.cuenta_nombre].filter(Boolean).join(" · ")}
                                </span>
                              </td>
                              <AnnualCells years={years} values={account.years} initial={account.saldo_inicial} total={account.total} level="account" />
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                <td className="sticky left-0 z-[1] border-r border-border/60 bg-slate-100 px-1.5 py-2 font-bold text-foreground dark:bg-slate-800">
                  Total general
                </td>
                <AnnualCells
                  years={years}
                  values={gridTotals.years}
                  initial={gridTotals.saldo_inicial}
                  total={gridTotals.total}
                  level="total"
                />
              </tr>
            </tfoot>
          </table>
        )}
        </div>
      </div>
    </div>
  );
};

export default ErpRealesPanel;
