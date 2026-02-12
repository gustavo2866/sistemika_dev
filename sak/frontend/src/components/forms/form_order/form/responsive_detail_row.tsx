"use client";

import { forwardRef } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

type ResponsiveDetailRowProps = React.HTMLAttributes<HTMLDivElement> & {
  className?: string;
  children: React.ReactNode;
};

export const ResponsiveDetailRow = forwardRef<HTMLDivElement, ResponsiveDetailRowProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "group relative flex w-full flex-col gap-0 rounded-md border border-border p-1 pb-0.5 pr-1 " +
            "transition-colors hover:bg-muted/80 sm:pr-0 sm:border-0 sm:p-0",
          className,
        )}
        data-focus-scope="detail-row"
        {...props}
      >
        <div className="pointer-events-none absolute right-1 top-1/2 hidden -translate-y-1/2 items-center text-muted-foreground/70 opacity-0 transition-opacity group-hover:opacity-100 sm:flex">
          <Pencil className="h-3 w-3" />
        </div>
        {children}
      </div>
    );
  },
);
ResponsiveDetailRow.displayName = "ResponsiveDetailRow";
