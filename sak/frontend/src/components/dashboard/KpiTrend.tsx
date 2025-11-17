"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/**
 * Props para el componente KpiTrend
 */
export interface KpiTrendProps {
  /** Valor numérico de la tendencia */
  value: number;
  
  /** Porcentaje de cambio */
  percentage: number;
  
  /** Dirección de la tendencia */
  direction: "up" | "down" | "neutral";
  
  /** Variante semántica (positivo/negativo) */
  variant?: "positive" | "negative" | "neutral";
  
  /** Mostrar el símbolo de porcentaje */
  showPercentage?: boolean;
  
  /** Clases CSS adicionales */
  className?: string;
}

const variantColors = {
  positive: "text-green-600 bg-green-50",
  negative: "text-red-600 bg-red-50",
  neutral: "text-gray-600 bg-gray-50",
};

/**
 * Muestra tendencias con flecha, valor y porcentaje
 * 
 * @example
 * ```tsx
 * <KpiTrend 
 *   value={12} 
 *   percentage={15} 
 *   direction="up" 
 *   variant="positive" 
 * />
 * ```
 */
export const KpiTrend = ({
  value,
  percentage,
  direction,
  variant = "neutral",
  showPercentage = true,
  className,
}: KpiTrendProps) => {
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  
  return (
    <div className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium", variantColors[variant], className)}>
      <Icon className="h-3 w-3" />
      {showPercentage && <span>{percentage > 0 ? "+" : ""}{percentage}%</span>}
      {!showPercentage && <span>{value}</span>}
    </div>
  );
};
