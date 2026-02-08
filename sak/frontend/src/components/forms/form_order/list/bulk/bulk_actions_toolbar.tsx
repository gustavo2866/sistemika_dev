import type { ReactNode } from "react";
import { useListContext } from "ra-core";
import { X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FormOrderBulkDeleteButton } from "./bulk_delete_button";
import { FormOrderBulkExportButton } from "./bulk_export_button";

const countLabel = (count: number) => `${count} seleccionadas`;

export const FormOrderBulkActionsToolbar = ({
  children = (
    <>
      <FormOrderBulkExportButton />
      <FormOrderBulkDeleteButton />
    </>
  ),
  className,
}: {
  children?: ReactNode;
  className?: string;
}) => {
  const { selectedIds, onUnselectItems } = useListContext();
  if (!selectedIds?.length) {
    return null;
  }
  const handleUnselectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUnselectItems();
  };

  return (
    <Card
      className={cn(
        "relative flex flex-nowrap items-center gap-2 rounded-lg border bg-zinc-100/95 p-1.5 px-2 shadow-sm dark:bg-zinc-900/95 sm:p-2 sm:px-3",
        "fixed top-24 left-1/2 z-10 w-auto -translate-x-1/2",
        className
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-1.5 top-1.5 h-5 w-5 sm:right-2 sm:top-2 sm:h-6 sm:w-6"
        onClick={handleUnselectAll}
        aria-label="Quitar seleccion"
      >
        <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
      </Button>
      <div className="flex items-center gap-1.5 pr-7 sm:gap-2 sm:pr-8">
        <span className="text-[9px] text-muted-foreground sm:text-[11px]">
          {countLabel(selectedIds.length)}
        </span>
        <div className="flex items-center gap-1.5 sm:gap-2">{children}</div>
      </div>
    </Card>
  );
};
