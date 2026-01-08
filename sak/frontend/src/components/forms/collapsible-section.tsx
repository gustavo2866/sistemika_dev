import { useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormHeaderDensity } from "./form-header-density-context";

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
  /** Posicion del contenido adicional */
  headerContentPosition?: "inline" | "below";
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
  headerContentPosition = "below",
  variant = "default",
  contentPadding = "md",
  className,
  contentClassName,
  onToggle,
  onOpen,
  onClose,
}: CollapsibleSectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const headerDensity = useFormHeaderDensity();
  const isCompactHeader = headerDensity === "compact";

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

  const showSubtitle = Boolean(
    resolvedSubtitle && (!isCompactHeader || open),
  );

  return (
    <Card
      className={cn(
        variantClasses[variant],
        isCompactHeader && "gap-0 py-1 sm:py-1.5",
        className
      )}
    >
      <div
        role={collapsible ? "button" : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onClick={collapsible ? handleToggle : undefined}
        onKeyDown={
          collapsible
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleToggle();
                }
              }
            : undefined
        }
        className={cn(
          "border-b transition-colors",
          collapsible && "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          isCompactHeader ? "px-2.5 pt-0 pb-1 sm:px-3 sm:pt-0.5 sm:pb-2" : "px-4 pt-0.5 pb-1.5",
        )}
      >
        <div className={cn("flex w-full", isCompactHeader ? "gap-1 items-center h-[16px]" : "gap-1.5 items-center")}>
          {collapsible && (
            <ChevronDown
              className={cn(
                "transition-transform duration-200",
                isCompactHeader ? "h-2.5 w-2.5" : "h-4 w-4",
                open ? "" : "-rotate-90"
              )}
            />
          )}
          <div className={cn("flex-1 min-w-0 flex items-center", isCompactHeader ? "h-full" : "")}>
            <h3
              className={cn(
                "truncate",
                isCompactHeader ? "text-[11px] font-medium leading-none !m-0 !p-0" : "text-base font-semibold",
              )}
            >
              {title}
            </h3>
            {showSubtitle && (
              <p
                className={cn(
                  "text-muted-foreground truncate",
                  isCompactHeader ? "text-[9px] leading-none" : "text-xs",
                )}
              >
                {resolvedSubtitle}
              </p>
            )}
          </div>
          {headerContent && headerContentPosition === "inline" && (
            <div className={cn(isCompactHeader ? "ml-2" : "ml-4")}>
              {headerContent}
            </div>
          )}
        </div>
        {headerContent && headerContentPosition === "below" && (
          <div className={cn(isCompactHeader ? "mt-0" : "mt-2")}>{headerContent}</div>
        )}
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
