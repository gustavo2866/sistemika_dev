"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const SectionCard = ({
  title,
  isOpen,
  onToggle,
  children,
  headerActions,
  showToggle = true,
  cardClassName,
  contentClassName,
  titleClassName,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  headerActions?: ReactNode;
  showToggle?: boolean;
  cardClassName?: string;
  contentClassName?: string;
  titleClassName?: string;
}) => {
  return (
    <Card className={cn("border border-border w-full", cardClassName)}>
      <CardContent className={cn("px-3 pt-0 pb-0", contentClassName)}>
        <div
          className="flex items-center justify-between cursor-pointer group hover:text-primary"
          onClick={onToggle}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggle();
            }
          }}
        >
          <div className={cn("text-sm font-bold text-foreground group-hover:text-primary", titleClassName)}>
            {title}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            {headerActions}
            {!headerActions && showToggle ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground"
                onClick={onToggle}
                aria-label={isOpen ? `Ocultar ${title}` : `Mostrar ${title}`}
                title={isOpen ? `Ocultar ${title}` : `Mostrar ${title}`}
              >
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            ) : null}
          </div>
        </div>
        {isOpen ? children : null}
      </CardContent>
    </Card>
  );
};

