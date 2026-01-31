/**
 * HeaderSummaryDisplay - Componente genérico para mostrar información en headers
 * 
 * Unifica el patrón de display de campos únicos (moneda, badge) y múltiples campos
 * con separadores personalizables. Soporta formateo automático y layouts flexibles.
 */

"use client";

import { type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

type FormatterType = 'currency' | 'badge' | 'text' | ((value: any) => ReactNode);

interface HeaderField {
  value: any;
  formatter?: FormatterType;
  label?: string;
  className?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}

interface HeaderSummaryDisplayProps {
  fields: HeaderField[];
  separator?: string | ReactNode;
  layout?: 'horizontal' | 'vertical' | 'inline';
  className?: string;
}

// ============================================
// FORMATTERS
// ============================================

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatValue = (value: any, formatter?: FormatterType, badgeVariant?: string): ReactNode => {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  if (typeof formatter === 'function') {
    return formatter(value);
  }

  switch (formatter) {
    case 'currency': {
      const numValue = Number(value);
      return (
        <span className="font-medium">
          {Number.isFinite(numValue) ? CURRENCY_FORMATTER.format(numValue) : '-'}
        </span>
      );
    }
    case 'badge': {
      return (
        <Badge variant={badgeVariant as any || "default"} className="text-xs">
          {String(value)}
        </Badge>
      );
    }
    case 'text':
    default:
      return <span>{String(value)}</span>;
  }
};

// ============================================
// COMPONENT
// ============================================

export const HeaderSummaryDisplay = ({
  fields,
  separator = " • ",
  layout = 'horizontal',
  className,
}: HeaderSummaryDisplayProps) => {
  if (!fields.length) return null;

  const renderField = (field: HeaderField, index: number) => {
    const formattedValue = formatValue(field.value, field.formatter, field.badgeVariant);
    
    return (
      <div key={index} className={cn("flex items-center gap-1", field.className)}>
        {field.label && (
          <span className="text-sm text-muted-foreground">{field.label}:</span>
        )}
        {formattedValue}
      </div>
    );
  };

  const layoutClasses = {
    horizontal: "flex items-center gap-2",
    vertical: "flex flex-col gap-1",
    inline: "inline-flex items-center gap-1 flex-wrap",
  };

  return (
    <div className={cn(layoutClasses[layout], className)}>
      {fields.map((field, index) => (
        <div key={index} className="flex items-center">
          {renderField(field, index)}
          {index < fields.length - 1 && layout !== 'vertical' && (
            <span className="text-muted-foreground">{separator}</span>
          )}
        </div>
      ))}
    </div>
  );
};