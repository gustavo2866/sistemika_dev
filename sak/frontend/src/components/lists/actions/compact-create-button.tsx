import { cn } from "@/lib/utils";
import { CreateButton as BaseCreateButton, type CreateButtonProps } from "@/components/create-button";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Componente CreateButton compacto con label "Crear" y estructura ghost button
 * Igual patrón que FilterButton y ExportButton para alineación perfecta
 */
export const CompactCreateButton = ({ className, label, ...props }: CreateButtonProps) => {
  const resolvedLabel =
    typeof label === "string" && label.trim().length > 0 ? label : "Crear";
  return (
    <div className="relative inline-block">
      {/* CreateButton original pero invisible - mantiene toda la funcionalidad */}
      <BaseCreateButton
        {...props}
        className={cn("opacity-0 absolute inset-0", className)}
        label={resolvedLabel}
      />
      {/* Botón visual custom con el texto correcto y color negro */}
      <Button
        type="button"
        variant="outline"
        className={cn("h-5 px-1.5 text-[9px] sm:h-7 sm:px-2 sm:text-[11px] pointer-events-none bg-black text-white border-black hover:bg-gray-800", className)}
      >
        <Plus className="w-2 h-2 mr-0.5 sm:w-3 sm:h-3 sm:mr-1" />
        {resolvedLabel}
      </Button>
    </div>
  );
};