"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FORM_FIELD_LABEL_CLASS,
  FORM_SELECT_TRIGGER_CLASS,
  PeriodRangeNavigator,
} from "@/components/forms/form_order";
import { cn } from "@/lib/utils";
import type { DashboardPrimaryFiltersViewModel } from "./use-dashboard-primary-filters";

export const DashboardPrimaryFilters = ({
  periodType,
  filters,
  tipoOperacionOptions,
  onApplyRange,
  onTipoOperacionChange,
}: DashboardPrimaryFiltersViewModel) => (
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
        <div className="flex flex-col gap-0.5">
          <span
            className={cn(
              FORM_FIELD_LABEL_CLASS,
              "text-[8px] uppercase tracking-[0.14em] text-muted-foreground sm:text-[9px]",
            )}
          >
            Operacion
          </span>
          <div className="compact-filter">
            <Select value={filters.tipoOperacionId} onValueChange={onTipoOperacionChange}>
              <SelectTrigger
                className={cn(
                  FORM_SELECT_TRIGGER_CLASS,
                  "h-5 w-[120px] bg-background text-[8px] sm:h-6 sm:w-[150px] sm:text-[10px]",
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tipoOperacionOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  </div>
);
