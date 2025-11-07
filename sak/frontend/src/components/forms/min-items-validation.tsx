import { AlertCircle } from "lucide-react";

interface MinItemsValidationProps {
  currentCount: number;
  minItems: number;
  itemName?: string;
}

export const MinItemsValidation = ({
  currentCount,
  minItems,
  itemName = "item",
}: MinItemsValidationProps) => {
  if (minItems <= 0 || currentCount >= minItems) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" />
      <span>
        Debes agregar al menos {minItems} {itemName}
        {minItems > 1 ? "s" : ""}
      </span>
    </div>
  );
};
