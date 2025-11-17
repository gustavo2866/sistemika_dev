"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

/**
 * Props para el componente KpiAlert
 */
export interface KpiAlertProps {
  /** Mensaje de alerta */
  message: string;
  
  /** Ícono opcional (componente React) */
  icon?: ReactNode;
  
  /** Variante de color de la alerta */
  variant?: "default" | "warning" | "danger" | "success";
  
  /** Clases CSS adicionales */
  className?: string;
}

const alertColors = {
  default: "text-gray-600",
  warning: "text-amber-600",
  danger: "text-red-600",
  success: "text-green-600",
};

/**
 * Muestra mensajes de alerta/notificación con ícono opcional
 * 
 * @example
 * ```tsx
 * import { AlertCircle } from "lucide-react";
 * 
 * <KpiAlert 
 *   variant="danger"
 *   message="Revisar vacancias activas"
 *   icon={<AlertCircle className="h-4 w-4" />}
 * />
 * ```
 */
export const KpiAlert = ({ message, icon, variant = "danger", className }: KpiAlertProps) => (
  <div className={cn("flex items-center gap-1 text-xs", alertColors[variant], className)}>
    {icon}
    <span>{message}</span>
  </div>
);
