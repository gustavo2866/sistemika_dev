"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const DetailDeleteButton = ({
  onClick,
  className,
  iconClassName,
  title = "Eliminar linea",
  tabIndex = -1,
}: {
  onClick: () => void;
  className?: string;
  iconClassName?: string;
  title?: string;
  tabIndex?: number;
}) => {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-4 w-4 md:h-5 md:w-5", className)}
      onClick={onClick}
      aria-label={title}
      title={title}
      tabIndex={tabIndex}
    >
      <Trash2 className={cn("size-2.5 md:size-3 text-red-500/70", iconClassName)} />
    </Button>
  );
};
