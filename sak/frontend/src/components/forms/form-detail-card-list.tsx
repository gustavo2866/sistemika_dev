import { type ComponentType, type ReactNode } from "react";
import { DetailList } from "./detail-list";
import { useFormDetailSectionContext } from "./form-detail-section-context";

export interface FormDetailCardListProps<TDetail> {
  children: (item: TDetail, index: number) => ReactNode;
  emptyMessage?: string;
  EmptyIcon?: ComponentType<{ className?: string }>;
  keyExtractor?: (item: TDetail) => string | number;
  showEditAction?: boolean;
  showDeleteAction?: boolean;
  contentClassName?: string;
  gridClassName?: string;
  actionsClassName?: string;
  listClassName?: string;
  variant?: "card" | "row";
  actionsWrapperClassName?: string;
}

export function FormDetailCardList<TDetail>({
  children,
  emptyMessage,
  EmptyIcon,
  keyExtractor,
  showEditAction,
  showDeleteAction,
  contentClassName,
  gridClassName,
  actionsClassName,
  listClassName,
  variant,
  actionsWrapperClassName,
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
      renderItem={(item, index) => children(item, index)}
      onEdit={(_, index) => handleEditBySortedIndex(index)}
      onDelete={(_, index) => handleDeleteBySortedIndex(index)}
      emptyMessage={emptyMessage}
      EmptyIcon={EmptyIcon}
      showEditAction={showEditAction}
      showDeleteAction={showDeleteAction}
      contentClassName={contentClassName}
      gridClassName={gridClassName}
      actionsClassName={actionsClassName}
      listClassName={listClassName}
      variant={variant}
      actionsWrapperClassName={actionsWrapperClassName}
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
