import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DetailItemRowProps {
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
  showEditAction?: boolean;
  showDeleteAction?: boolean;
  contentClassName?: string;
  gridClassName?: string;
  actionsClassName?: string;
  rowClassName?: string;
  actionsWrapperClassName?: string;
}

export const DetailItemRow = ({
  children,
  onEdit,
  onDelete,
  onClick,
  showEditAction = true,
  showDeleteAction = true,
  contentClassName,
  gridClassName,
  actionsClassName,
  rowClassName,
  actionsWrapperClassName,
}: DetailItemRowProps) => {
  const showEdit = Boolean(onEdit && showEditAction);
  const showDelete = Boolean(onDelete && showDeleteAction);
  const showActions = showEdit || showDelete;

  return (
    <div
      className={cn(
        "cursor-pointer rounded-md border border-border/70 bg-background/80 transition-colors hover:bg-muted/40",
        rowClassName
      )}
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
      <div className={cn("px-2 py-1", contentClassName)}>
        <div
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-2",
            gridClassName
          )}
        >
          <div className="min-w-0">{children}</div>
          {showActions && (
            <div className={cn("flex items-center gap-2", actionsWrapperClassName)}>
              {showEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-6 w-6", actionsClassName)}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit?.();
                  }}
                  aria-label="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {showDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive",
                    actionsClassName
                  )}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete?.();
                  }}
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
