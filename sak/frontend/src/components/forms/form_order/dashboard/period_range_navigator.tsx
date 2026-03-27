import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  FORM_FIELD_BASE_CLASS,
  FORM_FIELD_LABEL_CLASS,
  FORM_SELECT_TRIGGER_CLASS,
} from "../form/field_styles";

const PERIOD_OPTIONS = [
  "mes",
  "trimestre",
  "cuatrimestre",
  "semestre",
  "anio",
  "personalizado",
] as const;

export type PeriodType = (typeof PERIOD_OPTIONS)[number];

export type PeriodRange = {
  startDate: string;
  endDate: string;
};

export interface PeriodRangeNavigatorProps {
  value: PeriodRange;
  periodType: PeriodType;
  onChange: (nextRange: PeriodRange, periodType: PeriodType) => void;
  className?: string;
  hideLabel?: boolean;
}

const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

const QUARTER_OPTIONS = [
  { value: "0", label: "Ene - Mar" },
  { value: "1", label: "Abr - Jun" },
  { value: "2", label: "Jul - Sep" },
  { value: "3", label: "Oct - Dic" },
];

const CUATRIMESTER_OPTIONS = [
  { value: "0", label: "Ene - Abr" },
  { value: "1", label: "May - Ago" },
  { value: "2", label: "Sep - Dic" },
];

const SEMESTER_OPTIONS = [
  { value: "0", label: "Ene - Jun" },
  { value: "1", label: "Jul - Dic" },
];

const YEAR_OPTIONS = [{ value: "0", label: "Ene - Dic" }];

const periodToOffset = (period: PeriodType) => {
  switch (period) {
    case "mes":
      return 1;
    case "trimestre":
      return 3;
    case "cuatrimestre":
      return 4;
    case "semestre":
      return 6;
    case "anio":
      return 12;
    default:
      return 1;
  }
};

const parseValueToDate = (value?: string) => {
  if (!value) return new Date();
  const parts = value.split("-").map((part) => Number(part));
  if (parts.length === 3) {
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  }
  return new Date();
};

const toIsoDate = (date: Date) => date.toISOString().split("T")[0];

const buildRangeFrom = (endDate: Date, period: PeriodType): PeriodRange => {
  const months = periodToOffset(period);
  const start = new Date(
    Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1 - months, 1),
  );
  const end = new Date(
    Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 0),
  );
  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
};

const buildFixedRange = (
  year: number,
  period: Exclude<PeriodType, "personalizado">,
  segmentIndex: number,
): PeriodRange => {
  if (period === "mes") {
    const start = new Date(Date.UTC(year, segmentIndex, 1));
    const end = new Date(Date.UTC(year, segmentIndex + 1, 0));
    return {
      startDate: toIsoDate(start),
      endDate: toIsoDate(end),
    };
  }

  const startMonth =
    period === "trimestre"
      ? segmentIndex * 3
      : period === "cuatrimestre"
        ? segmentIndex * 4
        : period === "semestre"
          ? segmentIndex * 6
          : 0;

  const endMonth =
    period === "trimestre"
      ? startMonth + 2
      : period === "cuatrimestre"
        ? startMonth + 3
        : period === "semestre"
          ? startMonth + 5
          : 11;

  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, endMonth + 1, 0));
  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
};

const getSegmentOptions = (periodType: PeriodType) => {
  if (periodType === "mes") {
    return MONTH_LABELS.map((label, index) => ({ value: String(index), label }));
  }
  if (periodType === "trimestre") return QUARTER_OPTIONS;
  if (periodType === "cuatrimestre") return CUATRIMESTER_OPTIONS;
  if (periodType === "semestre") return SEMESTER_OPTIONS;
  if (periodType === "anio") return YEAR_OPTIONS;
  return [];
};

const getSegmentLabel = (periodType: PeriodType) => {
  if (periodType === "mes") return "Mes";
  if (periodType === "trimestre") return "Trimestre";
  if (periodType === "cuatrimestre") return "Cuatrimestre";
  if (periodType === "semestre") return "Semestre";
  return "Período";
};

const getCurrentPeriodRange = (periodType: PeriodType) =>
  buildRangeFrom(new Date(), periodType);

const formatMonthYear = (value?: string) => {
  const date = parseValueToDate(value);
  return `${MONTH_LABELS[date.getUTCMonth()] ?? ""} ${date.getUTCFullYear()}`;
};

const formatMonthRange = (startValue?: string, endValue?: string) => {
  const start = parseValueToDate(startValue);
  const end = parseValueToDate(endValue);
  const startMonth = MONTH_LABELS[start.getUTCMonth()] ?? "";
  const endMonth = MONTH_LABELS[end.getUTCMonth()] ?? "";

  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${startMonth} - ${endMonth} ${end.getUTCFullYear()}`;
  }

  return `${startMonth} ${start.getUTCFullYear()} - ${endMonth} ${end.getUTCFullYear()}`;
};

const formatFullDate = (value?: string) => {
  const date = parseValueToDate(value);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

export const PeriodRangeNavigator = ({
  value,
  periodType,
  onChange,
  className,
  hideLabel = false,
}: PeriodRangeNavigatorProps) => {
  const isCustom = periodType === "personalizado";
  const currentDate = useMemo(() => new Date(), []);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const alignedValue = useMemo(() => {
    if (!value?.startDate || !value?.endDate) {
      return getCurrentPeriodRange(periodType);
    }
    return value;
  }, [periodType, value]);

  const alignedStartDate = useMemo(
    () => parseValueToDate(alignedValue.startDate),
    [alignedValue.startDate],
  );

  const selectedYear = alignedStartDate.getUTCFullYear();
  const selectedSegment = useMemo(() => {
    const month = alignedStartDate.getUTCMonth();
    if (periodType === "mes") return month;
    if (periodType === "trimestre") return Math.floor(month / 3);
    if (periodType === "cuatrimestre") return Math.floor(month / 4);
    if (periodType === "semestre") return Math.floor(month / 6);
    return 0;
  }, [alignedStartDate, periodType]);

  const [draftRange, setDraftRange] = useState<PeriodRange>(alignedValue);
  const [draftYear, setDraftYear] = useState(String(selectedYear));
  const [draftSegment, setDraftSegment] = useState(String(selectedSegment));

  const yearOptions = useMemo(() => {
    const currentYear = currentDate.getUTCFullYear();
    const startYear = Math.min(currentYear, selectedYear) - 3;
    const endYear = Math.max(currentYear, selectedYear) + 3;
    return Array.from({ length: endYear - startYear + 1 }, (_, index) => {
      const year = startYear + index;
      return { value: String(year), label: String(year) };
    });
  }, [currentDate, selectedYear]);

  const fixedPeriodOptions = useMemo(
    () => getSegmentOptions(periodType),
    [periodType],
  );

  const rangeLabel = useMemo(() => {
    if (periodType === "mes") return formatMonthYear(alignedValue.endDate);
    if (periodType === "personalizado") {
      return `${formatFullDate(alignedValue.startDate)} - ${formatFullDate(alignedValue.endDate)}`;
    }
    return formatMonthRange(alignedValue.startDate, alignedValue.endDate);
  }, [alignedValue, periodType]);

  const resetDraft = () => {
    setDraftRange(alignedValue);
    setDraftYear(String(selectedYear));
    setDraftSegment(String(selectedSegment));
  };

  const handlePopoverOpenChange = (open: boolean) => {
    if (open) resetDraft();
    setPopoverOpen(open);
  };

  const handleSelectChange = (nextPeriod: PeriodType) => {
    if (nextPeriod === "personalizado") {
      onChange(alignedValue, nextPeriod);
      return;
    }
    onChange(getCurrentPeriodRange(nextPeriod), nextPeriod);
  };

  const handleNavigate = (direction: number) => {
    if (isCustom) return;
    const months = periodToOffset(periodType);
    const currentEnd = parseValueToDate(alignedValue.endDate);
    const nextEnd = new Date(
      Date.UTC(
        currentEnd.getUTCFullYear(),
        currentEnd.getUTCMonth() + direction * months + 1,
        0,
      ),
    );
    onChange(buildRangeFrom(nextEnd, periodType), periodType);
  };

  const handleRangeInputChange = (
    field: "startDate" | "endDate",
    inputValue: string,
  ) => {
    setDraftRange((current) => ({ ...current, [field]: inputValue }));
  };

  const handleApply = () => {
    if (isCustom) {
      onChange(draftRange, "personalizado");
    } else {
      onChange(
        buildFixedRange(
          Number(draftYear),
          periodType as Exclude<PeriodType, "personalizado">,
          Number(draftSegment),
        ),
        periodType,
      );
    }
    setPopoverOpen(false);
  };

  const handleCancel = () => {
    resetDraft();
    setPopoverOpen(false);
  };

  return (
    <div className={cn("grid w-full gap-[1px] sm:gap-[2px]", className)}>
      {!hideLabel ? (
        <Label className={cn(FORM_FIELD_LABEL_CLASS, "text-muted-foreground")}>
          Periodo
        </Label>
      ) : null}

      <div className="flex w-full items-center gap-0.5 rounded-lg border border-border/70 bg-card p-0.5 text-sm shadow-sm sm:w-fit sm:flex-wrap sm:gap-0.5 sm:p-0.5 sm:items-center">
        <div className="compact-filter min-w-0 shrink-0">
          <Select
            value={periodType}
            onValueChange={(nextValue) =>
              handleSelectChange(nextValue as PeriodType)
            }
          >
            <SelectTrigger
              className={cn(
                FORM_SELECT_TRIGGER_CLASS,
                "h-5 w-[78px] min-w-[78px] shrink-0 border-0 bg-slate-100/80 px-1 text-[8px] shadow-none ring-0 transition-colors hover:bg-slate-100 hover:text-primary focus:ring-0 focus:ring-offset-0 sm:h-6 sm:w-[94px] sm:min-w-[94px] sm:px-1.5",
              )}
            >
              <span className="inline-flex items-center gap-1 capitalize text-foreground">
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem
                  key={option}
                  value={option}
                  className="capitalize text-[10px] sm:text-sm"
                >
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-0 flex-1 items-center sm:order-3 sm:min-w-[118px] sm:flex-none">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 rounded-md text-black transition-colors hover:bg-slate-100/80 hover:text-primary sm:h-6 sm:w-6"
            onClick={() => handleNavigate(-1)}
          >
            {"<"}
          </Button>

          <Popover open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-5 min-w-0 flex-1 justify-center border-0 bg-slate-100/80 px-1 text-center text-[7px] shadow-none transition-colors hover:bg-slate-100 hover:text-primary sm:h-6 sm:min-w-[106px] sm:flex-none sm:px-1 sm:text-[8px]"
              >
                <span className="truncate">{rangeLabel}</span>
              </Button>
            </PopoverTrigger>

            <PopoverContent
              className="w-[min(236px,calc(100vw-2rem))] rounded-xl p-2.5"
              align="start"
            >
              {isCustom ? (
                <div className="relative space-y-3 pr-7">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-6 w-6 rounded-md px-0 text-muted-foreground"
                    onClick={handleCancel}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>

                  <div className={cn(FORM_FIELD_BASE_CLASS, "w-full gap-1")}>
                    <Label>Desde</Label>
                    <Input
                      type="date"
                      value={draftRange.startDate}
                      onChange={(event) =>
                        handleRangeInputChange("startDate", event.target.value)
                      }
                    />
                  </div>

                  <div className={cn(FORM_FIELD_BASE_CLASS, "w-full gap-1")}>
                    <Label>Hasta</Label>
                    <Input
                      type="date"
                      value={draftRange.endDate}
                      onChange={(event) =>
                        handleRangeInputChange("endDate", event.target.value)
                      }
                    />
                  </div>

                  <div className="flex justify-end pt-0.5">
                    <Button
                      type="button"
                      size="sm"
                      className="h-5 w-5 rounded-md px-0 sm:h-10 sm:w-10 sm:rounded-lg"
                      onClick={handleApply}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Ajusta manualmente para usar un rango personalizado.
                  </p>
                </div>
              ) : (
                <div className="relative pr-7">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-6 w-6 rounded-md px-0 text-muted-foreground"
                    onClick={handleCancel}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>

                  <div className="space-y-2">
                    <div className="flex items-end gap-2">
                    <div
                      className={cn(
                        FORM_FIELD_BASE_CLASS,
                        "min-w-0 flex-[0.74] gap-1",
                      )}
                    >
                      <Label>Año</Label>
                      <Select value={draftYear} onValueChange={setDraftYear}>
                        <SelectTrigger
                          className={cn(
                            FORM_SELECT_TRIGGER_CLASS,
                            "h-10 bg-background text-[13px] sm:text-[13px]",
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {yearOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div
                      className={cn(
                        FORM_FIELD_BASE_CLASS,
                        "min-w-0 flex-[1.02] gap-1",
                      )}
                    >
                      <Label>{getSegmentLabel(periodType)}</Label>
                      <Select value={draftSegment} onValueChange={setDraftSegment}>
                        <SelectTrigger
                          className={cn(
                            FORM_SELECT_TRIGGER_CLASS,
                            "h-10 bg-background text-[13px] sm:text-[13px]",
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {fixedPeriodOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        className="h-6 rounded-md px-2 text-[10px]"
                        onClick={handleApply}
                      >
                        <Check className="mr-1 h-2.5 w-2.5" />
                        Aceptar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 rounded-md text-black transition-colors hover:bg-slate-100/80 hover:text-primary sm:h-6 sm:w-6"
            onClick={() => handleNavigate(1)}
          >
            {">"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PeriodRangeNavigator;
