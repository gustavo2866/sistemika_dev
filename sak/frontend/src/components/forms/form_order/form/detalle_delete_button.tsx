"use client";

import { XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const DetalleDeleteButton = ({
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
      className={cn("h-6 w-6", className)}
      onClick={onClick}
      aria-label={title}
      title={title}
      tabIndex={tabIndex}
    >
      <XCircle className={cn("h-4 w-4", iconClassName)} />
    </Button>
  );
};

