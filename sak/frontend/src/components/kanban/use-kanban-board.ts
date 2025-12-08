"use client";

import type { KanbanBucketDefinition } from "./kanban-buckets-grid";
import {
  useKanbanCommonState,
  type KanbanCommonState,
  type KanbanCommonStateOptions,
} from "./use-kanban-common-state";

export interface UseKanbanBoardResult<TItem, K extends string>
  extends KanbanCommonState {
  filteredItems: TItem[];
  bucketDefinitions: KanbanBucketDefinition<K>[];
  bucketItems: Record<K, TItem[]>;
}

export interface UseKanbanBoardOptions<
  TItem,
  K extends string,
  THookArgs,
  THookResult extends {
    filteredEventos: TItem[];
    bucketedEventos: Record<K, TItem[]>;
    bucketDefinitions: KanbanBucketDefinition<K>[];
  },
> extends KanbanCommonStateOptions {
  items: TItem[];
  useBuckets: (args: THookArgs) => THookResult;
  buildBucketArgs: (params: {
    items: TItem[];
    search: string;
    ownerFilter: string;
  }) => THookArgs;
}

export const useKanbanBoard = <
  TItem,
  K extends string,
  THookArgs,
  THookResult extends {
    filteredEventos: TItem[];
    bucketedEventos: Record<K, TItem[]>;
    bucketDefinitions: KanbanBucketDefinition<K>[];
  },
>({
  items,
  useBuckets,
  buildBucketArgs,
  ...commonStateOptions
}: UseKanbanBoardOptions<TItem, K, THookArgs, THookResult>): UseKanbanBoardResult<
  TItem,
  K
> => {
  const {
    searchValue,
    setSearchValue,
    ownerFilter,
    setOwnerFilter,
    collapsedAll,
    toggleCollapsedAll,
    isCardCollapsed,
    toggleCardCollapse,
  } = useKanbanCommonState(commonStateOptions);

  const bucketArgs = buildBucketArgs({
    items,
    search: searchValue,
    ownerFilter,
  });

  const { filteredEventos, bucketedEventos, bucketDefinitions } = useBuckets(
    bucketArgs,
  );

  return {
    searchValue,
    setSearchValue,
    ownerFilter,
    setOwnerFilter,
    collapsedAll,
    toggleCollapsedAll,
    isCardCollapsed,
    toggleCardCollapse,
    filteredItems: filteredEventos,
    bucketDefinitions,
    bucketItems: bucketedEventos,
  };
};

