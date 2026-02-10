"use client";

import type { MouseEvent } from "react";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

export const DetailInfoButton = ({
  onClick,
  className,
  iconClassName,
  label = "Mostrar datos",
  tabIndex = -1,
}: {
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  iconClassName?: string;
  label?: string;
  tabIndex?: number;
}) => {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center h-4 w-4 md:h-5 md:w-5 text-blue-600 hover:text-blue-700",
        className,
      )}
      onClick={onClick}
      aria-label={label}
      title={label}
      tabIndex={tabIndex}
    >
      <Info className={cn("size-2.5 md:size-3", iconClassName)} />
    </button>
  );
};
