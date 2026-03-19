"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

/**
 * Props para el componente DashboardKpiCard
 */
export interface DashboardKpiCardProps {
  /** Título de la tarjeta */
  title: ReactNode;
  
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

  /** Version compacta para dashboards densos */
  compact?: boolean;
}

const variantStyles = {
  default: "",
  warning: "border-amber-300/70 hover:border-amber-400/80 shadow-sm",
  danger: "border-red-300/70 hover:border-red-400/80 shadow-sm",
  success: "border-green-300/70 hover:border-green-400/80 shadow-sm",
  selected: "border-primary/80 ring-2 ring-primary/30 shadow-[0_6px_16px_rgba(0,0,0,0.10)]",
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
  compact = false,
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
        "overflow-hidden border-muted bg-card/90 shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition-all",
        isClickable && "cursor-pointer hover:shadow-[0_6px_16px_rgba(0,0,0,0.08)] hover:border-primary/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/30",
        selected && variantStyles.selected,
        disabled && "opacity-50 cursor-not-allowed",
        variantStyles[variant],
        className,
      )}
    >
      <CardHeader className={cn(compact ? "px-3 pb-0.5 pt-1.5" : "pb-1")}>
        <CardTitle className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
          {title}
        </CardTitle>
      </CardHeader>
      
      <CardContent
        className={cn(
          compact ? "space-y-1.5 px-3 pb-2.5 pt-0 text-sm" : "space-y-2 text-sm",
        )}
      >
        {children}
        {footer && <div className="pt-1">{footer}</div>}
      </CardContent>
    </Card>
  );
};
