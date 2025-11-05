"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type BadgeConfig = {
  label: string;
  variant?: "outline" | "secondary" | "default" | "destructive";
  className?: string;
};

type DetalleItemCardProps = {
  title: string;
  subtitle?: string;
  badges?: BadgeConfig[];
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
  showDelete?: boolean;
};

/**
 * Tarjeta compacta para mostrar rápidamente cada detalle.
 */
export const DetalleItemCard = ({
  title,
  subtitle,
  badges = [],
  onEdit,
  onDelete,
  className = "",
  showDelete = true,
}: DetalleItemCardProps) => {
  return (
    <Card
      className={cn(
        "relative h-full cursor-pointer rounded-xl border border-border/60 bg-card/80 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/70 hover:shadow-md",
        className
      )}
      onClick={onEdit}
    >
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1">
            {(badges.length ? badges : [{ label: "Sin artículo", variant: "outline" }]).map(
              (badge, index) => (
                <Badge
                  key={index}
                  variant={badge.variant || "secondary"}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[10px] font-medium",
                    badge.className
                  )}
                >
                  {badge.label}
                </Badge>
              )
            )}
          </div>

          {showDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label="Eliminar detalle"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>

        <p className="line-clamp-2 text-sm font-semibold text-foreground">
          {title}
        </p>

        {subtitle && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Cantidad solicitada
            </span>
            <Badge
              variant="default"
              className="rounded-full px-3 py-1 text-[10px] font-semibold"
            >
              {subtitle}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
