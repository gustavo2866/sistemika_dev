"use client";

import { useEffect, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

export const TotalCompute = ({
  detailsSource = "detalles",
  totalSource = "total",
  computeTotal,
}: {
  detailsSource?: string;
  totalSource?: string;
  computeTotal: (detalles: Array<{ importe?: unknown }>) => number;
}) => {
  const { control, setValue } = useFormContext();
  const detalles = useWatch({ name: detailsSource, control }) as
    | Array<{ importe?: unknown }>
    | undefined;

  // Watch each individual importe field to ensure changes are detected.
  const importeFieldNames = useMemo(() => {
    if (!detalles || !Array.isArray(detalles)) return [];
    return detalles.map((_, index) => `${detailsSource}.${index}.importe`);
  }, [detalles?.length, detailsSource]);

  const importeValues = useWatch({ name: importeFieldNames, control });

  const detallesForTotal = useMemo(() => {
    if (!detalles || !Array.isArray(detalles)) return [];
    if (!Array.isArray(importeValues) || importeValues.length === 0) {
      return detalles;
    }
    return detalles.map((detalle, index) => ({
      ...detalle,
      importe: importeValues[index] ?? detalle?.importe,
    }));
  }, [detalles, importeValues]);

  const total = useMemo(
    () => computeTotal(detallesForTotal),
    [detallesForTotal, computeTotal],
  );

  useEffect(() => {
    setValue(totalSource, total, { shouldDirty: true, shouldValidate: true });
  }, [total, totalSource, setValue]);

  return null;
};
