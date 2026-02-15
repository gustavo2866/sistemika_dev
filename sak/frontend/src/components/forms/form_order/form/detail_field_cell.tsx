"use client";

import { cn } from "@/lib/utils";

export type DetailFieldCellProps = React.HTMLAttributes<HTMLDivElement> & {
  label?: string;
  desktopOnly?: boolean;
  mobileOnly?: boolean;
};

// Celda estandar para campos del detalle con etiqueta mobile opcional.
export const DetailFieldCell = ({
  label,
  desktopOnly = false,
  mobileOnly = false,
  className,
  children,
  ...rest
}: DetailFieldCellProps) => {
  const visibilityClass = desktopOnly
    ? "hidden sm:flex"
    : mobileOnly
    ? "sm:hidden"
    : "flex";

  return (
    <div className={cn(visibilityClass, "flex-col gap-0.5", className)} {...rest}>
      {label ? (
        <div className="sm:hidden text-[8px] font-semibold text-muted-foreground leading-none">
          {label}
        </div>
      ) : null}
      {children}
    </div>
  );
};
