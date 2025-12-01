import { useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  /** Título de la sección */
  title: string;
  /** Subtítulo (puede ser string o función que retorna string) */
  subtitle?: string | (() => string);
  /** Si la sección puede colapsarse */
  collapsible?: boolean;
  /** Estado inicial (solo aplica si collapsible=true) */
  defaultOpen?: boolean;
  /** Contenido de la sección */
  children: ReactNode;
  /** Contenido adicional en el header */
  headerContent?: ReactNode;
  /** Variante de estilo */
  variant?: "default" | "outlined" | "ghost";
  /** Tamaño del padding del contenido */
  contentPadding?: "none" | "sm" | "md" | "lg";
  /** Clase CSS adicional para el contenedor */
  className?: string;
  /** Clase CSS adicional para el contenido */
  contentClassName?: string;
  /** Callback cuando cambia el estado de colapso */
  onToggle?: (isOpen: boolean) => void;
  /** Callback cuando se abre */
  onOpen?: () => void;
  /** Callback cuando se cierra */
  onClose?: () => void;
}

export const CollapsibleSection = ({
  title,
  subtitle,
  collapsible = true,
  defaultOpen = true,
  children,
  headerContent,
  variant = "default",
  contentPadding = "md",
  className,
  contentClassName,
  onToggle,
  onOpen,
  onClose,
}: CollapsibleSectionProps) => {
  const [open, setOpen] = useState(defaultOpen);

  const handleToggle = () => {
    if (!collapsible) return;
    
    const newState = !open;
    setOpen(newState);
    onToggle?.(newState);
    
    if (newState) {
      onOpen?.();
    } else {
      onClose?.();
    }
  };

  // Resolver subtitle si es función
  const resolvedSubtitle = typeof subtitle === "function" ? subtitle() : subtitle;

  // Clases para el padding del contenido
  const paddingClasses = {
    none: "p-0",
    sm: "p-2",
    md: "p-4",
    lg: "p-6",
  };

  // Clases para la variante
  const variantClasses = {
    default: "",
    outlined: "border-2",
    ghost: "border-0 shadow-none",
  };

  return (
    <Card className={cn(variantClasses[variant], className)}>
      <div className="border-b px-4 py-2">
        <div className="flex items-start gap-2">
          {collapsible && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={handleToggle}
              aria-label={open ? `Colapsar ${title}` : `Expandir ${title}`}
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  open ? "" : "-rotate-90"
                )}
              />
            </Button>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold truncate">{title}</h3>
            {resolvedSubtitle && (
              <p className="text-xs text-muted-foreground truncate">
                {resolvedSubtitle}
              </p>
            )}
          </div>
        </div>
        {headerContent && <div className="mt-2">{headerContent}</div>}
      </div>
      <CardContent
        className={cn(
          "space-y-4",
          paddingClasses[contentPadding],
          (!collapsible || open) ? "block" : "hidden",
          contentClassName
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
};
