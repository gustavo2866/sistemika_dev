"use client";

import { cn } from "@/lib/utils";

/**
 * Props para el componente KpiDetail
 */
export interface KpiDetailProps {
  /** Etiqueta del detalle */
  label: string;
  
  /** Valor del detalle */
  value: string | number;
  
  /** Clases CSS adicionales */
  className?: string;
}

/**
 * Par label-value para detalles secundarios (usa 2 columnas del grid)
 * 
 * @example
 * ```tsx
 * <KpiDetails>
 *   <KpiDetail label="Propiedades" value={45} />
 *   <KpiDetail label="Costo" value="$2,500,000" />
 * </KpiDetails>
 * ```
 */
export const KpiDetail = ({ label, value, className }: KpiDetailProps) => (
  <>
    <span className={cn("text-muted-foreground", className)}>{label}</span>
    <span className={cn("text-right font-medium text-foreground", className)}>{value}</span>
  </>
);
