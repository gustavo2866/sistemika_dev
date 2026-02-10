"use client";

import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const DetailToggleButton = ({
  show,
  onToggle,
  className,
  iconClassName,
  tabIndex = 0,
  label = "actualizar",
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
      className={cn("h-4 w-4 md:h-5 md:w-5 text-muted-foreground", className)}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      aria-label={label}
      title={label}
      tabIndex={tabIndex}
    >
      <Check className={cn("size-2.5 md:size-3", iconClassName)} />
    </Button>
  );
};
