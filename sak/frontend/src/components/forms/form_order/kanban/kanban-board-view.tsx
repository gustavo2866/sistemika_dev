"use client";

import React, { useMemo } from "react";
import { useDataProvider, useNotify, useRefresh } from "ra-core";
import { KanbanBoard } from "./kanban-board";
import { KanbanFilterBar } from "./filter-bar";
import { KanbanCollapseToggle } from "./collapse-toggle";
import { useKanbanCommonState } from "./use-kanban-common-state";
import { useKanbanDragDrop } from "./use-kanban-drag-drop";
import {
  isKanbanRemoteMode,
  type KanbanBucketVisualState,
  type KanbanBoardViewProps,
} from "./types";
import { cn } from "@/lib/utils";

type BucketEntry<TItem, K extends string> = {
  item: TItem;
  bucketKey: K;
};

export const KanbanBoardView = <
  TItem extends { id?: number },
  K extends string,
>(
  props: KanbanBoardViewProps<TItem, K>,
) => {
  const {
    buckets,
    maxBucketsPerPage,
    showBucketPaginationFooter = true,
    onItemMove,
    canItemMove,
    resource,
    getMoveSuccessMessage,
    onLoadMore,
    customFilter,
    searchFilter,
    filterConfig = {},
    customFilters,
    initialCustomState = {},
    initialCollapsedAll,
    enableBucketCollapseToggle = true,
    bucketCollapseToggleLabel,
    bucketGridClassName,
    renderCard,
    isLoading,
    loadingMessage,
    emptyMessage,
    noResultsMessage,
  } = props;
  const isRemoteMode = isKanbanRemoteMode(props);
  const bucketData = isRemoteMode ? props.bucketData : undefined;
  const items = !isRemoteMode ? props.items : undefined;
  const getBucketKey = !isRemoteMode ? props.getBucketKey : undefined;
  const [customState, setCustomStateInternal] =
    React.useState(initialCustomState);

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

  const [currentPage, setCurrentPageInternal] =
    React.useState(getInitialPage);

  const setCurrentPage = React.useCallback(
    (value: number | ((prev: number) => number)) => {
      setCurrentPageInternal((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, String(next));
          } catch {}
        }
        return next;
      });
    },
    [storageKey],
  );

  const setCustomState = (key: string, value: any) => {
    setCustomStateInternal((prev) => ({ ...prev, [key]: value }));
  };

  // Drag and drop state
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const handleItemMove = React.useCallback(
    async (item: TItem, bucket: K) => {
      const allowed = canItemMove
        ? await Promise.resolve(canItemMove(item, bucket))
        : true;
      if (!allowed) return;

      try {
        if (!item.id || !onItemMove) return;
        const payload = await Promise.resolve(onItemMove(item, bucket));
        if (!payload) return;

        const shouldSkipUpdate =
          typeof payload === "object" &&
          payload !== null &&
          "__skipUpdate" in (payload as Record<string, unknown>);

        if (resource && !shouldSkipUpdate) {
          await dataProvider.update<TItem & { id: number }>(resource, {
            id: item.id!,
            data: payload,
            previousData: item,
          });
        }

        const message =
          getMoveSuccessMessage?.(item, bucket) ??
          "Item movido correctamente";
        notify(message, { type: "info" });
        refresh();
      } catch (err) {
        console.error("Error al mover item:", err);
        notify((err as any)?.message ?? "No se pudo mover el item", {
          type: "error",
        });
      }
    },
    [
      canItemMove,
      dataProvider,
      getMoveSuccessMessage,
      notify,
      onItemMove,
      refresh,
      resource,
    ],
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
    nonInteractiveBuckets: buckets
      .filter((bucket) => bucket.interactive === false)
      .map((bucket) => bucket.key),
  });

  const {
    searchValue,
    setSearchValue,
    collapsedAll,
    toggleCollapsedAll,
    isCardCollapsed,
    toggleCardCollapse,
  } = useKanbanCommonState({ storageKey: resource, initialCollapsedAll });

  const [bucketCollapseOverrides, setBucketCollapseOverrides] = React.useState<
    Record<string, boolean | undefined>
  >({});

  const getBucketCollapsed = React.useCallback(
    (bucketKey: K) => {
      const key = String(bucketKey);
      const override = bucketCollapseOverrides[key];
      return override ?? collapsedAll;
    },
    [bucketCollapseOverrides, collapsedAll],
  );

  const handleToggleBucketCollapse = React.useCallback(
    (bucketKey: K) => {
      setBucketCollapseOverrides((prev) => {
        const key = String(bucketKey);
        const current = prev[key];
        const effective = current ?? collapsedAll;
        return { ...prev, [key]: !effective };
      });
    },
    [collapsedAll],
  );

  const sourceEntries = useMemo<BucketEntry<TItem, K>[]>(() => {
    if (isRemoteMode) {
      return buckets.flatMap((bucket) =>
        (bucketData?.[bucket.key]?.items ?? []).map((item) => ({
          item,
          bucketKey: bucket.key,
        })),
      );
    }

    if (!items || !getBucketKey) return [];

    return items.map((item) => ({
      item,
      bucketKey: getBucketKey(item),
    }));
  }, [bucketData, buckets, getBucketKey, isRemoteMode, items]);

  const filteredEntries = useMemo(() => {
    return sourceEntries.filter(({ item }) => {
      if (customFilter && !customFilter(item, customState)) {
        return false;
      }

      if (
        searchValue &&
        searchFilter &&
        !searchFilter(item, searchValue.trim().toLowerCase())
      ) {
        return false;
      }

      return true;
    });
  }, [customFilter, customState, searchFilter, searchValue, sourceEntries]);

  const bucketItems = useMemo(() => {
    const result = {} as Record<K, TItem[]>;

    buckets.forEach((bucket) => {
      result[bucket.key] = [];
    });

    filteredEntries.forEach(({ item, bucketKey }) => {
      if (result[bucketKey]) {
        result[bucketKey].push(item);
      }
    });

    return result;
  }, [buckets, filteredEntries]);

  const bucketStates = useMemo<
    Partial<Record<K, KanbanBucketVisualState<TItem>>>
  >(() => {
    return buckets.reduce<Partial<Record<K, KanbanBucketVisualState<TItem>>>>(
      (acc, bucket) => {
        const bucketItemsForKey = bucketItems[bucket.key] ?? [];
        const remoteState = bucketData?.[bucket.key];
        const loadedCount =
          remoteState?.loadedCount ?? bucketItemsForKey.length;
        const total = remoteState?.total ?? loadedCount;

        acc[bucket.key] = {
          items: bucketItemsForKey,
          total,
          loadedCount,
          hasMore: remoteState?.hasMore ?? false,
          nextCursor: remoteState?.nextCursor ?? null,
          isLoadingInitial: remoteState?.isLoadingInitial ?? false,
          isLoadingMore: remoteState?.isLoadingMore ?? false,
          error: remoteState?.error ?? null,
        };

        return acc;
      },
      {},
    );
  }, [bucketData, bucketItems, buckets]);

  const hasBlockingBucketState = useMemo(
    () =>
      (
        Object.values(bucketStates) as Array<
          KanbanBucketVisualState<TItem> | undefined
        >
      ).some(
        (state) =>
          Boolean(state?.isLoadingInitial) || Boolean(state?.error),
      ),
    [bucketStates],
  );

  const { visibleBuckets, bucketNavigation, paginationFooter } = useMemo(() => {
    if (!maxBucketsPerPage || maxBucketsPerPage >= buckets.length) {
      return {
        visibleBuckets: buckets,
        bucketNavigation: undefined,
        paginationFooter: null,
      };
    }

    const totalPages = Math.ceil(
      (buckets.length - 1) / (maxBucketsPerPage - 1),
    );
    const startIndex =
      currentPage === 0 ? 0 : currentPage * (maxBucketsPerPage - 1);
    const endIndex = Math.min(startIndex + maxBucketsPerPage, buckets.length);
    const visible = buckets.slice(startIndex, endIndex);

    const canPrev = currentPage > 0;
    const canNext = currentPage < totalPages - 1;
    const visibleStart = startIndex + 1;
    const visibleEnd = endIndex;

    const nav = {
      canPrev,
      canNext,
      onPrev: () => setCurrentPage((page) => Math.max(0, page - 1)),
      onNext: () =>
        setCurrentPage((page) => Math.min(totalPages - 1, page + 1)),
      pageLabel: `${currentPage + 1} / ${totalPages}`,
      summaryLabel: `Etapas ${visibleStart}-${visibleEnd} de ${buckets.length}`,
    };

    const footer = showBucketPaginationFooter ? (
      <div className="mt-2 flex items-center justify-center gap-2 pt-2">
        <button
          type="button"
          onClick={nav.onPrev}
          disabled={!canPrev}
          className="rounded-lg border-2 border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          ← Anterior
        </button>
        <div className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
          {currentPage + 1} / {totalPages}
        </div>
        <button
          type="button"
          onClick={nav.onNext}
          disabled={!canNext}
          className="rounded-lg border-2 border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Siguiente →
        </button>
      </div>
    ) : null;

    return {
      visibleBuckets: visible,
      bucketNavigation: nav,
      paginationFooter: footer,
    };
  }, [
    buckets,
    currentPage,
    maxBucketsPerPage,
    setCurrentPage,
    showBucketPaginationFooter,
  ]);

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
    collapseToggleLabels: _collapseToggleLabels = {
      collapsed: "Expandir todo",
      expanded: "Contraer todo",
    },
  } = filterConfig;

  const collapseToggle = enableCollapseToggle ? (
    <KanbanCollapseToggle
      collapsed={collapsedAll}
      onToggle={toggleCollapsedAll}
      variant="icon-with-label"
    />
  ) : null;

  const hasFilterBarContent =
    Boolean(enableSearch) ||
    Boolean(customFilters) ||
    Boolean(enableCollapseToggle);
  const filterBar = hasFilterBarContent ? (
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
  ) : null;

  return (
    <KanbanBoard<TItem, K>
      bucketGridClassName={bucketGridClassName}
      filterBar={filterBar}
      isLoading={isLoading}
      loadingMessage={loadingMessage}
      bucketDefinitions={visibleBuckets}
      bucketItems={bucketItems}
      bucketStates={bucketStates}
      bucketCollapsed={
        enableBucketCollapseToggle
          ? (Object.fromEntries(
              Object.keys(bucketCollapseOverrides).map((key) => [
                key,
                getBucketCollapsed(key as K),
              ]),
            ) as Record<K, boolean>)
          : undefined
      }
      onToggleBucketCollapse={
        enableBucketCollapseToggle ? handleToggleBucketCollapse : undefined
      }
      bucketCollapseToggleVariant="icon"
      bucketCollapseToggleLabel={bucketCollapseToggleLabel}
      bucketCollapseToggleClassName="h-5 w-5"
      bucketCollapseToggleStopPropagation
      renderCard={(item, bucketKey) => {
        const bucketOverride = bucketKey
          ? bucketCollapseOverrides[String(bucketKey)]
          : undefined;
        const collapsed =
          bucketOverride != null
            ? bucketOverride
            : item.id
              ? isCardCollapsed(item.id)
              : false;
        const onToggle = item.id
          ? () => toggleCardCollapse(item.id!)
          : undefined;
        return renderCard(item, bucketKey, collapsed, onToggle);
      }}
      draggedItem={draggedItem}
      onCardDragStart={handleDragStart}
      dragOverBucket={dragOverBucket}
      onBucketDragOver={handleBucketDragOver}
      onBucketDrop={handleBucketDrop}
      onBucketDragLeave={handleBucketDragLeave}
      emptyMessage={emptyMessage}
      noResults={filteredEntries.length === 0 && !hasBlockingBucketState}
      noResultsMessage={noResultsMessage}
      footer={paginationFooter}
      bucketNavigation={bucketNavigation}
      onLoadMore={onLoadMore}
    />
  );
};
