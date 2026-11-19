"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNotify } from "ra-core";
import { BarChart3, Calculator, ChevronDown, ChevronLeft, ChevronRight, CircleEllipsis, DollarSign, FileDown, FileSpreadsheet, FileUp, Landmark, PencilLine, RefreshCw, RotateCcw, TrendingDown, TrendingUp, WalletCards, Waypoints } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { FinancialKpiCards } from "@/components/financial-kpi-cards";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiUrl } from "@/lib/dataProvider";
import { cn } from "@/lib/utils";
import { CashMovementDetailDialog, type CashMovementDetailTarget } from "./movement-detail-dialog";
import { CashProjectionQuickEditDialog } from "../proyectado";
import { CashAccountMappingsDialog } from "../maps/account-mappings-dialog";
import type { ErpCashPeriodoEstado } from "../periodos/model";
import { fetchCashProjectionHorizon } from "../proyectado/horizon";

type Month = { key: string; label: string; start: string; end: string };
type LedgerAccountRow = {
  cuenta_codigo: number;
  cuenta_contable_codigo?: string | null;
  cuenta_nombre: string;
  months: Record<string, number>;
  total: number;
  movement_count: number;
};
type AccountRow = {
  cuenta_cash_id?: number | null;
  cuenta_cash_nombre: string;
  months: Record<string, number>;
  total: number;
  projected_months: Record<string, number>;
  projected_total: number;
  movement_count: number;
  ledger_accounts: LedgerAccountRow[];
};
type GroupRow = {
  key: "INGRESOS" | "EGRESOS" | "SIN_CUENTA" | "FONDOS";
  label: string;
  months: Record<string, number>;
  total: number;
  projected_months: Record<string, number>;
  projected_total: number;
  accounts: AccountRow[];
};
type BalanceAccountRow = {
  cuenta_codigo: number;
  cuenta_contable_codigo?: string | null;
  cuenta_nombre: string;
  saldo_anterior: Record<string, number>;
  saldo_periodo: Record<string, number>;
  saldo_final: Record<string, number>;
  record_counts: Record<string, number>;
};
type BalanceField = "saldo_anterior" | "saldo_periodo" | "saldo_final";
type BalanceDetailTarget = {
  month: string;
  field: BalanceField;
  label: string;
};
type PanelResponse = {
  periodo: string;
  periods: Record<string, {
    estado: ErpCashPeriodoEstado;
    ultima_sincronizacion: string | null;
  }>;
  months: Month[];
  groups: GroupRow[];
  totals: Record<string, number>;
  total: number;
  balances: {
    saldo_anterior: Record<string, number>;
    saldo_periodo: Record<string, number>;
    saldo_final: Record<string, number>;
    record_counts: Record<string, number>;
    accounts: BalanceAccountRow[];
    projected_months: string[];
  };
};
type ProjectionEditTarget = {
  cuentaCashId: number;
  cuentaCashNombre: string;
  startYear?: number;
};
const DEFAULT_PERIOD = "2026-01";
const currentPeriod = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

const periodToDate = (period: string) => {
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month - 1, 1);
};

const dateToPeriod = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;

const movePeriod = (period: string, offset: number) => {
  const value = periodToDate(period);
  value.setMonth(value.getMonth() + offset);
  return dateToPeriod(value);
};

const formatPeriodLabel = (period: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(period)) return "—";
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(periodToDate(period));
};

const formatMonthColumn = (period: string) =>
  new Intl.DateTimeFormat("es-AR", { month: "short", year: "2-digit" })
    .format(periodToDate(period))
    .replace(" de ", " ");

const formatAmount = (value: number) =>
  `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((value || 0) / 1_000_000)} M`;

const formatExactAmount = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const escapeXml = (value: unknown) => String(value ?? "")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const safeFileName = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9_-]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .slice(0, 80);

const downloadXls = (xml: string, fileName: string) => {
  const blob = new Blob(["\uFEFF", xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const exportBalanceDetailToXls = (
  target: BalanceDetailTarget,
  accounts: BalanceAccountRow[],
  total: number,
) => {
  const rows = accounts.map((account) => {
    const value = account[target.field][target.month] ?? 0;
    return `
      <Row>
        <Cell><Data ss:Type="Number">${account.cuenta_codigo}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(account.cuenta_contable_codigo || "-")}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(account.cuenta_nombre)}</Data></Cell>
        <Cell ss:StyleID="Amount"><Data ss:Type="Number">${value}</Data></Cell>
      </Row>`;
  }).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="10"/></Style>
  <Style ss:ID="Title"><Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#4338CA" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Meta"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#475569"/></Style>
  <Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#334155" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Amount"><NumberFormat ss:Format="#,##0.00;[Red]-#,##0.00"/></Style>
  <Style ss:ID="TotalLabel"><Alignment ss:Horizontal="Right"/><Font ss:Bold="1"/><Interior ss:Color="#E0E7FF" ss:Pattern="Solid"/></Style>
  <Style ss:ID="TotalAmount"><Font ss:Bold="1"/><Interior ss:Color="#E0E7FF" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00;[Red]-#,##0.00"/></Style>
 </Styles>
 <Worksheet ss:Name="Saldos Fondo">
  <Table>
   <Column ss:Width="70"/><Column ss:Width="110"/><Column ss:Width="260"/><Column ss:Width="110"/>
   <Row ss:Height="24"><Cell ss:StyleID="Title" ss:MergeAcross="3"><Data ss:Type="String">${escapeXml(target.label)}</Data></Cell></Row>
   <Row><Cell ss:StyleID="Meta" ss:MergeAcross="3"><Data ss:Type="String">Período: ${escapeXml(target.month)} · Cuentas Fondo: ${accounts.length} · Origen: erp_cash_saldos</Data></Cell></Row>
   <Row ss:Height="8"/>
   <Row ss:Height="22">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Cuenta</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Código contable</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Nombre</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Importe</Data></Cell>
   </Row>${rows}
   <Row>
    <Cell ss:StyleID="TotalLabel" ss:MergeAcross="2"><Data ss:Type="String">Total</Data></Cell>
    <Cell ss:StyleID="TotalAmount"><Data ss:Type="Number">${total}</Data></Cell>
   </Row>
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>4</SplitHorizontal><TopRowBottomPane>4</TopRowBottomPane><ActivePane>2</ActivePane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions>
 </Worksheet>
</Workbook>`;

  downloadXls(
    xml,
    `cash_saldos_${target.month}_${safeFileName(target.label) || target.field}.xls`,
  );
};

const PRIMARY_COLUMN_WIDTH = 360;
const MONTH_COLUMN_WIDTH = 72;
const TOTAL_COLUMN_WIDTH = 96;
const DEFAULT_EXPANDED_GROUPS = new Set<string>();
const GROUP_PRESENTATION: Record<GroupRow["key"], {
  icon: LucideIcon;
  rowClassName: string;
  iconClassName: string;
  badgeClassName: string;
  totalClassName: string;
}> = {
  INGRESOS: {
    icon: TrendingUp,
    rowClassName: "bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/35",
    iconClassName: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    badgeClassName: "border-emerald-200 bg-emerald-100/70 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    totalClassName: "bg-emerald-50 dark:bg-emerald-950/50",
  },
  EGRESOS: {
    icon: TrendingDown,
    rowClassName: "bg-rose-50/70 hover:bg-rose-100/70 dark:bg-rose-950/20 dark:hover:bg-rose-950/35",
    iconClassName: "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300",
    badgeClassName: "border-rose-200 bg-rose-100/70 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300",
    totalClassName: "bg-rose-50 dark:bg-rose-950/50",
  },
  SIN_CUENTA: {
    icon: CircleEllipsis,
    rowClassName: "bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/20 dark:hover:bg-amber-950/35",
    iconClassName: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
    badgeClassName: "border-amber-200 bg-amber-100/70 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
    totalClassName: "bg-amber-50 dark:bg-amber-950/50",
  },
  FONDOS: {
    icon: Landmark,
    rowClassName: "bg-indigo-50/70 hover:bg-indigo-100/70 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/35",
    iconClassName: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300",
    badgeClassName: "border-indigo-200 bg-indigo-100/70 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
    totalClassName: "bg-indigo-50 dark:bg-indigo-950/50",
  },
};
const BALANCE_PRESENTATION: Record<BalanceField, {
  icon: LucideIcon;
  iconClassName: string;
  badgeClassName: string;
}> = {
  saldo_anterior: {
    icon: WalletCards,
    iconClassName: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    badgeClassName: "border-slate-300 bg-white/70 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  },
  saldo_periodo: {
    icon: Calculator,
    iconClassName: "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
    badgeClassName: "border-sky-200 bg-white/70 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
  },
  saldo_final: {
    icon: Landmark,
    iconClassName: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300",
    badgeClassName: "border-indigo-200 bg-white/70 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  },
};

const fetchPanel = async (periodo: string): Promise<PanelResponse> => {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(
    `${apiUrl}/erp/cash/panel?periodo=${encodeURIComponent(periodo)}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(30_000),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || "No se pudo cargar el panel Cash");
  return payload as PanelResponse;
};

const MonthAmountButton = ({
  value,
  projectedValue,
  onClick,
  allowZero = false,
  title = "Ver asientos que componen el importe",
}: {
  value: number;
  projectedValue?: number;
  onClick: () => void;
  allowZero?: boolean;
  title?: string;
}) => {
  const amount = (
    <span className="flex flex-col items-end leading-tight">
      <span>{formatAmount(value)}</span>
      {projectedValue !== undefined ? (
        <span className="mt-0.5 text-[8px] font-medium text-sky-700/80 dark:text-sky-300/80">
          ({formatAmount(projectedValue)})
        </span>
      ) : null}
    </span>
  );
  if (!value && !allowZero) return amount;
  return (
    <button
      type="button"
      className="w-full rounded-md px-1 py-0.5 text-right transition-colors hover:bg-white/80 hover:text-slate-950 hover:shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:hover:bg-slate-900/80 dark:hover:text-white"
      onClick={onClick}
      title={title}
    >
      {amount}
    </button>
  );
};

const AmountWithProjection = ({
  value,
  projectedValue,
}: {
  value: number;
  projectedValue?: number;
}) => (
  <span className="flex flex-col items-end leading-tight">
    <span>{formatAmount(value)}</span>
    {projectedValue !== undefined ? (
      <span className="mt-0.5 text-[8px] font-medium text-sky-700/80 dark:text-sky-300/80">
        ({formatAmount(projectedValue)})
      </span>
    ) : null}
  </span>
);

export const ErpCashPanel = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useNotify();
  const [searchParams, setSearchParams] = useSearchParams();
  const [periodo, setPeriodo] = useState(DEFAULT_PERIOD);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const [rebuildFrom, setRebuildFrom] = useState("");
  const [budgetAction, setBudgetAction] = useState<"export" | "import" | null>(null);
  const budgetFileInputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(DEFAULT_EXPANDED_GROUPS));
  const [detailTarget, setDetailTarget] = useState<CashMovementDetailTarget | null>(null);
  const [balanceDetailTarget, setBalanceDetailTarget] = useState<BalanceDetailTarget | null>(null);
  const [projectionEditTarget, setProjectionEditTarget] = useState<ProjectionEditTarget | null>(null);
  const [mappingTarget, setMappingTarget] = useState<{ accountNumber: number; accountName: string } | null>(null);
  const renderMappingButton = (accountNumber: number, accountName: string) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-5 shrink-0 text-slate-400 hover:text-sky-700 dark:hover:text-sky-300"
      title="Ver mapeos de la cuenta ERP"
      aria-label={`Ver mapeos de ${accountNumber} — ${accountName}`}
      onClick={(event) => {
        event.stopPropagation();
        setMappingTarget({ accountNumber, accountName });
      }}
    >
      <Waypoints className="size-3.5" />
    </Button>
  );
  useEffect(() => {
    const accountId = Number(searchParams.get("projection_account_id"));
    const accountName = searchParams.get("projection_account_name");
    const startYear = Number(searchParams.get("projection_start_year"));
    if (!Number.isInteger(accountId) || accountId <= 0 || !accountName) return;
    setProjectionEditTarget({
      cuentaCashId: accountId,
      cuentaCashNombre: accountName,
      startYear: Number.isInteger(startYear) ? startYear : undefined,
    });
  }, [searchParams]);

  const closeProjectionEditor = () => {
    setProjectionEditTarget(null);
    if (!searchParams.has("projection_account_id")) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("projection_account_id");
    nextParams.delete("projection_account_name");
    nextParams.delete("projection_start_year");
    nextParams.delete("projection_draft");
    setSearchParams(nextParams, { replace: true });
  };
  const query = useQuery({
    queryKey: ["erp-cash-panel", periodo],
    queryFn: () => fetchPanel(periodo),
    enabled: Boolean(periodo),
  });
  const horizonQuery = useQuery({ queryKey: ["cash-projection-horizon"], queryFn: fetchCashProjectionHorizon });
  const rebuildPeriodsPending = horizonQuery.isPending;
  const defaultRebuildPeriod = horizonQuery.data?.proyeccion_desde.slice(0, 7);
  const data = query.data;
  const positionedYear = periodToDate(periodo).getFullYear();
  const rebuildEndPeriod = horizonQuery.data?.proyeccion_hasta.slice(0, 7) ?? "";
  const validRebuildFrom = /^\d{4}-(0[1-9]|1[0-2])$/.test(rebuildFrom)
    && rebuildFrom >= "2025-12" && rebuildFrom <= rebuildEndPeriod;
  const columnCount = (data?.months.length ?? 0) + 2;
  const flowGroups = data?.groups.filter((group) => group.key !== "FONDOS") ?? [];
  const hasFlowMovements = flowGroups.some((group) => group.accounts.length > 0);
  const hasBalanceData = Object.values(data?.balances.record_counts ?? {}).some((count) => count > 0);
  const projectedBalanceMonths = useMemo(
    () => new Set(data?.balances.projected_months ?? []),
    [data?.balances.projected_months],
  );
  const fondoBalanceAccounts = data?.balances.accounts ?? [];
  const monthOptions = useMemo(() => {
    const selectedDate = periodToDate(periodo);
    return Array.from({ length: 12 }, (_, month) => {
      const date = new Date(selectedDate.getFullYear(), month, 1);
      const key = dateToPeriod(date);
      return { key, label: formatPeriodLabel(key) };
    });
  }, [periodo]);
  const ingresos = data?.groups.find((group) => group.key === "INGRESOS")?.total ?? 0;
  const egresos = data?.groups.find((group) => group.key === "EGRESOS")?.total ?? 0;
  const otros = data?.groups.find((group) => group.key === "SIN_CUENTA")?.total ?? 0;
  const netoTotal = ingresos + egresos + otros;
  const saldoMesTotal = (data?.months ?? []).reduce(
    (total, month) => total + (data?.balances.saldo_periodo[month.key] ?? 0),
    0,
  );
  const firstMonthKey = data?.months[0]?.key;
  const saldoInicial = firstMonthKey ? (data?.balances.saldo_anterior[firstMonthKey] ?? 0) : 0;
  const lastMonthKey = data?.months.at(-1)?.key;
  const saldoFinal = lastMonthKey
    ? (data?.balances.saldo_final[lastMonthKey] ?? 0)
    : saldoInicial + netoTotal;
  const balanceDetailAccounts = balanceDetailTarget
    ? fondoBalanceAccounts.filter(
      (account) => (account.record_counts[balanceDetailTarget.month] ?? 0) > 0,
    )
    : [];
  const balanceDetailTotal = balanceDetailTarget
    ? (data?.balances[balanceDetailTarget.field][balanceDetailTarget.month] ?? 0)
    : 0;

  const selectPeriod = (nextPeriod: string) => {
    setPeriodo(nextPeriod);
    setExpanded(new Set(DEFAULT_EXPANDED_GROUPS));
    setDetailTarget(null);
    setBalanceDetailTarget(null);
    setProjectionEditTarget(null);
  };

  const openRebuildDialog = () => {
    if (horizonQuery.error) {
      notify("No se pudieron cargar los períodos para actualizar Cash", { type: "error" });
      return;
    }
    setRebuildFrom(defaultRebuildPeriod && defaultRebuildPeriod >= "2025-12" ? defaultRebuildPeriod : "2025-12");
    setRebuildOpen(true);
  };

  const handleRebuild = async () => {
    if (!validRebuildFrom || rebuilding) return;

    setRebuilding(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${apiUrl}/erp/cash/rebuild`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ periodo_desde: rebuildFrom, incluir_cerrados: true }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "No se pudo actualizar Cash");
      setRebuildOpen(false);
      notify(`Cash actualizado: ${result.periodos_reales_reconstruidos} períodos con movimientos y saldos (${result.periodos_cerrados_reconstruidos} cerrados), ${result.proyecciones_calculadas} proyecciones recalculadas.`, { type: "success" });
      void query.refetch();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo actualizar Cash", { type: "error" });
    } finally {
      setRebuilding(false);
    }
  };

  const handleBudgetExport = async () => {
    const year = new Date().getFullYear();
    setBudgetAction("export");
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${apiUrl}/erp/cash/panel/budget/export?anio=${year}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.detail || "No se pudo exportar el presupuesto");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `presupuesto_cash_${year}_${year + 1}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo exportar el presupuesto", {
        type: "error",
      });
    } finally {
      setBudgetAction(null);
    }
  };

  const handleBudgetImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const year = new Date().getFullYear();
    if (!window.confirm(
      `Se actualizará el presupuesto de ${year}-01 a ${year + 1}-12 con el archivo ${file.name}. ¿Continuar?`,
    )) {
      return;
    }

    setBudgetAction("import");
    try {
      const token = localStorage.getItem("auth_token");
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`${apiUrl}/erp/cash/panel/budget/import?anio=${year}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.detail || "No se pudo importar el presupuesto");
      }
      await query.refetch();
      notify(
        `Presupuesto importado: ${result.created} creados, ${result.updated} actualizados y ${result.unchanged} sin cambios`,
        { type: "success" },
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo importar el presupuesto", {
        type: "error",
      });
    } finally {
      setBudgetAction(null);
    }
  };

  const toggle = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderSublevel = (rows: ReactNode, label: string) => (
    <tr>
      <td colSpan={columnCount} className="p-0">
        <div
          className="max-h-[min(32vh,18rem)] overflow-y-auto overscroll-y-contain [scrollbar-width:thin]"
          role="region"
          aria-label={`Detalle de ${label}`}
          tabIndex={0}
        >
          <table className="w-full table-fixed border-collapse text-[10px]" aria-label={`Cuentas de ${label}`}>
            <colgroup>
              <col className="w-[360px]" />
              {data?.months.map((month) => <col key={month.key} className="w-[72px]" />)}
              <col />
            </colgroup>
            <tbody>{rows}</tbody>
          </table>
        </div>
      </td>
    </tr>
  );

  const renderBalanceRow = (
    field: BalanceField,
    label: string,
    total: number,
    rowClassName: string,
    totalClassName: string,
  ) => {
    if (!data) return null;
    const rowKey = `balance:${field}`;
    const isExpanded = expanded.has(rowKey);
    const ToggleIcon = isExpanded ? ChevronDown : ChevronRight;
    const presentation = BALANCE_PRESENTATION[field];
    const BalanceIcon = presentation.icon;
    const isFinalBalance = field === "saldo_final";

    const accountTotal = (account: BalanceAccountRow) => {
      if (field === "saldo_periodo") {
        return data.months.reduce(
          (sum, month) => sum + (account.saldo_periodo[month.key] ?? 0),
          0,
        );
      }
      if (field === "saldo_anterior") {
        return firstMonthKey ? (account.saldo_anterior[firstMonthKey] ?? 0) : 0;
      }
      const lastMonth = [...data.months]
        .reverse()
        .find((month) => (account.record_counts[month.key] ?? 0) > 0);
      return lastMonth ? (account.saldo_final[lastMonth.key] ?? 0) : 0;
    };

    return (
      <Fragment>
        <tr className={cn("border-y border-slate-200/80 transition-colors dark:border-slate-800", rowClassName)}>
          <td className="border-r p-0">
            <button
              type="button"
              className="group flex w-full items-center gap-2 px-2 py-2 text-left"
              onClick={() => toggle(rowKey)}
              aria-expanded={isExpanded}
            >
              <ToggleIcon className={cn(
                "size-3.5 shrink-0 transition-transform",
                isFinalBalance
                  ? "text-white/80 group-hover:text-white"
                  : "text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-100",
              )} />
              <span className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-md shadow-sm",
                isFinalBalance ? "bg-white/15 text-white" : presentation.iconClassName,
              )}>
                <BalanceIcon className="size-3.5" />
              </span>
              <span className="truncate tracking-[0.015em]">{label}</span>
              <span className={cn(
                "ml-auto rounded-full border px-1.5 py-0.5 text-[8px] font-medium",
                isFinalBalance ? "border-white/25 bg-white/10 text-white" : presentation.badgeClassName,
              )}>
                {fondoBalanceAccounts.length} ctas.
              </span>
            </button>
          </td>
          {data.months.map((month) => {
            const value = data.balances[field][month.key] ?? 0;
            const isProjected = projectedBalanceMonths.has(month.key);
            return (
              <td key={month.key} className={cn(
                "border-r px-1 py-2 text-right text-[9px] font-semibold tabular-nums",
                isFinalBalance
                  ? "border-slate-500 text-white dark:border-slate-600"
                  : "border-slate-200/70 dark:border-slate-800",
                !isFinalBalance && value < 0 && "text-rose-700 dark:text-rose-400",
              )}>
                {data.periods?.[month.key]?.estado === "EN_CIERRE" && !data.balances.record_counts[month.key] ? (
                  <span title="En cierre: faltan saldos sincronizados">Sin datos</span>
                ) : isProjected ? (
                  <span>{formatAmount(value)}</span>
                ) : (
                  <MonthAmountButton
                    value={value}
                    allowZero={(data.balances.record_counts[month.key] ?? 0) > 0}
                    title="Ver saldo por cuenta"
                    onClick={() => setBalanceDetailTarget({ month: month.key, field, label })}
                  />
                )}
              </td>
            );
          })}
          <td className={cn(totalClassName, !isFinalBalance && total < 0 && "text-rose-700")}>
            {formatAmount(total)}
          </td>
        </tr>
        {isExpanded ? renderSublevel(fondoBalanceAccounts.map((account) => {
          const valueTotal = accountTotal(account);
          const ledgerLabel = `${account.cuenta_codigo} — ${account.cuenta_nombre}`;
          const ledgerTitle = account.cuenta_contable_codigo
            ? `${ledgerLabel} (${account.cuenta_contable_codigo})`
            : ledgerLabel;
          return (
            <tr key={`${rowKey}:${account.cuenta_codigo}`} className="border-t border-slate-100 bg-white/70 transition-colors hover:bg-slate-50 dark:border-slate-900 dark:bg-slate-950/30 dark:hover:bg-slate-900/50">
              <td className="border-r px-2 py-1.5 pl-10 text-[9px]">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <span className="min-w-0 flex-1 truncate" title={ledgerTitle}>{ledgerLabel}</span>
                  {renderMappingButton(account.cuenta_codigo, account.cuenta_nombre)}
                </span>
              </td>
              {data.months.map((month) => {
                const value = account[field][month.key] ?? 0;
                const isProjected = projectedBalanceMonths.has(month.key);
                return (
                  <td key={month.key} className={cn("border-r border-slate-100 px-1 py-1.5 text-right text-[9px] tabular-nums dark:border-slate-900", value < 0 && "text-rose-700 dark:text-rose-400")}>                
                    {isProjected ? (
                      "—"
                    ) : field === "saldo_periodo" ? (
                      <MonthAmountButton
                        value={value}
                        allowZero={(account.record_counts[month.key] ?? 0) > 0}
                        title="Ver asientos que tocaron la cuenta"
                        onClick={() => setDetailTarget({
                          month: month.key,
                          title: ledgerLabel,
                          scope: "ledger",
                          groupKey: "FONDOS",
                          cuentaCodigo: account.cuenta_codigo,
                          importeMode: "saldo",
                        })}
                      />
                    ) : (
                      formatAmount(value)
                    )}
                  </td>
                );
              })}
              <td className={cn("sticky right-0 z-10 border-l bg-background px-2 py-1.5 text-right text-[9px] font-medium tabular-nums", valueTotal < 0 && "text-rose-700")}>
                {formatAmount(valueTotal)}
              </td>
            </tr>
          );
        }), label) : null}
      </Fragment>
    );
  };

  return (
    <div className="w-full max-w-[1500px] px-2 py-3 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">CashFlow</p>
          <h1 className="text-xl font-semibold">Panel Cash</h1>
          <p className="text-[10px] capitalize text-muted-foreground">
            {formatPeriodLabel(periodo)} a {formatPeriodLabel(movePeriod(periodo, 11))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-slate-200 bg-white shadow-xs">
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-r-none" onClick={() => selectPeriod(movePeriod(periodo, -12))} aria-label="Doce meses anteriores" title="Doce meses anteriores">
              <ChevronLeft className="size-3" />
            </Button>
            <Popover open={isMonthPickerOpen} onOpenChange={setIsMonthPickerOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" className="h-6 min-w-[132px] rounded-none border-x border-slate-200 px-2 text-[11px] font-semibold capitalize text-slate-800 hover:bg-slate-50" aria-label="Seleccionar mes">
                  {formatPeriodLabel(periodo)}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="center" className="w-[230px] p-2">
                <div className="grid grid-cols-3 gap-1">
                  {monthOptions.map((month) => (
                    <Button
                      key={month.key}
                      type="button"
                      variant={month.key === periodo ? "default" : "ghost"}
                      className="h-7 justify-center px-1 text-[10px] capitalize"
                      onClick={() => {
                        selectPeriod(month.key);
                        setIsMonthPickerOpen(false);
                      }}
                    >
                      {month.label.split(" de ")[0]}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-l-none" onClick={() => selectPeriod(movePeriod(periodo, 12))} aria-label="Doce meses siguientes" title="Doce meses siguientes">
              <ChevronRight className="size-3" />
            </Button>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => selectPeriod(currentPeriod())}>
            <RotateCcw className="mr-1 size-3.5" />Hoy
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={openRebuildDialog}
            disabled={rebuilding || query.isFetching || rebuildPeriodsPending}
          >
            <RefreshCw className={cn("mr-1 size-3.5", (rebuilding || query.isFetching) && "animate-spin")} />
            {rebuilding ? "Actualizando…" : query.isFetching ? "Cargando panel…" : "Actualizar Cash"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={budgetAction !== null}
              >
                <FileSpreadsheet className="mr-1 size-3.5" />
                {budgetAction === "export"
                  ? "Exportando"
                  : budgetAction === "import"
                    ? "Importando"
                    : "Presupuesto"}
                <ChevronDown className="ml-1 size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuItem onSelect={() => void handleBudgetExport()}>
                <FileDown className="mr-2 size-4" />Exportar XLS
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => budgetFileInputRef.current?.click()}>
                <FileUp className="mr-2 size-4" />Importar XLS
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={budgetFileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={handleBudgetImport}
          />
        </div>
      </div>

      <FinancialKpiCards
        className="mb-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        items={[
          {
            key: "saldo-inicial",
            title: "Saldo inicial",
            value: saldoInicial,
            icon: DollarSign,
            iconClassName: "bg-slate-600",
          },
          { key: "ingresos", title: "Ingresos", value: ingresos, icon: TrendingUp, iconClassName: "bg-emerald-600" },
          { key: "egresos", title: "Egresos", value: egresos, icon: TrendingDown, iconClassName: "bg-rose-600" },
          { key: "otros", title: "Otros", value: otros, icon: CircleEllipsis, iconClassName: "bg-amber-500" },
          { key: "saldo-final", title: "Saldo final", value: saldoFinal, icon: BarChart3, iconClassName: "bg-indigo-700" },
        ]}
      />

      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-background shadow-[0_8px_24px_-18px_rgba(15,23,42,0.55)] dark:border-slate-800">
        <table
          className="table-fixed border-collapse text-[10px]"
          style={{
            width: PRIMARY_COLUMN_WIDTH + (data?.months.length ?? 0) * MONTH_COLUMN_WIDTH + TOTAL_COLUMN_WIDTH,
          }}
        >
          <colgroup>
            <col className="w-[360px]" />
            {data?.months.map((month) => <col key={month.key} className="w-[72px]" />)}
            <col className="w-[96px]" />
          </colgroup>
          <thead className="bg-slate-600 text-[9px] uppercase tracking-[0.08em] text-white dark:bg-slate-700">
            <tr>
              <th className="border-r border-slate-500 px-3 py-2.5 text-left font-semibold dark:border-slate-600">Cuenta Cash</th>
              {data?.months.map((month) => {
                const period = data.periods?.[month.key];
                const isClosing = period?.estado === "EN_CIERRE";
                const lastSync = period?.ultima_sincronizacion
                  ? new Date(period.ultima_sincronizacion).toLocaleString("es-AR")
                  : "sin registro";
                return (
                  <th
                    key={month.key}
                    className={cn(
                      "border-r border-slate-500 px-0.5 py-2.5 text-center text-[8px] font-semibold dark:border-slate-600",
                      isClosing && "bg-amber-700 text-amber-50 ring-1 ring-inset ring-amber-300/60 dark:bg-amber-800",
                    )}
                    title={`${month.start} a ${month.end}${isClosing ? " · En cierre" : ""}${period ? ` · Última sincronización: ${lastSync}` : ""}`}
                  >
                    {formatMonthColumn(month.key)}
                  </th>
                );
              })}
              <th className="sticky right-0 z-20 border-l border-slate-500 bg-slate-600 px-2 py-2.5 text-center font-bold text-white dark:border-slate-600 dark:bg-slate-700">TOTAL (M)</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr><td colSpan={columnCount} className="p-8 text-center text-sm text-muted-foreground">Cargando panel…</td></tr>
            ) : query.error ? (
              <tr><td colSpan={columnCount} className="p-8 text-center text-sm text-destructive">{query.error instanceof Error ? query.error.message : "No se pudo cargar el panel"}</td></tr>
            ) : !data || (!hasFlowMovements && !hasBalanceData) ? (
              <tr><td colSpan={columnCount} className="p-8 text-center text-sm text-muted-foreground">No hay movimientos Cash para el período.</td></tr>
            ) : (
              <>
              {renderBalanceRow(
                "saldo_anterior",
                "SALDO ANTERIOR",
                saldoInicial,
                "border-t-2 bg-slate-50/70 font-semibold dark:bg-slate-950/25",
                "sticky right-0 z-10 border-l bg-slate-50 px-2 py-2 text-right tabular-nums dark:bg-slate-950",
              )}
              {flowGroups.map((group) => {
                const groupRowKey = `group:${group.key}`;
                const isGroupExpanded = expanded.has(groupRowKey);
                const GroupToggleIcon = isGroupExpanded ? ChevronDown : ChevronRight;
                const movementCount = group.accounts.reduce((count, account) => count + account.movement_count, 0);
                const presentation = GROUP_PRESENTATION[group.key];
                const GroupIcon = presentation.icon;
                return (
                  <Fragment key={group.key}>
                    <tr className={cn("border-y border-slate-200/80 font-semibold transition-colors dark:border-slate-800", presentation.rowClassName)}>
                      <td className="border-r p-0">
                        <button type="button" className="group flex w-full items-center gap-2 px-2 py-2 text-left" onClick={() => toggle(groupRowKey)} aria-expanded={isGroupExpanded}>
                          <GroupToggleIcon className="size-3.5 shrink-0 text-slate-500 transition-colors group-hover:text-slate-900 dark:group-hover:text-slate-100" />
                          <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md shadow-sm", presentation.iconClassName)}>
                            <GroupIcon className="size-3.5" />
                          </span>
                          <span className="truncate tracking-[0.015em]">{group.label}</span>
                          <span className={cn("ml-auto rounded-full border px-1.5 py-0.5 text-[8px] font-medium", presentation.badgeClassName)}>{movementCount}</span>
                        </button>
                      </td>
                      {data.months.map((month) => (
                        <td key={month.key} className={cn("border-r border-slate-200/70 px-1 py-2 text-right text-[9px] font-semibold tabular-nums dark:border-slate-800", group.months[month.key] < 0 && "text-rose-700 dark:text-rose-400")}>
                          <MonthAmountButton
                            value={group.months[month.key]}
                            projectedValue={group.key === "INGRESOS" || group.key === "EGRESOS" ? group.projected_months[month.key] : undefined}
                            onClick={() => setDetailTarget({
                              month: month.key,
                              title: group.label,
                              scope: "group",
                              groupKey: group.key,
                            })}
                          />
                        </td>
                      ))}
                      <td className={cn("sticky right-0 z-10 border-l px-2 py-2 text-right font-bold tabular-nums", presentation.totalClassName, group.total < 0 && "text-rose-700 dark:text-rose-400")}>
                        <AmountWithProjection
                          value={group.total}
                          projectedValue={group.key === "INGRESOS" || group.key === "EGRESOS" ? group.projected_total : undefined}
                        />
                      </td>
                    </tr>
                    {isGroupExpanded ? renderSublevel(group.accounts.map((account) => {
                      const accountRowKey = `account:${group.key}:${account.cuenta_cash_id ?? "unmapped"}`;
                      const isAccountExpanded = expanded.has(accountRowKey);
                      const AccountToggleIcon = isAccountExpanded ? ChevronDown : ChevronRight;
                      return (
                        <Fragment key={accountRowKey}>
                          <tr className="border-t border-slate-100 bg-white/70 transition-colors hover:bg-slate-50 dark:border-slate-900 dark:bg-slate-950/30 dark:hover:bg-slate-900/50">
                            <td className="border-r p-0">
                              <div className="flex w-full items-center py-1 pl-9 pr-2 font-medium">
                                <button type="button" className="group flex min-w-0 flex-1 items-center gap-2 py-1 text-left" onClick={() => toggle(accountRowKey)} aria-expanded={isAccountExpanded}>
                                  <AccountToggleIcon className="size-3.5 shrink-0 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
                                  <span className="truncate">{account.cuenta_cash_nombre}</span>
                                </button>
                                {(group.key === "INGRESOS" || group.key === "EGRESOS") && account.cuenta_cash_id != null ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="ml-1 size-6 shrink-0 text-sky-700 hover:bg-sky-100 hover:text-sky-800 dark:text-sky-300 dark:hover:bg-sky-950"
                                    title="Editar proyección de 24 meses"
                                    aria-label={`Editar proyección de ${account.cuenta_cash_nombre}`}
                                    onClick={() => setProjectionEditTarget({
                                      cuentaCashId: account.cuenta_cash_id!,
                                      cuentaCashNombre: account.cuenta_cash_nombre,
                                    })}
                                  >
                                    <Calculator className="size-3.5" />
                                  </Button>
                                ) : null}
                                {account.cuenta_cash_id != null ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-6 shrink-0 text-sky-700 hover:bg-sky-100 hover:text-sky-800 dark:text-sky-300 dark:hover:bg-sky-950"
                                    title="Editar cuenta Cash"
                                    aria-label={`Editar cuenta Cash ${account.cuenta_cash_nombre}`}
                                    onClick={() => navigate(`/cashflow/setup/cuentas/edit/${account.cuenta_cash_id}?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`, {
                                      state: { returnTo: `${location.pathname}${location.search}` },
                                    })}
                                  >
                                    <PencilLine className="size-3.5" />
                                  </Button>
                                ) : null}
                                <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px] font-normal text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                  {account.ledger_accounts.length} ctas.
                                </span>
                              </div>
                            </td>
                            {data.months.map((month) => (
                              <td key={month.key} className={cn("border-r border-slate-100 px-1 py-2 text-right text-[9px] tabular-nums dark:border-slate-900", account.months[month.key] < 0 && "text-rose-700 dark:text-rose-400")}>
                                <MonthAmountButton
                                  value={account.months[month.key]}
                                  projectedValue={group.key === "INGRESOS" || group.key === "EGRESOS" ? account.projected_months[month.key] : undefined}
                                  onClick={() => setDetailTarget({
                                    month: month.key,
                                    title: account.cuenta_cash_nombre,
                                    scope: "account",
                                    groupKey: group.key,
                                    cuentaCashId: account.cuenta_cash_id,
                                  })}
                                />
                              </td>
                            ))}
                            <td className={cn("sticky right-0 z-10 border-l bg-background px-2 py-2 text-right font-semibold tabular-nums", account.total < 0 && "text-rose-700")}>
                              <AmountWithProjection
                                value={account.total}
                                projectedValue={group.key === "INGRESOS" || group.key === "EGRESOS" ? account.projected_total : undefined}
                              />
                            </td>
                          </tr>
                          {isAccountExpanded ? account.ledger_accounts.map((ledgerAccount) => {
                            const ledgerLabel = `${ledgerAccount.cuenta_codigo} — ${ledgerAccount.cuenta_nombre}`;
                            const ledgerTitle = ledgerAccount.cuenta_contable_codigo
                              ? `${ledgerLabel} (${ledgerAccount.cuenta_contable_codigo})`
                              : ledgerLabel;
                            return (
                              <tr key={`${accountRowKey}:ledger:${ledgerAccount.cuenta_codigo}:${ledgerAccount.cuenta_contable_codigo ?? ""}`} className="border-t border-slate-100 bg-slate-50/40 transition-colors hover:bg-slate-100/60 dark:border-slate-900 dark:bg-slate-950/20 dark:hover:bg-slate-900/40">
                                <td className="border-r px-2 py-1.5 pl-14 text-[9px]">
                                  <div className="flex items-center gap-1.5">
                                    <span className="min-w-0 flex-1 truncate" title={ledgerTitle}>{ledgerLabel}</span>
                                    {renderMappingButton(ledgerAccount.cuenta_codigo, ledgerAccount.cuenta_nombre)}
                                    <span className="shrink-0 text-[8px] text-muted-foreground">{ledgerAccount.movement_count} mov.</span>
                                  </div>
                                </td>
                                {data.months.map((month) => (
                                  <td key={month.key} className={cn("border-r px-1 py-1.5 text-right text-[9px] tabular-nums", ledgerAccount.months[month.key] < 0 && "text-rose-700")}>
                                    <MonthAmountButton
                                      value={ledgerAccount.months[month.key]}
                                      onClick={() => setDetailTarget({
                                        month: month.key,
                                        title: ledgerLabel,
                                        scope: "ledger",
                                        groupKey: group.key,
                                        cuentaCashId: account.cuenta_cash_id,
                                        cuentaCodigo: ledgerAccount.cuenta_codigo,
                                      })}
                                    />
                                  </td>
                                ))}
                                <td className={cn("sticky right-0 z-10 border-l bg-muted px-2 py-1.5 text-right text-[9px] font-medium tabular-nums", ledgerAccount.total < 0 && "text-rose-700")}>
                                  {formatAmount(ledgerAccount.total)}
                                </td>
                              </tr>
                            );
                          }) : null}
                        </Fragment>
                      );
                    }), group.label) : null}
                  </Fragment>
                );
              })}
              {renderBalanceRow(
                "saldo_periodo",
                "SALDO DEL MES",
                saldoMesTotal,
                "border-t-2 bg-sky-50/60 font-semibold dark:bg-sky-950/20",
                "sticky right-0 z-10 border-l bg-sky-50 px-2 py-2 text-right tabular-nums dark:bg-sky-950",
              )}
              {renderBalanceRow(
                "saldo_final",
                "SALDO FINAL",
                saldoFinal,
                "border-t-2 border-slate-500 bg-slate-600 font-semibold text-white hover:bg-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600",
                "sticky right-0 z-10 border-l border-slate-500 bg-slate-600 px-2 py-2 text-right text-white tabular-nums dark:border-slate-600 dark:bg-slate-700",
              )}
              </>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[9px] text-muted-foreground">
        Importes expresados en millones. Saldo anterior, saldo del mes y saldo final provienen de erp_cash_saldos para las cuentas Fondo. Al expandir estas filas se muestra la apertura por cuenta contable.
      </p>

      <Dialog open={rebuildOpen} onOpenChange={(open) => { if (!rebuilding) setRebuildOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Actualizar Cash</DialogTitle>
            <DialogDescription>
              Aplicar los mapeos y métodos vigentes con los datos ya importados, hasta {formatPeriodLabel(rebuildEndPeriod)}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label htmlFor="cash-rebuild-from" className="text-sm font-medium">Desde qué mes</label>
            <Input id="cash-rebuild-from" type="month" min="2025-12" max={rebuildEndPeriod}
              value={rebuildFrom} onChange={(event) => setRebuildFrom(event.target.value)} disabled={rebuilding} />
            <p className="text-xs text-muted-foreground">
              Por defecto, el primer mes en cierre o abierto. Diciembre de 2025 se conserva como saldo base; si lo elegís, se actualiza desde enero de 2026.
            </p>
            {!validRebuildFrom && <p role="alert" className="text-xs text-destructive">Seleccioná un mes entre diciembre de 2025 y {formatPeriodLabel(rebuildEndPeriod)}.</p>}
          </div>
          <p className="text-sm">
            Se actualizarán también los meses cerrados del rango, sin reabrirlos. Se conservan los importes manuales y comprometidos.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRebuildOpen(false)} disabled={rebuilding}>Cancelar</Button>
            <Button onClick={handleRebuild} disabled={!validRebuildFrom || rebuilding}>
              <RefreshCw className={cn("size-4", rebuilding && "animate-spin")} />
              {rebuilding ? "Actualizando…" : "Actualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CashProjectionQuickEditDialog
        open={projectionEditTarget !== null}
        onOpenChange={(open) => { if (!open) closeProjectionEditor(); }}
        cuentaCashId={projectionEditTarget?.cuentaCashId ?? null}
        cuentaCashNombre={projectionEditTarget?.cuentaCashNombre ?? ""}
        startYear={projectionEditTarget?.startYear ?? positionedYear}
        onSaved={async () => { await query.refetch(); }}
      />

      <Dialog open={balanceDetailTarget !== null} onOpenChange={(open) => { if (!open) setBalanceDetailTarget(null); }}>
        <DialogContent className="grid max-h-[80vh] !w-[92vw] !max-w-[760px] grid-rows-[auto_minmax(0,1fr)] gap-3 p-4">
          <DialogHeader className="pr-36">
            <DialogTitle className="text-base">{balanceDetailTarget?.label ?? "Detalle de saldo"}</DialogTitle>
            <DialogDescription className="capitalize">
              {balanceDetailTarget ? formatPeriodLabel(balanceDetailTarget.month) : ""}
              {balanceDetailTarget && data?.periods?.[balanceDetailTarget.month]?.estado === "EN_CIERRE"
                ? " · Real provisional · En cierre" : ""}
              {balanceDetailTarget ? ` · ${balanceDetailAccounts.length} cuentas Fondo · importes en unidades` : ""}
            </DialogDescription>
          </DialogHeader>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute right-12 top-3 h-8 text-xs"
            disabled={!balanceDetailTarget || !balanceDetailAccounts.length}
            onClick={() => {
              if (balanceDetailTarget) {
                exportBalanceDetailToXls(
                  balanceDetailTarget,
                  balanceDetailAccounts,
                  balanceDetailTotal,
                );
              }
            }}
          >
            <FileSpreadsheet className="mr-1 size-3.5" /> Exportar XLS
          </Button>
          <div className="min-h-0 overflow-auto rounded-md border">
            {!balanceDetailAccounts.length ? (
              <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
                No hay saldos de cuentas Fondo para este período.
              </div>
            ) : (
              <table className="w-full min-w-[620px] border-collapse text-[10px]">
                <thead className="sticky top-0 z-10 bg-background text-[9px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="border-b px-2 py-2 text-right">Cuenta</th>
                    <th className="border-b px-2 py-2 text-left">Código contable / nombre</th>
                    <th className="border-b px-2 py-2 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceDetailTarget ? balanceDetailAccounts.map((account) => {
                    const value = account[balanceDetailTarget.field][balanceDetailTarget.month] ?? 0;
                    return (
                      <tr key={`balance-detail:${account.cuenta_codigo}`} className="border-t hover:bg-muted/25">
                        <td className="px-2 py-1.5 text-right tabular-nums">{account.cuenta_codigo}</td>
                        <td className="px-2 py-1.5">
                          <span className="font-medium">{account.cuenta_contable_codigo || "-"}</span>
                          <span className="ml-2 text-muted-foreground">{account.cuenta_nombre}</span>
                        </td>
                        <td className={cn("px-2 py-1.5 text-right font-medium tabular-nums", value < 0 && "text-rose-700")}>
                          {formatExactAmount(value)}
                        </td>
                      </tr>
                    );
                  }) : null}
                </tbody>
                <tfoot className="sticky bottom-0 border-t-2 bg-background font-semibold">
                  <tr>
                    <td colSpan={2} className="px-2 py-2 text-right">Total</td>
                    <td className={cn("px-2 py-2 text-right tabular-nums", balanceDetailTotal < 0 && "text-rose-700")}>
                      {formatExactAmount(balanceDetailTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CashMovementDetailDialog target={detailTarget} onClose={() => setDetailTarget(null)} />
      {mappingTarget && <CashAccountMappingsDialog
        key={mappingTarget.accountNumber}
        open
        accountNumber={mappingTarget.accountNumber}
        accountName={mappingTarget.accountName}
        onOpenChange={(open) => { if (!open) setMappingTarget(null); }}
        onSaved={() => { void query.refetch(); }}
      />}

    </div>
  );
};

export default ErpCashPanel;
