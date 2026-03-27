import type {
  PeriodType,
  PoDashboardFilters,
  SelectOption,
} from "../../model";

type PrimaryFilters = Pick<
  PoDashboardFilters,
  | "startDate"
  | "endDate"
  | "solicitanteId"
  | "proveedorId"
  | "tipoSolicitudId"
  | "departamentoId"
  | "tipoCompra"
>;

export type DashboardPrimaryFiltersViewModel = {
  periodType: PeriodType;
  filters: PrimaryFilters;
  showAdditionalFilters: boolean;
  solicitanteOptions: SelectOption[];
  proveedorOptions: SelectOption[];
  tipoSolicitudOptions: SelectOption[];
  departamentoOptions: SelectOption[];
  tipoCompraOptions: SelectOption[];
  onApplyRange: (
    range: { startDate: string; endDate: string },
    type: PeriodType,
  ) => void;
  onSolicitanteChange: (value: string) => void;
  onProveedorChange: (value: string) => void;
  onTipoSolicitudChange: (value: string) => void;
  onDepartamentoChange: (value: string) => void;
  onTipoCompraChange: (value: string) => void;
  onToggleAdditionalFilters: () => void;
  onResetFilters: () => void;
};

type UseDashboardPrimaryFiltersParams = DashboardPrimaryFiltersViewModel;

export const useDashboardPrimaryFilters = ({
  periodType,
  filters,
  showAdditionalFilters,
  solicitanteOptions,
  proveedorOptions,
  tipoSolicitudOptions,
  departamentoOptions,
  tipoCompraOptions,
  onApplyRange,
  onSolicitanteChange,
  onProveedorChange,
  onTipoSolicitudChange,
  onDepartamentoChange,
  onTipoCompraChange,
  onToggleAdditionalFilters,
  onResetFilters,
}: UseDashboardPrimaryFiltersParams): DashboardPrimaryFiltersViewModel => ({
  periodType,
  filters,
  showAdditionalFilters,
  solicitanteOptions,
  proveedorOptions,
  tipoSolicitudOptions,
  departamentoOptions,
  tipoCompraOptions,
  onApplyRange,
  onSolicitanteChange,
  onProveedorChange,
  onTipoSolicitudChange,
  onDepartamentoChange,
  onTipoCompraChange,
  onToggleAdditionalFilters,
  onResetFilters,
});
