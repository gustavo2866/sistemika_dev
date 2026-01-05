import type { FormFieldError } from "@/components/forms/form-field";
import { FormField } from "@/components/forms/form-field";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface CompactFormFieldProps {
  label: string;
  error?: FormFieldError;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}

export const CompactFormField = ({
  className,
  ...props
}: CompactFormFieldProps) => {
  return <FormField {...props} className={cn("space-y-1", className)} />;
};
