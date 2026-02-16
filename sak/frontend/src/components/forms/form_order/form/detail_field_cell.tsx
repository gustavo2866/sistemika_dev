"use client";

import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DetailFieldCellProps = React.HTMLAttributes<HTMLDivElement> & {
  label?: string;
  desktopOnly?: boolean;
  mobileOnly?: boolean;
  colIndex?: number;
};

type DetailFieldIndexContextValue = {
  nextIndex: () => number;
  mobileSpans?: Array<number | "full" | undefined>;
};

const DetailFieldIndexContext = createContext<DetailFieldIndexContextValue | null>(null);

export const DetailFieldIndexProvider = ({
  children,
  mobileSpans,
}: {
  children: ReactNode;
  mobileSpans?: Array<number | "full" | undefined>;
}) => {
  const indexRef = useRef(0);
  const nextIndex = useCallback(() => {
    indexRef.current += 1;
    return indexRef.current;
  }, []);

  return (
    <DetailFieldIndexContext.Provider value={{ nextIndex, mobileSpans }}>
      {children}
    </DetailFieldIndexContext.Provider>
  );
};

const useDetailFieldIndex = () => useContext(DetailFieldIndexContext);

// Celda estandar para campos del detalle con etiqueta mobile opcional.
export const DetailFieldCell = ({
  label,
  desktopOnly = false,
  mobileOnly = false,
  colIndex,
  className,
  style,
  children,
  ...rest
}: DetailFieldCellProps) => {
  const context = useDetailFieldIndex();
  const nextIndex = context?.nextIndex;
  const indexRef = useRef<number | undefined>(colIndex);
  if (indexRef.current == null && nextIndex) {
    indexRef.current = nextIndex();
  }
  const mobileSpan =
    indexRef.current != null ? context?.mobileSpans?.[indexRef.current - 1] : undefined;
  const mobileGridColumn = mobileSpan
    ? mobileSpan === "full"
      ? "1 / -1"
      : `span ${mobileSpan} / span ${mobileSpan}`
    : undefined;

  const visibilityClass = desktopOnly
    ? "hidden sm:flex"
    : mobileOnly
    ? "sm:hidden"
    : "flex";

  return (
    <div
      className={cn(
        visibilityClass,
        "flex-col gap-0.5",
        mobileGridColumn && "[grid-column:var(--detail-mobile-col)] sm:[grid-column:auto]",
        className,
      )}
      data-detail-col={indexRef.current}
      style={
        mobileGridColumn
          ? { ...style, ["--detail-mobile-col" as any]: mobileGridColumn }
          : style
      }
      {...rest}
    >
      {label ? (
        <div className="sm:hidden text-[8px] font-semibold text-muted-foreground leading-none">
          {label}
        </div>
      ) : null}
      {children}
    </div>
  );
};
