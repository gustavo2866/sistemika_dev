import { cn } from "@/lib/utils";
import { ReferenceInput as BaseReferenceInput, type ReferenceInputProps } from "@/components/reference-input";

/**
 * Componente ReferenceInput compacto para filtros
 * Aplica estilos responsivos: más pequeño en mobile, tamaño estándar en desktop
 * Reduce tanto label como campo select interno
 */
export const CompactReferenceInput = ({ className, children, ...props }: ReferenceInputProps) => {
  return (
    <BaseReferenceInput
      {...props}
      className={cn("compact-filter", className)}
    >
      {children}
    </BaseReferenceInput>
  );
};