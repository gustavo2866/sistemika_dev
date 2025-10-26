"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Trash2 } from "lucide-react";

type DetailEditorFooterProps = {
  onClose: () => void;
  onSubmit: () => void;
  onDelete?: () => void;
  closeLabel?: string;
  submitLabel?: string;
  deleteLabel?: string;
  showDelete?: boolean;
};

export const DetailEditorFooter = ({
  onClose,
  onSubmit,
  onDelete,
  closeLabel = "Volver",
  submitLabel = "Aceptar",
  deleteLabel = "Eliminar",
  showDelete = true,
}: DetailEditorFooterProps) => {
  return (
    <div className="flex justify-between pt-4">
      <Button
        type="button"
        variant="ghost"
        onClick={onClose}
        className="gap-2 px-6"
        tabIndex={-1}
      >
        <ArrowLeft className="h-4 w-4" />
        {closeLabel}
      </Button>
      <div className="flex gap-2">
        {showDelete && onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-destructive gap-2"
            tabIndex={-1}
          >
            <Trash2 className="h-4 w-4" />
            {deleteLabel}
          </Button>
        ) : null}
        <Button type="button" onClick={onSubmit} className="gap-2 px-6">
          <Save className="h-4 w-4" />
          {submitLabel}
        </Button>
      </div>
    </div>
  );
};
