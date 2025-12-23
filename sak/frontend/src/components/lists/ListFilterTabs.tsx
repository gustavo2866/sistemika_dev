"use client";

import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export type ListFilterTabItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type ListFilterTabsProps = {
  tabs: ListFilterTabItem[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  getCount?: (id: string) => number | null | undefined;
  className?: string;
};

export const ListFilterTabs = ({
  tabs,
  activeTabId,
  onTabChange,
  getCount,
  className,
}: ListFilterTabsProps) => (
  <div className={cn("flex flex-wrap gap-2", className)}>
    {tabs.map((tab) => (
      <button
        key={tab.id}
        type="button"
        onClick={() => onTabChange(tab.id)}
        className={cn(
          "relative inline-flex w-[20%] items-center justify-between gap-1 rounded-lg border px-1.5 py-1 text-[7px] font-semibold shadow-sm sm:w-auto sm:gap-2 sm:px-3 sm:py-2 sm:text-xs",
          activeTabId === tab.id
            ? "border-blue-500 bg-blue-500 text-white shadow-blue-200"
            : "border-slate-200 bg-white text-slate-700"
        )}
      >
        <span className="inline-flex items-center gap-0.5 sm:gap-2">
          <tab.icon className="h-2 w-2 sm:h-3.5 sm:w-3.5" />
          {tab.label}
        </span>
        <span className="absolute -top-1 -right-1 inline-flex h-3 min-w-[12px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[6px] font-semibold text-white sm:static sm:ml-2 sm:h-auto sm:min-w-0 sm:bg-slate-100 sm:px-2 sm:py-0.5 sm:text-[11px] sm:text-slate-700">
          {getCount ? getCount(tab.id) : null}
        </span>
      </button>
    ))}
  </div>
);
