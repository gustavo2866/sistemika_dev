"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, type ButtonProps } from "@/components/ui/button";

// ============================================================================
// Generic Kanban Card with Collapse Support
// ============================================================================

export interface KanbanCardAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "success" | "danger";
}

export interface KanbanCardWithCollapseProps {
  id?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  header?: {
    left?: React.ReactNode;
    right?: React.ReactNode;
  };
  title: React.ReactNode;
  body?: React.ReactNode;
  actions?: KanbanCardAction[];
  className?: string;
  draggable?: boolean;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
}

export const KanbanCardWithCollapse = ({
  collapsed = false,
  onToggleCollapse,
  header,
  title,
  body,
  actions = [],
  className,
  draggable,
  onDragStart,
  onDragEnd,
}: KanbanCardWithCollapseProps) => {
  const handleDoubleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onToggleCollapse?.();
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 cursor-pointer focus-within:ring-2 focus-within:ring-primary/40",
        collapsed ? "py-2" : "",
        className
      )}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDoubleClick={handleDoubleClick}
    >
      {/* Header */}
      {header && (
        <div className="flex items-start justify-between gap-2">
          {header.left}
          {header.right}
        </div>
      )}

      {/* Body */}
      <div className="text-xs text-slate-600 space-y-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {!collapsed && body}
      </div>

      {/* Actions */}
      {!collapsed && actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1 text-[8px] font-semibold text-slate-500">
          {actions.map((action, index) => (
            <KanbanActionButton
              key={index}
              icon={action.icon}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
              disabled={action.disabled}
              variant={action.variant}
            >
              {action.label}
            </KanbanActionButton>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Primitive Card Components (for custom implementations)
// ============================================================================

export type KanbanCardProps = React.HTMLAttributes<HTMLDivElement>;

export const KanbanCard = React.forwardRef<HTMLDivElement, KanbanCardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300",
        className
      )}
      {...props}
    />
  )
);
KanbanCard.displayName = "KanbanCard";

export const KanbanCardHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-start justify-between gap-2", className)} {...props} />
);

export const KanbanCardBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("text-xs text-slate-600 space-y-1", className)} {...props} />
);

export const KanbanCardFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-wrap items-center justify-end gap-1.5 pt-1", className)} {...props} />
);

export const KanbanCardTitle = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm font-semibold text-slate-900", className)} {...props} />
);

export const KanbanCardSubtitle = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-[11px] text-slate-500", className)} {...props} />
);

export type KanbanAvatarProps = {
  src?: string | null;
  alt?: string;
  fallback?: string;
  className?: string;
};

export const KanbanAvatar = ({ src, alt, fallback, className }: KanbanAvatarProps) => (
  <Avatar className={cn("size-6 border border-white shadow", className)}>
    {src ? <AvatarImage src={src} alt={alt} /> : null}
    <AvatarFallback className="bg-slate-200 text-[9px] font-semibold uppercase text-slate-600">
      {fallback}
    </AvatarFallback>
  </Avatar>
);

export const KanbanMeta = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-xl bg-slate-50 px-2 py-1.5 text-[10px] text-slate-600 space-y-0.5", className)} {...props} />
);

export const KanbanMetaRow = ({
  className,
  icon,
  children,
}: {
  className?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className={cn("flex items-center gap-1.5", className)}>
    {icon}
    <span className="truncate">{children}</span>
  </div>
);

export interface KanbanIconButtonProps {
  icon: React.ReactNode;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  "aria-label"?: string;
}

export const KanbanIconButton = ({ icon, className, ...props }: KanbanIconButtonProps) => (
  <Button
    type="button"
    size="sm"
    variant="ghost"
    className={cn(
      "flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
      className
    )}
    {...props}
  >
    {icon}
  </Button>
);

export interface KanbanActionButtonProps {
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  variant?: "default" | "success" | "danger";
}

export const KanbanActionButton = ({
  icon,
  className,
  children,
  variant = "default",
  ...props
}: KanbanActionButtonProps) => {
  const variantClasses = {
    default: "border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50",
    success: "border-emerald-300 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50",
    danger: "border-rose-300 text-rose-700 hover:border-rose-400 hover:bg-rose-50",
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        "inline-flex h-[18px] min-w-[72px] items-center justify-center rounded-full px-1.5 py-0 text-[8px] font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {icon ? <span className="-mr-1 text-xs">{icon}</span> : null}
      {children}
    </Button>
  );
};

export const KanbanBadge = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(
      "rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600",
      className
    )}
    {...props}
  />
);
