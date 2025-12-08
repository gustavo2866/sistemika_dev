"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  KanbanBucketsGrid,
  type KanbanBucketDefinition,
  type KanbanBucketNavigation,
} from "./kanban-buckets-grid";

export interface KanbanBoardProps<TItem, K extends string> {
  className?: string;
  filterBar?: React.ReactNode;
  isLoading?: boolean;
  loadingMessage?: string;
  bucketDefinitions: KanbanBucketDefinition<K>[];
  bucketItems: Record<K, TItem[]>;
  renderCard: (item: TItem, bucketKey: K) => React.ReactNode;
  dragOverBucket?: K | null;
  draggedItem?: TItem | null;
  onCardDragStart?: (event: React.DragEvent<HTMLDivElement>, item: TItem) => void;
  emptyMessage?: string;
  onBucketDragOver?: (event: React.DragEvent<HTMLDivElement>, bucketKey: K) => void;
  onBucketDrop?: (event: React.DragEvent<HTMLDivElement>, bucketKey: K) => void;
  onBucketDragLeave?: () => void;
  noResults?: boolean;
  noResultsMessage?: string;
  footer?: React.ReactNode;
  bucketNavigation?: KanbanBucketNavigation;
}

export const KanbanBoard = <TItem, K extends string>({
  className,
  filterBar,
  isLoading,
  loadingMessage = "Cargando...",
  bucketDefinitions,
  bucketItems,
  renderCard,
  dragOverBucket,
  draggedItem,
  onCardDragStart,
  emptyMessage = "Sin elementos",
  onBucketDragOver,
  onBucketDrop,
  onBucketDragLeave,
  noResults,
  noResultsMessage = "No se encontraron resultados",
  footer,
  bucketNavigation,
}: KanbanBoardProps<TItem, K>) => (
  <div
    className={cn(
      "space-y-6 rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-white/95 via-white/90 to-slate-50/90 p-5 shadow-[0_30px_60px_rgba(15,23,42,0.12)]",
      className
    )}
  >
    {filterBar}
    {isLoading ? (
      <div className="text-center py-8 text-muted-foreground">{loadingMessage}</div>
    ) : (
      <div className="space-y-6">
        <KanbanBucketsGrid
          bucketDefinitions={bucketDefinitions}
          bucketItems={bucketItems}
          renderCard={renderCard}
          dragOverBucket={dragOverBucket}
          draggedItem={draggedItem}
          onCardDragStart={onCardDragStart}
          emptyMessage={emptyMessage}
          onBucketDragOver={onBucketDragOver}
          onBucketDrop={onBucketDrop}
          onBucketDragLeave={onBucketDragLeave}
          bucketNavigation={bucketNavigation}
        />
        {noResults ? (
          <div className="text-center py-8 text-muted-foreground">{noResultsMessage}</div>
        ) : null}
        {footer}
      </div>
    )}
  </div>
);
