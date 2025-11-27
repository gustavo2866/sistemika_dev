"use client";

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
  title?: string;
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
        "mb-4 rounded-lg border bg-card/60 p-3",
        className
      )}
    >
      {title ? (
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">
          Cargando...
        </p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => (
            <button
              key={item.value ?? item.label}
              type="button"
              onClick={() => handleClick(item.value)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                item.chipClassName,
                selected === item.value
                  ? cn(
                      "ring-1 ring-offset-1 ring-offset-background",
                      item.selectedChipClassName ?? "bg-primary text-primary-foreground border-transparent"
                    )
                  : "border-border bg-background text-foreground hover:border-primary/40"
              )}
            >
              <span className="text-xs uppercase tracking-wide">
                {item.label}
              </span>
            <span
                className={cn(
                  "rounded-full px-2 py-0.5",
                  selected === item.value
                    ? item.selectedCountClassName ??
                        "text-base font-semibold bg-background/80 text-foreground"
                    : item.countClassName ??
                        "text-sm font-semibold text-muted-foreground bg-muted/70"
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
