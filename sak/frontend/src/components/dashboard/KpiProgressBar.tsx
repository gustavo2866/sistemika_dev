"use client";

import { cn } from "@/lib/utils";

/**
 * Props para el componente KpiProgressBar
 */
export interface KpiProgressBarProps {
  /** Valor actual */
  value: number;
  
  /** Valor máximo */
  max: number;
  
  /** Etiqueta opcional */
  label?: string;
  
  /** Mostrar porcentaje */
  showPercentage?: boolean;
  
  /** Mostrar valores numéricos (ej: 18/24) */
  showValues?: boolean;
  
  /** Variante de color */
  variant?: "default" | "warning" | "danger" | "success";
  
  /** Altura de la barra */
  height?: "sm" | "md" | "lg";
  
  /** Clases CSS adicionales */
  className?: string;
}

const variantColors = {
  default: "bg-blue-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  success: "bg-green-500",
};

const heightStyles = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

/**
 * Barra de progreso para métricas visuales
 * 
 * @example
 * ```tsx
 * <KpiProgressBar 
 *   value={18} 
 *   max={24} 
 *   label="Ocupación" 
 *   showPercentage 
 *   variant="success" 
 * />
 * ```
 */
export const KpiProgressBar = ({
  value,
  max,
  label,
  showPercentage = false,
  showValues = false,
  variant = "default",
  height = "md",
  className,
}: KpiProgressBarProps) => {
  const percentage = Math.min(Math.round((value / max) * 100), 100);
  
  return (
    <div className={cn("space-y-1", className)}>
      {(label || showPercentage || showValues) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="text-muted-foreground">{label}</span>}
          <div className="flex items-center gap-2">
            {showValues && (
              <span className="font-medium">
                {value}/{max}
              </span>
            )}
            {showPercentage && (
              <span className="font-medium">{percentage}%</span>
            )}
          </div>
        </div>
      )}
      <div className={cn("w-full bg-gray-200 rounded-full overflow-hidden", heightStyles[height])}>
        <div
          className={cn("h-full rounded-full transition-all duration-300", variantColors[variant])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
