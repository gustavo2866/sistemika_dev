"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Identity } from "ra-core";
import { useDataProvider, useNotify, useRefresh } from "ra-core";
import type { KanbanBucketDefinition } from "./kanban-buckets-grid";
import { KanbanBoard } from "./kanban-board";
import { KanbanFilterBar } from "./filter-bar";
import { KanbanCollapseToggle } from "./collapse-toggle";
import { UserSelector } from "@/components/forms";
import { useKanbanCommonState } from "./use-kanban-common-state";
import { useKanbanDragDrop } from "./use-kanban-drag-drop";

export interface KanbanBoardViewFilterConfig {
  enableSearch?: boolean;
  searchPlaceholder?: string;
  enableOwnerFilter?: boolean;
  ownerFilterPlaceholder?: string;
  enableCollapseToggle?: boolean;
  collapseToggleLabels?: { collapsed: string; expanded: string };
}

export interface KanbanBoardViewProps<TItem extends { id?: number }, K extends string> {
  // Data
  items: TItem[];
  
  // Bucket configuration
  buckets: KanbanBucketDefinition<K>[];
  getBucketKey: (item: TItem) => K;
  
  // Drag and drop
  onItemMove?: (item: TItem, bucket: K) => any | Promise<any>;
  resource?: string;
  getMoveSuccessMessage?: (item: TItem, bucket: K) => string;
  
  // Optional filtering
  customFilter?: (item: TItem, customFilters: Record<string, any>) => boolean;
  searchFilter?: (item: TItem, searchTerm: string) => boolean;
  ownerFilter?: (item: TItem, ownerId: string) => boolean;
  
  // UI
  identity?: Identity | null;
  autoSelectOwnerId?: string | null;
  
  // Filter configuration
  filterConfig?: KanbanBoardViewFilterConfig;
  customFilters?: (params: {
    customState: Record<string, any>;
    setCustomState: (key: string, value: any) => void;
  }) => ReactNode;
  initialCustomState?: Record<string, any>;
  
  // Board configuration
  renderCard: (
    item: TItem,
    bucketKey?: K,
    collapsed?: boolean,
    onToggleCollapse?: () => void
  ) => ReactNode;
  isLoading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  noResultsMessage?: string;
}

export const KanbanBoardView = <TItem extends { id?: number }, K extends string>({
  items,
  buckets,
  getBucketKey,
  onItemMove,
  resource,
  getMoveSuccessMessage,
  customFilter,
  searchFilter,
  ownerFilter,
  identity,
  autoSelectOwnerId,
  filterConfig = {},
  customFilters,
  initialCustomState = {},
  renderCard,
  isLoading,
  loadingMessage,
  emptyMessage,
  noResultsMessage,
}: KanbanBoardViewProps<TItem, K>) => {
  const [customState, setCustomStateInternal] = React.useState(initialCustomState);
  
  const setCustomState = (key: string, value: any) => {
    setCustomStateInternal(prev => ({ ...prev, [key]: value }));
  };

  // Drag and drop state
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const moveItemToBucket = useCallback(
    async (item: TItem, bucket: K) => {
      if (!item.id || !onItemMove) return;
      
      setUpdatingId(item.id);
      try {
        const payload = await Promise.resolve(onItemMove(item, bucket));
        if (!payload) {
          setUpdatingId(null);
          return;
        }

        if (resource) {
          await dataProvider.update<TItem>(resource, {
            id: item.id,
            data: payload,
            previousData: item,
          });
        }

        const message = getMoveSuccessMessage?.(item, bucket) ?? "Item movido correctamente";
        notify(message, { type: "info" });
        refresh();
      } catch (err: any) {
        console.error("Error al mover item:", err);
        notify(err?.message ?? "No se pudo mover el item", { type: "error" });
      } finally {
        setUpdatingId(null);
      }
    },
    [onItemMove, resource, dataProvider, notify, refresh, getMoveSuccessMessage]
  );

  const {
    draggedItem,
    dragOverBucket,
    handleDragStart,
    handleDragEnd,
    handleBucketDragOver,
    handleBucketDrop,
    handleBucketDragLeave,
  } = useKanbanDragDrop<TItem, K>({
    onItemDropped: moveItemToBucket,
    getItemId: (item) => item.id,
    nonInteractiveBuckets: buckets.filter(b => b.interactive === false).map(b => b.key),
  });

  const {
    searchValue,
    setSearchValue,
    ownerFilter: ownerFilterValue,
    setOwnerFilter: setOwnerFilterValue,
    collapsedAll,
    toggleCollapsedAll,
    isCardCollapsed,
    toggleCardCollapse,
  } = useKanbanCommonState({});

  useEffect(() => {
    if (autoSelectOwnerId && ownerFilterValue === "todos") {
      setOwnerFilterValue(autoSelectOwnerId);
    }
  }, [autoSelectOwnerId, ownerFilterValue, setOwnerFilterValue]);

  // Filtrado
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Custom filter
      if (customFilter && !customFilter(item, customState)) {
        return false;
      }
      
      // Search filter
      if (searchValue && searchFilter && !searchFilter(item, searchValue.trim().toLowerCase())) {
        return false;
      }
      
      // Owner filter
      if (ownerFilterValue !== "todos" && ownerFilter && !ownerFilter(item, ownerFilterValue)) {
        return false;
      }
      
      return true;
    });
  }, [items, customState, searchValue, ownerFilterValue, customFilter, searchFilter, ownerFilter]);

  // Agrupación por buckets
  const bucketItems = useMemo(() => {
    const result = {} as Record<K, TItem[]>;
    
    // Inicializar buckets vacíos
    buckets.forEach(bucket => {
      result[bucket.key] = [];
    });
    
    // Agrupar items
    filteredItems.forEach(item => {
      const bucketKey = getBucketKey(item);
      if (result[bucketKey]) {
        result[bucketKey].push(item);
      }
    });
    
    return result;
  }, [filteredItems, buckets, getBucketKey]);

  const {
    enableSearch = true,
    searchPlaceholder = "Buscar...",
    enableOwnerFilter = true,
    ownerFilterPlaceholder = "Asignado",
    enableCollapseToggle = true,
    collapseToggleLabels = { collapsed: "Expandir todo", expanded: "Contraer todo" },
  } = filterConfig;

  const filterBar = (
    <KanbanFilterBar
      searchValue={enableSearch ? searchValue : ""}
      onSearchChange={enableSearch ? setSearchValue : () => {}}
      searchPlaceholder={searchPlaceholder}
      searchClassName={!enableSearch ? "hidden" : undefined}
      rightContent={
        <>
          {customFilters?.({ customState, setCustomState })}
          {enableOwnerFilter && (
            <div className="min-w-[170px]">
              <UserSelector
                records={items as any[]}
                identity={identity}
                value={ownerFilterValue}
                onValueChange={setOwnerFilterValue}
                placeholder={ownerFilterPlaceholder}
              />
            </div>
          )}
          {enableCollapseToggle && (
            <KanbanCollapseToggle
              collapsed={collapsedAll}
              onToggle={toggleCollapsedAll}
              variant="pill"
            >
              {collapsedAll ? collapseToggleLabels.collapsed : collapseToggleLabels.expanded}
            </KanbanCollapseToggle>
          )}
        </>
      }
    />
  );

  return (
    <KanbanBoard<TItem, K>
      filterBar={filterBar}
      isLoading={isLoading}
      loadingMessage={loadingMessage}
      bucketDefinitions={buckets}
      bucketItems={bucketItems}
      renderCard={(item, bucketKey) => {
        const collapsed = item.id ? isCardCollapsed(item.id) : false;
        const onToggle = item.id ? () => toggleCardCollapse(item.id!) : undefined;
        return renderCard(item, bucketKey, collapsed, onToggle);
      }}
      draggedItem={draggedItem}
      onCardDragStart={handleDragStart}
      dragOverBucket={dragOverBucket}
      onBucketDragOver={handleBucketDragOver}
      onBucketDrop={handleBucketDrop}
      onBucketDragLeave={handleBucketDragLeave}
      emptyMessage={emptyMessage}
      noResults={filteredItems.length === 0}
      noResultsMessage={noResultsMessage}
    />
  );
};
