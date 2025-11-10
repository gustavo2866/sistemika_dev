import { Label } from "@/components/ui/label";
import { type ReactNode } from "react";

export type FormFieldError =
  | string
  | { message?: string | undefined | null }
  | null
  | undefined;

interface FormFieldProps {
  label: string;
  error?: FormFieldError;
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
  const resolveErrorMessage = (err: FormFieldError) => {
    if (!err) return undefined;
    if (typeof err === "string") return err;
    const maybeMessage =
      typeof err === "object" && err !== null ? err.message : undefined;
    return typeof maybeMessage === "string" ? maybeMessage : undefined;
  };

  const resolvedError = resolveErrorMessage(error);

  return (
    <div className={className || "space-y-2"}>
      <Label htmlFor={htmlFor} className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {resolvedError && (
        <p className="text-sm text-destructive">{resolvedError}</p>
      )}
    </div>
  );
};
