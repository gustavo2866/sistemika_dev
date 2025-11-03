"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";

type CollapsibleFormSectionProps = {
  title: string | ReactNode;
  subtitle?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  rightElement?: ReactNode;
  headerClassName?: string;
  contentClassName?: string;
  className?: string;
};

/**
 * Sección de formulario colapsable con cabecera clickeable
 * 
 * @example
 * ```tsx
 * <CollapsibleFormSection
 *   title="Información General"
 *   isOpen={headerOpen}
 *   onToggle={() => setHeaderOpen(!headerOpen)}
 *   rightElement={<Badge>ID: 123</Badge>}
 * >
 *   {/* Contenido del formulario *\/}
 * </CollapsibleFormSection>
 * ```
 */
export const CollapsibleFormSection = ({
  title,
  subtitle,
  isOpen,
  onToggle,
  children,
  rightElement,
  headerClassName = "",
  contentClassName = "",
  className = "",
}: CollapsibleFormSectionProps) => {
  return (
    <Card className={className}>
      <CardHeader 
        className={cn("cursor-pointer", headerClassName)} 
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              {title}
              {rightElement}
            </CardTitle>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">
                {subtitle}
              </p>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-5 w-5 transition-transform flex-shrink-0",
              !isOpen && "-rotate-90"
            )}
          />
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className={contentClassName}>
          {children}
        </CardContent>
      )}
    </Card>
  );
};
