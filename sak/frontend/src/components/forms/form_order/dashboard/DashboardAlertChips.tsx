"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DashboardAlertChipItem<T extends string = string> = {
  key: T;
  label: string;
  count: ReactNode;
  icon: LucideIcon;
  className?: string;
  badgeClassName?: string;
};

export type DashboardAlertChipsProps<T extends string = string> = {
  items: DashboardAlertChipItem<T>[];
  selectedKey?: T | null;
  onSelect: (key: T) => void;
  className?: string;
  loading?: boolean;
};

export const DashboardAlertChips = <T extends string = string>({
  items,
  selectedKey,
  onSelect,
  className,
  loading = false,
}: DashboardAlertChipsProps<T>) => (
  <div
    className={cn(
      "mt-1 flex flex-wrap gap-1 overflow-x-auto border-t border-border/50 pb-0.5 pt-1",
      loading && "animate-pulse",
      className,
    )}
  >
    {items.map((item) => {
      const Icon = item.icon;
      return (
        <button
          type="button"
          key={item.key}
          className={cn(
            "inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[9px] font-medium transition-all",
            selectedKey === item.key && "ring-2 ring-primary/30",
            item.className,
          )}
          onClick={() => onSelect(item.key)}
        >
          <Icon className="h-3 w-3" />
          <span className="max-w-[150px] truncate whitespace-nowrap">{item.label}</span>
          <span
            className={cn(
              "inline-flex min-w-4 items-center justify-center rounded-full px-1 py-0 text-[9px] font-semibold",
              item.badgeClassName,
            )}
          >
            {item.count}
          </span>
        </button>
      );
    })}
  </div>
);
