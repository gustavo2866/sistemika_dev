import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PERIOD_OPTIONS = ["mes", "trimestre", "cuatrimestre", "semestre", "anio", "personalizado"] as const;

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
}

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

const buildRangeFrom = (endDate: Date, period: PeriodType): PeriodRange => {
  const months = periodToOffset(period);
  const start = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1 - months, 1));
  const startDate = start.toISOString().split("T")[0];
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 0))
    .toISOString()
    .split("T")[0];
  return { startDate, endDate: end };
};

const parseValueToDate = (value?: string) => {
  if (!value) return new Date();
  const parts = value.split("-").map((p) => Number(p));
  if (parts.length === 3) {
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  }
  return new Date();
};

export const PeriodRangeNavigator = ({
  value,
  periodType,
  onChange,
  className,
}: PeriodRangeNavigatorProps) => {
  const isCustom = periodType === "personalizado";
  const alignedValue = useMemo(() => {
    if (!value?.startDate || !value?.endDate) {
      return buildRangeFrom(new Date(), periodType);
    }
    return value;
  }, [periodType, value]);

  const rangeLabel = useMemo(() => {
    return `${new Date(alignedValue.startDate).toLocaleDateString("es-AR")} - ${new Date(
      alignedValue.endDate,
    ).toLocaleDateString("es-AR")}`;
  }, [alignedValue]);

  const handleSelectChange = (nextPeriod: PeriodType) => {
    if (nextPeriod === "personalizado") {
      onChange(alignedValue, nextPeriod);
      return;
    }
    onChange(buildRangeFrom(new Date(), nextPeriod), nextPeriod);
  };

  const handleNavigate = (direction: number) => {
    if (isCustom) return;
    const months = periodToOffset(periodType);
    const currentEnd = parseValueToDate(alignedValue.endDate);
    const nextEnd = new Date(Date.UTC(currentEnd.getUTCFullYear(), currentEnd.getUTCMonth() + direction * months + 1, 0));
    onChange(buildRangeFrom(nextEnd, periodType), periodType);
  };

  const handleRangeInputChange = (field: "startDate" | "endDate", inputValue: string) => {
    const next = { ...alignedValue, [field]: inputValue };
    onChange(next, "personalizado");
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label className="text-xs text-muted-foreground">Periodo</Label>
      <div className={cn("flex flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm shadow-sm")}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-black"
          onClick={() => handleNavigate(-1)}
        >
          {"<"}
        </Button>
        <Select value={periodType} onValueChange={(value) => handleSelectChange(value as PeriodType)}>
          <SelectTrigger className="h-8 w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option} value={option} className="capitalize">
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-[180px] h-8 justify-between">
              {rangeLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px]" align="start">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Desde</Label>
                <Input
                  type="date"
                  value={alignedValue.startDate}
                  onChange={(event) => handleRangeInputChange("startDate", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Hasta</Label>
                <Input
                  type="date"
                  value={alignedValue.endDate}
                  onChange={(event) => handleRangeInputChange("endDate", event.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">Ajusta manualmente para usar un rango personalizado.</p>
            </div>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-black"
          onClick={() => handleNavigate(1)}
        >
          {">"}
        </Button>
      </div>
    </div>
  );
};

export default PeriodRangeNavigator;
