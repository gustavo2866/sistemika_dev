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
  const { setValue } = useFormContext();
  const detalles = useWatch({ name: detailsSource }) as
    | Array<{ importe?: unknown }>
    | undefined;
  const total = useMemo(() => computeTotal(detalles ?? []), [detalles, computeTotal]);

  useEffect(() => {
    setValue(totalSource, total, { shouldDirty: true, shouldValidate: true });
  }, [total, totalSource, setValue]);

  return null;
};

