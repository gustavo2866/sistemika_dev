"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { Key, ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export type TodoBucketDefinition<TBucket extends string> = {
  id: TBucket;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  headerRight?: ReactNode;
};

export type TodoBoardProps<TItem, TBucket extends string> = {
  items: TItem[];
  buckets: Array<TodoBucketDefinition<TBucket>>;
  getBucket: (item: TItem) => TBucket;
  getItemKey: (item: TItem) => Key;
  renderItem: (item: TItem) => ReactNode;
  sortItems?: (a: TItem, b: TItem) => number;
  isLoading?: boolean;
  loadingText?: string;
  emptyText?: string;
  emptyBucketText?: string;
  collapseAllByDefault?: boolean;
  defaultCollapsed?: Partial<Record<TBucket, boolean>>;
  className?: string;
};

const buildInitialCollapsed = <TBucket extends string>(
  buckets: Array<TodoBucketDefinition<TBucket>>,
  collapseAllByDefault?: boolean,
  defaultCollapsed?: Partial<Record<TBucket, boolean>>
) => {
  const initial: Record<TBucket, boolean> = {} as Record<TBucket, boolean>;
  buckets.forEach((bucket) => {
    const value =
      typeof defaultCollapsed?.[bucket.id] === "boolean"
        ? defaultCollapsed[bucket.id]
        : Boolean(collapseAllByDefault);
    initial[bucket.id] = value;
  });
  return initial;
};

export const TodoBoard = <TItem, TBucket extends string>({
  items,
  buckets,
  getBucket,
  getItemKey,
  renderItem,
  sortItems,
  isLoading,
  loadingText = "Cargando...",
  emptyText = "Sin items",
  emptyBucketText = "Sin items",
  collapseAllByDefault,
  defaultCollapsed,
  className,
}: TodoBoardProps<TItem, TBucket>) => {
  const [collapsed, setCollapsed] = useState<Record<TBucket, boolean>>(() =>
    buildInitialCollapsed(buckets, collapseAllByDefault, defaultCollapsed)
  );

  useEffect(() => {
    setCollapsed((prev) => {
      const next = { ...prev } as Record<TBucket, boolean>;
      buckets.forEach((bucket) => {
        if (bucket.id in next) {
          if (typeof defaultCollapsed?.[bucket.id] === "boolean") {
            next[bucket.id] = Boolean(defaultCollapsed[bucket.id]);
          }
          return;
        }
        next[bucket.id] =
          typeof defaultCollapsed?.[bucket.id] === "boolean"
            ? Boolean(defaultCollapsed[bucket.id])
            : Boolean(collapseAllByDefault);
      });
      return next;
    });
  }, [buckets, collapseAllByDefault, defaultCollapsed]);

  const grouped = useMemo(() => {
    const base = {} as Record<TBucket, TItem[]>;
    buckets.forEach((bucket) => {
      base[bucket.id] = [];
    });
    items.forEach((item) => {
      const bucketId = getBucket(item);
      if (!base[bucketId]) {
        base[bucketId] = [];
      }
      base[bucketId].push(item);
    });
    if (sortItems) {
      buckets.forEach((bucket) => {
        base[bucket.id].sort(sortItems);
      });
    }
    return base;
  }, [buckets, getBucket, items, sortItems]);

  if (isLoading) {
    return <div className="py-6 text-sm text-muted-foreground">{loadingText}</div>;
  }

  if (!items.length) {
    return <div className="py-6 text-sm text-muted-foreground">{emptyText}</div>;
  }

  const toggleBucket = (bucketId: TBucket) =>
    setCollapsed((prev) => ({ ...prev, [bucketId]: !prev[bucketId] }));

  return (
    <div className={className ?? "space-y-4"}>
      {buckets.map((bucket) => {
        const bucketItems = grouped[bucket.id] ?? [];
        const isCollapsed = collapsed[bucket.id];
        const Icon = bucket.icon;
        return (
          <div key={bucket.id} className="rounded-2xl border border-slate-200/80 bg-white/90">
            <button
              type="button"
              onClick={() => toggleBucket(bucket.id)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-50 sm:gap-3 sm:px-4 sm:py-3"
            >
              <div className="flex items-center gap-2">
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400 sm:h-4 sm:w-4" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 sm:h-4 sm:w-4" />
                )}
                {Icon ? (
                  <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${bucket.iconClassName ?? ""}`} />
                ) : null}
                <span className="text-xs font-semibold text-slate-800 sm:text-sm">{bucket.label}</span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 sm:px-2 sm:text-xs">
                  {bucketItems.length}
                </span>
              </div>
              {bucket.headerRight}
            </button>
            {isCollapsed ? null : (
              <div className="border-t border-slate-200/70">
                {bucketItems.length === 0 ? (
                  <div className="px-4 py-4 text-xs text-slate-400">{emptyBucketText}</div>
                ) : (
                  bucketItems.map((item) => (
                    <Fragment key={getItemKey(item)}>{renderItem(item)}</Fragment>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
