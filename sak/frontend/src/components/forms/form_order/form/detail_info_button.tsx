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
  active = false,
}: {
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  iconClassName?: string;
  label?: string;
  tabIndex?: number;
  active?: boolean;
}) => {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-full leading-none transition h-4 w-4 md:h-5 md:w-5",
        active
          ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]"
          : "text-blue-600 hover:text-blue-700 hover:bg-blue-50/60",
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
