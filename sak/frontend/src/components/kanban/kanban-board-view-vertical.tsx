"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { KanbanBucketDraggableList } from "./kanban-bucket-draggable-list";
import { KanbanDragDropProvider } from "./drag-drop-provider";
import { useKanbanCollapseState } from "./use-kanban-collapse-state";
import { useKanbanMoveController } from "./use-kanban-move-controller";

export type KanbanVerticalBucket<K extends string> = {
  key: K;
  emptyMessage?: string;
  wrapperClassName?: string;
};

export interface KanbanBoardViewVerticalProps<TItem, K extends string> {
  buckets: KanbanVerticalBucket<K>[];
  bucketItems: Record<K, TItem[]>;
  renderItem: (item: TItem, bucketKey: K, helpers: { onMove: (item: TItem, bucket: K) => Promise<void> }) => ReactNode;
  renderBucketHeader?: (
    bucket: KanbanVerticalBucket<K>,
    count: number,
    collapsed: boolean,
    onToggle: () => void
  ) => ReactNode;
  initialCollapsedBuckets?: Record<K, boolean>;
  getBucketBodyClassName?: (bucketKey: K) => string;
  enableDragDrop?: boolean;
  onItemMove?: (item: TItem, bucket: K) => boolean | void | Promise<boolean | void>;
  canItemMove?: (item: TItem, bucket: K) => boolean | Promise<boolean>;
  onAfterMove?: (item: TItem, bucket: K) => void | Promise<void>;
  onMoveError?: (error: unknown, item: TItem, bucket: K) => void;
  getItemId?: (item: TItem) => string | number | null | undefined;
}

export const KanbanBoardViewVertical = <TItem, K extends string>({
  buckets,
  bucketItems,
  renderItem,
  renderBucketHeader,
  initialCollapsedBuckets,
  getBucketBodyClassName,
  enableDragDrop = true,
  onItemMove,
  canItemMove,
  onAfterMove,
  onMoveError,
  getItemId,
}: KanbanBoardViewVerticalProps<TItem, K>) => {
  const { handleItemMove } = useKanbanMoveController<TItem, K>({
    canMove: canItemMove,
    onMove: (item, bucket) => {
      if (!onItemMove) return false;
      return onItemMove(item, bucket);
    },
    onAfterMove,
    onMoveError,
    getItemId,
  });

  const isInteractive = enableDragDrop && Boolean(onItemMove);

  const initialCollapsed = initialCollapsedBuckets ?? buckets.reduce((acc, bucket) => {
    acc[bucket.key] = false;
    return acc;
  }, {} as Record<K, boolean>);

  const { collapsed, toggle } = useKanbanCollapseState<K>(initialCollapsed);

  return (
    <KanbanDragDropProvider<TItem, K> onItemDropped={handleItemMove} getItemId={getItemId}>
      <div className="space-y-3">
        {buckets.map((bucket) => {
          const items = bucketItems[bucket.key] ?? [];
          const isCollapsed = collapsed[bucket.key];
          const handleToggle = () => toggle(bucket.key);
          return (
            <div key={bucket.key} className={cn("rounded-xl border border-slate-200 bg-white", bucket.wrapperClassName)}>
              {renderBucketHeader ? renderBucketHeader(bucket, items.length, isCollapsed, handleToggle) : null}
              {isCollapsed ? null : (
                <div className="px-4 pb-3">
                  <KanbanBucketDraggableList<TItem, K>
                    bucketKey={bucket.key}
                    items={items}
                    emptyMessage={bucket.emptyMessage}
                    bodyClassName={getBucketBodyClassName ? getBucketBodyClassName(bucket.key) : undefined}
                    isInteractive={isInteractive}
                    renderItem={(item) => renderItem(item, bucket.key, { onMove: handleItemMove })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </KanbanDragDropProvider>
  );
};
