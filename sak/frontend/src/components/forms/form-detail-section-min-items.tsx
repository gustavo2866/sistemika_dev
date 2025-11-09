import { MinItemsValidation } from "./min-items-validation";
import { useFormDetailSectionContext } from "./form-detail-section-context";

interface FormDetailSectionMinItemsProps {
  itemName?: string;
}

export const FormDetailSectionMinItems = ({
  itemName = "item",
}: FormDetailSectionMinItemsProps) => {
  const { minItems, sortedEntries } = useFormDetailSectionContext();

  if (!minItems || minItems <= 0) {
    return null;
  }

  return (
    <MinItemsValidation
      currentCount={sortedEntries.length}
      minItems={minItems}
      itemName={itemName}
    />
  );
};
