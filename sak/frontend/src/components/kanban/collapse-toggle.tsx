"use client";

import * as React from "react";
import { Expand, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KanbanCollapseToggleProps {
  collapsed: boolean;
  onToggle: () => void;
  variant?: "icon" | "pill" | "icon-with-label";
  className?: string;
  children?: React.ReactNode;
  label?: string;
  stopPropagation?: boolean;
}

export const KanbanCollapseToggle = ({
  collapsed,
  onToggle,
  variant = "icon",
  className,
  children,
  label,
  stopPropagation = false,
}: KanbanCollapseToggleProps) => {
  const computedLabel = label ?? (collapsed ? "Expandir tarjetas" : "Contraer tarjetas");
  const baseClass =
    variant === "icon"
      ? "h-8 w-8 rounded-full"
      : variant === "pill"
      ? "h-8 rounded-full px-4 text-xs font-semibold uppercase tracking-wide"
      : "";

  if (variant === "icon-with-label") {
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (stopPropagation) {
        event.stopPropagation();
      }
      onToggle();
    };

    return (
        <button
          type="button"
          onClick={handleClick}
          aria-label={computedLabel}
          className={cn(
          "inline-flex flex-col items-center justify-center gap-0.5 transition hover:opacity-80 shrink-0",
          className,
        )}
      >
        <div className="h-8 w-8 rounded-full border border-slate-300 bg-white/80 text-slate-600 shadow-sm flex items-center justify-center hover:bg-slate-100">
          {collapsed ? <Expand className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
        </div>
        <span className="text-[9px] text-slate-500 font-medium">
          {collapsed ? "Expandir" : "Contraer"}
        </span>
      </button>
    );
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) {
      event.stopPropagation();
    }
    onToggle();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={computedLabel}
      title={computedLabel}
      className={cn(
        "inline-flex items-center justify-center border border-slate-300 bg-white/80 text-slate-600 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 shrink-0",
        baseClass,
        className,
      )}
    >
      {children ?? (collapsed ? <Expand className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />)}
    </button>
  );
};
