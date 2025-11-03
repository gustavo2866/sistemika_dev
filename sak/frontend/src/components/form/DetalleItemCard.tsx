"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";

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
 * Card compacto para mostrar items en grid con opción de editar/eliminar
 * 
 * @example
 * ```tsx
 * <DetalleItemCard
 *   title="Artículo XYZ"
 *   subtitle="Descripción detallada"
 *   badges={[
 *     { label: "UM: UN", variant: "outline" },
 *     { label: "Cant: 10", variant: "secondary" }
 *   ]}
 *   onEdit={() => openEditDialog(index)}
 *   onDelete={() => deleteItem(index)}
 * />
 * ```
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
    <Card className={`relative hover:border-primary transition-colors ${className}`}>
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p 
            className="font-medium text-sm truncate flex-1 cursor-pointer"
            onClick={onEdit}
          >
            {title}
          </p>
          {showDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        
        {subtitle && (
          <p 
            className="text-xs text-muted-foreground truncate cursor-pointer"
            onClick={onEdit}
          >
            {subtitle}
          </p>
        )}
        
        {badges.length > 0 && (
          <div 
            className="flex items-center gap-1.5 text-xs cursor-pointer"
            onClick={onEdit}
          >
            {badges.map((badge, index) => (
              <Badge 
                key={index}
                variant={badge.variant || "outline"} 
                className={`text-xs px-1.5 py-0 ${badge.className || ""}`}
              >
                {badge.label}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
