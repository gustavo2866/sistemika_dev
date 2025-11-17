"use client";

import { cn } from "@/lib/utils";

/**
 * Props para el componente KpiMetric
 */
export interface KpiMetricProps {
  /** Valor principal de la métrica */
  value: string | number;
  
  /** Etiqueta descriptiva de la métrica */
  label: string;
  
  /** Clases CSS adicionales */
  className?: string;
}

/**
 * Componente para mostrar una métrica individual con valor grande y label
 * 
 * @example
 * ```tsx
 * <KpiMetric value={150} label="Vacancias" />
 * <KpiMetric value="$450,000" label="Costo Total" className="text-right" />
 * ```
 */
export const KpiMetric = ({ value, label, className }: KpiMetricProps) => (
  <div className={className}>
    <div className="text-3xl font-semibold leading-tight">{value}</div>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);
