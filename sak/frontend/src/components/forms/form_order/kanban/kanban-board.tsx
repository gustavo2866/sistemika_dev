"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  KanbanBucketsGrid,
  type KanbanBucketDefinition,
  type KanbanBucketNavigation,
} from "./kanban-buckets-grid";
import type { KanbanBucketVisualState } from "./types";

export interface KanbanBoardProps<TItem, K extends string> {
  className?: string;
  bucketGridClassName?: string;
  filterBar?: React.ReactNode;
  isLoading?: boolean;
  loadingMessage?: string;
  bucketDefinitions: KanbanBucketDefinition<K>[];
  bucketItems: Record<K, TItem[]>;
  bucketStates?: Partial<Record<K, KanbanBucketVisualState<TItem>>>;
  renderCard: (item: TItem, bucketKey: K) => React.ReactNode;
  bucketCollapsed?: Partial<Record<K, boolean>>;
  onToggleBucketCollapse?: (bucketKey: K) => void;
  bucketCollapseToggleVariant?: import("./collapse-toggle").KanbanCollapseToggleProps["variant"];
  bucketCollapseToggleLabel?: string;
  bucketCollapseToggleClassName?: string;
  bucketCollapseToggleContent?: React.ReactNode;
  bucketCollapseToggleStopPropagation?: boolean;
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
  onLoadMore?: (bucketKey: K) => void;
}

export const KanbanBoard = <TItem, K extends string>({
  className,
  bucketGridClassName,
  filterBar,
  isLoading,
  loadingMessage = "Cargando...",
  bucketDefinitions,
  bucketItems,
  bucketStates,
  renderCard,
  bucketCollapsed,
  onToggleBucketCollapse,
  bucketCollapseToggleVariant,
  bucketCollapseToggleLabel,
  bucketCollapseToggleClassName,
  bucketCollapseToggleContent,
  bucketCollapseToggleStopPropagation,
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
  onLoadMore,
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
        {bucketNavigation &&
        (bucketNavigation.canPrev ||
          bucketNavigation.canNext ||
          bucketNavigation.pageLabel ||
          bucketNavigation.summaryLabel) ? (
          <div className="flex justify-end">
            <div className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/90 p-1 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
              {bucketNavigation.canPrev ? (
                <button
                  type="button"
                  onClick={bucketNavigation.onPrev}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  aria-label="Ver buckets anteriores"
                  title="Ver buckets anteriores"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              ) : null}
              <div className="min-w-[110px] px-2 text-center leading-tight">
                {bucketNavigation.summaryLabel ? (
                  <div className="text-[11px] font-semibold text-slate-700">
                    {bucketNavigation.summaryLabel}
                  </div>
                ) : null}
                {bucketNavigation.pageLabel ? (
                  <div className="text-[10px] font-medium text-slate-500">
                    Pag. {bucketNavigation.pageLabel}
                  </div>
                ) : null}
              </div>
              {bucketNavigation.canNext ? (
                <button
                  type="button"
                  onClick={bucketNavigation.onNext}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-900 bg-slate-900 text-white transition hover:bg-slate-800"
                  aria-label="Ver siguientes buckets"
                  title="Ver siguientes buckets"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <KanbanBucketsGrid
          className={bucketGridClassName}
          bucketDefinitions={bucketDefinitions}
          bucketItems={bucketItems}
          bucketStates={bucketStates}
          renderCard={renderCard}
          bucketCollapsed={bucketCollapsed}
          onToggleBucketCollapse={onToggleBucketCollapse}
          bucketCollapseToggleVariant={bucketCollapseToggleVariant}
          bucketCollapseToggleLabel={bucketCollapseToggleLabel}
          bucketCollapseToggleClassName={bucketCollapseToggleClassName}
          bucketCollapseToggleContent={bucketCollapseToggleContent}
          bucketCollapseToggleStopPropagation={bucketCollapseToggleStopPropagation}
          dragOverBucket={dragOverBucket}
          draggedItem={draggedItem}
          onCardDragStart={onCardDragStart}
          emptyMessage={emptyMessage}
          onBucketDragOver={onBucketDragOver}
          onBucketDrop={onBucketDrop}
          onBucketDragLeave={onBucketDragLeave}
          onLoadMore={onLoadMore}
        />
        {noResults ? (
          <div className="text-center py-8 text-muted-foreground">{noResultsMessage}</div>
        ) : null}
        {footer}
      </div>
    )}
  </div>
);
