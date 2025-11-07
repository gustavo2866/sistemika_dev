import { Label } from "@/components/ui/label";
import { type ReactNode } from "react";

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}

export const FormField = ({
  label,
  error,
  required,
  children,
  htmlFor,
  className,
}: FormFieldProps) => {
  return (
    <div className={className || "space-y-2"}>
      <Label htmlFor={htmlFor} className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};
