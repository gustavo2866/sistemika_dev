/**
 * ConditionalFieldLock - Componente wrapper para bloqueo condicional de campos
 * 
 * Maneja el bloqueo de campos según estado del form, condiciones custom,
 * y proporciona feedback visual del estado locked.
 */

"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================
// TYPES
// ============================================

interface ConditionalFieldLockProps {
  isLocked: boolean | (() => boolean);
  lockReason?: string;
  lockMode?: 'disabled' | 'readonly' | 'overlay';
  children: ReactNode;
  showTooltip?: boolean;
  className?: string;
}

// ============================================
// COMPONENT
// ============================================

export const ConditionalFieldLock = ({
  isLocked,
  lockReason = "Campo bloqueado",
  lockMode = 'disabled',
  children,
  showTooltip = true,
  className,
}: ConditionalFieldLockProps) => {
  const locked = typeof isLocked === 'function' ? isLocked() : isLocked;

  if (!locked) {
    return <div className={className}>{children}</div>;
  }

  const renderContent = () => {
    switch (lockMode) {
      case 'overlay':
        return (
          <div className={cn("relative", className)}>
            {children}
            <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] rounded border border-dashed border-muted-foreground/30" />
          </div>
        );
      
      case 'readonly':
        return (
          <div className={cn("opacity-60 pointer-events-none", className)}>
            {children}
          </div>
        );
      
      case 'disabled':
      default:
        return (
          <div className={cn("opacity-50 pointer-events-none", className)}>
            {children}
          </div>
        );
    }
  };

  if (!showTooltip) {
    return renderContent();
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {renderContent()}
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{lockReason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// ============================================
// HELPER HOOKS
// ============================================

/**
 * Hook para determinar si campos deben estar bloqueados según estado
 */
export function useFieldLockByState(
  currentState: string, 
  lockedStates: string[] = ['emitida', 'aprobada', 'finalizada']
) {
  return lockedStates.includes(currentState);
}

/**
 * Hook para determinar si campos de detalle deben estar bloqueados
 */
export function useDetailFieldLock(
  hasItems: boolean,
  currentState?: string,
  lockedStates: string[] = ['emitida']
) {
  return hasItems && currentState && lockedStates.includes(currentState);
}