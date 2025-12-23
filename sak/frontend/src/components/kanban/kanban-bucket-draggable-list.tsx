"use client";

import type { DragEvent as ReactDragEvent } from "react";
import { cn } from "@/lib/utils";
import { KanbanBucketBody, KanbanBucketEmpty } from "./bucket";
import { useKanbanDragDropContext } from "./drag-drop-provider";

export interface KanbanBucketDraggableListProps<TItem, K extends string> {
  bucketKey: K;
  items: TItem[];
  renderItem: (item: TItem) => React.ReactNode;
  emptyMessage?: string;
  bodyClassName?: string;
  dragOverClassName?: string;
  emptyClassName?: string;
  isInteractive?: boolean;
  getItemKey?: (item: TItem) => string | number;
}

export const KanbanBucketDraggableList = <TItem, K extends string>({
  bucketKey,
  items,
  renderItem,
  emptyMessage = "Sin elementos",
  bodyClassName,
  dragOverClassName = "ring-1 ring-primary/40 bg-primary/5",
  emptyClassName,
  isInteractive = true,
  getItemKey,
}: KanbanBucketDraggableListProps<TItem, K>) => {
  const {
    dragOverBucket,
    handleDragStart,
    handleDragEnd,
    handleBucketDragOver,
    handleBucketDrop,
    handleBucketDragLeave,
  } = useKanbanDragDropContext<TItem, K>();

  const bodyClass = cn(bodyClassName, dragOverBucket === bucketKey ? dragOverClassName : "");

  const handleDragOver = isInteractive
    ? (event: ReactDragEvent<HTMLDivElement>) => handleBucketDragOver(event, bucketKey)
    : undefined;
  const handleDrop = isInteractive
    ? (event: ReactDragEvent<HTMLDivElement>) => handleBucketDrop(event, bucketKey)
    : undefined;
  const handleLeave = isInteractive ? handleBucketDragLeave : undefined;

  return (
    <KanbanBucketBody
      className={bodyClass}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleLeave}
    >
      {items.length === 0 ? (
        <KanbanBucketEmpty message={emptyMessage} className={emptyClassName} />
      ) : (
        items.map((item, index) => (
          <div
            key={getItemKey ? getItemKey(item) : (item as any).id ?? index}
            draggable={isInteractive}
            onDragStart={isInteractive ? (event) => handleDragStart(event, item) : undefined}
            onDragEnd={isInteractive ? handleDragEnd : undefined}
            style={isInteractive ? { cursor: "grab" } : undefined}
          >
            {renderItem(item)}
          </div>
        ))
      )}
    </KanbanBucketBody>
  );
};
