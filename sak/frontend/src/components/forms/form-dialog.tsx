import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  contentClassName?: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  showFooter?: boolean;
  compact?: boolean;
}

export const FormDialog = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  contentClassName,
  onSubmit,
  onCancel,
  submitLabel = "Guardar",
  isSubmitting = false,
  submitDisabled = false,
  showFooter = true,
  compact = false,
}: FormDialogProps) => {
  const baseContentClassName = compact ? "p-4 gap-3 sm:max-w-md" : "sm:max-w-lg";
  const headerClassName = compact ? "gap-1" : undefined;
  const titleClassName = compact ? "text-base" : undefined;
  const descriptionClassName = compact ? "text-xs" : undefined;
  const formClassName = compact ? "space-y-3" : "space-y-4";
  const footerClassName = compact
    ? "flex flex-col gap-1 sm:flex-row sm:justify-end"
    : "flex flex-col gap-2 sm:flex-row sm:justify-end";
  const buttonClassName = compact ? "h-8 text-xs" : undefined;
  const buttonSize = compact ? "sm" : undefined;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(baseContentClassName, contentClassName)}>
        <DialogHeader className={headerClassName}>
          <DialogTitle className={titleClassName}>{title}</DialogTitle>
          {description && (
            <DialogDescription className={descriptionClassName}>
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={onSubmit} className={formClassName}>
          {children}
          {showFooter && (
            <DialogFooter className={footerClassName}>
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                className={cn("w-full sm:w-auto", buttonClassName)}
                size={buttonSize}
                tabIndex={-1}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className={cn("w-full sm:w-auto", buttonClassName)}
                size={buttonSize}
                tabIndex={0}
                disabled={isSubmitting || submitDisabled}
              >
                {submitLabel}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};
