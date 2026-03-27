import type { PeriodType, ProyDashboardFilters, SelectOption } from "../../model";

type PrimaryFilters = Pick<
  ProyDashboardFilters,
  "startDate" | "endDate" | "proyectoId" | "estado"
>;

export type DashboardPrimaryFiltersViewModel = {
  periodType: PeriodType;
  filters: PrimaryFilters;
  proyectoOptions: SelectOption[];
  estadoOptions: SelectOption[];
  onApplyRange: (range: { startDate: string; endDate: string }, type: PeriodType) => void;
  onProyectoChange: (value: string) => void;
  onEstadoChange: (value: string) => void;
};

type UseDashboardPrimaryFiltersParams = DashboardPrimaryFiltersViewModel;

export const useDashboardPrimaryFilters = ({
  periodType,
  filters,
  proyectoOptions,
  estadoOptions,
  onApplyRange,
  onProyectoChange,
  onEstadoChange,
}: UseDashboardPrimaryFiltersParams): DashboardPrimaryFiltersViewModel => ({
  periodType,
  filters,
  proyectoOptions,
  estadoOptions,
  onApplyRange,
  onProyectoChange,
  onEstadoChange,
});
