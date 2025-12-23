"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { KanbanBucketHeader } from "./bucket";

type IconType = React.ComponentType<{ className?: string }>;

export type KanbanBucketHeaderCardProps = {
  title: string;
  subtitle?: string;
  icon: IconType;
  iconWrapperClassName?: string;
  iconClassName?: string;
  badgeClassName?: string;
  countBadge?: number | null;
  collapsed?: boolean;
  onToggle?: () => void;
  rightSlot?: React.ReactNode;
  className?: string;
};

export const KanbanBucketHeaderCard = ({
  title,
  subtitle,
  icon: Icon,
  iconWrapperClassName,
  iconClassName,
  badgeClassName,
  countBadge,
  collapsed,
  onToggle,
  rightSlot,
  className,
}: KanbanBucketHeaderCardProps) => {
  const showToggle = Boolean(onToggle);
  return (
    <KanbanBucketHeader
      title={title}
      headerContent={
        <div className="flex items-center gap-2 sm:gap-3">
          <span
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded-lg text-white sm:h-7 sm:w-7",
              iconWrapperClassName
            )}
          >
            <Icon className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", iconClassName)} />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-slate-900 sm:text-sm">{title}</p>
            {subtitle ? <p className="text-[10px] text-slate-500 sm:text-xs">{subtitle}</p> : null}
          </div>
        </div>
      }
      onClick={onToggle}
      className={cn(
        "flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-slate-50",
        className
      )}
      role={showToggle ? "button" : undefined}
      tabIndex={showToggle ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onToggle) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
    >
      {rightSlot ?? (
        <div className="flex items-center gap-2">
          {typeof countBadge === "number" ? (
            <span
              className={cn(
                "inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-semibold text-white sm:h-5 sm:min-w-[20px] sm:px-1.5 sm:text-[11px]",
                badgeClassName
              )}
            >
              {countBadge}
            </span>
          ) : null}
          {showToggle ? (
            collapsed ? (
              <ChevronDown className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
            ) : (
              <ChevronUp className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
            )
          ) : null}
        </div>
      )}
    </KanbanBucketHeader>
  );
};
