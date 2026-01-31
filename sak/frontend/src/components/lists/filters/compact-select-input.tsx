import { cn } from "@/lib/utils";
import { SelectInput as BaseSelectInput, type SelectInputProps } from "@/components/select-input";

/**
 * Componente SelectInput compacto para filtros
 * Aplica estilos responsivos: más pequeño en mobile, tamaño estándar en desktop
 * Reduce tanto label como campo select
 */
export const CompactSelectInput = ({ className, ...props }: SelectInputProps) => {
  return (
    <BaseSelectInput
      {...props}
      className={cn("compact-filter", className)}
    />
  );
};