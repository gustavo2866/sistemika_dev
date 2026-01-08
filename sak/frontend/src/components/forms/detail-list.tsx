import { EmptyState } from "./empty-state";
import { DetailItemCard } from "./detail-item-card";
import { DetailItemRow } from "./detail-item-row";
import { type ReactNode, type ComponentType } from "react";
import { cn } from "@/lib/utils";

interface DetailListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  onEdit?: (item: T, index: number) => void;
  onDelete?: (item: T, index: number) => void;
  emptyMessage?: string;
  EmptyIcon?: ComponentType<{ className?: string }>;
  keyExtractor?: (item: T, index: number) => string | number;
  showEditAction?: boolean;
  showDeleteAction?: boolean;
  contentClassName?: string;
  gridClassName?: string;
  actionsClassName?: string;
  listClassName?: string;
  variant?: "card" | "row";
  actionsWrapperClassName?: string;
}

export function DetailList<T>({
  items,
  renderItem,
  onEdit,
  onDelete,
  emptyMessage = "No hay items para mostrar.",
  EmptyIcon,
  keyExtractor = (_item, index) => index,
  showEditAction = true,
  showDeleteAction = true,
  contentClassName,
  gridClassName,
  actionsClassName,
  listClassName,
  variant = "card",
  actionsWrapperClassName,
}: DetailListProps<T>) {
  if (items.length === 0) {
    return <EmptyState message={emptyMessage} Icon={EmptyIcon} />;
  }

  const ItemComponent = variant === "row" ? DetailItemRow : DetailItemCard;

  return (
    <div
      className={cn(
        "max-h-[70vh] space-y-3 overflow-y-auto pr-1",
        listClassName
      )}
    >
      {items.map((item, index) => (
        <ItemComponent
          key={keyExtractor(item, index)}
          onEdit={onEdit ? () => onEdit(item, index) : undefined}
          onDelete={onDelete ? () => onDelete(item, index) : undefined}
          showEditAction={showEditAction}
          showDeleteAction={showDeleteAction}
          contentClassName={contentClassName}
          gridClassName={gridClassName}
          actionsClassName={actionsClassName}
          actionsWrapperClassName={actionsWrapperClassName}
        >
          {renderItem(item, index)}
        </ItemComponent>
      ))}
    </div>
  );
}
