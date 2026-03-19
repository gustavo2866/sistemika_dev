"use client";

import * as React from "react";
import type { DragEvent as ReactDragEvent } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  KanbanBucketErrorState,
  KanbanBucketFooter,
  KanbanBucketLoadingState,
} from "./bucket-state";
import { KanbanCollapseToggle } from "./collapse-toggle";
import type { KanbanCollapseToggleProps } from "./collapse-toggle";
import type { KanbanBucketVisualState } from "./types";

interface KanbanBucketProps extends React.HTMLAttributes<HTMLDivElement> {
  accentClass?: string;
}

const KanbanBucket = React.forwardRef<HTMLDivElement, KanbanBucketProps>(
  ({ className, accentClass, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex min-h-[220px] flex-col gap-1.5 rounded-xl border border-slate-200/70 bg-gradient-to-b px-2 py-2 shadow-inner",
        className,
        accentClass
      )}
      {...props}
    />
  )
);
KanbanBucket.displayName = "KanbanBucket";

interface KanbanBucketHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  helper?: string;
  count?: number;
  headerContent?: React.ReactNode;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  collapseToggleVariant?: KanbanCollapseToggleProps["variant"];
  collapseToggleLabel?: string;
  collapseToggleClassName?: string;
  collapseToggleContent?: React.ReactNode;
  collapseToggleStopPropagation?: boolean;
}

const KanbanBucketHeader = ({
  title,
  helper,
  count,
  headerContent,
  collapsible,
  collapsed,
  onToggleCollapse,
  collapseToggleVariant,
  collapseToggleLabel,
  collapseToggleClassName,
  collapseToggleContent,
  collapseToggleStopPropagation,
  className,
  children,
  ...props
}: KanbanBucketHeaderProps) => (
  <div className={cn("flex items-center justify-between gap-2", className)} {...props}>
    <div className="flex items-center gap-1.5">
      {headerContent ? (
        <div>{headerContent}</div>
      ) : (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">
            {title}
          </p>
          {helper ? <p className="text-[8px] text-slate-500">{helper}</p> : null}
        </div>
      )}
    </div>
    <div className="flex items-center gap-1.5">
      {children ?? <KanbanBucketCounter value={count ?? 0} />}
      {collapsible && onToggleCollapse ? (
        <KanbanCollapseToggle
          collapsed={Boolean(collapsed)}
          onToggle={onToggleCollapse}
          variant={collapseToggleVariant}
          label={collapseToggleLabel}
          className={collapseToggleClassName}
          stopPropagation={collapseToggleStopPropagation}
        >
          {collapseToggleContent}
        </KanbanCollapseToggle>
      ) : null}
    </div>
  </div>
);

const KanbanBucketCounter = ({
  value,
  className,
}: {
  value: number | string;
  className?: string;
}) => (
  <Badge
    variant="outline"
    className={cn(
      "rounded-full border-slate-200/80 px-2 py-0.5 text-[9px] font-semibold",
      className
    )}
  >
    {value}
  </Badge>
);

type KanbanBucketBodyProps = React.HTMLAttributes<HTMLDivElement>;

const KanbanBucketBody = React.forwardRef<HTMLDivElement, KanbanBucketBodyProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("kanban-scroll flex h-[240px] overflow-y-auto rounded-lg -mx-2", className)}
      {...props}
    >
      <div className="flex min-w-0 w-full flex-col gap-1.5 px-2">{children}</div>
    </div>
  )
);
KanbanBucketBody.displayName = "KanbanBucketBody";

const KanbanBucketEmpty = ({
  message = "Sin elementos",
  className,
}: {
  message?: string;
  className?: string;
}) => (
  <div
    className={cn(
      "flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200/80 bg-slate-50/70 px-2 py-3 text-center text-[9px] text-slate-400",
      className
    )}
  >
    {message}
  </div>
);

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
  bucketStates?: Partial<Record<K, KanbanBucketVisualState<TItem>>>;
  renderCard: (item: TItem, bucketKey: K) => React.ReactNode;
  bucketCollapsed?: Partial<Record<K, boolean>>;
  onToggleBucketCollapse?: (bucketKey: K) => void;
  bucketCollapseToggleVariant?: KanbanCollapseToggleProps["variant"];
  bucketCollapseToggleLabel?: string;
  bucketCollapseToggleClassName?: string;
  bucketCollapseToggleContent?: React.ReactNode;
  bucketCollapseToggleStopPropagation?: boolean;
  dragOverBucket?: K | null;
  draggedItem?: TItem | null;
  onCardDragStart?: (event: ReactDragEvent<HTMLDivElement>, item: TItem) => void;
  emptyMessage?: string;
  onBucketDragOver?: (event: ReactDragEvent<HTMLDivElement>, bucketKey: K) => void;
  onBucketDrop?: (event: ReactDragEvent<HTMLDivElement>, bucketKey: K) => void;
  onBucketDragLeave?: () => void;
  onLoadMore?: (bucketKey: K) => void;
}

export interface KanbanBucketNavigation {
  canPrev?: boolean;
  canNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  pageLabel?: React.ReactNode;
  summaryLabel?: React.ReactNode;
}

export const KanbanBucketsGrid = <TItem, K extends string>({
  className,
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
  draggedItem: _draggedItem,
  onCardDragStart,
  emptyMessage = "Sin elementos",
  onBucketDragOver,
  onBucketDrop,
  onBucketDragLeave,
  onLoadMore,
}: KanbanBucketsGridProps<TItem, K>) => (
  <div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-4", className)}>
    {bucketDefinitions.map(
      ({
        key,
        title,
        helper,
        accentClass,
        bucketClassName,
        interactive = true,
        headerContent,
      }) => {
      const items = bucketItems[key] ?? [];
      const bucketState = bucketStates?.[key];
      const isInteractive = interactive;
      const bodyClass = dragOverBucket === key ? "ring-1 ring-primary/40 bg-primary/5" : "";
      const isCollapsed = Boolean(bucketCollapsed?.[key]);
      const handleToggle = onToggleBucketCollapse ? () => onToggleBucketCollapse(key) : undefined;
      const showInitialLoading =
        Boolean(bucketState?.isLoadingInitial) && items.length === 0;
      const showErrorState = Boolean(bucketState?.error) && items.length === 0;
      const counterValue = bucketState?.total ?? items.length;
      return (
        <KanbanBucket key={key} accentClass={accentClass} className={bucketClassName}>
          <KanbanBucketHeader
            title={title}
            helper={helper}
            count={counterValue}
            headerContent={headerContent}
            collapsible={Boolean(onToggleBucketCollapse)}
            collapsed={isCollapsed}
            onToggleCollapse={handleToggle}
            collapseToggleVariant={bucketCollapseToggleVariant}
            collapseToggleLabel={bucketCollapseToggleLabel}
            collapseToggleClassName={bucketCollapseToggleClassName}
            collapseToggleContent={bucketCollapseToggleContent}
            collapseToggleStopPropagation={bucketCollapseToggleStopPropagation}
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
            {showInitialLoading ? (
              <KanbanBucketLoadingState message="Cargando columna..." />
            ) : showErrorState ? (
              <KanbanBucketErrorState message={bucketState?.error ?? "No se pudo cargar"} />
            ) : items.length === 0 ? (
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
          <KanbanBucketFooter
            loadedCount={bucketState?.loadedCount ?? items.length}
            total={bucketState?.total ?? items.length}
            hasMore={bucketState?.hasMore}
            isLoadingMore={bucketState?.isLoadingMore}
            error={items.length > 0 ? bucketState?.error : null}
            onLoadMore={onLoadMore ? () => onLoadMore(key) : undefined}
          />
        </KanbanBucket>
      );
    })}
  </div>
);
