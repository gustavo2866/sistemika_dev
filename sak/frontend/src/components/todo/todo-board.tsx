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
  compact?: boolean;
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
    initial[bucket.id] = Boolean(value);
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
  compact = false,
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

  const rootClassName = `${compact ? "space-y-2" : "space-y-4"} ${className ?? ""}`.trim();
  const bucketCardClassName = compact
    ? "rounded-xl border border-slate-200/80 bg-white/90"
    : "rounded-2xl border border-slate-200/80 bg-white/90";
  const bucketHeaderClassName = compact
    ? "flex w-full items-center justify-between gap-2 px-2 py-1 text-left transition-colors hover:bg-slate-50"
    : "flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-50 sm:gap-3 sm:px-4 sm:py-3";
  const bucketChevronClassName = compact
    ? "h-3 w-3 text-slate-400"
    : "h-3.5 w-3.5 text-slate-400 sm:h-4 sm:w-4";
  const bucketIconClassName = compact ? "h-3 w-3" : "h-3.5 w-3.5 sm:h-4 sm:w-4";
  const bucketLabelClassName = compact
    ? "text-[10px] font-semibold text-slate-800"
    : "text-xs font-semibold text-slate-800 sm:text-sm";
  const bucketCountClassName = compact
    ? "rounded-full bg-slate-100 px-1 py-0 text-[8px] font-semibold text-slate-600"
    : "rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 sm:px-2 sm:text-xs";
  const emptyBucketClassName = compact
    ? "px-3 py-2 text-[10px] text-slate-400"
    : "px-4 py-4 text-xs text-slate-400";

  return (
    <div className={rootClassName}>
      {buckets.map((bucket) => {
        const bucketItems = grouped[bucket.id] ?? [];
        const isCollapsed = collapsed[bucket.id];
        const Icon = bucket.icon;
        return (
          <div key={bucket.id} className={bucketCardClassName}>
            <button
              type="button"
              onClick={() => toggleBucket(bucket.id)}
              className={bucketHeaderClassName}
            >
              <div className="flex items-center gap-2">
                {isCollapsed ? (
                  <ChevronRight className={bucketChevronClassName} />
                ) : (
                  <ChevronDown className={bucketChevronClassName} />
                )}
                {Icon ? (
                  <Icon
                    className={`${bucketIconClassName} ${bucket.iconClassName ?? ""}`}
                  />
                ) : null}
                <span className={bucketLabelClassName}>{bucket.label}</span>
                <span className={bucketCountClassName}>
                  {bucketItems.length}
                </span>
              </div>
              {bucket.headerRight}
            </button>
            {isCollapsed ? null : (
              <div className="border-t border-slate-200/70">
                {bucketItems.length === 0 ? (
                  <div className={emptyBucketClassName}>{emptyBucketText}</div>
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
