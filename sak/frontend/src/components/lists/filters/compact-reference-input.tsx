import { cn } from "@/lib/utils";
import { ReferenceInput as BaseReferenceInput, type ReferenceInputProps } from "@/components/reference-input";

interface CompactReferenceInputProps extends ReferenceInputProps {
  className?: string;
}

/**
 * Componente ReferenceInput compacto para filtros
 * Aplica estilos responsivos: más pequeño en mobile, tamaño estándar en desktop
 * Reduce tanto label como campo select interno
 */
export const CompactReferenceInput = ({ className, children, ...props }: CompactReferenceInputProps) => {
  return (
    <div className={cn("compact-filter", className)}>
      <BaseReferenceInput {...props}>
        {children}
      </BaseReferenceInput>
    </div>
  );
};