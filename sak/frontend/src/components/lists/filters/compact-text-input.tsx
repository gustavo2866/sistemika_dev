import { cn } from "@/lib/utils";
import { TextInput as BaseTextInput, type TextInputProps } from "@/components/text-input";

/**
 * Componente TextInput compacto para filtros
 * Aplica estilos responsivos: más pequeño en mobile, tamaño estándar en desktop
 * Reduce tanto label como campo de entrada
 */
export const CompactTextInput = ({ className, ...props }: TextInputProps) => {
  return (
    <BaseTextInput
      {...props}
      className={cn("compact-filter", className)}
    />
  );
};