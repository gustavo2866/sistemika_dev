import { type ComponentType, type ReactNode } from "react";
import { DetailList } from "./detail-list";
import { useFormDetailSectionContext } from "./form-detail-section-context";

export interface FormDetailCardListProps<TDetail> {
  children: (item: TDetail) => ReactNode;
  emptyMessage?: string;
  EmptyIcon?: ComponentType<{ className?: string }>;
  keyExtractor?: (item: TDetail) => string | number;
}

export function FormDetailCardList<TDetail>({
  children,
  emptyMessage,
  EmptyIcon,
  keyExtractor,
}: FormDetailCardListProps<TDetail>) {
  const {
    sortedEntries,
    handleEditBySortedIndex,
    handleDeleteBySortedIndex,
  } = useFormDetailSectionContext<any, TDetail>();

  const items = sortedEntries.map((entry) => entry.item);

  return (
    <DetailList
      items={items}
      renderItem={(item) => children(item)}
      onEdit={(_, index) => handleEditBySortedIndex(index)}
      onDelete={(_, index) => handleDeleteBySortedIndex(index)}
      emptyMessage={emptyMessage}
      EmptyIcon={EmptyIcon}
      keyExtractor={(item, index) =>
        keyExtractor
          ? keyExtractor(item)
          : String(
              (item as any)?.id ??
                (item as any)?.tempId ??
                `${sortedEntries[index]?.originalIndex ?? index}-${index}`
            )
      }
    />
  );
}
