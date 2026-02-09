"use client";

import { useEffect, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useWrappedSource } from "ra-core";

import { NumberField } from "@/components/number-field";
import { FormValue } from "./field_wrappers";

export const CalculatedImporte = ({
  computeImporte,
  className,
  widthClass,
  valueClassName,
}: {
  computeImporte: (input: { cantidad?: unknown; precio?: unknown }) => number;
  className?: string;
  widthClass?: string;
  valueClassName?: string;
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
    <FormValue
      label={false}
      className={className}
      widthClass={widthClass ?? "w-[80px] sm:w-[84px] shrink-0"}
      valueClassName={valueClassName}
    >
      <NumberField
        source="importe"
        record={{ importe }}
        options={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
      />
    </FormValue>
  );
};
