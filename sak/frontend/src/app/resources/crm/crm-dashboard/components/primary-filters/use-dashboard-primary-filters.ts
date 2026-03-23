import type { PeriodType } from "../../model";
import type { CrmDashboardFilters, SelectOption } from "../../model";

type PrimaryFilters = Pick<CrmDashboardFilters, "startDate" | "endDate" | "tipoOperacionId">;

export type DashboardPrimaryFiltersViewModel = {
  periodType: PeriodType;
  filters: PrimaryFilters;
  tipoOperacionOptions: SelectOption[];
  onApplyRange: (range: { startDate: string; endDate: string }, type: PeriodType) => void;
  onTipoOperacionChange: (value: string) => void;
};

type UseDashboardPrimaryFiltersParams = {
  periodType: PeriodType;
  filters: PrimaryFilters;
  tipoOperacionOptions: SelectOption[];
  onApplyRange: (range: { startDate: string; endDate: string }, type: PeriodType) => void;
  onTipoOperacionChange: (value: string) => void;
};

export const useDashboardPrimaryFilters = ({
  periodType,
  filters,
  tipoOperacionOptions,
  onApplyRange,
  onTipoOperacionChange,
}: UseDashboardPrimaryFiltersParams): DashboardPrimaryFiltersViewModel => ({
  periodType,
  filters,
  tipoOperacionOptions,
  onApplyRange,
  onTipoOperacionChange,
});
