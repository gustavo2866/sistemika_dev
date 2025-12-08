"use client";

import { useCallback, useState } from "react";
import type { DragEvent as ReactDragEvent } from "react";

export interface UseKanbanDragDropOptions<TItem, K extends string> {
  /**
   * Called when an item is dropped into a bucket.
   * Implement your business logic here (e.g., update date, status).
   */
  onItemDropped?: (item: TItem, targetBucket: K) => void | Promise<void>;
  
  /**
   * Extract a unique identifier from an item for drag data transfer.
   */
  getItemId?: (item: TItem) => string | number;
  
  /**
   * Buckets that should not accept drops (e.g., "overdue", "completed").
   */
  nonInteractiveBuckets?: K[];
}

export interface UseKanbanDragDropResult<TItem, K extends string> {
  draggedItem: TItem | null;
  dragOverBucket: K | null;
  handleDragStart: (event: ReactDragEvent<HTMLDivElement>, item: TItem) => void;
  handleDragEnd: () => void;
  handleBucketDragOver: (event: ReactDragEvent<HTMLDivElement>, bucket: K) => void;
  handleBucketDrop: (event: ReactDragEvent<HTMLDivElement>, bucket: K) => void;
  handleBucketDragLeave: () => void;
}

/**
 * Generic hook for Kanban drag & drop functionality.
 * Manages drag state and provides event handlers for cards and buckets.
 */
export function useKanbanDragDrop<TItem, K extends string>({
  onItemDropped,
  getItemId = (item: any) => item.id,
  nonInteractiveBuckets = [],
}: UseKanbanDragDropOptions<TItem, K> = {}): UseKanbanDragDropResult<TItem, K> {
  const [draggedItem, setDraggedItem] = useState<TItem | null>(null);
  const [dragOverBucket, setDragOverBucket] = useState<K | null>(null);

  // Stores the card currently being dragged.
  const handleDragStart = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, item: TItem) => {
      const itemId = getItemId(item);
      if (!itemId) return;
      
      setDraggedItem(item);
      event.dataTransfer.setData("text/plain", String(itemId));
      event.dataTransfer.effectAllowed = "move";
    },
    [getItemId]
  );

  // Resets drag state when interaction ends.
  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverBucket(null);
  }, []);

  // Highlights eligible buckets while dragging over them.
  const handleBucketDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, bucket: K) => {
      if (!draggedItem) return;
      if (nonInteractiveBuckets.includes(bucket)) return;
      
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDragOverBucket(bucket);
    },
    [draggedItem, nonInteractiveBuckets]
  );

  // Handles dropping a card inside a bucket.
  const handleBucketDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, bucket: K) => {
      event.preventDefault();
      
      if (!draggedItem || nonInteractiveBuckets.includes(bucket)) {
        setDragOverBucket(null);
        return;
      }

      if (onItemDropped) {
        onItemDropped(draggedItem, bucket);
      }

      setDraggedItem(null);
      setDragOverBucket(null);
    },
    [draggedItem, nonInteractiveBuckets, onItemDropped]
  );

  // Clears bucket hover styles when leaving a column.
  const handleBucketDragLeave = useCallback(() => {
    setDragOverBucket(null);
  }, []);

  return {
    draggedItem,
    dragOverBucket,
    handleDragStart,
    handleDragEnd,
    handleBucketDragOver,
    handleBucketDrop,
    handleBucketDragLeave,
  };
}
