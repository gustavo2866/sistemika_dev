"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetList, useNotify } from "ra-core";
import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Save,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiUrl } from "@/lib/dataProvider";
import type { MetodoProyeccion } from "../metodos-proyeccion/model";

type ProjectionValue = {
  periodo: string;
  importe: number;
  importe_real?: number | null;
  importe_pendiente?: number | null;
  importe_comprometido?: number | null;
  descripcion?: string | null;
  estado_periodo?: "ABIERTO" | "CERRADO";
};

type ProjectionQuickEditResponse = {
  cuenta_cash_id: number;
  cuenta_cash_nombre: string;
  metodo_proyeccion_id?: number | null;
  anio: number;
  tipo: "PROYECCION";
  values: ProjectionValue[];
};

export type CashProjectionQuickEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuentaCashId: number | null;
  cuentaCashNombre: string;
  startYear: number;
  onSaved?: () => void | Promise<void>;
};

const MILLION = 1_000_000;
const monthGridClass =
  "grid-cols-[minmax(108px,1fr)_72px_84px_72px_84px_minmax(150px,1.6fr)_86px]";

const buildMonths = (year: number) => Array.from({ length: 24 }, (_, offset) => {
  const value = new Date(year, offset, 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-01`;
});

const formatMonth = (period: string) => new Intl.DateTimeFormat("es-AR", {
  month: "long",
}).format(new Date(`${period.slice(0, 7)}-01T12:00:00`));

const parseDisplayedAmount = (value: string | undefined) => {
  const parsed = Number(String(value ?? "0").trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const fetchProjectionValues = async (
  cuentaCashId: number,
  startYear: number,
): Promise<ProjectionQuickEditResponse> => {
  const token = localStorage.getItem("auth_token");
  const params = new URLSearchParams({
    cuenta_cash_id: String(cuentaCashId),
    anio: String(startYear),
  });
  const response = await fetch(`${apiUrl}/erp/cash/proyectado/quick-edit/values?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.detail || "No se pudieron cargar las proyecciones");
  return result as ProjectionQuickEditResponse;
};

export const CashProjectionQuickEditDialog = ({
  open,
  onOpenChange,
  cuentaCashId,
  cuentaCashNombre,
  startYear,
  onSaved,
}: CashProjectionQuickEditDialogProps) => {
  const notify = useNotify();
  const location = useLocation();
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, string>>({});
  const [pendingValues, setPendingValues] = useState<Record<string, string>>({});
  const [committedValues, setCommittedValues] = useState<Record<string, string>>({});
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState("");
  const [visibleYear, setVisibleYear] = useState(startYear);
  const months = useMemo(() => buildMonths(startYear), [startYear]);
  const query = useQuery({
    queryKey: ["erp-cash-proyectado-quick-edit", cuentaCashId, startYear],
    queryFn: () => fetchProjectionValues(cuentaCashId!, startYear),
    enabled: open && cuentaCashId !== null,
  });
  const methodsQuery = useGetList<MetodoProyeccion>(
    "metodos-proyeccion",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "nombre", order: "ASC" },
      filter: { activo: true },
    },
    { enabled: open },
  );
  const realValues = useMemo(
    () => Object.fromEntries(
      (query.data?.values ?? []).map((item) => [item.periodo, item.importe_real]),
    ),
    [query.data],
  );
  const periodStatuses = useMemo(
    () => Object.fromEntries(
      (query.data?.values ?? []).map((item) => [
        item.periodo,
        item.estado_periodo ?? "ABIERTO",
      ]),
    ),
    [query.data],
  );

  useEffect(() => {
    if (!query.data) return;
    setValues(Object.fromEntries(
      query.data.values.map((item) => [item.periodo, (Number(item.importe || 0) / MILLION).toFixed(2)]),
    ));
    setPendingValues(Object.fromEntries(
      query.data.values.map((item) => [
        item.periodo,
        (Number(item.importe_pendiente || 0) / MILLION).toFixed(2),
      ]),
    ));
    setCommittedValues(Object.fromEntries(
      query.data.values.map((item) => [
        item.periodo,
        (Number(item.importe_comprometido || 0) / MILLION).toFixed(2),
      ]),
    ));
    setDescriptions(Object.fromEntries(
      query.data.values.map((item) => [item.periodo, item.descripcion ?? ""]),
    ));
    setSelectedMethodId(
      query.data.metodo_proyeccion_id == null
        ? ""
        : String(query.data.metodo_proyeccion_id),
    );
  }, [query.data]);

  useEffect(() => {
    if (open) setVisibleYear(startYear);
  }, [open, startYear]);

  const handleCalculate = async () => {
    if (cuentaCashId === null) return;
    const openMonths = months.filter(
      (month) => periodStatuses[month] !== "CERRADO",
    );
    if (openMonths.length === 0) {
      notify("No hay períodos abiertos en el rango visible.", { type: "info" });
      return;
    }
    setCalculating(true);
    try {
      const token = localStorage.getItem("auth_token");
      const params = new URLSearchParams({
        cuenta_cash_id: String(cuentaCashId),
        anio: String(startYear),
        metodo_proyeccion_id: selectedMethodId,
        periodo_desde: openMonths[0],
        periodo_hasta: openMonths[openMonths.length - 1],
      });
      const response = await fetch(
        `${apiUrl}/erp/cash/proyectado/quick-edit/calculate?${params}`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );
      const result = await response.json().catch(() => ({}));
      const errorDetail = typeof result.detail === "string"
        ? result.detail
        : result.detail?.message;
      if (!response.ok) {
        throw new Error(errorDetail || "No se pudo calcular la proyección");
      }
      const calculated = result as ProjectionQuickEditResponse;
      setValues((current) => ({
        ...current,
        ...Object.fromEntries(
          calculated.values
            .filter((item) => periodStatuses[item.periodo] !== "CERRADO")
            .map((item) => [
              item.periodo,
              (Number(item.importe || 0) / MILLION).toFixed(2),
            ]),
        ),
      }));
      notify("Proyección calculada. Revisá los valores antes de guardar.", {
        type: "success",
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo calcular la proyección", {
        type: "error",
      });
    } finally {
      setCalculating(false);
    }
  };

  const buildMethodReturnTo = () => {
    if (cuentaCashId === null) return null;
    const returnParams = new URLSearchParams(location.search);
    returnParams.set("projection_account_id", String(cuentaCashId));
    returnParams.set("projection_account_name", cuentaCashNombre);
    returnParams.set("projection_start_year", String(startYear));
    return `${location.pathname}?${returnParams.toString()}`;
  };

  const handleEditMethod = () => {
    if (!selectedMethodId) return;
    const returnTo = buildMethodReturnTo();
    if (!returnTo) return;
    navigate(`/cashflow/setup/metodos-proyeccion/edit/${selectedMethodId}`, {
      state: { returnTo },
    });
  };

  const handleCreateMethod = () => {
    const returnTo = buildMethodReturnTo();
    if (!returnTo) return;
    navigate("/cashflow/setup/metodos-proyeccion/create", {
      state: { returnTo },
    });
  };

  const handleSave = async () => {
    if (cuentaCashId === null) return;
    setSaving(true);
    try {
      const parsedValues = months.map((periodo) => {
        const rawValue = String(values[periodo] ?? "0").trim().replace(",", ".");
        const numericValue = Number(rawValue || "0");
        if (!Number.isFinite(numericValue)) {
          throw new Error(`El importe de ${periodo.slice(0, 7)} no es válido`);
        }
        const rawPending = String(pendingValues[periodo] ?? "0")
          .trim()
          .replace(",", ".");
        const numericPending = Number(rawPending || "0");
        if (!Number.isFinite(numericPending)) {
          throw new Error(
            `El importe pendiente de ${periodo.slice(0, 7)} no es válido`,
          );
        }
        const rawCommitted = String(committedValues[periodo] ?? "0")
          .trim()
          .replace(",", ".");
        const numericCommitted = Number(rawCommitted || "0");
        if (!Number.isFinite(numericCommitted)) {
          throw new Error(
            `El importe comprometido de ${periodo.slice(0, 7)} no es válido`,
          );
        }
        return {
          periodo,
          importe: (numericValue * MILLION).toFixed(2),
          importe_pendiente: (numericPending * MILLION).toFixed(2),
          importe_comprometido: (numericCommitted * MILLION).toFixed(2),
          descripcion: String(descriptions[periodo] ?? "").trim() || null,
        };
      });
      const token = localStorage.getItem("auth_token");
      const params = new URLSearchParams({
        cuenta_cash_id: String(cuentaCashId),
        anio: String(startYear),
      });
      const response = await fetch(`${apiUrl}/erp/cash/proyectado/quick-edit/values?${params}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          values: parsedValues,
          metodo_proyeccion_id: selectedMethodId
            ? Number(selectedMethodId)
            : null,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "No se pudieron guardar las proyecciones");
      await onSaved?.();
      notify(
        `Proyección actualizada: ${result.created} creados, ${result.updated} modificados. `
          + `Pendientes: ${result.pending_created} creados, `
          + `${result.pending_updated} modificados. `
          + `Comprometidos: ${result.committed_created} creados, `
          + `${result.committed_updated} modificados`,
        { type: "success" },
      );
      onOpenChange(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudieron guardar las proyecciones", {
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderYear = (year: number, yearMonths: string[]) => {
    const realTotal = yearMonths.reduce(
      (total, period) => total + Number(realValues[period] ?? 0) / MILLION,
      0,
    );
    const projectedTotal = yearMonths.reduce(
      (total, period) => total + parseDisplayedAmount(values[period]),
      0,
    );
    const pendingTotal = yearMonths.reduce(
      (total, period) => total + parseDisplayedAmount(pendingValues[period]),
      0,
    );
    const committedTotal = yearMonths.reduce(
      (total, period) => total + parseDisplayedAmount(committedValues[period]),
      0,
    );

    return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200/90
      bg-background shadow-[0_10px_30px_-24px_rgba(15,23,42,0.6)] dark:border-slate-800">
      <div className="grid grid-cols-[36px_1fr_36px] items-center border-b border-slate-200/80
        bg-slate-50/80 px-2 py-2 dark:border-slate-800 dark:bg-slate-950/40">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-full"
          onClick={() => setVisibleYear((current) => current - 1)}
          disabled={visibleYear <= startYear}
          aria-label="Año anterior"
          title="Año anterior"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <div className="text-center">
          <h3 className="text-sm font-bold tracking-[0.08em] text-slate-800 dark:text-slate-100">
            {year}
          </h3>
          <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
            Flujo mensual en millones
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-full"
          onClick={() => setVisibleYear((current) => current + 1)}
          disabled={visibleYear >= startYear + 1}
          aria-label="Año siguiente"
          title="Año siguiente"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
      <div className="px-2 pb-2 pt-1.5">
        <div
          className={`sticky top-0 z-10 grid ${monthGridClass} mb-1 items-stretch gap-1.5
            rounded-lg border border-slate-200/80 bg-white p-1 text-center text-[8px]
            font-bold uppercase tracking-[0.06em] text-slate-600 shadow-sm
            dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300
            [&>span]:flex [&>span]:items-center [&>span]:justify-center [&>span]:rounded-md
            [&>span]:bg-slate-100 [&>span]:px-1 [&>span]:py-1.5 dark:[&>span]:bg-slate-900`}
        >
          <span>Mes</span>
          <span>Real</span>
          <span className="!bg-sky-100 !text-sky-800 dark:!bg-sky-950/70
            dark:!text-sky-300">Proyectado</span>
          <span
            title="Pendiente"
            className="!bg-amber-100 !text-amber-800 dark:!bg-amber-950/70
              dark:!text-amber-300"
          >
            PEND
          </span>
          <span
            title="Comprometido"
            className="!bg-violet-100 !text-violet-800 dark:!bg-violet-950/70
              dark:!text-violet-300"
          >
            COMPR.
          </span>
          <span title="Detalle del importe comprometido">Detalle</span>
          <span className="!bg-indigo-100 !text-indigo-800 dark:!bg-indigo-950/70
            dark:!text-indigo-300">Total</span>
        </div>
        {yearMonths.map((period) => (
          <div
            key={period}
            className={`grid ${monthGridClass} min-h-8 items-center gap-1.5 border-b border-l-2
              border-b-slate-100 px-1 py-0.5 text-[10px] transition-colors last:border-b-0
              dark:border-b-slate-900 ${periodStatuses[period] === "CERRADO"
                ? "border-l-slate-300 bg-slate-50/55 dark:border-l-slate-700 dark:bg-slate-950/25"
                : "border-l-emerald-400 bg-white hover:bg-emerald-50/25 dark:bg-background dark:hover:bg-emerald-950/10"
              }`}
          >
            <span className="flex min-w-0 items-center gap-1.5 capitalize font-medium
              text-slate-700 dark:text-slate-200">
              {periodStatuses[period] === "CERRADO" ? (
                <Lock
                  className="size-3 shrink-0 text-slate-400"
                  aria-label="Período cerrado"
                />
              ) : (
                <LockOpen
                  className="size-3 shrink-0 text-emerald-600"
                  aria-label="Período abierto"
                />
              )}
              <span className="truncate">{formatMonth(period)}</span>
            </span>
            <span
              className={`flex h-7 items-center justify-end rounded-md border border-slate-200/80
                bg-slate-100/70 px-2 text-[10px] font-medium tabular-nums dark:border-slate-800
                dark:bg-slate-900/70 ${Number(realValues[period] ?? 0) < 0
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-slate-600 dark:text-slate-300"
                }`}
              aria-label={`${formatMonth(period)} ${year}, importe real en millones`}
            >
              {realValues[period] == null
                ? "—"
                : (Number(realValues[period]) / MILLION).toFixed(2)}
            </span>
            <Input
              type="text"
              inputMode="decimal"
              value={values[period] ?? "0.00"}
              onChange={(event) => setValues((current) => ({
                ...current,
                [period]: event.target.value,
              }))}
              className="h-7 rounded-md border-sky-200 bg-sky-50/70 px-2 text-right text-[10px]
                font-semibold tabular-nums text-sky-950 shadow-none focus-visible:border-sky-400
                focus-visible:ring-2 focus-visible:ring-sky-200 dark:border-sky-900
                dark:bg-sky-950/30 dark:text-sky-100"
              aria-label={`${formatMonth(period)} ${year}, importe en millones`}
              disabled={saving || calculating || query.isLoading}
            />
            <Input
              type="text"
              inputMode="decimal"
              value={pendingValues[period] ?? "0.00"}
              onChange={(event) => setPendingValues((current) => ({
                ...current,
                [period]: event.target.value,
              }))}
              className="h-7 rounded-md border-amber-200 bg-amber-50/70 px-2 text-right text-[10px]
                font-semibold tabular-nums text-amber-950 shadow-none focus-visible:border-amber-400
                focus-visible:ring-2 focus-visible:ring-amber-200 dark:border-amber-900
                dark:bg-amber-950/30 dark:text-amber-100"
              aria-label={`${formatMonth(period)} ${year}, pendiente en millones`}
              disabled={saving || calculating || query.isLoading}
            />
            <Input
              type="text"
              inputMode="decimal"
              value={committedValues[period] ?? "0.00"}
              onChange={(event) => setCommittedValues((current) => ({
                ...current,
                [period]: event.target.value,
              }))}
              className="h-7 rounded-md border-violet-200 bg-violet-50/70 px-2 text-right
                text-[10px] font-semibold tabular-nums text-violet-950 shadow-none
                focus-visible:border-violet-400 focus-visible:ring-2 focus-visible:ring-violet-200
                disabled:border-slate-200 disabled:bg-slate-100/70 disabled:text-slate-400
                dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100"
              aria-label={`${formatMonth(period)} ${year}, comprometido en millones`}
              disabled={
                saving
                || calculating
                || query.isLoading
                || periodStatuses[period] === "CERRADO"
              }
            />
            <Input
              type="text"
              value={descriptions[period] ?? ""}
              onChange={(event) => setDescriptions((current) => ({
                ...current,
                [period]: event.target.value,
              }))}
              maxLength={255}
              placeholder={periodStatuses[period] === "CERRADO" ? "" : "Detalle"}
              className="h-7 min-w-0 rounded-md border-slate-200 bg-white px-2 text-[10px]
                shadow-none placeholder:text-slate-400 focus-visible:border-slate-400
                focus-visible:ring-2 focus-visible:ring-slate-200 disabled:bg-slate-100/70
                disabled:text-slate-400 dark:border-slate-800 dark:bg-slate-950"
              aria-label={`${formatMonth(period)} ${year}, descripción del comprometido`}
              disabled={
                saving
                || calculating
                || query.isLoading
                || periodStatuses[period] === "CERRADO"
              }
            />
            <span
              className={`flex h-7 items-center justify-end rounded-md border border-indigo-200
                bg-indigo-50 px-2 text-[10px] font-bold tabular-nums dark:border-indigo-900
                dark:bg-indigo-950/40 ${(
                  parseDisplayedAmount(values[period])
                  + parseDisplayedAmount(pendingValues[period])
                  + parseDisplayedAmount(committedValues[period])
                ) < 0
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-indigo-950 dark:text-indigo-100"
                }`}
              aria-label={`${formatMonth(period)} ${year}, total en millones`}
            >
              {(
                parseDisplayedAmount(values[period])
                + parseDisplayedAmount(pendingValues[period])
                + parseDisplayedAmount(committedValues[period])
              ).toFixed(2)}
            </span>
          </div>
        ))}
        <div
          className={`sticky bottom-0 grid ${monthGridClass} mt-1 items-center gap-1.5 rounded-lg
            border border-slate-300 bg-slate-100 p-1 text-[10px] font-bold shadow-sm
            dark:border-slate-700 dark:bg-slate-900`}
        >
          <span className="px-2 text-left uppercase tracking-[0.08em] text-slate-700
            dark:text-slate-200">Total anual</span>
          <span className="rounded-md bg-white px-2 py-1.5 text-right tabular-nums text-slate-700
            dark:bg-slate-950 dark:text-slate-200">{realTotal.toFixed(2)}</span>
          <span className="rounded-md bg-sky-100 px-2 py-1.5 text-right tabular-nums text-sky-900
            dark:bg-sky-950/70 dark:text-sky-200">{projectedTotal.toFixed(2)}</span>
          <span className="rounded-md bg-amber-100 px-2 py-1.5 text-right tabular-nums text-amber-900
            dark:bg-amber-950/70 dark:text-amber-200">{pendingTotal.toFixed(2)}</span>
          <span className="rounded-md bg-violet-100 px-2 py-1.5 text-right tabular-nums
            text-violet-900 dark:bg-violet-950/70 dark:text-violet-200">
            {committedTotal.toFixed(2)}
          </span>
          <span aria-hidden="true" />
          <span className="rounded-md bg-indigo-600 px-2 py-1.5 text-right tabular-nums text-white
            dark:bg-indigo-500">
            {(projectedTotal + pendingTotal + committedTotal).toFixed(2)}
          </span>
        </div>
      </div>
    </section>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!saving && !calculating) onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="grid max-h-[94vh] !w-[96vw] !max-w-[980px]
          grid-rows-[auto_minmax(0,1fr)_auto] gap-3 p-4"
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-tight">Editar proyección</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {cuentaCashNombre}
            </span>
            <span aria-hidden="true">·</span>
            <span>Importes expresados en millones</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/90
          bg-slate-50/70 px-3 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
          <label htmlFor="projection-method" className="shrink-0 text-[11px] font-bold uppercase
            tracking-wide text-slate-600 dark:text-slate-300">
            Método de proyección
          </label>
          <Select
            value={selectedMethodId}
            onValueChange={setSelectedMethodId}
            disabled={saving || calculating || methodsQuery.isLoading}
          >
            <SelectTrigger id="projection-method" size="sm" className="w-64 bg-white dark:bg-slate-950">
              <SelectValue placeholder="Seleccionar método" />
            </SelectTrigger>
            <SelectContent>
              {(methodsQuery.data ?? []).map((method) => (
                <SelectItem key={method.id} value={String(method.id)}>
                  {method.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={handleCreateMethod}
            disabled={saving || calculating}
            aria-label="Crear método de proyección"
            title="Crear método de proyección"
          >
            <Plus className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={handleEditMethod}
            disabled={saving || calculating || !selectedMethodId}
            aria-label="Editar método de proyección"
            title="Editar método de proyección"
          >
            <Pencil className="size-3.5" />
          </Button>
          <div className="ml-auto flex shrink-0 items-center gap-2 text-[10px] font-medium">
            <span className="flex items-center gap-1 rounded-full border border-emerald-200
              bg-emerald-50 px-2 py-1 text-emerald-700 dark:border-emerald-900
              dark:bg-emerald-950/40 dark:text-emerald-300">
              <LockOpen className="size-3" /> Abierto
            </span>
            <span className="flex items-center gap-1 rounded-full border border-slate-200
              bg-white px-2 py-1 text-slate-600 dark:border-slate-800 dark:bg-slate-900
              dark:text-slate-300">
              <Lock className="size-3" /> Cerrado
            </span>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto pr-1">
          {query.isLoading ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />Cargando proyección…
            </div>
          ) : query.error ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-destructive">
              {query.error instanceof Error ? query.error.message : "No se pudieron cargar los valores"}
            </div>
          ) : (
            renderYear(
              visibleYear,
              visibleYear === startYear ? months.slice(0, 12) : months.slice(12, 24),
            )
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving || calculating}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCalculate()}
            disabled={
              saving
              || calculating
              || query.isLoading
              || methodsQuery.isLoading
              || !selectedMethodId
              || Boolean(query.error)
            }
          >
            {calculating
              ? <Loader2 className="mr-1.5 size-4 animate-spin" />
              : <Calculator className="mr-1.5 size-4" />}
            Calcular
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || calculating || query.isLoading || Boolean(query.error)}
          >
            {saving
              ? <Loader2 className="mr-1.5 size-4 animate-spin" />
              : <Save className="mr-1.5 size-4" />}
            Guardar 24 meses
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
