"use client";

import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

/**
 * Props para el componente KpiIcon
 */
export interface KpiIconProps {
  /** Ícono de Lucide React */
  icon: LucideIcon;
  
  /** Variante de color */
  variant?: "default" | "warning" | "danger" | "success" | "info";
  
  /** Tamaño del ícono */
  size?: "sm" | "md" | "lg" | "xl";
  
  /** Mostrar fondo circular */
  withBackground?: boolean;
  
  /** Clases CSS adicionales */
  className?: string;
}

const variantColors = {
  default: "text-gray-600",
  warning: "text-amber-600",
  danger: "text-red-600",
  success: "text-green-600",
  info: "text-blue-600",
};

const variantBackgrounds = {
  default: "bg-gray-100",
  warning: "bg-amber-100",
  danger: "bg-red-100",
  success: "bg-green-100",
  info: "bg-blue-100",
};

const sizeStyles = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
};

const backgroundSizes = {
  sm: "p-1.5",
  md: "p-2",
  lg: "p-2.5",
  xl: "p-3",
};

/**
 * Ícono con variantes de color predefinidas y fondo opcional
 * 
 * @example
 * ```tsx
 * import { TrendingUp } from "lucide-react";
 * 
 * <KpiIcon 
 *   icon={TrendingUp} 
 *   variant="success" 
 *   size="lg" 
 *   withBackground 
 * />
 * ```
 */
export const KpiIcon = ({
  icon: Icon,
  variant = "default",
  size = "md",
  withBackground = false,
  className,
}: KpiIconProps) => {
  if (withBackground) {
    return (
      <div className={cn("inline-flex items-center justify-center rounded-full", variantBackgrounds[variant], backgroundSizes[size], className)}>
        <Icon className={cn(sizeStyles[size], variantColors[variant])} />
      </div>
    );
  }
  
  return <Icon className={cn(sizeStyles[size], variantColors[variant], className)} />;
};
