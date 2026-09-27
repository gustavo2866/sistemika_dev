"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight, CircleEllipsis, DollarSign, List, RefreshCw, RotateCcw, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

import { FinancialKpiCards } from "@/components/financial-kpi-cards";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiUrl } from "@/lib/dataProvider";
import { cn } from "@/lib/utils";

type Week = { key: string; label: string; start: string; end: string };
type Movement = {
  id: number;
  empresa_id: number;
  fecha: string;
  tipo_asiento?: string | null;
  nro_asiento?: string | null;
  cuenta_codigo: number;
  tipo_subcuenta?: string | null;
  nro_subcuenta?: string | null;
  importe: number;
  week_key: string;
  descripcion?: string | null;
};
type AccountRow = {
  cuenta_cash_id?: number | null;
  cuenta_cash_nombre: string;
  weeks: Record<string, number>;
  total: number;
  movements: Movement[];
};
type GroupRow = {
  key: "INGRESOS" | "EGRESOS" | "SIN_CUENTA";
  label: string;
  weeks: Record<string, number>;
  total: number;
  accounts: AccountRow[];
};
type PanelResponse = {
  periodo: string;
  weeks: Week[];
  groups: GroupRow[];
  totals: Record<string, number>;
  total: number;
};
type LibroMayorSaldosResponse = {
  periodo: string;
  totales: {
    saldo_inicial: number;
    saldo_periodo: number;
    saldo_final: number;
  };
};

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

const formatPeriodLabel = (period: string) =>
  new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(periodToDate(period));

const formatAmount = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const formatDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const PRIMARY_COLUMN_WIDTH = 490;
const WEEK_COLUMN_WIDTH = 82;
const TOTAL_COLUMN_WIDTH = 96;
const DEFAULT_EXPANDED_GROUPS = new Set(["group:INGRESOS", "group:EGRESOS", "group:SIN_CUENTA"]);

const fetchPanel = async (periodo: string): Promise<PanelResponse> => {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(
    `${apiUrl}/erp/cash/diario/panel?periodo=${encodeURIComponent(periodo)}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || "No se pudo cargar el panel Cash");
  return payload as PanelResponse;
};

const fetchSaldoInicial = async (periodo: string): Promise<LibroMayorSaldosResponse> => {
  const token = localStorage.getItem("auth_token");
  const params = new URLSearchParams({ periodo, rubro: "01-DISP" });
  const response = await fetch(`${apiUrl}/erp/libro-mayor/saldos?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || "No se pudo obtener el saldo inicial");
  return payload as LibroMayorSaldosResponse;
};

const MovementDetails = ({ movements, weeks }: { movements: Movement[]; weeks: Week[] }) => (
  <div className="max-h-[240px] overflow-x-hidden overflow-y-auto border-y bg-muted/15 py-1.5">
    <table
      className="max-w-full table-fixed border-collapse text-[9px] leading-tight"
      style={{ width: PRIMARY_COLUMN_WIDTH + weeks.length * WEEK_COLUMN_WIDTH + TOTAL_COLUMN_WIDTH }}
    >
      <colgroup>
        <col className="w-[34px]" />
        <col className="w-[66px]" />
        <col className="w-[46px]" />
        <col className="w-[50px]" />
        <col className="w-[54px]" />
        <col className="w-[240px]" />
        {weeks.map((week) => <col key={week.key} className="w-[82px]" />)}
        <col className="w-[96px]" />
      </colgroup>
      <thead className="sticky top-0 z-10 bg-background text-[8px] uppercase tracking-wide text-muted-foreground">
        <tr>
          <th className="px-1 py-1 text-left">Emp.</th>
          <th className="px-1 py-1 text-left">Fecha</th>
          <th className="px-1 py-1 text-left">Asiento</th>
          <th className="px-1 py-1 text-right">Cuenta</th>
          <th className="px-1 py-1 text-left">Subcta.</th>
          <th className="px-1 py-1 text-left">Descripción</th>
          {weeks.map((week, index) => (
            <th key={week.key} className="border-l px-1 py-1 text-center" title={week.label}>
              Sem. {index + 1}
            </th>
          ))}
          <th className="px-1 py-1 text-center">Total</th>
        </tr>
      </thead>
      <tbody>
        {movements.map((movement) => (
          <tr key={movement.id} className="border-t border-border/40 hover:bg-muted/30">
            <td className="px-1 py-1">{movement.empresa_id}</td>
            <td className="px-1 py-1 whitespace-nowrap">{formatDate(movement.fecha)}</td>
            <td className="px-1 py-1 truncate" title={`${movement.tipo_asiento ?? ""} ${movement.nro_asiento ?? ""}`}>
              {[movement.tipo_asiento, movement.nro_asiento].filter(Boolean).join(" / ") || "-"}
            </td>
            <td className="px-1 py-1 text-right tabular-nums">{movement.cuenta_codigo}</td>
            <td className="px-1 py-1 truncate" title={`${movement.tipo_subcuenta ?? ""} ${movement.nro_subcuenta ?? ""}`}>
              {[movement.tipo_subcuenta, movement.nro_subcuenta].filter(Boolean).join(" / ") || "-"}
            </td>
            <td className="px-1 py-1">
              <div className="truncate" title={movement.descripcion ?? ""}>
                {movement.descripcion || "-"}
              </div>
            </td>
            {weeks.map((week) => (
              <td
                key={week.key}
                className={cn(
                  "border-l px-1 py-1 text-right font-medium tabular-nums",
                  movement.week_key === week.key && movement.importe < 0 && "text-rose-700",
                )}
              >
                {movement.week_key === week.key ? formatAmount(movement.importe) : null}
              </td>
            ))}
            <td className={cn("px-1 py-1 text-right font-medium tabular-nums", movement.importe < 0 && "text-rose-700")}>
              {formatAmount(movement.importe)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const ErpCashDiarioPanel = () => {
  const [periodo, setPeriodo] = useState(currentPeriod);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(DEFAULT_EXPANDED_GROUPS));
  const query = useQuery({
    queryKey: ["erp-cash-diario-panel", periodo],
    queryFn: () => fetchPanel(periodo),
    enabled: Boolean(periodo),
  });
  const saldoQuery = useQuery({
    queryKey: ["erp-libro-mayor-saldo-inicial", periodo],
    queryFn: () => fetchSaldoInicial(periodo),
    enabled: Boolean(periodo),
  });
  const data = query.data;
  const columnCount = (data?.weeks.length ?? 0) + 2;
  const hasMovements = data?.groups.some((group) => group.accounts.length > 0) ?? false;
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
  const saldoInicial = saldoQuery.data?.totales.saldo_inicial ?? 0;
  const saldoFinal = saldoInicial + ingresos + egresos + otros;

  const selectPeriod = (nextPeriod: string) => {
    setPeriodo(nextPeriod);
    setExpanded(new Set(DEFAULT_EXPANDED_GROUPS));
  };

  const toggle = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="w-full max-w-[1500px] px-2 py-3 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">CashFlow</p>
          <h1 className="text-xl font-semibold">Panel Diario Cash</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-slate-200 bg-white shadow-xs">
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-r-none" onClick={() => selectPeriod(movePeriod(periodo, -1))} aria-label="Mes anterior" title="Mes anterior">
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
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-l-none" onClick={() => selectPeriod(movePeriod(periodo, 1))} aria-label="Mes siguiente" title="Mes siguiente">
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
            onClick={() => {
              query.refetch();
              saldoQuery.refetch();
            }}
            disabled={query.isFetching || saldoQuery.isFetching}
          >
            <RefreshCw className={cn("mr-1 size-3.5", (query.isFetching || saldoQuery.isFetching) && "animate-spin")} />
            Actualizar
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
            <Link to="/erp/cash/diario"><List className="mr-1 size-3.5" />Listado</Link>
          </Button>
        </div>
      </div>

      <FinancialKpiCards
        className="mb-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        items={[
          {
            key: "saldo-inicial",
            title: "Saldo inicial",
            value: saldoInicial,
            detail: saldoQuery.isLoading ? "Cargando…" : saldoQuery.error ? "No disponible" : undefined,
            detailTitle: saldoQuery.error instanceof Error ? saldoQuery.error.message : undefined,
            icon: DollarSign,
            iconClassName: "bg-slate-600",
          },
          { key: "ingresos", title: "Ingresos", value: ingresos, icon: TrendingUp, iconClassName: "bg-emerald-600" },
          { key: "egresos", title: "Egresos", value: egresos, icon: TrendingDown, iconClassName: "bg-rose-600" },
          { key: "otros", title: "Otros", value: otros, icon: CircleEllipsis, iconClassName: "bg-amber-500" },
          { key: "saldo-final", title: "Saldo final", value: saldoFinal, icon: BarChart3, iconClassName: "bg-indigo-700" },
        ]}
      />

      <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
        <table
          className="max-w-full table-fixed border-collapse text-[10px]"
          style={{
            width: PRIMARY_COLUMN_WIDTH + (data?.weeks.length ?? 0) * WEEK_COLUMN_WIDTH + TOTAL_COLUMN_WIDTH,
          }}
        >
          <colgroup>
            <col className="w-[490px]" />
            {data?.weeks.map((week) => <col key={week.key} className="w-[82px]" />)}
            <col className="w-[96px]" />
          </colgroup>
          <thead className="bg-muted/50 text-[9px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="border-r px-2 py-2 text-left">Cuenta Cash</th>
              {data?.weeks.map((week, index) => (
                <th key={week.key} className="border-r px-0.5 py-2 text-center text-[8px]" title={`${week.start} a ${week.end}`}>
                  Sem. {index + 1}<span className="ml-0.5 font-normal normal-case">({week.label})</span>
                </th>
              ))}
              <th className="px-2 py-2 text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr><td colSpan={columnCount} className="p-8 text-center text-sm text-muted-foreground">Cargando panel…</td></tr>
            ) : query.error ? (
              <tr><td colSpan={columnCount} className="p-8 text-center text-sm text-destructive">{query.error instanceof Error ? query.error.message : "No se pudo cargar el panel"}</td></tr>
            ) : !data || !hasMovements ? (
              <tr><td colSpan={columnCount} className="p-8 text-center text-sm text-muted-foreground">No hay movimientos Cash para el período.</td></tr>
            ) : (
              data.groups.map((group) => {
                const groupRowKey = `group:${group.key}`;
                const isGroupExpanded = expanded.has(groupRowKey);
                const GroupToggleIcon = isGroupExpanded ? ChevronDown : ChevronRight;
                const movementCount = group.accounts.reduce((count, account) => count + account.movements.length, 0);
                return (
                  <Fragment key={group.key}>
                    <tr className="border-t bg-muted/40 font-semibold hover:bg-muted/55">
                      <td className="border-r p-0">
                        <button type="button" className="flex w-full items-center gap-1.5 px-2 py-2 text-left" onClick={() => toggle(groupRowKey)} aria-expanded={isGroupExpanded}>
                          <GroupToggleIcon className="size-3.5 shrink-0" />
                          <span className="truncate">{group.label}</span>
                          <span className="ml-auto text-[8px] font-normal text-muted-foreground">{movementCount}</span>
                        </button>
                      </td>
                      {data.weeks.map((week) => (
                        <td key={week.key} className={cn("border-r px-1 py-2 text-right text-[9px] tabular-nums", group.weeks[week.key] < 0 && "text-rose-700")}>
                          {formatAmount(group.weeks[week.key])}
                        </td>
                      ))}
                      <td className={cn("px-2 py-2 text-right tabular-nums", group.total < 0 && "text-rose-700")}>
                        {formatAmount(group.total)}
                      </td>
                    </tr>
                    {isGroupExpanded ? group.accounts.map((account) => {
                      const accountRowKey = `account:${group.key}:${account.cuenta_cash_id ?? "unmapped"}`;
                      const isAccountExpanded = expanded.has(accountRowKey);
                      const AccountToggleIcon = isAccountExpanded ? ChevronDown : ChevronRight;
                      return (
                        <Fragment key={accountRowKey}>
                          <tr className="border-t hover:bg-muted/20">
                            <td className="border-r p-0">
                              <button type="button" className="flex w-full items-center gap-1.5 py-2 pl-7 pr-2 text-left font-medium" onClick={() => toggle(accountRowKey)} aria-expanded={isAccountExpanded}>
                                <AccountToggleIcon className="size-3.5 shrink-0" />
                                <span className="truncate">{account.cuenta_cash_nombre}</span>
                                <span className="ml-auto text-[8px] text-muted-foreground">{account.movements.length}</span>
                              </button>
                            </td>
                            {data.weeks.map((week) => (
                              <td key={week.key} className={cn("border-r px-1 py-2 text-right text-[9px] tabular-nums", account.weeks[week.key] < 0 && "text-rose-700")}>
                                {formatAmount(account.weeks[week.key])}
                              </td>
                            ))}
                            <td className={cn("px-2 py-2 text-right font-semibold tabular-nums", account.total < 0 && "text-rose-700")}>
                              {formatAmount(account.total)}
                            </td>
                          </tr>
                          {isAccountExpanded ? (
                            <tr><td colSpan={columnCount}><MovementDetails movements={account.movements} weeks={data.weeks} /></td></tr>
                          ) : null}
                        </Fragment>
                      );
                    }) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
          {data && hasMovements ? (
            <tfoot className="border-t-2 bg-muted/40 font-semibold">
              <tr>
                <td className="border-r px-2 py-2">Total</td>
                {data.weeks.map((week) => (
                  <td key={week.key} className={cn("border-r px-1 py-2 text-right text-[9px] tabular-nums", data.totals[week.key] < 0 && "text-rose-700")}>
                    {formatAmount(data.totals[week.key])}
                  </td>
                ))}
                <td className={cn("px-2 py-2 text-right tabular-nums", data.total < 0 && "text-rose-700")}>{formatAmount(data.total)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <p className="mt-2 text-[9px] text-muted-foreground">Se excluyen los movimientos cuyo rubro comienza con 01-DISP.</p>
    </div>
  );
};

export default ErpCashDiarioPanel;
