"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const DetalleToggleButton = ({
  show,
  onToggle,
  className,
  iconClassName,
  tabIndex = -1,
  label = "detalle",
}: {
  show: boolean;
  onToggle: () => void;
  className?: string;
  iconClassName?: string;
  tabIndex?: number;
  label?: string;
}) => {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-6 w-6 text-muted-foreground", className)}
      onClick={onToggle}
      aria-label={show ? `Ocultar ${label}` : `Mostrar ${label}`}
      title={show ? `Ocultar ${label}` : `Mostrar ${label}`}
      tabIndex={tabIndex}
    >
      {show ? (
        <ChevronUp className={cn("h-4 w-4", iconClassName)} />
      ) : (
        <ChevronDown className={cn("h-4 w-4", iconClassName)} />
      )}
    </Button>
  );
};

