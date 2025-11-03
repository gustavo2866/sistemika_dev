/**
 * GenericList - Declarative list component
 * 
 * Main component that orchestrates the entire configurable list system
 */

"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { useIsMobile } from "@/hooks/use-mobile";
import { useColumnRenderer, useFilterBuilder } from "./hooks";
import { ListConfig } from "./types";
import { RowActions } from "./components/RowActions";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";

export interface GenericListProps {
  config: ListConfig;
}

export const GenericList = ({ config }: GenericListProps) => {
  const isMobile = useIsMobile();
  const renderColumn = useColumnRenderer();
  const filters = useFilterBuilder(config.filters);
  
  const hasActions = config.actions && config.actions.length > 0;
  const rowActions = config.actions?.filter(a => a.individual !== "none") || [];
  
  // Determine action mode from layout config
  const maxInline = config.rowActionsLayout?.inline?.maxVisible || 2;
  const actionMode: "inline" | "menu" | "mixed" = 
    config.rowActionsLayout?.inline && !config.rowActionsLayout?.menu 
      ? "inline"
      : config.rowActionsLayout?.menu && !config.rowActionsLayout?.inline
        ? "menu"
        : "mixed";
  
  // Check if we have toggleable filters (not alwaysOn)
  const hasToggleableFilters = filters.some(f => !f.props.alwaysOn);

  return (
    <List
      filters={filters}
      perPage={config.perPage || 25}
      sort={config.defaultSort || { field: "id", order: "DESC" }}
      actions={
        <div className="flex items-center gap-2">
          {hasToggleableFilters && <FilterButton />}
          <CreateButton />
          <ExportButton />
        </div>
      }
    >
      <DataTable
        rowClick={typeof config.rowClick === "function" 
          ? (id: string | number) => (config.rowClick as (id: string | number) => string)(id)
          : config.rowClick
        }
        mobileConfig={config.mobile}
      >
        {config.columns.map((col) => (
          <DataTable.Col
            key={col.source}
            source={col.source}
            label={col.label}
            disableSort={col.sortable === false}
          >
            {renderColumn(col)}
          </DataTable.Col>
        ))}
        
        {/* Actions column */}
        {hasActions && (
          <DataTable.Col label="Acciones">
            <RowActions 
              actions={rowActions}
              mode={isMobile ? "menu" : actionMode}
              maxInline={maxInline}
            />
          </DataTable.Col>
        )}
      </DataTable>
    </List>
  );
};
