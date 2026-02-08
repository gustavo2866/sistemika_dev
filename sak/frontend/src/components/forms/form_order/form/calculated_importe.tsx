"use client";

import { useEffect, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useWrappedSource } from "ra-core";

import { NumberField } from "@/components/number-field";

export const CalculatedImporte = ({
  computeImporte,
  className,
}: {
  computeImporte: (input: { cantidad?: unknown; precio?: unknown }) => number;
  className?: string;
}) => {
  const { setValue } = useFormContext();
  const cantidadSource = useWrappedSource("cantidad");
  const precioSource = useWrappedSource("precio");
  const importeSource = useWrappedSource("importe");

  const cantidad = useWatch({ name: cantidadSource }) as number | undefined;
  const precio = useWatch({ name: precioSource }) as number | undefined;

  const importe = useMemo(
    () => computeImporte({ cantidad, precio }),
    [cantidad, precio, computeImporte],
  );

  useEffect(() => {
    setValue(importeSource, importe, { shouldDirty: true, shouldValidate: true });
  }, [importeSource, importe, setValue]);

  return (
    <div className={className ?? "flex flex-col w-[80px] sm:w-[84px] shrink-0"}>
      <div className="flex h-5 sm:h-5 items-center justify-end rounded-md border border-border bg-muted/30 px-2 text-[9px] sm:text-[9px] font-medium text-right">
        <NumberField
          source="importe"
          record={{ importe }}
          options={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
        />
      </div>
    </div>
  );
};

