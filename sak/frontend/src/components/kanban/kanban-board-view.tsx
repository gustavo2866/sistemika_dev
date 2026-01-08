"use client";

import React, { useMemo } from "react";
import type { ReactNode } from "react";
import { useDataProvider, useNotify, useRefresh } from "ra-core";
import type { KanbanBucketDefinition } from "./kanban-buckets-grid";
import { KanbanBoard } from "./kanban-board";
import { KanbanFilterBar } from "./filter-bar";
import { KanbanCollapseToggle } from "./collapse-toggle";
import { useKanbanCommonState } from "./use-kanban-common-state";
import { useKanbanDragDrop } from "./use-kanban-drag-drop";
import { cn } from "@/lib/utils";

export interface KanbanBoardViewFilterConfig {
  enableSearch?: boolean;
  searchPlaceholder?: string;
  searchClassName?: string;
  searchInputClassName?: string;
  filterBarClassName?: string;
  filterBarWrap?: boolean;
  filterBarSpread?: boolean;
  collapseToggleAlignRight?: boolean;
  enableCollapseToggle?: boolean;
  collapseToggleLabels?: { collapsed: string; expanded: string };
}

export interface KanbanBoardViewProps<TItem extends { id?: number }, K extends string> {
  // Data
  items: TItem[];
  
  // Bucket configuration
  buckets: KanbanBucketDefinition<K>[];
  getBucketKey: (item: TItem) => K;
  maxBucketsPerPage?: number;
  
  // Drag and drop
  onItemMove?: (item: TItem, bucket: K) => any | Promise<any>;
  canItemMove?: (item: TItem, bucket: K) => boolean | Promise<boolean>;
  resource?: string;
  getMoveSuccessMessage?: (item: TItem, bucket: K) => string;
  
  // Optional filtering
  customFilter?: (item: TItem, customFilters: Record<string, any>) => boolean;
  searchFilter?: (item: TItem, searchTerm: string) => boolean;
  
  // UI
  // Filter configuration
  filterConfig?: KanbanBoardViewFilterConfig;
  customFilters?: (params: {
    customState: Record<string, any>;
    setCustomState: (key: string, value: any) => void;
  }) => ReactNode;
  initialCustomState?: Record<string, any>;
  initialCollapsedAll?: boolean;
  
  // Board configuration
  bucketGridClassName?: string;
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
  maxBucketsPerPage,
  onItemMove,
  canItemMove,
  resource,
  getMoveSuccessMessage,
  customFilter,
  searchFilter,
  filterConfig = {},
  customFilters,
  initialCustomState = {},
  initialCollapsedAll,
  bucketGridClassName,
  renderCard,
  isLoading,
  loadingMessage,
  emptyMessage,
  noResultsMessage,
}: KanbanBoardViewProps<TItem, K>) => {
  const [customState, setCustomStateInternal] = React.useState(initialCustomState);
  
  // Persist currentPage in localStorage
  const storageKey = resource ? `kanban-page-${resource}` : null;
  const getInitialPage = () => {
    if (!storageKey) return 0;
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  };
  
  const [currentPage, setCurrentPageInternal] = React.useState(getInitialPage);
  
  const setCurrentPage = React.useCallback((value: number | ((prev: number) => number)) => {
    setCurrentPageInternal(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, String(next));
        } catch {}
      }
      return next;
    });
  }, [storageKey]);
  
  const setCustomState = (key: string, value: any) => {
    setCustomStateInternal(prev => ({ ...prev, [key]: value }));
  };

  // Drag and drop state
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const handleItemMove = React.useCallback(
    async (item: TItem, bucket: K) => {
      const allowed = canItemMove ? await Promise.resolve(canItemMove(item, bucket)) : true;
      if (!allowed) return;

      try {
        if (!item.id || !onItemMove) return;
        const payload = await Promise.resolve(onItemMove(item, bucket));
        if (!payload) return;

        if (resource) {
          await dataProvider.update<TItem & { id: number }>(resource, {
            id: item.id!,
            data: payload,
            previousData: item,
          });
        }

        const message = getMoveSuccessMessage?.(item, bucket) ?? "Item movido correctamente";
        notify(message, { type: "info" });
        refresh();
      } catch (err) {
        console.error("Error al mover item:", err);
        notify((err as any)?.message ?? "No se pudo mover el item", { type: "error" });
      }
    },
    [canItemMove, dataProvider, getMoveSuccessMessage, notify, onItemMove, refresh, resource]
  );

  const {
    draggedItem,
    dragOverBucket,
    handleDragStart,
    handleBucketDragOver,
    handleBucketDrop,
    handleBucketDragLeave,
  } = useKanbanDragDrop<TItem, K>({
    onItemDropped: handleItemMove,
    getItemId: (item) => item.id,
    nonInteractiveBuckets: buckets.filter(b => b.interactive === false).map(b => b.key),
  });

  const {
    searchValue,
    setSearchValue,
    collapsedAll,
    toggleCollapsedAll,
    isCardCollapsed,
    toggleCardCollapse,
  } = useKanbanCommonState({ storageKey: resource, initialCollapsedAll });

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
      
      return true;
    });
  }, [items, customState, searchValue, customFilter, searchFilter]);

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

  // Paginación de buckets
  const { visibleBuckets, bucketNavigation, paginationFooter } = useMemo(() => {
    if (!maxBucketsPerPage || maxBucketsPerPage >= buckets.length) {
      return { visibleBuckets: buckets, bucketNavigation: undefined, paginationFooter: null };
    }

    const totalPages = Math.ceil((buckets.length - 1) / (maxBucketsPerPage - 1));
    const startIndex = currentPage === 0 ? 0 : currentPage * (maxBucketsPerPage - 1);
    const endIndex = Math.min(startIndex + maxBucketsPerPage, buckets.length);
    const visible = buckets.slice(startIndex, endIndex);

    const canPrev = currentPage > 0;
    const canNext = currentPage < totalPages - 1;

    const nav = {
      canPrev,
      canNext,
      onPrev: () => setCurrentPage(p => Math.max(0, p - 1)),
      onNext: () => setCurrentPage(p => Math.min(totalPages - 1, p + 1)),
    };

    const footer = (
      <div className="flex items-center justify-center gap-2 pt-2 mt-2">
        <button
          type="button"
          onClick={nav.onPrev}
          disabled={!canPrev}
          className="px-4 py-1.5 text-xs font-medium rounded-lg border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          ← Anterior
        </button>
        <div className="px-3 py-1 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg shadow-sm">
          {currentPage + 1} / {totalPages}
        </div>
        <button
          type="button"
          onClick={nav.onNext}
          disabled={!canNext}
          className="px-4 py-1.5 text-xs font-medium rounded-lg border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          Siguiente →
        </button>
      </div>
    );

    return { visibleBuckets: visible, bucketNavigation: nav, paginationFooter: footer };
  }, [buckets, maxBucketsPerPage, currentPage, setCurrentPage]);

  const {
    enableSearch = true,
    searchPlaceholder = "Buscar...",
    searchClassName,
    searchInputClassName,
    filterBarClassName,
    filterBarWrap,
    filterBarSpread,
    collapseToggleAlignRight,
    enableCollapseToggle = true,
    collapseToggleLabels: _collapseToggleLabels = { collapsed: "Expandir todo", expanded: "Contraer todo" },
  } = filterConfig;

  const collapseToggle = enableCollapseToggle ? (
    <KanbanCollapseToggle
      collapsed={collapsedAll}
      onToggle={toggleCollapsedAll}
      variant="icon-with-label"
    />
  ) : null;

  const filterBar = (
    <KanbanFilterBar
      className={filterBarClassName}
      searchValue={enableSearch ? searchValue : ""}
      onSearchChange={enableSearch ? setSearchValue : () => {}}
      searchPlaceholder={searchPlaceholder}
      searchClassName={cn(!enableSearch ? "hidden" : undefined, searchClassName)}
      searchInputClassName={searchInputClassName}
      wrap={filterBarWrap}
      spread={filterBarSpread}
      rightContent={
        <>
          {customFilters?.({ customState, setCustomState })}
          {!collapseToggleAlignRight ? collapseToggle : null}
        </>
      }
      rightEdgeContent={collapseToggleAlignRight ? collapseToggle : null}
    />
  );

  return (
    <KanbanBoard<TItem, K>
      bucketGridClassName={bucketGridClassName}
      filterBar={filterBar}
      isLoading={isLoading}
      loadingMessage={loadingMessage}
      bucketDefinitions={visibleBuckets}
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
      footer={paginationFooter}
      bucketNavigation={bucketNavigation}
    />
  );
};
