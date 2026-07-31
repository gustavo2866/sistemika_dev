import { fetchUtils } from "ra-core";

import { apiUrl } from "@/lib/dataProvider";

import type { MovimientoRequest, PanelCuenta, PanelProject, PanelRubro, MonthValues } from "./types";

export const fetchJsonWithAuth = async <T,>(url: string): Promise<T> => {
  const { json } = await fetchUtils.fetchJson(url, {
    headers: new Headers(
      typeof window !== "undefined" && localStorage.getItem("auth_token")
        ? { Authorization: `Bearer ${localStorage.getItem("auth_token")}` }
        : {},
    ),
  });
  return json as T;
};

export const patchJsonWithAuth = async <T,>(
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

export const postJsonWithAuth = async <T,>(
  url: string,
  payload: Record<string, unknown>,
): Promise<T> => {
  const { json } = await fetchUtils.fetchJson(url, {
    method: "POST",
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

export const downloadBlobWithAuth = async (url: string, filename: string) => {
  const response = await fetch(url, {
    headers:
      typeof window !== "undefined" && localStorage.getItem("auth_token")
        ? { Authorization: `Bearer ${localStorage.getItem("auth_token")}` }
        : {},
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

export const postFormDataWithAuth = async <T,>(
  url: string,
  formData: FormData,
): Promise<T> => {
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    headers:
      typeof window !== "undefined" && localStorage.getItem("auth_token")
        ? { Authorization: `Bearer ${localStorage.getItem("auth_token")}` }
        : {},
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.detail ?? `HTTP ${response.status}`);
  }
  return json as T;
};

export const toStartOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

export const addMonths = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);

export const formatDateParam = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getPreviousMonthKey = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return formatDateParam(addMonths(new Date(year, month - 1, 1), -1)).slice(0, 7);
};

export const buildConceptsUrl = () => {
  const params = new URLSearchParams();
  params.set("sort", JSON.stringify(["nombre", "ASC"]));
  params.set("range", JSON.stringify([0, 199]));
  params.set("filter", JSON.stringify({ activo: true }));
  return `${apiUrl}/constructora/proyectos-conceptos?${params.toString()}`;
};

export const getMonthEnd = (monthStart: Date) =>
  new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

export const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", {
    month: "short",
    year: "2-digit",
  }).format(new Date(year, month - 1, 1));
};

export const formatMonthRangeLabel = (startDate: Date, endDate: Date) => {
  const formatter = new Intl.DateTimeFormat("es-AR", {
    month: "short",
    year: "2-digit",
  });
  if (
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth()
  ) {
    return formatter.format(startDate);
  }
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
};

export const formatCurrency = (value?: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value ?? 0);

export const formatPercent = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
};

export const getVariationPercent = (real: number, budget: number) => {
  const denominator = Math.abs(budget);
  if (denominator === 0) return real === 0 ? 0 : null;
  return ((real - budget) / denominator) * 100;
};

export const getProfitabilityPercent = (result: number, income: number) => {
  if (income === 0) return result === 0 ? 0 : null;
  return (result / income) * 100;
};

export const getNegativeOnlyColorClass = (value: number | null) => {
  if (value === null) return "text-foreground";
  return value < 0 ? "text-rose-700" : "text-foreground";
};

export const formatEmployees = (value?: number) =>
  new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 1,
  }).format(value ?? 0);

export const formatDateValue = (value?: string | null) => {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("es-AR").format(new Date(year, month - 1, day));
};

export const escapeCsvValue = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
};

export const downloadCsv = (
  filename: string,
  rows: Array<Array<string | number | null | undefined>>,
) => {
  const csv = rows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(";"))
    .join("\r\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const getEmptyMonthValues = (): MonthValues => ({
  ingresos: 0,
  egresos: 0,
  real_ingresos: 0,
  real_egresos: 0,
  empleados: 0,
  presupuesto_id: null,
  record_count: 0,
});

export const formatCuentaLabel = (cuenta: PanelCuenta) =>
  [cuenta.cuenta_codigo, cuenta.cuenta_nombre].filter(Boolean).join(" - ") ||
  `#${cuenta.cuenta_id}`;

export const normalizeRubroName = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const isHiddenRubro = (rubro: PanelRubro) =>
  normalizeRubroName(rubro.rubro_nombre) === "ingresos";

export const buildPresupuestoListLink = (
  monthKey: string,
  context?: { proyecto_id: number; erp_cuenta_id: number },
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

export const buildMovimientosUrl = (request: MovimientoRequest) => {
  const params = new URLSearchParams();
  params.set("periodo", request.month);
  params.set("proyecto_id", String(request.proyecto_id));
  params.set("concepto", request.concepto);
  if (request.rubro_id) params.set("rubro_id", String(request.rubro_id));
  if (request.erp_cuenta_id) {
    params.set("erp_cuenta_id", String(request.erp_cuenta_id));
  }
  return `${apiUrl}/erp/presupuestos/panel/movimientos?${params.toString()}`;
};

export const buildMovimientosExportUrl = (request: MovimientoRequest) => {
  const params = new URLSearchParams();
  params.set("periodo", request.month);
  params.set("proyecto_id", String(request.proyecto_id));
  params.set("concepto", request.concepto);
  if (request.rubro_id) params.set("rubro_id", String(request.rubro_id));
  if (request.erp_cuenta_id) {
    params.set("erp_cuenta_id", String(request.erp_cuenta_id));
  }
  return `${apiUrl}/erp/presupuestos/panel/movimientos/export?${params.toString()}`;
};

export const buildBudgetIncomeRows = (
  panelRows: PanelProject[],
  request: import("./types").BudgetIncomeRequest | null,
): import("./types").BudgetIncomeRow[] => {
  if (!request) return [];

  const project = panelRows.find((item) => item.proyecto_id === request.proyecto_id);
  if (!project) return [];

  return project.rubros
    .filter((rubro) => !request.rubro_id || rubro.rubro_id === request.rubro_id)
    .filter((rubro) => !isHiddenRubro(rubro))
    .flatMap((rubro) =>
      rubro.cuentas
        .filter((cuenta) => !request.erp_cuenta_id || cuenta.cuenta_id === request.erp_cuenta_id)
        .map((cuenta) => {
          const values = cuenta.months[request.month] ?? getEmptyMonthValues();
          return {
            presupuesto_id: values.presupuesto_id ?? null,
            cuenta_id: cuenta.cuenta_id,
            rubro_nombre: rubro.rubro_nombre,
            cuenta_label: formatCuentaLabel(cuenta),
            ingreso_presupuesto: Number(values.ingresos ?? 0),
            ingreso_real: Number(values.real_ingresos ?? 0),
            egreso_presupuesto: Number(values.egresos ?? 0),
            egreso_real: Number(values.real_egresos ?? 0),
          };
        }),
    )
    .sort((left, right) => {
      const rubroCompare = left.rubro_nombre.localeCompare(right.rubro_nombre, "es");
      if (rubroCompare !== 0) return rubroCompare;
      return left.cuenta_label.localeCompare(right.cuenta_label, "es");
    });
};

export const buildBudgetIncomeRubroTotal = (
  panelRows: PanelProject[],
  request: import("./types").BudgetIncomeRequest | null,
): import("./types").BudgetIncomeRubroTotal => {
  if (!request) return { real_ingreso: 0 };

  const project = panelRows.find((item) => item.proyecto_id === request.proyecto_id);
  const incomeRubro = project?.rubros.find(isHiddenRubro);
  const values = incomeRubro?.months[request.month] ?? getEmptyMonthValues();

  return {
    rubro_id: incomeRubro?.rubro_id,
    real_ingreso: Number(values.real_ingresos ?? 0),
  };
};
