import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

export type ListLabelProps = PropsWithChildren<{
  className?: string;
}>;

export const ListLabel = ({ className, children }: ListLabelProps) => {
  return (
    <span className={cn("text-[10px] font-semibold text-foreground", className)}>
      {children}
    </span>
  );
};
