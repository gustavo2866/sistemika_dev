"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SummaryChipItem = {
  label: string;
  count: number;
  total?: number;
  value?: string;
  chipClassName?: string;
  selectedChipClassName?: string;
  countClassName?: string;
  selectedCountClassName?: string;
};

type SummaryChipsProps = {
  title?: ReactNode;
  items: SummaryChipItem[];
  loading?: boolean;
  error?: string | null;
  selectedValue?: string | string[] | null;
  onSelect?: (value?: string) => void;
  className?: string;
};

export const SummaryChips = ({
  title,
  items,
  loading,
  error,
  selectedValue,
  onSelect,
  className,
}: SummaryChipsProps) => {
  const selected =
    Array.isArray(selectedValue) && selectedValue.length > 0
      ? selectedValue[0]
      : typeof selectedValue === "string"
      ? selectedValue
      : undefined;

  const handleClick = (value?: string) => {
    if (!onSelect) return;
    if (selected === value) {
      onSelect(undefined);
    } else {
      onSelect(value);
    }
  };

  return (
    <div
      className={cn(
        "mb-4 inline-flex w-full flex-col items-stretch rounded-2xl border border-border/50 bg-card/80 p-3 shadow-sm md:w-auto",
        className
      )}
    >
      {title
        ? typeof title === "string"
          ? (
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground text-center">
              {title}
            </p>
          )
          : (
            <div className="mb-3 flex items-center justify-center">
              {title}
            </div>
          )
        : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">
          Cargando...
        </p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <div className="mt-1 flex flex-wrap justify-end gap-1.5">
          {items.map((item) => (
            <button
              key={item.value ?? item.label}
              type="button"
              onClick={() => handleClick(item.value)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-all duration-150",
                item.chipClassName,
                selected === item.value
                  ? cn(
                      "ring-1 ring-offset-1 ring-offset-background",
                      item.selectedChipClassName ?? "bg-primary text-primary-foreground border-transparent"
                    )
                  : "border-border bg-background text-foreground hover:border-primary/40"
              )}
            >
              <span
                className={cn(
                  "text-[9px]",
                  selected === item.value ? "opacity-90" : "text-muted-foreground/90"
                )}
              >
                {item.label}
              </span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  selected === item.value
                    ? item.selectedCountClassName ??
                        "bg-background/80 text-foreground"
                    : item.countClassName ??
                        "text-muted-foreground bg-muted/70"
                )}
              >
                {item.total != null
                  ? `${item.count} / ${item.total}`
                  : item.count}
              </span>
            </button>
          ))}
          {!items.length ? (
            <span className="text-sm text-muted-foreground">
              Sin datos
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
};
