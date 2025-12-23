"use client";

import type { ReactNode } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { KanbanBucket, KanbanBucketEmpty, KanbanBucketHeader } from "@/components/kanban";
import { useKanbanMoveController } from "@/components/kanban";

export type AgendaRenderHelpers<TItem, K extends string> = {
  onMove: (item: TItem, bucket: K) => Promise<void>;
};

export type AgendaProps<TItem, K extends string> = {
  title?: string;
  dateLabel?: ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  onCreate?: () => void;
  createLabel?: string;
  className?: string;
  items: TItem[];
  emptyMessage?: string;
  renderItem: (item: TItem, helpers: AgendaRenderHelpers<TItem, K>) => ReactNode;
  onItemMove?: (item: TItem, bucket: K) => boolean | void | Promise<boolean | void>;
  canItemMove?: (item: TItem, bucket: K) => boolean | Promise<boolean>;
  onAfterMove?: (item: TItem, bucket: K) => void | Promise<void>;
  onMoveError?: (error: unknown, item: TItem, bucket: K) => void;
  getItemId?: (item: TItem) => string | number | null | undefined;
};

export const Agenda = <TItem, K extends string>({
  title = "Agenda",
  dateLabel,
  collapsed,
  onToggle,
  onCreate,
  createLabel = "Nuevo",
  className,
  items,
  emptyMessage = "Sin eventos",
  renderItem,
  onItemMove,
  canItemMove,
  onAfterMove,
  onMoveError,
  getItemId,
}: AgendaProps<TItem, K>) => {
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

  const helpers: AgendaRenderHelpers<TItem, K> = { onMove: handleItemMove };

  return (
    <KanbanBucket
      accentClass="from-white to-white"
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-4",
        collapsed ? "min-h-0 py-3" : "",
        className
      )}
    >
      <KanbanBucketHeader
        title={title}
        headerContent={
          <div className="flex items-center gap-2 sm:gap-3">
            <CalendarDays className="h-7 w-7 text-slate-600 sm:h-9 sm:w-9" />
            <span className="text-[10px] text-slate-500 sm:text-xs">{dateLabel}</span>
          </div>
        }
        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-slate-50 sm:px-3"
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
        collapsible
        collapsed={collapsed}
        onToggleCollapse={onToggle}
        collapseToggleVariant="icon"
        collapseToggleLabel="Expandir agenda"
        collapseToggleClassName="!rounded-md !border-slate-200 !bg-white !px-2 !py-1 !text-[10px] !text-slate-500 !shadow-none hover:!bg-slate-50 sm:!px-2.5 sm:!py-1.5 sm:!text-xs"
        collapseToggleContent={
          collapsed ? (
            <ChevronDown className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
          ) : (
            <ChevronUp className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
          )
        }
        collapseToggleStopPropagation
      >
        {onCreate ? (
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-500 px-2 py-1 text-[10px] font-semibold text-white shadow-sm sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onCreate();
            }}
          >
            <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            {createLabel}
          </button>
        ) : null}
      </KanbanBucketHeader>
      {collapsed ? null : (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          {items.length === 0 ? (
            <KanbanBucketEmpty message={emptyMessage} />
          ) : (
            items.map((item, index) => (
              <div key={(getItemId?.(item) ?? index) as string | number}>
                {renderItem(item, helpers)}
              </div>
            ))
          )}
        </div>
      )}
    </KanbanBucket>
  );
};
