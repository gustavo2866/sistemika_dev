import { type ButtonHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FormActionsMenuButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
};

export const FormActionsMenuButton = ({
  className,
  ...props
}: FormActionsMenuButtonProps) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    className={cn(
      "h-6 w-6 border border-muted/60 bg-muted/40 hover:bg-muted/60",
      className
    )}
    {...props}
  />
);
