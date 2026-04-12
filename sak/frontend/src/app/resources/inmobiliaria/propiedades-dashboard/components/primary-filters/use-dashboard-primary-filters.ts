import type { PeriodType } from "../../model";
import type { PropDashboardFilters, SelectOption } from "../../model";

type PrimaryFilters = Pick<
  PropDashboardFilters,
  "startDate" | "endDate" | "tipoOperacionId" | "emprendimientoId"
>;

export type DashboardPrimaryFiltersViewModel = {
  periodType: PeriodType;
  filters: PrimaryFilters;
  tipoOperacionOptions: SelectOption[];
  emprendimientoOptions: SelectOption[];
  onApplyRange: (range: { startDate: string; endDate: string }, type: PeriodType) => void;
  onTipoOperacionChange: (value: string) => void;
  onEmprendimientoChange: (value: string) => void;
};

type UseDashboardPrimaryFiltersParams = {
  periodType: PeriodType;
  filters: PrimaryFilters;
  tipoOperacionOptions: SelectOption[];
  emprendimientoOptions: SelectOption[];
  onApplyRange: (range: { startDate: string; endDate: string }, type: PeriodType) => void;
  onTipoOperacionChange: (value: string) => void;
  onEmprendimientoChange: (value: string) => void;
};

export const useDashboardPrimaryFilters = ({
  periodType,
  filters,
  tipoOperacionOptions,
  emprendimientoOptions,
  onApplyRange,
  onTipoOperacionChange,
  onEmprendimientoChange,
}: UseDashboardPrimaryFiltersParams): DashboardPrimaryFiltersViewModel => ({
  periodType,
  filters,
  tipoOperacionOptions,
  emprendimientoOptions,
  onApplyRange,
  onTipoOperacionChange,
  onEmprendimientoChange,
});
