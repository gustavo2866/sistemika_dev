import { cn } from "@/lib/utils";
import { ExportButton as BaseExportButton, type ExportButtonProps } from "@/components/export-button";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Componente ExportButton compacto con label "Exportar" hardcodeado
 * Aplica estilos responsivos: más pequeño en mobile, tamaño estándar en desktop
 */
export const CompactExportButton = ({ className, ...props }: ExportButtonProps) => {
  return (
    <div className="relative inline-block">
      {/* ExportButton original pero invisible - mantiene toda la funcionalidad */}
      <BaseExportButton
        {...props}
        className={cn("opacity-0 absolute inset-0", className)}
      />
      {/* Botón visual custom con el texto correcto */}
      <Button
        type="button"
        variant="outline"
        className={cn("h-5 px-1.5 text-[9px] sm:h-7 sm:px-2 sm:text-[11px] pointer-events-none", className)}
      >
        <Download className="w-2 h-2 mr-0.5 sm:w-3 sm:h-3 sm:mr-1" />
        Exportar
      </Button>
    </div>
  );
};