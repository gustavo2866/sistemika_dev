import { cn } from "@/lib/utils";
import { FilterButton as BaseFilterButton, type FilterButtonProps } from "@/components/filter-form";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import React from "react";

/**
 * Componente FilterButton compacto con label "Filtros" hardcodeado
 * Aplica estilos responsivos: más pequeño en mobile, tamaño estándar en desktop
 */
export const CompactFilterButton = ({ buttonClassName, ...props }: FilterButtonProps) => {
  // Renderizamos el FilterButton oculto para mantener funcionalidad, pero mostramos nuestro botón custom
  return (
    <div className="relative inline-block">
      {/* FilterButton original pero invisible - mantiene toda la funcionalidad */}
      <BaseFilterButton
        {...props}
        buttonClassName={cn("opacity-0 absolute inset-0", buttonClassName)}
      />
      {/* Botón visual custom con el texto correcto */}
      <Button
        type="button"
        variant="outline"
        className={cn("h-5 px-1.5 text-[9px] sm:h-7 sm:px-2 sm:text-[11px] pointer-events-none", buttonClassName)}
      >
        <Filter className="w-2 h-2 mr-0.5 sm:w-3 sm:h-3 sm:mr-1" />
        Filtros
      </Button>
    </div>
  );
};