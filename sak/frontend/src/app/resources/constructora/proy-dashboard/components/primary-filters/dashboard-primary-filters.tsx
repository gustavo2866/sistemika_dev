"use client";

import { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import {
  FORM_FIELD_LABEL_CLASS,
  PeriodRangeNavigator,
} from "@/components/forms/form_order";
import { CompactSelectInput } from "@/components/lists/filters";
import { cn } from "@/lib/utils";
import type { DashboardPrimaryFiltersViewModel } from "./use-dashboard-primary-filters";

type DashboardFilterFormValues = {
  proyectoId: string;
  estado: string;
};

type CompactChoice = {
  id: string;
  name: string;
};

const normalizeFilterValue = (value: string) => (value === "todos" ? "" : value);

const buildChoices = (options: Array<{ value: string; label: string }>): CompactChoice[] =>
  options
    .filter((option) => option.value !== "todos" && option.value !== "")
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
    className={cn("w-[120px] min-w-[120px] max-w-[120px]", widthClass)}
    onSelectionChange={(selected) => onChange(selected ? String(selected) : "todos")}
  />
);

export const DashboardPrimaryFilters = ({
  periodType,
  filters,
  proyectoOptions,
  estadoOptions,
  onApplyRange,
  onProyectoChange,
  onEstadoChange,
}: DashboardPrimaryFiltersViewModel) => {
  const form = useForm<DashboardFilterFormValues>({
    defaultValues: {
      proyectoId: normalizeFilterValue(filters.proyectoId),
      estado: normalizeFilterValue(filters.estado),
    },
  });

  useEffect(() => {
    form.reset({
      proyectoId: normalizeFilterValue(filters.proyectoId),
      estado: normalizeFilterValue(filters.estado),
    });
  }, [filters.estado, filters.proyectoId, form]);

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

            <div className="flex flex-wrap items-end gap-1 sm:gap-1.5">
              <CompactDashboardFilter
                source="proyectoId"
                label="Proyecto"
                choices={buildChoices(proyectoOptions)}
                widthClass="w-[180px] min-w-[180px] max-w-[180px]"
                onChange={onProyectoChange}
              />
              <CompactDashboardFilter
                source="estado"
                label="Estado"
                choices={buildChoices(estadoOptions)}
                widthClass="w-[120px] min-w-[120px] max-w-[120px]"
                onChange={onEstadoChange}
              />
            </div>
          </div>
        </div>
      </div>
    </FormProvider>
  );
};
