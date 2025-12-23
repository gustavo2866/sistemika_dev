"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResponsableSelector } from "@/components/forms";

type ListFiltersHeaderProps = {
  title: string;
  subtitle?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  ownerValue: string;
  onOwnerChange: (value: string) => void;
  ownerPlaceholder?: string;
  className?: string;
};

export const ListFiltersHeader = ({
  title,
  subtitle,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  ownerValue,
  onOwnerChange,
  ownerPlaceholder = "Responsable",
  className,
}: ListFiltersHeaderProps) => {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-start justify-between gap-3 sm:block">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle ? (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="w-[45vw] sm:hidden">
          <ResponsableSelector
            value={ownerValue}
            onValueChange={onOwnerChange}
            placeholder={ownerPlaceholder}
            triggerClassName="h-8 rounded-full text-[10px]"
            hideLabel
            hideLabelOnSmall
          />
        </div>
      </div>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <div className="flex w-[45vw] items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 sm:w-auto sm:py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            className="w-full text-[10px] outline-none sm:w-44 sm:text-sm"
          />
        </div>
        <div className="hidden w-[45vw] sm:block sm:w-auto">
          <ResponsableSelector
            value={ownerValue}
            onValueChange={onOwnerChange}
            placeholder={ownerPlaceholder}
            triggerClassName="h-8 rounded-full text-[10px] sm:h-9 sm:text-sm"
            hideLabel
            hideLabelOnSmall
          />
        </div>
      </div>
    </div>
  );
};
