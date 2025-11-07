import { EmptyState } from "./empty-state";
import { DetailItemCard } from "./detail-item-card";
import { type ReactNode, type ComponentType } from "react";

interface DetailListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  onEdit?: (item: T, index: number) => void;
  onDelete?: (item: T, index: number) => void;
  emptyMessage?: string;
  EmptyIcon?: ComponentType<{ className?: string }>;
  keyExtractor?: (item: T, index: number) => string | number;
}

export function DetailList<T>({
  items,
  renderItem,
  onEdit,
  onDelete,
  emptyMessage = "No hay items para mostrar.",
  EmptyIcon,
  keyExtractor = (_item, index) => index,
}: DetailListProps<T>) {
  if (items.length === 0) {
    return <EmptyState message={emptyMessage} Icon={EmptyIcon} />;
  }

  return (
    <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
      {items.map((item, index) => (
        <DetailItemCard
          key={keyExtractor(item, index)}
          onEdit={onEdit ? () => onEdit(item, index) : undefined}
          onDelete={onDelete ? () => onDelete(item, index) : undefined}
        >
          {renderItem(item, index)}
        </DetailItemCard>
      ))}
    </div>
  );
}
