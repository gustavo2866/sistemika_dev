"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

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
  onClick?: () => void;
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
  onClick,
  header,
  title,
  body,
  actions = [],
  className,
  draggable,
  onDragStart,
  onDragEnd,
}: KanbanCardWithCollapseProps) => {
  const SINGLE_CLICK_DELAY_MS = 320;
  const clickTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (clickTimeoutRef.current !== null) {
        window.clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onClick) {
      return;
    }
    if (event.detail !== 1) {
      return;
    }

    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current);
    }

    clickTimeoutRef.current = window.setTimeout(() => {
      clickTimeoutRef.current = null;
      onClick();
    }, SINGLE_CLICK_DELAY_MS);
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    onToggleCollapse?.();
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm transition hover:border-slate-300 cursor-pointer focus-within:ring-2 focus-within:ring-primary/40",
        collapsed ? "py-1" : "",
        className
      )}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Header */}
      {header && (
        <div className="flex items-start justify-between gap-1">
          {header.left}
          {header.right}
        </div>
      )}

      {/* Body */}
      <div className="text-[8px] text-slate-600 space-y-0.5">
        <p className="text-[9px] font-semibold text-slate-900">{title}</p>
        {!collapsed && body}
      </div>

      {/* Actions */}
      {!collapsed && actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-0.5 pt-0.5 text-[4px] font-semibold text-slate-500">
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
        "flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm transition hover:border-slate-300",
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
  <div className={cn("flex items-start justify-between gap-1", className)} {...props} />
);

export const KanbanCardBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("text-[8px] text-slate-600 space-y-0.5", className)} {...props} />
);

export const KanbanCardFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-wrap items-center justify-end gap-0.5 pt-0.5", className)} {...props} />
);

export const KanbanCardTitle = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-[9px] font-semibold text-slate-900", className)} {...props} />
);

export const KanbanCardSubtitle = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-[7px] text-slate-500", className)} {...props} />
);

export type KanbanAvatarProps = {
  src?: string | null;
  alt?: string;
  fallback?: string;
  className?: string;
};

export const KanbanAvatar = ({ src, alt, fallback, className }: KanbanAvatarProps) => (
  <Avatar className={cn("size-4 border border-white shadow", className)}>
    {src ? <AvatarImage src={src} alt={alt} /> : null}
    <AvatarFallback className="bg-slate-200 text-[7px] font-semibold uppercase text-slate-600">
      {fallback}
    </AvatarFallback>
  </Avatar>
);

export const KanbanMeta = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-md bg-slate-50 px-1 py-0.5 text-[6px] text-slate-600 space-y-0.5", className)} {...props} />
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
  <div className={cn("flex items-center gap-1", className)}>
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
      "flex h-4 w-4 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
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
        "inline-flex h-[14px] min-w-[52px] items-center justify-center rounded-full px-1 py-0 text-[4px] font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {icon ? <span className="-mr-1 text-[7px]">{icon}</span> : null}
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
      "rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[6px] font-semibold uppercase tracking-wide text-slate-600",
      className
    )}
    {...props}
  />
);
