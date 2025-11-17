"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

/**
 * Props para el componente KpiDetails
 */
export interface KpiDetailsProps {
  /** Componentes KpiDetail a mostrar */
  children: ReactNode;
  
  /** Número de columnas del grid */
  columns?: 2 | 3;
  
  /** Clases CSS adicionales */
  className?: string;
}

/**
 * Grid layout para mostrar detalles secundarios (label-value pairs)
 * 
 * @example
 * ```tsx
 * <KpiDetails columns={2}>
 *   <KpiDetail label="Propiedades" value={45} />
 *   <KpiDetail label="Costo" value="$2,500,000" />
 *   <KpiDetail label="Promedio" value="23.5 días" />
 * </KpiDetails>
 * ```
 */
export const KpiDetails = ({ children, columns = 2, className }: KpiDetailsProps) => (
  <div className={cn("grid gap-x-3 gap-y-1 text-xs", `grid-cols-${columns}`, className)}>
    {children}
  </div>
);
