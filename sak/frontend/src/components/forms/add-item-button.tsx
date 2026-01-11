import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { forwardRef } from "react";

interface AddItemButtonProps {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const AddItemButton = forwardRef<HTMLButtonElement, AddItemButtonProps>(
  ({ onClick, label = "Agregar item", disabled, className }, ref) => {
    return (
      <Button
        ref={ref}
        type="button"
        onClick={onClick}
        className={className || "mt-3 w-full"}
        disabled={disabled}
      >
        <Plus className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5" />
        {label}
      </Button>
    );
  }
);

AddItemButton.displayName = "AddItemButton";
