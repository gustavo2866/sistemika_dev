"use client";

import { cn } from "@/lib/utils";

/**
 * Props para el componente KpiBadge
 */
export interface KpiBadgeProps {
  /** Texto del badge */
  label: string;
  
  /** Variante de color */
  variant?: "default" | "warning" | "danger" | "success" | "info";
  
  /** Clases CSS adicionales */
  className?: string;
}

const variantStyles = {
  default: "bg-gray-100 text-gray-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  success: "bg-green-100 text-green-800",
  info: "bg-blue-100 text-blue-800",
};

/**
 * Badge/Tag para etiquetas destacadas
 * 
 * @example
 * ```tsx
 * <KpiBadge label="Urgente" variant="danger" />
 * <KpiBadge label="Nuevo" variant="success" />
 * ```
 */
export const KpiBadge = ({ label, variant = "default", className }: KpiBadgeProps) => (
  <span className={cn("inline-flex items-center px-2 py-1 text-xs font-medium rounded", variantStyles[variant], className)}>
    {label}
  </span>
);
