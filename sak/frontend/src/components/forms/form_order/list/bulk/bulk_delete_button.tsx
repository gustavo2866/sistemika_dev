import { Trash } from "lucide-react";
import { BulkDeleteButton } from "@/components/bulk-delete-button";
import { cn } from "@/lib/utils";

export const FormOrderBulkDeleteButton = ({
  className,
  ...props
}: React.ComponentProps<typeof BulkDeleteButton>) => {
  return (
    <BulkDeleteButton
      {...props}
      label="Eliminar"
      icon={<Trash className="h-3.5 w-3.5" />}
      className={cn("h-7 gap-1 px-2 text-[10px] sm:h-8 sm:text-[11px]", className)}
    />
  );
};

