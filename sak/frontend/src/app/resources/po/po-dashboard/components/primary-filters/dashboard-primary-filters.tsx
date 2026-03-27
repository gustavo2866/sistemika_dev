"use client";

import { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { RefreshCcw, SlidersHorizontal } from "lucide-react";
import {
  FORM_FIELD_LABEL_CLASS,
  PeriodRangeNavigator,
} from "@/components/forms/form_order";
import { CompactSelectInput } from "@/components/lists/filters";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DashboardPrimaryFiltersViewModel } from "./use-dashboard-primary-filters";

type DashboardFilterFormValues = {
  solicitanteId: string;
  proveedorId: string;
  tipoSolicitudId: string;
  departamentoId: string;
  tipoCompra: string;
};

type CompactChoice = {
  id: string;
  name: string;
};

const normalizeFilterValue = (value: string) => (value === "todos" ? "" : value);

const buildChoices = (options: Array<{ value: string; label: string }>): CompactChoice[] =>
  options
    .filter((option) => option.value !== "todos")
    .map((option) => ({
      id: option.value,
      name: option.label,
    }));

const CompactDashboardFilter = ({
  source,
  label,
  choices,
  widthClass = "w-full",
  onChange,
}: {
  source: keyof DashboardFilterFormValues;
  label: string;
  choices: CompactChoice[];
  widthClass?: string;
  onChange: (value: string) => void;
}) => (
  <CompactSelectInput
    source={source}
    label={label}
    choices={choices}
    optionText="name"
    optionValue="id"
    emptyText="Todos"
    className={cn("w-[100px] min-w-[100px] max-w-[100px]", widthClass)}
    onSelectionChange={(selected) => onChange(selected ? String(selected) : "todos")}
  />
);

export const DashboardPrimaryFilters = ({
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
}: DashboardPrimaryFiltersViewModel) => {
  const form = useForm<DashboardFilterFormValues>({
    defaultValues: {
      solicitanteId: normalizeFilterValue(filters.solicitanteId),
      proveedorId: normalizeFilterValue(filters.proveedorId),
      tipoSolicitudId: normalizeFilterValue(filters.tipoSolicitudId),
      departamentoId: normalizeFilterValue(filters.departamentoId),
      tipoCompra: normalizeFilterValue(filters.tipoCompra),
    },
  });

  useEffect(() => {
    form.reset({
      solicitanteId: normalizeFilterValue(filters.solicitanteId),
      proveedorId: normalizeFilterValue(filters.proveedorId),
      tipoSolicitudId: normalizeFilterValue(filters.tipoSolicitudId),
      departamentoId: normalizeFilterValue(filters.departamentoId),
      tipoCompra: normalizeFilterValue(filters.tipoCompra),
    });
  }, [
    filters.departamentoId,
    filters.proveedorId,
    filters.solicitanteId,
    filters.tipoCompra,
    filters.tipoSolicitudId,
    form,
  ]);

  return (
    <FormProvider {...form}>
      <div className="w-full rounded-xl border border-border/60 bg-background/95 p-1 sm:p-2">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1.5">
          <div className="flex flex-wrap items-end gap-x-2 gap-y-1.5">
            <div className="flex flex-col gap-0.5">
              <span
                className={cn(
                  FORM_FIELD_LABEL_CLASS,
                  "text-[8px] uppercase tracking-[0.14em] text-muted-foreground sm:text-[9px]",
                )}
              >
                Periodo
              </span>
              <PeriodRangeNavigator
                value={{ startDate: filters.startDate, endDate: filters.endDate }}
                periodType={periodType}
                onChange={onApplyRange}
                hideLabel
                className="min-w-0 lg:w-fit"
              />
            </div>

            <div className="flex items-end gap-1 sm:gap-1.5">
              <CompactDashboardFilter
                source="tipoCompra"
                label="Tipo orden"
                choices={buildChoices(tipoCompraOptions)}
                onChange={onTipoCompraChange}
              />
              <CompactDashboardFilter
                source="departamentoId"
                label="Departamento"
                choices={buildChoices(departamentoOptions)}
                onChange={onDepartamentoChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 w-6 shrink-0 px-0 text-[10px] sm:h-8 sm:w-8"
                onClick={onToggleAdditionalFilters}
                title={showAdditionalFilters ? "Ocultar filtros" : "Mas filtros"}
                aria-label={showAdditionalFilters ? "Ocultar filtros" : "Mas filtros"}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 w-6 shrink-0 px-0 text-[10px] sm:h-8 sm:w-8"
                onClick={onResetFilters}
                title="Limpiar"
                aria-label="Limpiar"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {showAdditionalFilters ? (
          <div className="mt-1.5 border-t border-border/50 pt-1.5">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="inline-flex h-5 items-center rounded-full border border-border/60 bg-muted px-2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                Filtros adicionales
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <CompactDashboardFilter
                source="solicitanteId"
                label="Solicitante"
                choices={buildChoices(solicitanteOptions)}
                onChange={onSolicitanteChange}
              />
              <CompactDashboardFilter
                source="proveedorId"
                label="Proveedor"
                choices={buildChoices(proveedorOptions)}
                onChange={onProveedorChange}
              />
              <CompactDashboardFilter
                source="tipoSolicitudId"
                label="Tipo solicitud"
                choices={buildChoices(tipoSolicitudOptions)}
                onChange={onTipoSolicitudChange}
              />
            </div>
          </div>
        ) : null}
      </div>
    </FormProvider>
  );
};
