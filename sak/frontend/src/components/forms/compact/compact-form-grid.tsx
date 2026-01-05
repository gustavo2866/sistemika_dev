import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type CompactGridColumns = "one" | "two" | "three";

interface CompactFormGridProps {
  children: ReactNode;
  columns?: CompactGridColumns;
  className?: string;
  style?: React.CSSProperties;
}

const columnClasses: Record<CompactGridColumns, string> = {
  one: "grid grid-cols-1 gap-3 sm:gap-4",
  two: "grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2",
  three: "grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3",
};

export const CompactFormGrid = ({
  children,
  columns = "one",
  className,
  style,
}: CompactFormGridProps) => {
  return (
    <div className={cn(columnClasses[columns], className)} style={style}>
      {children}
    </div>
  );
};
