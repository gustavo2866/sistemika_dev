"use client";

import type { Identity } from "ra-core";
import { Button } from "@/components/ui/button";
import { UserSelector } from "@/components/forms";
import type { CRMEvento } from "@/app/resources/crm-eventos/model";
import { KanbanFilterBar } from "./filter-bar";
import { KanbanCollapseToggle } from "./collapse-toggle";
import type { FocusFilter } from "./use-crm-evento-buckets";

interface CRMEventoFilterControlsProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  focusFilter: FocusFilter;
  onFocusFilterChange: (value: FocusFilter) => void;
  ownerFilter: string;
  onOwnerFilterChange: (value: string) => void;
  eventos: CRMEvento[];
  identity?: Identity | null;
  collapsedAll: boolean;
  onToggleCollapsed: () => void;
}

export const CRMEventoFilterControls = ({
  searchValue,
  onSearchChange,
  focusFilter,
  onFocusFilterChange,
  ownerFilter,
  onOwnerFilterChange,
  eventos,
  identity,
  collapsedAll,
  onToggleCollapsed,
}: CRMEventoFilterControlsProps) => (
  <KanbanFilterBar
    searchValue={searchValue}
    onSearchChange={onSearchChange}
    searchPlaceholder="Buscar eventos..."
    searchClassName="relative w-[220px]"
    rightContent={
      <>
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
        <div className="min-w-[170px]">
          <UserSelector
            records={eventos}
            identity={identity}
            value={ownerFilter}
            onValueChange={onOwnerFilterChange}
            placeholder="Asignado"
          />
        </div>
        <KanbanCollapseToggle
          collapsed={collapsedAll}
          onToggle={onToggleCollapsed}
          variant="pill"
        >
          {collapsedAll ? "Expandir todo" : "Contraer todo"}
        </KanbanCollapseToggle>
      </>
    }
  />
);
