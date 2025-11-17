"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

/**
 * Props para el componente DashboardKpiCard
 */
export interface DashboardKpiCardProps {
  /** Título de la tarjeta */
  title: string;
  
  /** Contenido de las métricas principales */
  children: ReactNode;
  
  /** Contenido del pie/footer (alertas, detalles adicionales) */
  footer?: ReactNode;
  
  /** Callback cuando se hace click en la tarjeta */
  onSelect?: () => void;
  
  /** Indica si la tarjeta está seleccionada */
  selected?: boolean;
  
  /** Variante visual */
  variant?: "default" | "warning" | "danger" | "success";
  
  /** Deshabilita la interacción */
  disabled?: boolean;
  
  /** Clases CSS adicionales */
  className?: string;
}

const variantStyles = {
  default: "",
  warning: "border-amber-300/70 hover:border-amber-400/80 shadow-sm",
  danger: "border-red-300/70 hover:border-red-400/80 shadow-sm",
  success: "border-green-300/70 hover:border-green-400/80 shadow-sm",
};

/**
 * Tarjeta KPI reutilizable para dashboards con contenido flexible via JSX
 * 
 * @example
 * ```tsx
 * <DashboardKpiCard title="Vacancias Activas" variant="danger">
 *   <KpiMetricsRow>
 *     <KpiMetric value={45} label="Vacancias" />
 *     <KpiMetric value={230} label="Días" />
 *   </KpiMetricsRow>
 *   <KpiDetails>
 *     <KpiDetail label="Propiedades" value={12} />
 *     <KpiDetail label="Costo" value="$450,000" />
 *   </KpiDetails>
 * </DashboardKpiCard>
 * ```
 */
export const DashboardKpiCard = ({
  title,
  children,
  footer,
  onSelect,
  selected = false,
  variant = "default",
  disabled = false,
  className,
}: DashboardKpiCardProps) => {
  const isClickable = !!onSelect && !disabled;

  const handleClick = () => {
    if (isClickable) {
      onSelect();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isClickable && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <Card
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "border-muted bg-card/90 shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all",
        isClickable && "cursor-pointer hover:shadow-[0_6px_16px_rgba(0,0,0,0.08)] hover:border-primary/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/30",
        selected && "border-primary/70 ring-2 ring-primary/20 shadow-[0_6px_16px_rgba(0,0,0,0.10)]",
        disabled && "opacity-50 cursor-not-allowed",
        variantStyles[variant],
        className,
      )}
    >
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-2 text-sm">
        {children}
        {footer && <div className="pt-1">{footer}</div>}
      </CardContent>
    </Card>
  );
};
