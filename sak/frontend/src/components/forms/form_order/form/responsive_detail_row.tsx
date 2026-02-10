"use client";

import { cn } from "@/lib/utils";

export const ResponsiveDetailRow = ({
  className,
  onClick,
  children,
}: {
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  children: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-0 rounded-md border border-border p-1 pb-0.5 pr-1 " +
          "sm:pr-0 sm:border-0 sm:p-0",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
