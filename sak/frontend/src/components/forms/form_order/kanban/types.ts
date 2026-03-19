"use client";

import type { ReactNode } from "react";
import type { KanbanBucketDefinition } from "./kanban-buckets-grid";

export type KanbanItemId = number | string;
export type KanbanBucketCursor = string | number | null;

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

export interface KanbanBucketData<TItem> {
  items: TItem[];
  total?: number;
  loadedCount?: number;
  hasMore?: boolean;
  nextCursor?: KanbanBucketCursor;
  isLoadingInitial?: boolean;
  isLoadingMore?: boolean;
  error?: string | null;
}

export interface KanbanBucketVisualState<TItem> extends KanbanBucketData<TItem> {
  items: TItem[];
  total: number;
  loadedCount: number;
  hasMore: boolean;
  isLoadingInitial: boolean;
  isLoadingMore: boolean;
  error: string | null;
}

export interface KanbanRemoteLoadParams<
  K extends string,
  TFilters = Record<string, unknown>,
> {
  bucketKey: K;
  page: number;
  perPage: number;
  filters: TFilters;
}

export interface KanbanRemoteLoadResult<TItem> {
  items: TItem[];
  total?: number;
}

export interface UseRemoteKanbanOptions<
  TItem extends { id?: number | string },
  K extends string,
  TFilters = Record<string, unknown>,
> {
  bucketKeys: readonly K[];
  filters: TFilters;
  filterSignature: string;
  enabled?: boolean;
  pageSize?: number;
  cacheKey?: string;
  cacheTtlMs?: number;
  loadBucket: (
    params: KanbanRemoteLoadParams<K, TFilters>,
  ) => Promise<KanbanRemoteLoadResult<TItem>>;
  mergeItems?: (previousItems: TItem[], nextItems: TItem[]) => TItem[];
  sortItems?: (items: TItem[]) => TItem[];
}

export interface UseRemoteKanbanResult<
  TItem extends { id?: number | string },
  K extends string,
> {
  bucketData: Partial<Record<K, KanbanBucketData<TItem>>>;
  hasHydratedData: boolean;
  reloadBuckets: (bucketKeys: K[]) => Promise<void>;
  loadMore: (bucketKey: K) => void;
  replaceBucketData: (
    bucketKey: K,
    updater: (
      previousState: KanbanBucketData<TItem>,
    ) => KanbanBucketData<TItem>,
  ) => void;
}

export interface KanbanBoardViewBaseProps<
  TItem extends { id?: number },
  K extends string,
> {
  buckets: KanbanBucketDefinition<K>[];
  maxBucketsPerPage?: number;
  showBucketPaginationFooter?: boolean;
  onItemMove?: (item: TItem, bucket: K) => any | Promise<any>;
  canItemMove?: (item: TItem, bucket: K) => boolean | Promise<boolean>;
  resource?: string;
  getMoveSuccessMessage?: (item: TItem, bucket: K) => string;
  onLoadMore?: (bucketKey: K) => void | Promise<void>;
  customFilter?: (item: TItem, customFilters: Record<string, any>) => boolean;
  searchFilter?: (item: TItem, searchTerm: string) => boolean;
  filterConfig?: KanbanBoardViewFilterConfig;
  customFilters?: (params: {
    customState: Record<string, any>;
    setCustomState: (key: string, value: any) => void;
  }) => ReactNode;
  initialCustomState?: Record<string, any>;
  initialCollapsedAll?: boolean;
  enableBucketCollapseToggle?: boolean;
  bucketCollapseToggleLabel?: string;
  bucketGridClassName?: string;
  renderCard: (
    item: TItem,
    bucketKey?: K,
    collapsed?: boolean,
    onToggleCollapse?: () => void,
  ) => ReactNode;
  isLoading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  noResultsMessage?: string;
}

export interface KanbanBoardViewClientModeProps<
  TItem extends { id?: number },
  K extends string,
> extends KanbanBoardViewBaseProps<TItem, K> {
  mode?: "client";
  items: TItem[];
  getBucketKey: (item: TItem) => K;
  bucketData?: never;
}

export interface KanbanBoardViewRemoteModeProps<
  TItem extends { id?: number },
  K extends string,
> extends KanbanBoardViewBaseProps<TItem, K> {
  mode: "remote";
  bucketData: Partial<Record<K, KanbanBucketData<TItem>>>;
  items?: never;
  getBucketKey?: never;
}

export type KanbanBoardViewProps<
  TItem extends { id?: number },
  K extends string,
> =
  | KanbanBoardViewClientModeProps<TItem, K>
  | KanbanBoardViewRemoteModeProps<TItem, K>;

export const isKanbanRemoteMode = <
  TItem extends { id?: number },
  K extends string,
>(
  props: KanbanBoardViewProps<TItem, K>,
): props is KanbanBoardViewRemoteModeProps<TItem, K> =>
  props.mode === "remote";
