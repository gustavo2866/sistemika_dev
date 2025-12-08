"use client";

import { Button } from "@/components/ui/button";
import type { FocusFilter } from "@/components/kanban/use-crm-evento-buckets";

interface EventoCustomFiltersProps {
  focusFilter: FocusFilter;
  onFocusFilterChange: (value: FocusFilter) => void;
}

export const EventoCustomFilters = ({
  focusFilter,
  onFocusFilterChange,
}: EventoCustomFiltersProps) => (
  <div className="flex gap-1 rounded-full border border-slate-200/80 bg-white/80 p-1 text-[11px] font-semibold uppercase">
    <Button
      type="button"
      variant={focusFilter === "activos" ? "default" : "ghost"}
      size="sm"
      className="rounded-full px-3"
      onClick={() => onFocusFilterChange("activos")}
    >
      Activos
    </Button>
    <Button
      type="button"
      variant={focusFilter === "todos" ? "default" : "ghost"}
      size="sm"
      className="rounded-full px-3"
      onClick={() => onFocusFilterChange("todos")}
    >
      Todos
    </Button>
  </div>
);
