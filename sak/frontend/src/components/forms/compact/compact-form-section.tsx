import { cn } from "@/lib/utils";
import { FormSimpleSection } from "@/components/forms/form-simple-section";
import type { ReactNode } from "react";

interface CompactFormSectionProps {
  children: ReactNode;
  className?: string;
}

export const CompactFormSection = ({
  children,
  className,
}: CompactFormSectionProps) => {
  return (
    <FormSimpleSection className={cn("space-y-3 sm:space-y-4", className)}>
      {children}
    </FormSimpleSection>
  );
};
