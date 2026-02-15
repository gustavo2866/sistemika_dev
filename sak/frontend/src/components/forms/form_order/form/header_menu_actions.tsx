"use client";

import type { MouseEvent } from "react";
import { Eye, Trash2 } from "lucide-react";

import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export type FormOrderHeaderMenuActionsProps = {
  canPreview?: boolean;
  canDelete?: boolean;
  onPreview?: (event: MouseEvent) => void;
  onDelete?: () => void;
  previewLabel?: string;
  deleteLabel?: string;
};

const ITEM_CLASSNAME = "gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]";

// Items reutilizables para el menu de acciones de cabecera.
export const FormOrderHeaderMenuActions = ({
  canPreview = false,
  canDelete = false,
  onPreview,
  onDelete,
  previewLabel = "Preview",
  deleteLabel = "Eliminar",
}: FormOrderHeaderMenuActionsProps) => {
  if (!canPreview && !canDelete) return null;

  return (
    <>
      {canPreview ? (
        <DropdownMenuItem
          onClick={onPreview}
          className={ITEM_CLASSNAME}
        >
          <Eye className="h-3 w-3" />
          {previewLabel}
        </DropdownMenuItem>
      ) : null}
      {canDelete ? (
        <>
          {canPreview ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem
            onClick={() => onDelete?.()}
            className={ITEM_CLASSNAME}
            variant="destructive"
          >
            <Trash2 className="h-3 w-3" />
            {deleteLabel}
          </DropdownMenuItem>
        </>
      ) : null}
    </>
  );
};
