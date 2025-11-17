"use client";

import { cn } from "@/lib/utils";

/**
 * Props para el componente KpiDivider
 */
export interface KpiDividerProps {
  /** Clases CSS adicionales */
  className?: string;
}

/**
 * Separador visual entre secciones del card
 * 
 * @example
 * ```tsx
 * <KpiMetricsRow>
 *   <KpiMetric value={150} label="Vacancias" />
 * </KpiMetricsRow>
 * 
 * <KpiDivider />
 * 
 * <KpiDetails>
 *   <KpiDetail label="Propiedades" value={45} />
 * </KpiDetails>
 * ```
 */
export const KpiDivider = ({ className }: KpiDividerProps) => (
  <hr className={cn("border-t border-muted", className)} />
);
