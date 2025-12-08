"use client";

import * as React from "react";
import { Expand, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KanbanCollapseToggleProps {
  collapsed: boolean;
  onToggle: () => void;
  variant?: "icon" | "pill";
  className?: string;
  children?: React.ReactNode;
  label?: string;
}

export const KanbanCollapseToggle = ({
  collapsed,
  onToggle,
  variant = "icon",
  className,
  children,
  label,
}: KanbanCollapseToggleProps) => {
  const computedLabel = label ?? (collapsed ? "Expandir tarjetas" : "Contraer tarjetas");
  const baseClass =
    variant === "icon"
      ? "h-8 w-8 rounded-full"
      : "h-8 rounded-full px-4 text-xs font-semibold uppercase tracking-wide";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={computedLabel}
      title={computedLabel}
      className={cn(
        "inline-flex items-center justify-center border border-slate-300 bg-white/80 text-slate-600 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        baseClass,
        className,
      )}
    >
      {children ?? (collapsed ? <Expand className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />)}
    </button>
  );
};
