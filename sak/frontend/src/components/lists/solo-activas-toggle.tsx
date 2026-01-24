"use client";

import { useListContext } from "ra-core";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type SoloActivasToggleProps = {
  className?: string;
  source?: string;
  label?: string;
  alwaysOn?: boolean;
};

export const SoloActivasToggleFilter = ({
  className,
  source = "activo",
  label = "Solo activas",
}: SoloActivasToggleProps) => {
  const { filterValues, setFilters } = useListContext();
  const soloActivas = Boolean((filterValues as Record<string, unknown>)[source]);

  const handleSoloActivasChange = (next: boolean) => {
    const nextFilters = { ...filterValues } as Record<string, unknown>;
    if (next) {
      nextFilters[source] = true;
    } else {
      delete nextFilters[source];
    }
    setFilters(nextFilters, {});
  };

  return (
    <div
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md border px-2 py-0 shrink-0 sm:h-9 sm:gap-2 sm:px-3 sm:py-0",
        className
      )}
    >
      <Switch
        id="solo-activas-toggle"
        checked={soloActivas}
        onCheckedChange={handleSoloActivasChange}
        className="!h-[1rem] !w-7 !px-0 !py-0 sm:!h-[1.15rem] sm:!w-8"
      />
      <Label htmlFor="solo-activas-toggle" className="text-[11px] font-medium sm:text-sm">
        {label}
      </Label>
    </div>
  );
};
