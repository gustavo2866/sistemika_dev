"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  KanbanBucketData,
  UseRemoteKanbanOptions,
  UseRemoteKanbanResult,
} from "./types";

const REMOTE_KANBAN_SNAPSHOT_PREFIX = "kanban:remote:";
const DEFAULT_REMOTE_KANBAN_PAGE_SIZE = 20;
const DEFAULT_REMOTE_KANBAN_CACHE_TTL_MS = 5 * 60 * 1000;

const createEmptyBucketState = <TItem,>(): KanbanBucketData<TItem> => ({
  items: [],
  total: 0,
  loadedCount: 0,
  hasMore: false,
  nextCursor: null,
  isLoadingInitial: false,
  isLoadingMore: false,
  error: null,
});

const createInitialBucketStates = <TItem, K extends string>(
  bucketKeys: readonly K[],
): Partial<Record<K, KanbanBucketData<TItem>>> =>
  Object.fromEntries(
    bucketKeys.map((bucketKey) => [bucketKey, createEmptyBucketState<TItem>()]),
  ) as Partial<Record<K, KanbanBucketData<TItem>>>;

const getSnapshotStorageKey = (cacheKey: string) =>
  `${REMOTE_KANBAN_SNAPSHOT_PREFIX}${cacheKey}`;

const getBucketCurrentPage = <TItem,>(
  state?: KanbanBucketData<TItem>,
  pageSize = DEFAULT_REMOTE_KANBAN_PAGE_SIZE,
) => {
  if (!state) return 0;
  if (typeof state.nextCursor === "number") {
    return Math.max(1, state.nextCursor - 1);
  }
  const loadedCount = state.loadedCount ?? 0;
  if (loadedCount > 0) {
    return Math.max(1, Math.ceil(loadedCount / pageSize));
  }
  return 0;
};

const readRemoteKanbanSnapshot = <TItem, K extends string>({
  cacheKey,
  cacheTtlMs,
  filterSignature,
}: {
  cacheKey?: string;
  cacheTtlMs: number;
  filterSignature: string;
}): Partial<Record<K, KanbanBucketData<TItem>>> | null => {
  if (!cacheKey || typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(getSnapshotStorageKey(cacheKey));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      timestamp?: number;
      filterSignature?: string;
      bucketData?: Partial<Record<K, KanbanBucketData<TItem>>>;
    };

    if (!parsed.timestamp || !parsed.bucketData) return null;
    if (parsed.filterSignature !== filterSignature) return null;

    if (Date.now() - parsed.timestamp > cacheTtlMs) {
      window.sessionStorage.removeItem(getSnapshotStorageKey(cacheKey));
      return null;
    }

    return parsed.bucketData;
  } catch {
    return null;
  }
};

const writeRemoteKanbanSnapshot = <TItem, K extends string>({
  cacheKey,
  filterSignature,
  bucketData,
}: {
  cacheKey?: string;
  filterSignature: string;
  bucketData: Partial<Record<K, KanbanBucketData<TItem>>>;
}) => {
  if (!cacheKey || typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      getSnapshotStorageKey(cacheKey),
      JSON.stringify({
        timestamp: Date.now(),
        filterSignature,
        bucketData,
      }),
    );
  } catch {}
};

const mergeUniqueById = <TItem extends { id?: number | string }>(
  previousItems: TItem[],
  nextItems: TItem[],
) => {
  const merged = new Map<number | string, TItem>();

  previousItems.forEach((item) => {
    if (item.id != null) {
      merged.set(item.id, item);
    }
  });

  nextItems.forEach((item) => {
    if (item.id != null) {
      merged.set(item.id, item);
    }
  });

  const mergedItems = Array.from(merged.values());
  const anonymousItems = nextItems.filter((item) => item.id == null);

  return anonymousItems.length > 0
    ? [...mergedItems, ...anonymousItems]
    : mergedItems;
};

export const useRemoteKanban = <
  TItem extends { id?: number | string },
  K extends string,
  TFilters = Record<string, unknown>,
>({
  bucketKeys,
  filters,
  filterSignature,
  enabled = true,
  pageSize = DEFAULT_REMOTE_KANBAN_PAGE_SIZE,
  cacheKey,
  cacheTtlMs = DEFAULT_REMOTE_KANBAN_CACHE_TTL_MS,
  loadBucket,
  mergeItems = mergeUniqueById,
  sortItems,
}: UseRemoteKanbanOptions<TItem, K, TFilters>): UseRemoteKanbanResult<
  TItem,
  K
> => {
  const initialSnapshot = useMemo(
    () =>
      readRemoteKanbanSnapshot<TItem, K>({
        cacheKey,
        cacheTtlMs,
        filterSignature,
      }),
    [cacheKey, cacheTtlMs, filterSignature],
  );
  const initialHasHydratedData = useMemo(
    () =>
      bucketKeys.some(
        (bucketKey) => (initialSnapshot?.[bucketKey]?.loadedCount ?? 0) > 0,
      ),
    [bucketKeys, initialSnapshot],
  );

  const bucketPageRef = useRef<Record<K, number>>(
    Object.fromEntries(
      bucketKeys.map((bucketKey) => [
        bucketKey,
        getBucketCurrentPage(initialSnapshot?.[bucketKey], pageSize),
      ]),
    ) as Record<K, number>,
  );
  const activeRequestRef = useRef(0);
  const loadedFilterSignatureRef = useRef<string | null>(
    initialSnapshot ? filterSignature : null,
  );
  const autoLoadedFilterSignatureRef = useRef<string | null>(
    initialHasHydratedData ? filterSignature : null,
  );

  const [bucketData, setBucketData] = useState<
    Partial<Record<K, KanbanBucketData<TItem>>>
  >(initialSnapshot ?? createInitialBucketStates<TItem, K>(bucketKeys));

  const replaceBucketData = useCallback(
    (
      bucketKey: K,
      updater: (
        previousState: KanbanBucketData<TItem>,
      ) => KanbanBucketData<TItem>,
    ) => {
      setBucketData((previous) => {
        const previousState = previous[bucketKey] ?? createEmptyBucketState<TItem>();
        return {
          ...previous,
          [bucketKey]: updater(previousState),
        };
      });
    },
    [],
  );

  const fetchBucketPage = useCallback(
    async ({
      bucketKey,
      page,
      replace,
      requestId,
    }: {
      bucketKey: K;
      page: number;
      replace: boolean;
      requestId: number;
    }) => {
      replaceBucketData(bucketKey, (previousState) => ({
        ...previousState,
        items: replace ? [] : previousState.items ?? [],
        isLoadingInitial: replace,
        isLoadingMore: !replace,
        error: null,
      }));

      try {
        const response = await loadBucket({
          bucketKey,
          page,
          perPage: pageSize,
          filters,
        });

        if (requestId !== activeRequestRef.current) {
          return;
        }

        const incomingItems = response.items ?? [];
        const total =
          typeof response.total === "number"
            ? response.total
            : incomingItems.length;

        replaceBucketData(bucketKey, (previousState) => {
          const mergedItems = sortItems
            ? sortItems(
                replace
                  ? incomingItems
                  : mergeItems(previousState.items ?? [], incomingItems),
              )
            : replace
              ? incomingItems
              : mergeItems(previousState.items ?? [], incomingItems);
          const loadedCount = mergedItems.length;
          const hasMore = loadedCount < total;

          return {
            items: mergedItems,
            total,
            loadedCount,
            hasMore,
            nextCursor: hasMore ? page + 1 : null,
            isLoadingInitial: false,
            isLoadingMore: false,
            error: null,
          };
        });

        bucketPageRef.current[bucketKey] = page;
      } catch {
        if (requestId !== activeRequestRef.current) {
          return;
        }

        replaceBucketData(bucketKey, (previousState) => ({
          ...previousState,
          items: replace ? [] : previousState.items ?? [],
          total: previousState.total ?? previousState.items?.length ?? 0,
          loadedCount:
            previousState.loadedCount ?? previousState.items?.length ?? 0,
          isLoadingInitial: false,
          isLoadingMore: false,
          error: "No se pudo cargar la columna",
        }));
      }
    },
    [filters, loadBucket, mergeItems, pageSize, replaceBucketData, sortItems],
  );

  const reloadBuckets = useCallback(
    async (targetBucketKeys: K[]) => {
      if (!enabled || targetBucketKeys.length === 0) return;

      const requestId = activeRequestRef.current + 1;
      activeRequestRef.current = requestId;
      const uniqueBucketKeys = Array.from(new Set(targetBucketKeys));

      uniqueBucketKeys.forEach((bucketKey) => {
        bucketPageRef.current[bucketKey] = 0;
      });

      await Promise.all(
        uniqueBucketKeys.map((bucketKey) =>
          fetchBucketPage({
            bucketKey,
            page: 1,
            replace: true,
            requestId,
          }),
        ),
      );
    },
    [enabled, fetchBucketPage],
  );

  const loadMore = useCallback(
    (bucketKey: K) => {
      if (!enabled) return;

      const currentState = bucketData[bucketKey];
      if (currentState?.isLoadingInitial || currentState?.isLoadingMore) {
        return;
      }

      const nextCursor = currentState?.nextCursor;
      const nextPage =
        typeof nextCursor === "number"
          ? nextCursor
          : bucketPageRef.current[bucketKey] + 1;

      if (!nextPage || nextPage < 2) return;

      void fetchBucketPage({
        bucketKey,
        page: nextPage,
        replace: false,
        requestId: activeRequestRef.current,
      });
    },
    [bucketData, enabled, fetchBucketPage],
  );

  useEffect(() => {
    writeRemoteKanbanSnapshot({
      cacheKey,
      filterSignature,
      bucketData,
    });
  }, [bucketData, cacheKey, filterSignature]);

  const hasHydratedData = useMemo(
    () =>
      bucketKeys.some(
        (bucketKey) => (bucketData[bucketKey]?.loadedCount ?? 0) > 0,
      ),
    [bucketData, bucketKeys],
  );
  const hasPendingLoad = useMemo(
    () =>
      bucketKeys.some((bucketKey) => {
        const bucketState = bucketData[bucketKey];
        return Boolean(
          bucketState?.isLoadingInitial || bucketState?.isLoadingMore,
        );
      }),
    [bucketData, bucketKeys],
  );

  useEffect(() => {
    if (!enabled) return;

    if (loadedFilterSignatureRef.current !== filterSignature) {
      loadedFilterSignatureRef.current = filterSignature;
      autoLoadedFilterSignatureRef.current = filterSignature;
      void reloadBuckets([...bucketKeys]);
      return;
    }

    if (
      !hasHydratedData &&
      !hasPendingLoad &&
      autoLoadedFilterSignatureRef.current !== filterSignature
    ) {
      loadedFilterSignatureRef.current = filterSignature;
      autoLoadedFilterSignatureRef.current = filterSignature;
      void reloadBuckets([...bucketKeys]);
    }
  }, [
    bucketKeys,
    enabled,
    filterSignature,
    hasHydratedData,
    hasPendingLoad,
    reloadBuckets,
  ]);

  return {
    bucketData,
    hasHydratedData,
    reloadBuckets,
    loadMore,
    replaceBucketData,
  };
};
