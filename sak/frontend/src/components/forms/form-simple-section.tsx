import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormSimpleSectionProps {
  children: ReactNode;
  /**
   * Espaciado interno opcional para mantener consistencia visual
   */
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
}

const paddingClasses: Record<NonNullable<FormSimpleSectionProps["padding"]>, string> = {
  none: "",
  sm: "space-y-2",
  md: "space-y-4",
  lg: "space-y-6",
};

export const FormSimpleSection = ({
  children,
  padding = "md",
  className,
}: FormSimpleSectionProps) => {
  return <div className={cn(paddingClasses[padding], className)}>{children}</div>;
};
