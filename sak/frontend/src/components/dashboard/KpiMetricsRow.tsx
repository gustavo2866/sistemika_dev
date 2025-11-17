"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

/**
 * Props para el componente KpiMetricsRow
 */
export interface KpiMetricsRowProps {
  /** Componentes KpiMetric a mostrar */
  children: ReactNode;
  
  /** Clases CSS adicionales */
  className?: string;
}

/**
 * Container flex para alinear múltiples métricas horizontalmente
 * 
 * @example
 * ```tsx
 * <KpiMetricsRow>
 *   <KpiMetric value={150} label="Vacancias" />
 *   <KpiMetric value={3450} label="Días" className="text-right" />
 * </KpiMetricsRow>
 * ```
 */
export const KpiMetricsRow = ({ children, className }: KpiMetricsRowProps) => (
  <div className={cn("flex items-baseline justify-between gap-4", className)}>
    {children}
  </div>
);
