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
      className={cn(
        "h-4 w-4 md:h-5 md:w-5 text-primary bg-primary/10 border border-primary/30 shadow-sm " +
          "hover:bg-primary/15 hover:text-primary focus-visible:ring-1 focus-visible:ring-primary",
        className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      aria-label={label}
      title={label}
      tabIndex={tabIndex}
    >
      <Check className={cn("size-3 md:size-3.5", iconClassName)} />
    </Button>
  );
};
