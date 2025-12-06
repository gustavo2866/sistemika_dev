"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface KanbanBucketProps extends React.HTMLAttributes<HTMLDivElement> {
  accentClass?: string;
}

export const KanbanBucket = React.forwardRef<HTMLDivElement, KanbanBucketProps>(
  ({ className, accentClass, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex min-h-[320px] flex-col gap-3 rounded-3xl border border-slate-200/70 bg-gradient-to-b p-4 shadow-inner",
        accentClass,
        className
      )}
      {...props}
    />
  )
);
KanbanBucket.displayName = "KanbanBucket";

export interface KanbanBucketHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  helper?: string;
  count?: number;
}

export const KanbanBucketHeader = ({
  title,
  helper,
  count,
  className,
  children,
  ...props
}: KanbanBucketHeaderProps) => (
  <div className={cn("flex items-center justify-between gap-2", className)} {...props}>
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-600">{title}</p>
      {helper ? <p className="text-xs text-slate-500">{helper}</p> : null}
    </div>
    {children ?? <KanbanBucketCounter value={count ?? 0} />}
  </div>
);

export const KanbanBucketCounter = ({
  value,
  className,
}: {
  value: number | string;
  className?: string;
}) => (
  <Badge
    variant="outline"
    className={cn(
      "rounded-full border-slate-200/80 px-3 py-1 text-xs font-semibold",
      className
    )}
  >
    {value}
  </Badge>
);

export interface KanbanBucketBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

export const KanbanBucketBody = React.forwardRef<HTMLDivElement, KanbanBucketBodyProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-1 flex-col gap-3 max-h-[380px] overflow-y-auto pr-1 rounded-2xl", className)}
      {...props}
    />
  )
);
KanbanBucketBody.displayName = "KanbanBucketBody";

export const KanbanBucketEmpty = ({
  message = "Sin elementos",
  className,
}: {
  message?: string;
  className?: string;
}) => (
  <div
    className={cn(
      "flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/70 px-3 py-6 text-center text-xs text-slate-400",
      className
    )}
  >
    {message}
  </div>
);
