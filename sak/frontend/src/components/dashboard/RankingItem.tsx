"use client";

import { ReactNode } from "react";

/**
 * Props para el componente RankingItem
 */
export interface RankingItemProps {
  /** Contenido principal del item */
  children: ReactNode;
  
  /** Contenido de acciones/botones en el lado derecho */
  actions?: ReactNode;
  
  /** Callback cuando se hace click en el item */
  onClick?: () => void;
  
  /** Indica si el item está seleccionado */
  selected?: boolean;
  
  /** Clases CSS adicionales */
  className?: string;
}

/**
 * Componente de item individual para rankings
 * 
 * Proporciona estructura estándar para items de ranking con contenido principal
 * y área de acciones opcional.
 * 
 * @example
 * ```tsx
 * <RankingItem
 *   actions={
 *     <div className="flex flex-col items-end gap-2">
 *       <div className="text-lg font-semibold">250 días</div>
 *       <ActionsMenu />
 *     </div>
 *   }
 * >
 *   <div className="space-y-1">
 *     <p className="font-semibold">Propiedad ABC</p>
 *     <p className="text-xs text-muted-foreground">Detalles adicionales</p>
 *   </div>
 * </RankingItem>
 * ```
 */
export function RankingItem({
  children,
  actions,
  onClick,
  selected = false,
  className = "",
}: RankingItemProps) {
  const baseClasses = "flex items-start justify-between gap-3 rounded border px-3 py-2 transition-colors";
  const interactiveClasses = onClick ? "cursor-pointer hover:bg-muted/50" : "";
  const selectedClasses = selected ? "border-primary bg-muted/30" : "";
  
  return (
    <div
      className={`${baseClasses} ${interactiveClasses} ${selectedClasses} ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      <div className="flex-1">
        {children}
      </div>
      
      {actions && (
        <div className="flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export default RankingItem;
