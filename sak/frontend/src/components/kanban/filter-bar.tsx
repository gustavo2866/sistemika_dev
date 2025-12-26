"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export interface KanbanFilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  rightEdgeContent?: React.ReactNode;
  searchClassName?: string;
  searchInputClassName?: string;
  rightContentClassName?: string;
  wrap?: boolean;
  spread?: boolean;
}

export const KanbanFilterBar = ({
  className,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  leftContent,
  rightContent,
  rightEdgeContent,
  searchClassName,
  searchInputClassName,
  rightContentClassName,
  wrap = true,
  spread = true,
  ...props
}: KanbanFilterBarProps) => (
  <div
    className={cn(
      "rounded-[24px] border border-slate-200/60 bg-white/90 px-3 py-2 shadow-sm",
      className
    )}
    {...props}
  >
    <div
      className={cn(
        "flex items-center gap-2.5",
        wrap ? "flex-wrap" : "flex-nowrap",
        spread ? "justify-between" : "justify-start"
      )}
    >
      <div className={cn("flex items-center gap-2 sm:gap-3", wrap ? "flex-wrap" : "flex-nowrap")}>
        <div className={cn("relative min-w-[200px] max-w-md", wrap ? "flex-1" : "flex-none", searchClassName)}>
        <Search className="absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400 sm:h-3.5 sm:w-3.5" />
          <Input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
          className={cn(
            "h-9 rounded-2xl border-slate-200/80 bg-white/70 pl-8 text-sm shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/20",
            "py-0",
            searchInputClassName
          )}
        />
        </div>
        {leftContent}
        {rightContent}
      </div>
      {rightEdgeContent ? <div className="flex items-center gap-1.5 ml-auto">{rightEdgeContent}</div> : null}
    </div>
  </div>
);
