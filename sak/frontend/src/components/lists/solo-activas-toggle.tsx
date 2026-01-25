"use client";

import { useListContext } from "ra-core";
import { FormField } from "@/components/forms";
import { Switch } from "@/components/ui/switch";
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
    <FormField label={label} className={cn("space-y-1 sm:space-y-2", className)}>
      <div className="flex h-7 items-center gap-2 rounded-md border px-2 sm:h-9 sm:px-3">
        <Switch
          id="solo-activas-toggle"
          checked={soloActivas}
          onCheckedChange={handleSoloActivasChange}
          className="!h-[1rem] !w-7 !px-0 !py-0 [&_[data-slot=switch-thumb]]:size-3 sm:!h-[1.15rem] sm:!w-8 sm:[&_[data-slot=switch-thumb]]:size-4"
        />
      </div>
    </FormField>
  );
};
