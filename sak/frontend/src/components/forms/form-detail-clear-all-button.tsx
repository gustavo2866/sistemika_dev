import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useFormDetailSectionContext } from "./form-detail-section-context";

interface FormDetailClearAllButtonProps {
  children?: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  confirmMessage?: string;
}

export const FormDetailClearAllButton = ({
  children,
  variant = "outline",
  size = "sm",
  className,
  confirmMessage = "¿Seguro que deseas eliminar todos los elementos?",
}: FormDetailClearAllButtonProps) => {
  const { items, handleClearAll } = useFormDetailSectionContext();

  const handleClick = () => {
    if (items.length === 0) return;

    const confirmed = window.confirm(confirmMessage);
    if (confirmed) {
      handleClearAll();
    }
  };

  if (items.length === 0) {
    return null; // No mostrar el botón si no hay elementos
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
    >
      <Trash2 className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5" />
      {children || "Limpiar todo"}
    </Button>
  );
};
