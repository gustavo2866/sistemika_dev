import type { RealProject } from "../../reales/model";

export type HistoricalTotals = {
  real: { income: number; cost: number };
  adjusted: { income: number; cost: number };
};

export const getHistoricalTotals = (
  project?: RealProject,
  rubroId?: number,
  accountId?: number,
): HistoricalTotals => {
  const totals: HistoricalTotals = {
    real: { income: 0, cost: 0 },
    adjusted: { income: 0, cost: 0 },
  };
  for (const category of project?.rubros ?? []) {
    if (rubroId !== undefined && category.rubro_id !== rubroId) continue;
    const isIncome = category.rubro_nombre.trim().toLowerCase() === "ingresos";
    for (const account of category.cuentas) {
      if (accountId !== undefined && account.cuenta_id !== accountId) continue;
      // El histórico ya invierte el signo contable: ingresos positivos, costos negativos.
      const field = isIncome ? "income" : "cost";
      const sign = isIncome ? 1 : -1;
      totals.real[field] += sign * Number(account.total.historico ?? 0);
      totals.adjusted[field] += sign * Number(account.total.actual ?? 0);
    }
  }
  return totals;
};

export const sumHistoricalTotals = (items: HistoricalTotals[]): HistoricalTotals =>
  items.reduce((sum, item) => ({
    real: { income: sum.real.income + item.real.income, cost: sum.real.cost + item.real.cost },
    adjusted: { income: sum.adjusted.income + item.adjusted.income, cost: sum.adjusted.cost + item.adjusted.cost },
  }), { real: { income: 0, cost: 0 }, adjusted: { income: 0, cost: 0 } });
