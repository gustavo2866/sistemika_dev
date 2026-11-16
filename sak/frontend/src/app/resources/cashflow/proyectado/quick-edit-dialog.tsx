"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetList, useNotify } from "ra-core";
import {
  Calculator,
  Loader2,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  ReceiptText,
  Save,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/confirm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiUrl } from "@/lib/dataProvider";
import { cn } from "@/lib/utils";
import { getTotalProyectado, type ProjectionBase } from "./model";
import type { MetodoProyeccion } from "../metodos-proyeccion/model";
import type { ErpCashCuenta } from "../cuentas/model";
import { CashPendingProjectionDetailDialog } from "../pendientes-input";
import type { CashProjectionHorizon } from "./horizon";

type ProjectionValue = {
  periodo: string;
  importe_proyectado: number;
  origen_proyectado?: "MANUAL" | "CALCULADO";
  total_proyectado?: number;
  tipo_calculo?: ProjectionBase;
  importe_real?: number | null;
  importe_pendiente?: number | null;
  importe_comprometido?: number | null;
  descripcion?: string | null;
  estado_periodo?: "ABIERTO" | "EN_CIERRE" | "CERRADO";
};

type ProjectionQuickEditResponse = CashProjectionHorizon & {
  cuenta_cash_id: number;
  cuenta_cash_nombre: string;
  metodo_proyeccion_id?: number | null;
  cuenta_cash_referencia_id?: number | null;
  porcentaje?: number | null;
  anio: number;
  tipo_calculo?: ProjectionBase;
  primer_periodo_abierto?: string | null;
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

type ProjectionFormState = {
  values: Record<string, string>;
  projectionOrigins: Record<string, "MANUAL" | "CALCULADO">;
  pendingValues: Record<string, string>;
  committedValues: Record<string, string>;
  descriptions: Record<string, string>;
  selectedMethodId: string;
  referenceAccountId: string;
  relationalFactor: string;
  periodFrom: string;
};

type ProjectionDraft = {
  accountId: number;
  year: number;
  form: ProjectionFormState;
  initial: ProjectionFormState;
  scrollTop: number;
};

const restoreProjectionDraft = (draft: ProjectionDraft, latest: ProjectionFormState): ProjectionFormState => {
  const merge = <T extends string,>(field: Record<string, T>, original: Record<string, T>, fresh: Record<string, T>) =>
    Object.fromEntries(Object.entries(fresh).map(([key, value]) => [key, field[key] !== original[key] ? field[key] ?? value : value])) as Record<string, T>;
  return {
    values: merge(draft.form.values, draft.initial.values, latest.values),
    projectionOrigins: merge(draft.form.projectionOrigins, draft.initial.projectionOrigins, latest.projectionOrigins),
    pendingValues: merge(draft.form.pendingValues, draft.initial.pendingValues, latest.pendingValues),
    committedValues: merge(draft.form.committedValues, draft.initial.committedValues, latest.committedValues),
    descriptions: merge(draft.form.descriptions, draft.initial.descriptions, latest.descriptions),
    selectedMethodId: draft.form.selectedMethodId !== draft.initial.selectedMethodId ? draft.form.selectedMethodId : latest.selectedMethodId,
    referenceAccountId: draft.form.referenceAccountId !== draft.initial.referenceAccountId ? draft.form.referenceAccountId : latest.referenceAccountId,
    relationalFactor: draft.form.relationalFactor !== draft.initial.relationalFactor ? draft.form.relationalFactor : latest.relationalFactor,
    periodFrom: draft.form.periodFrom !== draft.initial.periodFrom ? draft.form.periodFrom : latest.periodFrom,
  };
};

const MILLION = 1_000_000;

const projectionFormState = (data: ProjectionQuickEditResponse): ProjectionFormState => ({
  values: Object.fromEntries(data.values.map((item) => [item.periodo, (Number(item.importe_proyectado || 0) / MILLION).toFixed(2)])),
  projectionOrigins: Object.fromEntries(data.values.map((item) => [item.periodo, item.origen_proyectado ?? "MANUAL"])),
  pendingValues: Object.fromEntries(data.values.map((item) => [item.periodo, (Number(item.importe_pendiente || 0) / MILLION).toFixed(2)])),
  committedValues: Object.fromEntries(data.values.map((item) => [item.periodo, (Number(item.importe_comprometido || 0) / MILLION).toFixed(2)])),
  descriptions: Object.fromEntries(data.values.map((item) => [item.periodo, item.descripcion ?? ""])),
  selectedMethodId: data.metodo_proyeccion_id == null ? "" : String(data.metodo_proyeccion_id),
  referenceAccountId: data.cuenta_cash_referencia_id == null ? "" : String(data.cuenta_cash_referencia_id),
  relationalFactor: data.porcentaje == null ? "" : String(data.porcentaje),
  periodFrom: data.proyeccion_desde.slice(0, 7),
});
const monthGridClass =
  "grid-cols-[90px_52px_72px_84px_72px_84px_minmax(150px,1fr)_86px]";

const formatPeriod = (period: string) => `${period.slice(0, 4)} ${["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][Number(period.slice(5, 7)) - 1]}`;

const formatMonth = (period: string) => new Intl.DateTimeFormat("es-AR", {
  month: "long",
}).format(new Date(`${period.slice(0, 7)}-01T12:00:00`));

const parseDisplayedAmount = (value: string | undefined) => {
  const parsed = Number(String(value ?? "0").trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const endOfMonth = (period: string) => {
  const [year, month] = period.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
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
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, string>>({});
  const [projectionOrigins, setProjectionOrigins] = useState<Record<string, "MANUAL" | "CALCULADO">>({});
  const [pendingValues, setPendingValues] = useState<Record<string, string>>({});
  const [committedValues, setCommittedValues] = useState<Record<string, string>>({});
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState("");
  const [referenceAccountId, setReferenceAccountId] = useState("");
  const [relationalFactor, setRelationalFactor] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [historicalSaveConfirmOpen, setHistoricalSaveConfirmOpen] = useState(false);
  const [initialForm, setInitialForm] = useState<ProjectionFormState | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const pendingExitRef = useRef<(() => void) | null>(null);
  const initializedFormScopeRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const currentForm: ProjectionFormState = {
    values, projectionOrigins, pendingValues, committedValues, descriptions,
    selectedMethodId, referenceAccountId, relationalFactor, periodFrom,
  };
  const hasUnsavedChanges = initialForm !== null && JSON.stringify(currentForm) !== JSON.stringify(initialForm);
  useEffect(() => { dirtyRef.current = hasUnsavedChanges; }, [hasUnsavedChanges]);
  const requestExit = (action: () => void) => {
    if (saving || calculating) return;
    if (hasUnsavedChanges) {
      pendingExitRef.current = action;
      setDiscardConfirmOpen(true);
    } else {
      action();
    }
  };
  const [pendingDetailTarget, setPendingDetailTarget] = useState<{
    dueDateFrom: string;
    dueDateTo: string;
  } | null>(null);
  const monthsScrollRef = useRef<HTMLDivElement>(null);
  const columnsHeaderRef = useRef<HTMLDivElement>(null);
  const initiallyPositionedRef = useRef(false);
  const query = useQuery({
    queryKey: ["erp-cash-proyectado-quick-edit", cuentaCashId, startYear],
    queryFn: () => fetchProjectionValues(cuentaCashId!, startYear),
    enabled: open && cuentaCashId !== null,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const months = useMemo(() => (query.data?.values ?? []).map((item) => item.periodo), [query.data]);
  const validPeriodFrom = Boolean(query.data && /^\d{4}-(0[1-9]|1[0-2])$/.test(periodFrom)
    && periodFrom >= "2026-01" && periodFrom <= query.data.proyeccion_desde.slice(0, 7));
  const historicalEditing = Boolean(validPeriodFrom && query.data && periodFrom < query.data.proyeccion_desde.slice(0, 7));
  const isEditablePeriod = (period: string) => Boolean(query.data
    && validPeriodFrom && period >= `${periodFrom}-01` && period <= query.data.proyeccion_hasta
    && (historicalEditing || periodStatuses[period] !== "CERRADO"));
  const methodsQuery = useGetList<MetodoProyeccion>(
    "metodos-proyeccion",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "nombre", order: "ASC" },
      filter: { activo: true },
    },
    { enabled: open },
  );
  const methodChanged = selectedMethodId !== String(query.data?.metodo_proyeccion_id ?? "");
  const selectedMethod = methodsQuery.data?.find((method) => String(method.id) === selectedMethodId);
  const selectedBase = selectedMethod?.tipo_calculo ?? query.data?.tipo_calculo ?? "HISTORICO";
  const pendingActive = selectedBase === "PENDIENTE";
  const inactiveColumnClass = "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-500";
  const isRelational = selectedBase === "RELACIONAL";
  const parsedFactor = Number(relationalFactor.trim().replace(",", "."));
  const validRelational = !isRelational || (Boolean(referenceAccountId) && relationalFactor.trim() !== "" && Number.isFinite(parsedFactor));
  const accountsQuery = useGetList<ErpCashCuenta>("erp/cash/cuentas", {
    pagination: { page: 1, perPage: 1000 }, sort: { field: "descripcion", order: "ASC" }, filter: {},
  }, { enabled: open && isRelational });

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
    initiallyPositionedRef.current = false;
  }, [open, cuentaCashId, startYear, periodFrom]);

  useEffect(() => {
    if (!open || query.isFetching || query.error || !query.data || initiallyPositionedRef.current) return;
    const lastClosed = query.data.ultimo_periodo_cerrado?.slice(0, 7);
    const targetPeriod = (historicalEditing ? months.find((period) => period.startsWith(periodFrom)) : undefined)
      ?? (lastClosed ? months.find((period) => period.startsWith(lastClosed)) : undefined)
      ?? months.filter((period) => periodStatuses[period] === "CERRADO").at(-1)
      ?? months[0];
    const frame = requestAnimationFrame(() => {
      const container = monthsScrollRef.current;
      const row = container?.querySelector<HTMLElement>(`[data-period="${targetPeriod}"]`);
      if (!container || !row) return;
      container.scrollTop = Math.max(0, row.offsetTop - (columnsHeaderRef.current?.offsetHeight ?? 0) - 4);
      initiallyPositionedRef.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [open, query.isFetching, query.error, query.data, months, periodStatuses, periodFrom, historicalEditing]);

  useEffect(() => {
    if (!open) {
      initializedFormScopeRef.current = null;
      pendingExitRef.current = null;
      setDiscardConfirmOpen(false);
      setHistoricalSaveConfirmOpen(false);
      return;
    }
    if (!query.data) return;
    const draftId = new URLSearchParams(location.search).get("projection_draft");
    const draftKey = ["projection-editor-draft", draftId];
    const draft = draftId ? queryClient.getQueryData<ProjectionDraft>(draftKey) : undefined;
    if (draft && query.isFetching) return;
    const scope = `${cuentaCashId}:${startYear}`;
    if (initializedFormScopeRef.current === scope && dirtyRef.current) return;
    const initial = projectionFormState(query.data);
    const validDraft = draft?.accountId === cuentaCashId && draft?.year === startYear ? draft : undefined;
    const form = validDraft ? restoreProjectionDraft(validDraft, initial) : initial;
    setValues(form.values);
    setProjectionOrigins(form.projectionOrigins);
    setPendingValues(form.pendingValues);
    setCommittedValues(form.committedValues);
    setDescriptions(form.descriptions);
    setSelectedMethodId(form.selectedMethodId);
    setReferenceAccountId(form.referenceAccountId);
    setRelationalFactor(form.relationalFactor);
    setPeriodFrom(form.periodFrom);
    setInitialForm(initial);
    initializedFormScopeRef.current = scope;
    if (validDraft) {
      queryClient.removeQueries({ queryKey: draftKey, exact: true });
      requestAnimationFrame(() => {
        if (monthsScrollRef.current) monthsScrollRef.current.scrollTop = validDraft.scrollTop;
        initiallyPositionedRef.current = true;
      });
    }
  }, [open, query.data, query.isFetching, cuentaCashId, startYear, location.search, queryClient]);

  const openPendingDetail = (period: string) => {
    setPendingDetailTarget({
      dueDateFrom: query.data?.primer_periodo_abierto === period
        ? "0001-01-01"
        : period,
      dueDateTo: endOfMonth(period),
    });
  };

  const handleCalculate = async () => {
    if (cuentaCashId === null || !validRelational || !validPeriodFrom) return;
    const openMonths = months.filter(
      (month) => isEditablePeriod(month),
    );
    if (openMonths.length === 0) {
      notify("No hay períodos disponibles para calcular.", { type: "info" });
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
      if (isRelational) {
        params.set("cuenta_cash_referencia_id", referenceAccountId);
        params.set("porcentaje", relationalFactor.trim().replace(",", "."));
      }
      const previewValues = openMonths.map((periodo) => {
        const value = Number(String(values[periodo] ?? "0").trim().replace(",", "."));
        if (!Number.isFinite(value)) throw new Error(`El importe de ${periodo.slice(0, 7)} no es válido`);
        const stored = query.data?.values.find((item) => item.periodo === periodo);
        return {
          periodo,
          importe_proyectado: stored && values[periodo] === (Number(stored.importe_proyectado) / MILLION).toFixed(2)
            ? String(stored.importe_proyectado) : (value * MILLION).toFixed(2),
          origen_proyectado: projectionOrigins[periodo] ?? "MANUAL",
        };
      });
      const response = await fetch(
        `${apiUrl}/erp/cash/proyectado/quick-edit/calculate?${params}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ values: previewValues, periodo_referencia: `${periodFrom}-01` }),
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
            .filter((item) => isEditablePeriod(item.periodo)
              && projectionOrigins[item.periodo] === "CALCULADO")
            .map((item) => [
              item.periodo,
              (Number(item.importe_proyectado || 0) / MILLION).toFixed(2),
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

  const buildReturnTo = () => {
    if (cuentaCashId === null) return null;
    const draftId = crypto.randomUUID();
    queryClient.setQueryDefaults(["projection-editor-draft"], { gcTime: Infinity });
    queryClient.setQueryData<ProjectionDraft>(["projection-editor-draft", draftId], {
      accountId: cuentaCashId, year: startYear, form: currentForm,
      initial: initialForm ?? currentForm, scrollTop: monthsScrollRef.current?.scrollTop ?? 0,
    });
    const returnParams = new URLSearchParams(location.search);
    returnParams.set("projection_account_id", String(cuentaCashId));
    returnParams.set("projection_account_name", cuentaCashNombre);
    returnParams.set("projection_start_year", String(startYear));
    returnParams.set("projection_draft", draftId);
    return `${location.pathname}?${returnParams.toString()}`;
  };

  const handleEditMethod = () => {
    if (!selectedMethodId || saving || calculating) return;
    const returnTo = buildReturnTo();
    if (!returnTo) return;
    navigate(`/cashflow/setup/metodos-proyeccion/edit/${selectedMethodId}`, {
      state: { returnTo },
    });
  };

  const handleCreateMethod = () => {
    if (saving || calculating) return;
    const returnTo = buildReturnTo();
    if (!returnTo) return;
    navigate("/cashflow/setup/metodos-proyeccion/create", {
      state: { returnTo },
    });
  };

  const handleEditAccount = () => {
    if (saving || calculating) return;
    const returnTo = buildReturnTo();
    if (!returnTo || cuentaCashId === null) return;
    navigate(`/cashflow/setup/cuentas/edit/${cuentaCashId}?returnTo=${encodeURIComponent(returnTo)}`, {
      state: { returnTo },
    });
  };

  const handleSave = async (historicalConfirmed = false) => {
    if (!validPeriodFrom) return;
    const changesBeforeFrom = months.some((period) => period < `${periodFrom}-01` && initialForm
      && (values[period] !== initialForm.values[period]
        || projectionOrigins[period] !== initialForm.projectionOrigins[period]
        || committedValues[period] !== initialForm.committedValues[period]
        || descriptions[period] !== initialForm.descriptions[period]));
    if (changesBeforeFrom) {
      notify("Hay cambios anteriores a Período desde. Ampliá el rango para poder guardarlos.", { type: "warning" });
      return;
    }
    if (historicalEditing && !historicalConfirmed) {
      setHistoricalSaveConfirmOpen(true);
      return;
    }
    if (cuentaCashId === null || !validRelational) return;
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
          importe_proyectado: initialForm && values[periodo] === initialForm.values[periodo]
            ? String(query.data?.values.find((item) => item.periodo === periodo)?.importe_proyectado ?? 0)
            : (numericValue * MILLION).toFixed(2),
          origen_proyectado: projectionOrigins[periodo] ?? "MANUAL",
          importe_pendiente: initialForm && pendingValues[periodo] === initialForm.pendingValues[periodo]
            ? String(query.data?.values.find((item) => item.periodo === periodo)?.importe_pendiente ?? 0)
            : (numericPending * MILLION).toFixed(2),
          importe_comprometido: initialForm && committedValues[periodo] === initialForm.committedValues[periodo]
            ? String(query.data?.values.find((item) => item.periodo === periodo)?.importe_comprometido ?? 0)
            : (numericCommitted * MILLION).toFixed(2),
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
          periodo_referencia: `${periodFrom}-01`,
          confirmar_historico: historicalConfirmed,
          ...(isRelational ? { cuenta_cash_referencia_id: Number(referenceAccountId), porcentaje: relationalFactor.trim().replace(",", ".") } : {}),
          metodo_proyeccion_id: methodChanged && selectedMethodId
            ? Number(selectedMethodId)
            : null,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "No se pudieron guardar las proyecciones");
      await onSaved?.();
      notify(
        `Proyección actualizada: ${result.created} períodos creados, ${result.updated} modificados.`,
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

  const totalForPeriod = (period: string) => {
    const stored = query.data?.values.find((item) => item.periodo === period);
    if (!isEditablePeriod(period)) return Number(stored?.total_proyectado ?? 0) / MILLION;
    return getTotalProyectado(
      methodChanged ? selectedBase : stored?.tipo_calculo ?? selectedBase,
      parseDisplayedAmount(values[period]),
      parseDisplayedAmount(pendingValues[period]),
      parseDisplayedAmount(committedValues[period]),
    );
  };

  const renderMonths = () => {
    const totalPeriods = months.filter((period) =>
      periodStatuses[period] === "ABIERTO" || periodStatuses[period] === "EN_CIERRE");
    const projectedTotal = totalPeriods.reduce(
      (total, period) => total + parseDisplayedAmount(values[period]),
      0,
    );
    const pendingTotal = totalPeriods.reduce(
      (total, period) => total + parseDisplayedAmount(pendingValues[period]),
      0,
    );
    const committedTotal = totalPeriods.reduce(
      (total, period) => total + parseDisplayedAmount(committedValues[period]),
      0,
    );

    return (
    <section className="min-w-0 rounded-xl border border-slate-200/90
      bg-background shadow-[0_10px_30px_-24px_rgba(15,23,42,0.6)] dark:border-slate-800">
      <div className="px-2 pb-2 pt-1.5">
        <div
          ref={columnsHeaderRef}
          className={`sticky top-0 z-10 grid ${monthGridClass} mb-1 items-stretch gap-1.5
            rounded-lg border border-slate-200/80 bg-white p-1 text-center text-[8px]
            font-bold uppercase tracking-[0.06em] text-slate-600 shadow-sm
            dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300
            [&>span]:flex [&>span]:items-center [&>span]:justify-center [&>span]:rounded-md
            [&>span]:bg-slate-100 [&>span]:px-1 [&>span]:py-1.5 dark:[&>span]:bg-slate-900`}
        >
          <span>Período</span>
          <span>Manual</span>
          <span>Real</span>
          <span
            title={pendingActive ? "No participa en el total con este método" : "Participa en el total"}
            className={pendingActive
              ? "!bg-slate-100 !text-slate-400 dark:!bg-slate-900 dark:!text-slate-500"
              : "!bg-sky-100 !text-sky-800 ring-1 ring-inset ring-sky-200 dark:!bg-sky-950/70 dark:!text-sky-300 dark:ring-sky-800"}
          >Proyectado</span>
          <span
            title={pendingActive ? "Pendiente: participa en el total" : "Pendiente: no participa en el total con este método"}
            className={pendingActive
              ? "!bg-amber-100 !text-amber-800 ring-1 ring-inset ring-amber-200 dark:!bg-amber-950/70 dark:!text-amber-300 dark:ring-amber-800"
              : "!bg-slate-100 !text-slate-400 dark:!bg-slate-900 dark:!text-slate-500"}
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
        {months.map((period, index) => (
          <Fragment key={period}>
          {index > 0 && period.slice(0, 4) !== months[index - 1].slice(0, 4) && (
            <div className="h-2" aria-hidden="true" />
          )}
          <div
            data-period={period}
            className={`grid ${monthGridClass} min-h-8 items-center gap-1.5 border-b
              border-slate-100 bg-white px-1 py-0.5 text-[10px] last:border-b-0
              dark:border-slate-900 dark:bg-background`}
          >
            <span
              className={cn(
                "flex min-w-0 items-center gap-1.5 rounded-md px-1 py-1 capitalize font-medium text-slate-700 dark:text-slate-200",
                period.slice(0, 7) === periodFrom
                  && "bg-sky-100 font-semibold text-sky-900 ring-1 ring-inset ring-sky-300 dark:bg-sky-950/60 dark:text-sky-200 dark:ring-sky-700",
              )}
              aria-current={period.slice(0, 7) === periodFrom ? "date" : undefined}
              title={periodStatuses[period] === "CERRADO" ? "Cerrado" : periodStatuses[period] === "EN_CIERRE" ? "En cierre" : "Abierto"}
            >
              {periodStatuses[period] === "CERRADO" ? (
                <Lock className="size-3 shrink-0 text-slate-400" aria-label="Cerrado" />
              ) : (
                <LockOpen
                  className={cn("size-3 shrink-0 text-emerald-500", periodStatuses[period] === "EN_CIERRE" && "text-amber-600 dark:text-amber-400")}
                  aria-label={periodStatuses[period] === "EN_CIERRE" ? "En cierre" : "Abierto"}
                />
              )}
              <span className="truncate">{formatPeriod(period)}</span>
            </span>
            <Switch
              checked={projectionOrigins[period] !== "CALCULADO"}
              aria-label={`Manual para ${period}`}
              title={projectionOrigins[period] === "CALCULADO"
                ? "Calculado: activar Manual para editar el importe"
                : "Manual: desactivar para aplicar el método al actualizar Cash"}
              className="justify-self-center"
              disabled={saving || calculating || query.isLoading || !isEditablePeriod(period)}
              onCheckedChange={(checked) => setProjectionOrigins((current) => ({
                ...current,
                [period]: checked ? "MANUAL" : "CALCULADO",
              }))}
            />
            <span
              className={`flex h-7 items-center justify-end rounded-md border border-slate-200/80
                bg-slate-100/70 px-2 text-[10px] font-medium tabular-nums dark:border-slate-800
                dark:bg-slate-900/70 ${Number(realValues[period] ?? 0) < 0
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-slate-600 dark:text-slate-300"
                }`}
              aria-label={`${formatMonth(period)} ${period.slice(0, 4)}, importe real en millones`}
            >
              {realValues[period] == null
                ? "—"
                : (Number(realValues[period]) / MILLION).toFixed(2)}
            </span>
            <Input
              type="text"
              inputMode="decimal"
              value={values[period] ?? "0.00"}
              readOnly={projectionOrigins[period] === "CALCULADO"}
              onChange={(event) => {
                setValues((current) => ({ ...current, [period]: event.target.value }));
                setProjectionOrigins((current) => ({ ...current, [period]: "MANUAL" }));
              }}
              className={cn("h-7 rounded-md px-2 text-right text-[10px] font-semibold tabular-nums shadow-none",
                pendingActive ? inactiveColumnClass
                  : projectionOrigins[period] === "CALCULADO"
                    ? "border-sky-200 bg-sky-50/70 text-sky-950 disabled:opacity-50 read-only:opacity-50 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100"
                    : "border-sky-200 bg-sky-50/70 text-sky-950 focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-200 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100")}
              aria-label={`${formatMonth(period)} ${period.slice(0, 4)}, importe en millones`}
              title={pendingActive ? "No participa en el total con este método" : projectionOrigins[period] === "CALCULADO"
                ? "Valor calculado: se recalcula al reconstruir Cash"
                : "Valor manual: se conserva al reconstruir Cash"}
              disabled={saving || calculating || query.isLoading || !isEditablePeriod(period)}
            />
            <div className="relative min-w-0">
              <Input
                type="text"
                inputMode="decimal"
                value={pendingValues[period] ?? "0.00"}
                onChange={(event) => setPendingValues((current) => ({
                  ...current,
                  [period]: event.target.value,
                }))}
                className={cn("h-7 rounded-md px-2 pr-6 text-right text-[10px] font-semibold tabular-nums shadow-none",
                  pendingActive
                    ? "border-amber-200 bg-amber-50/70 text-amber-950 focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-200 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                    : inactiveColumnClass)}
                title={pendingActive ? "Participa en el total" : "No participa en el total con este método"}
                aria-label={`${formatMonth(period)} ${period.slice(0, 4)}, pendiente en millones`}
                disabled={saving || calculating || query.isLoading || !isEditablePeriod(period)
                  || periodStatuses[period] === "CERRADO" || period < (query.data?.proyeccion_desde ?? "")}
              />
              {cuentaCashId !== null && parseDisplayedAmount(pendingValues[period]) !== 0 ? (
                <button
                  type="button"
                  onClick={() => openPendingDetail(period)}
                  className={cn("absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-1",
                    pendingActive
                      ? "text-amber-700 hover:bg-amber-200/70 hover:text-amber-950 focus-visible:ring-amber-500 dark:text-amber-300 dark:hover:bg-amber-900/70"
                      : "text-slate-400 hover:bg-slate-200/70 focus-visible:ring-slate-400 dark:text-slate-500 dark:hover:bg-slate-800")}
                  aria-label={`Ver comprobantes pendientes de ${formatMonth(period)} ${period.slice(0, 4)}`}
                  title="Ver comprobantes pendientes"
                >
                  <ReceiptText className="size-3" />
                </button>
              ) : null}
            </div>
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
              aria-label={`${formatMonth(period)} ${period.slice(0, 4)}, comprometido en millones`}
              disabled={
                saving
                || calculating
                || query.isLoading
                || !isEditablePeriod(period)
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
              placeholder={!isEditablePeriod(period) ? "" : "Detalle"}
              className="h-7 min-w-0 rounded-md border-slate-200 bg-white px-2 text-[10px]
                shadow-none placeholder:text-slate-400 focus-visible:border-slate-400
                focus-visible:ring-2 focus-visible:ring-slate-200 disabled:bg-slate-100/70
                disabled:text-slate-400 dark:border-slate-800 dark:bg-slate-950"
              aria-label={`${formatMonth(period)} ${period.slice(0, 4)}, descripción del comprometido`}
              disabled={
                saving
                || calculating
                || query.isLoading
                || !isEditablePeriod(period)
              }
            />
            <span
              className={`flex h-7 items-center justify-end rounded-md border border-indigo-200
                bg-indigo-50 px-2 text-[10px] font-bold tabular-nums dark:border-indigo-900
                dark:bg-indigo-950/40 ${(
                  totalForPeriod(period)
                ) < 0
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-indigo-950 dark:text-indigo-100"
                }`}
              aria-label={`${formatMonth(period)} ${period.slice(0, 4)}, total en millones`}
            >
              {(
                totalForPeriod(period)
              ).toFixed(2)}
            </span>
          </div>
          </Fragment>
        ))}
        <div
          className={`sticky bottom-0 grid ${monthGridClass} mt-1 items-center gap-1.5 rounded-lg
            border border-slate-300 bg-slate-100 p-1 text-[10px] font-bold shadow-sm
            dark:border-slate-700 dark:bg-slate-900`}
        >
          <span className="col-span-3 px-2 text-left uppercase tracking-[0.08em] text-slate-700
            dark:text-slate-200">Total proyectado</span>
          <span className={cn("rounded-md px-2 py-1.5 text-right tabular-nums",
            pendingActive ? inactiveColumnClass : "bg-sky-100 text-sky-900 dark:bg-sky-950/70 dark:text-sky-200")}>{projectedTotal.toFixed(2)}</span>
          <span className={cn("rounded-md px-2 py-1.5 text-right tabular-nums",
            pendingActive ? "bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200" : inactiveColumnClass)}>{pendingTotal.toFixed(2)}</span>
          <span className="rounded-md bg-violet-100 px-2 py-1.5 text-right tabular-nums
            text-violet-900 dark:bg-violet-950/70 dark:text-violet-200">
            {committedTotal.toFixed(2)}
          </span>
          <span aria-hidden="true" />
          <span className="rounded-md bg-indigo-600 px-2 py-1.5 text-right tabular-nums text-white
            dark:bg-indigo-500">
            {totalPeriods.reduce((total, period) => total + totalForPeriod(period), 0).toFixed(2)}
          </span>
        </div>
      </div>
    </section>
    );
  };

  return (
    <>
      <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) requestExit(() => onOpenChange(false));
        else onOpenChange(true);
      }}
    >
      <DialogContent
        className="grid h-[94vh] max-h-[94vh] !w-[96vw] !max-w-[980px]
          grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 p-4"
      >
        <DialogHeader className="gap-3">
          <DialogTitle className="text-lg font-bold tracking-tight">Editar proyección</DialogTitle>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-slate-50/50 px-3 py-2 text-left dark:border-slate-800 dark:bg-slate-950/30">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {cuentaCashNombre}
              </p>
              <DialogDescription className="text-[10px] leading-tight text-muted-foreground">
                Importes expresados en millones
                {query.data && <span className="mt-1 block">
                  Proyección: {query.data.proyeccion_desde.slice(0, 7)} a {query.data.proyeccion_hasta.slice(0, 7)} · {query.data.meses_proyeccion} meses
                </span>}
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5 px-2.5 text-[11px]"
              onClick={handleEditAccount}
              disabled={saving || calculating || cuentaCashId === null}
              aria-label="Editar cuenta Cash"
              title="Editar cuenta Cash"
            >
              <Pencil className="size-3.5" />
              Editar cuenta
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200/90
          bg-slate-50/70 px-3 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
          <div className="grid gap-1">
          <label htmlFor="projection-method" className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
            Método de proyección
          </label>
          <Select
            value={selectedMethodId}
            onValueChange={setSelectedMethodId}
            disabled={saving || calculating || methodsQuery.isLoading}
          >
            <SelectTrigger id="projection-method" size="sm" className="w-48 bg-white dark:bg-slate-950">
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
          </div>
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
          {isRelational && <>
            <div className="grid min-w-44 flex-1 gap-1">
              <label htmlFor="projection-reference" className="text-[10px] font-medium text-slate-600 dark:text-slate-300">Cuenta Cash *</label>
              <Select value={referenceAccountId} onValueChange={setReferenceAccountId} disabled={saving || calculating || accountsQuery.isLoading}>
                <SelectTrigger id="projection-reference" size="sm" className="w-full bg-white dark:bg-slate-950" aria-required="true">
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {(accountsQuery.data ?? []).filter((account) => String(account.id) !== String(cuentaCashId)).map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>{account.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid w-24 gap-1">
              <label htmlFor="projection-factor" className="text-[10px] font-medium text-slate-600 dark:text-slate-300">Factor (%) *</label>
              <Input id="projection-factor" type="text" inputMode="decimal" required aria-required="true"
                value={relationalFactor} onChange={(event) => setRelationalFactor(event.target.value)}
                disabled={saving || calculating} className="h-8 bg-white dark:bg-slate-950"
                placeholder="Ej. 5" title="5 equivale al 5 % del proyectado de la cuenta Cash" />
            </div>
          </>}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto h-8 shrink-0 gap-1.5 px-2.5 text-[11px]"
            onClick={handleEditMethod}
            disabled={saving || calculating || !selectedMethodId}
            aria-label="Editar método de proyección"
            title="Editar método de proyección"
          >
            <Calculator className="size-3.5" />
            Editar método
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 gap-1.5 border-sky-700 bg-sky-700 px-3 text-[11px] font-semibold text-white shadow-sm hover:border-sky-800 hover:bg-sky-800 hover:text-white dark:border-sky-600 dark:bg-sky-600 dark:hover:border-sky-500 dark:hover:bg-sky-500"
            title={selectedBase === "PENDIENTE" ? "El método usa directamente el importe pendiente" : undefined}
            onClick={() => void handleCalculate()}
            disabled={
              saving
              || calculating
              || query.isLoading
              || methodsQuery.isLoading
              || !selectedMethodId
              || !validRelational
              || !validPeriodFrom
              || (isRelational && (accountsQuery.isLoading || Boolean(accountsQuery.error)))
              || selectedBase === "PENDIENTE"
              || Boolean(query.error)
            }
          >
            {calculating
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Calculator className="size-3.5" />}
            Calcular
          </Button>
          <div className="grid gap-1">
            <label htmlFor="projection-period-from" className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
              Período desde
            </label>
            <Select value={periodFrom} onValueChange={setPeriodFrom}
              disabled={saving || calculating || query.isLoading}>
              <SelectTrigger id="projection-period-from" aria-invalid={!validPeriodFrom}
                className="h-8 w-32 bg-white text-[11px] dark:bg-slate-950">
                <SelectValue placeholder="Elegir mes" />
              </SelectTrigger>
              <SelectContent>
                {months.filter((period) => period >= "2026-01-01" && period <= (query.data?.proyeccion_desde ?? ""))
                  .map((period) => (
                    <SelectItem key={period} value={period.slice(0, 7)} className="text-[11px]">
                      {formatPeriod(period)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          {isRelational && (!validRelational || accountsQuery.error) && <p className="w-full text-xs text-destructive" role="alert">
            {accountsQuery.error ? "No se pudieron cargar las cuentas Cash." : "La cuenta Cash y el factor (%) son obligatorios."}
          </p>}
          {query.data && !validPeriodFrom && <p className="w-full text-xs text-destructive" role="alert">
            Elegí un período entre enero de 2026 y {query.data.proyeccion_desde.slice(0, 7)}.
          </p>}
          {historicalEditing && <p className="w-full text-[10px] text-amber-700 dark:text-amber-400">
            Desde {periodFrom}, el cálculo utiliza proyectados incluso en meses cerrados. Al guardar se confirmarán los cambios históricos.
          </p>}
        </div>

        <div ref={monthsScrollRef} className="relative min-h-0 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
          {query.isLoading ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />Cargando proyección…
            </div>
          ) : query.error ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-destructive">
              {query.error instanceof Error ? query.error.message : "No se pudieron cargar los valores"}
            </div>
          ) : (
            renderMonths()
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => requestExit(() => onOpenChange(false))}
            disabled={saving || calculating}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || calculating || query.isLoading || methodsQuery.isLoading || !validRelational || !validPeriodFrom || (isRelational && (accountsQuery.isLoading || Boolean(accountsQuery.error))) || Boolean(query.error)}
          >
            {saving
              ? <Loader2 className="mr-1.5 size-4 animate-spin" />
              : <Save className="mr-1.5 size-4" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
      <Confirm
        isOpen={discardConfirmOpen}
        title="Descartar cambios"
        content="Hay cambios sin guardar. Si salís, se perderán los cambios realizados en la proyección."
        confirm="Salir sin guardar"
        cancel="Seguir editando"
        confirmColor="warning"
        onClose={() => {
          setDiscardConfirmOpen(false);
          pendingExitRef.current = null;
        }}
        onConfirm={() => {
          const exit = pendingExitRef.current;
          pendingExitRef.current = null;
          setDiscardConfirmOpen(false);
          exit?.();
        }}
      />
      <Confirm
        isOpen={historicalSaveConfirmOpen}
        title="Guardar cambios históricos"
        content={`Se guardarán las proyecciones y los importes comprometidos desde ${periodFrom}, incluyendo meses cerrados. Los estados de los períodos y sus importes reales se conservarán.`}
        confirm="Guardar cambios"
        cancel="Seguir editando"
        confirmColor="warning"
        loading={saving}
        onClose={() => setHistoricalSaveConfirmOpen(false)}
        onConfirm={() => {
          setHistoricalSaveConfirmOpen(false);
          void handleSave(true);
        }}
      />
      <CashPendingProjectionDetailDialog
        open={pendingDetailTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingDetailTarget(null);
        }}
        cuentaCashId={cuentaCashId}
        cuentaCashNombre={cuentaCashNombre}
        dueDateFrom={pendingDetailTarget?.dueDateFrom ?? ""}
        dueDateTo={pendingDetailTarget?.dueDateTo ?? ""}
      />
    </>
  );
};
