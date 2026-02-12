"use client";

import { useMemo } from "react";
import { useFormState } from "react-hook-form";
import { cn } from "@/lib/utils";

export type FormErrorSummaryProps = {
  className?: string;
};

type FirstError = { path: string[]; message: string };

const getFirstError = (
  errors: unknown,
  path: string[] = [],
): FirstError | undefined => {
  if (!errors || typeof errors !== "object") return undefined;
  const errorAny = errors as {
    message?: unknown;
    root?: { message?: unknown };
    [key: string]: unknown;
  };
  if (typeof errorAny.message === "string" && errorAny.message.trim()) {
    return { path, message: errorAny.message };
  }
  if (typeof errorAny.root?.message === "string" && errorAny.root.message.trim()) {
    return { path, message: errorAny.root.message };
  }
  for (const key of Object.keys(errorAny)) {
    if (key === "ref" || key === "type" || key === "types") continue;
    const child = errorAny[key];
    const nested = getFirstError(child, [...path, key]);
    if (nested) return nested;
  }
  return undefined;
};

export const FormErrorSummary = ({ className }: FormErrorSummaryProps) => {
  const { errors, submitCount } = useFormState();
  const firstError = useMemo(
    () => (submitCount > 0 ? getFirstError(errors) : undefined),
    [errors, submitCount],
  );

  if (!firstError) return null;

  const pathLabel = firstError.path.length
    ? `${firstError.path.join(".")}: `
    : "";

  return (
    <div className={cn("text-[10px] text-destructive", className)}>
      {pathLabel}
      {firstError.message}
    </div>
  );
};
