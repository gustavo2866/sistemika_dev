"use client";

import { useFormContext, useWatch } from "react-hook-form";
import type { MouseEvent, ReactNode } from "react";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";

export const POTotalInline = ({
  name = "total",
  format = formatCurrency,
}: {
  name?: string;
  format?: (value: number) => string;
}) => {
  const { control } = useFormContext();
  const total = useWatch({ control, name });
  const totalDisplay = format(Number(total ?? 0));

  return (
    <div className="text-[10px] leading-none text-muted-foreground sm:text-xs">
      <span>Total estimado</span>{" "}
      <span className="rounded-sm bg-muted/80 px-1.5 py-0.5 font-semibold text-foreground shadow-sm">
        {totalDisplay}
      </span>
    </div>
  );
};

export const PODetalleHeaderRow = ({
  onAdd,
  menuContent,
}: {
  onAdd?: () => void;
  menuContent?: ReactNode;
}) => {
  const handleAddClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onAdd?.();
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddClick}
        disabled={!onAdd}
        className="h-6 px-1.5 text-[10px] leading-none sm:h-6 sm:px-2 sm:text-[11px]"
      >
        + Agregar
      </Button>
      {menuContent}
    </div>
  );
};
