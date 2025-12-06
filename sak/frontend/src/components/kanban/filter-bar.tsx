"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export interface KanbanFilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  rightContent?: React.ReactNode;
  searchClassName?: string;
}

export const KanbanFilterBar = ({
  className,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  rightContent,
  searchClassName,
  ...props
}: KanbanFilterBarProps) => (
  <div
    className={cn(
      "rounded-[24px] border border-slate-200/60 bg-white/90 px-3 py-2 shadow-sm",
      className
    )}
    {...props}
  >
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <div className={cn("relative flex-1 min-w-[200px] max-w-md", searchClassName)}>
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 rounded-2xl border-slate-200/80 bg-white/70 pl-8 text-sm shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">{rightContent}</div>
    </div>
  </div>
);
