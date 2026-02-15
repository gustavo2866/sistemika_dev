"use client";

import { useMemo } from "react";
import { useFormState } from "react-hook-form";
import { useSimpleFormIterator, useSimpleFormIteratorItem } from "ra-core";
import { cn } from "@/lib/utils";
import { useDetailRowContext } from "./detail_row_context";

const getFirstErrorMessage = (errors: unknown): string | undefined => {
  if (!errors || typeof errors !== "object") return undefined;
  const errorAny = errors as {
    message?: unknown;
    root?: { message?: unknown };
    [key: string]: unknown;
  };
  if (typeof errorAny.message === "string" && errorAny.message.trim()) {
    return errorAny.message;
  }
  if (typeof errorAny.root?.message === "string" && errorAny.root.message.trim()) {
    return errorAny.root.message;
  }
  for (const key of Object.keys(errorAny)) {
    if (key === "ref" || key === "type" || key === "types") continue;
    const child = errorAny[key];
    const nested = getFirstErrorMessage(child);
    if (nested) return nested;
  }
  return undefined;
};

export const DetailRowError = ({ className }: { className?: string }) => {
  const { isActive } = useDetailRowContext();
  const { errors } = useFormState();
  const { source } = useSimpleFormIterator();
  const { index } = useSimpleFormIteratorItem();

  const rowErrors = source
    ? (errors as any)?.[source]?.[index]
    : undefined;
  const message = useMemo(() => getFirstErrorMessage(rowErrors), [rowErrors]);

  if (!isActive || !message) return null;

  return (
    <div className={cn("col-span-full text-[9px] text-destructive", className)}>
      {message}
    </div>
  );
};
