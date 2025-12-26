"use client";

import type { DragEvent as ReactDragEvent } from "react";
import { cn } from "@/lib/utils";
import { KanbanBucket, KanbanBucketBody, KanbanBucketEmpty, KanbanBucketHeader } from "./bucket";

export interface KanbanBucketDefinition<K extends string = string> {
  key: K;
  title: string;
  helper: string;
  accentClass: string;
  bucketClassName?: string;
  interactive?: boolean;
  headerContent?: React.ReactNode;
}

interface KanbanBucketsGridProps<TItem, K extends string> {
  className?: string;
  bucketDefinitions: KanbanBucketDefinition<K>[];
  bucketItems: Record<K, TItem[]>;
  renderCard: (item: TItem, bucketKey: K) => React.ReactNode;
  dragOverBucket?: K | null;
  draggedItem?: TItem | null;
  onCardDragStart?: (event: ReactDragEvent<HTMLDivElement>, item: TItem) => void;
  emptyMessage?: string;
  onBucketDragOver?: (event: ReactDragEvent<HTMLDivElement>, bucketKey: K) => void;
  onBucketDrop?: (event: ReactDragEvent<HTMLDivElement>, bucketKey: K) => void;
  onBucketDragLeave?: () => void;
  bucketNavigation?: KanbanBucketNavigation;
}

export interface KanbanBucketNavigation {
  canPrev?: boolean;
  canNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}

export const KanbanBucketsGrid = <TItem, K extends string>({
  className,
  bucketDefinitions,
  bucketItems,
  renderCard,
  dragOverBucket,
  draggedItem: _draggedItem,
  onCardDragStart,
  emptyMessage = "Sin elementos",
  onBucketDragOver,
  onBucketDrop,
  onBucketDragLeave,
  bucketNavigation,
}: KanbanBucketsGridProps<TItem, K>) => (
  <div className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-4", className)}>
    {bucketDefinitions.map(({ key, title, helper, accentClass, bucketClassName, interactive = true, headerContent }, index) => {
      const items = bucketItems[key] ?? [];
      const isInteractive = interactive;
      const bodyClass = dragOverBucket === key ? "ring-1 ring-primary/40 bg-primary/5" : "";
      const isFirst = index === 0;
      const isLast = index === bucketDefinitions.length - 1;
      const showPrevControl = Boolean(bucketNavigation?.canPrev && isFirst);
      const showNextControl = Boolean(bucketNavigation?.canNext && isLast);
      return (
        <KanbanBucket key={key} accentClass={accentClass} className={bucketClassName}>
          <KanbanBucketHeader
            title={title}
            helper={helper}
            count={items.length}
            headerContent={headerContent}
            showPrevControl={showPrevControl}
            showNextControl={showNextControl}
            onPrev={bucketNavigation?.onPrev}
            onNext={bucketNavigation?.onNext}
          />
          <KanbanBucketBody
            className={bodyClass}
            onDragOver={
              isInteractive && onBucketDragOver ? (event) => onBucketDragOver(event, key) : undefined
            }
            onDrop={
              isInteractive && onBucketDrop ? (event) => onBucketDrop(event, key) : undefined
            }
            onDragLeave={isInteractive ? onBucketDragLeave : undefined}
          >
            {items.length === 0 ? (
              <KanbanBucketEmpty message={emptyMessage} />
            ) : (
              items.map((item) => {
                const card = renderCard(item, key);
                if (!onCardDragStart) return card;
                
                return (
                  <div
                    key={(item as any).id ?? Math.random()}
                    draggable
                    onDragStart={(e) => onCardDragStart(e, item)}
                    style={{ cursor: 'grab' }}
                  >
                    {card}
                  </div>
                );
              })
            )}
          </KanbanBucketBody>
        </KanbanBucket>
      );
    })}
  </div>
);
