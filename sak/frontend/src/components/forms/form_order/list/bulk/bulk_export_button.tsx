import { Download } from "lucide-react";
import { BulkExportButton } from "@/components/bulk-export-button";
import { cn } from "@/lib/utils";

export const FormOrderBulkExportButton = ({
  className,
  ...props
}: React.ComponentProps<typeof BulkExportButton>) => {
  return (
    <BulkExportButton
      {...props}
      label="Exportar"
      icon={<Download className="h-3.5 w-3.5" />}
      className={cn("h-7 gap-1 px-2 text-[10px] sm:h-8 sm:text-[11px]", className)}
    />
  );
};

