"use client";

import type { ComponentProps } from "react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FormOrderPrintButtonProps = ComponentProps<typeof Button> & {
  label?: string;
};

export const FormOrderPrintButton = ({
  label = "Imprimir",
  className,
  onClick,
  ...rest
}: FormOrderPrintButtonProps) => {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn("h-7 px-2 text-[11px] sm:h-9 sm:px-4 sm:text-sm gap-1", className)}
      onClick={onClick ?? (() => window.print())}
      {...rest}
    >
      <Printer className="size-3 sm:size-4" />
      {label}
    </Button>
  );
};
