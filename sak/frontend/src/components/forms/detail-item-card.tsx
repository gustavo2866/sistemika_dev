import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { type ReactNode } from "react";

interface DetailItemCardProps {
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
}

export const DetailItemCard = ({
  children,
  onEdit,
  onDelete,
  onClick,
}: DetailItemCardProps) => {
  return (
    <Card
      className="cursor-pointer border-border/70 transition-shadow hover:shadow-sm"
      onClick={onClick || onEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          (onClick || onEdit)?.();
        }
      }}
    >
      <CardContent className="p-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-3">
          <div className="min-w-0">{children}</div>
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              aria-label="Editar"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              aria-label="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
