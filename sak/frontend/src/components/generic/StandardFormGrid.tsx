/**
 * StandardFormGrid - Sistema de layout declarativo para forms
 * 
 * Elimina la repetición de estructuras Grid mediante configuración declarativa
 * con responsive breakpoints automáticos y spacing consistente.
 */

"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface FormGridField {
  component: ReactNode;
  span?: number;
  condition?: boolean | (() => boolean);
  className?: string;
}

interface FormGridSection {
  title?: string;
  condition?: boolean | (() => boolean);
  columns: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  fields: FormGridField[];
  className?: string;
}

interface StandardFormGridProps {
  sections: FormGridSection[];
  responsive?: boolean;
  className?: string;
}

// ============================================
// UTILS
// ============================================

const getGridColumnsClass = (columns: 1 | 2 | 3 | 4, responsive: boolean = true) => {
  const baseClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2", 
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  } as const;
  
  const nonResponsiveClasses = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3", 
    4: "grid-cols-4",
  } as const;
  
  return responsive ? baseClasses[columns] : nonResponsiveClasses[columns];
};

const getGapClass = (gap: 'sm' | 'md' | 'lg' = 'md') => {
  const gaps = {
    sm: "gap-2",
    md: "gap-4", 
    lg: "gap-6",
  };
  return gaps[gap];
};

const getSpanClass = (span: number, maxColumns: number) => {
  if (span >= maxColumns) return `col-span-full`;
  return `col-span-${span}`;
};

// ============================================
// COMPONENT
// ============================================

export const StandardFormGrid = ({
  sections,
  responsive = true,
  className,
}: StandardFormGridProps) => {
  const renderField = (field: FormGridField, maxColumns: number, index: number) => {
    const shouldRender = field.condition !== undefined 
      ? (typeof field.condition === 'function' ? field.condition() : field.condition)
      : true;

    if (!shouldRender) return null;

    const spanClass = field.span ? getSpanClass(field.span, maxColumns) : undefined;

    return (
      <div 
        key={index} 
        className={cn(spanClass, field.className)}
      >
        {field.component}
      </div>
    );
  };

  const renderSection = (section: FormGridSection, index: number) => {
    const shouldRender = section.condition !== undefined
      ? (typeof section.condition === 'function' ? section.condition() : section.condition) 
      : true;

    if (!shouldRender) return null;

    const visibleFields = section.fields.filter(field => {
      const condition = field.condition !== undefined 
        ? (typeof field.condition === 'function' ? field.condition() : field.condition)
        : true;
      return condition;
    });

    if (!visibleFields.length) return null;

    return (
      <div key={index} className={cn("space-y-4", section.className)}>
        {section.title && (
          <h3 className="text-sm font-medium text-foreground/80 border-b border-border/50 pb-1">
            {section.title}
          </h3>
        )}
        <div 
          className={cn(
            "grid",
            getGridColumnsClass(section.columns, responsive),
            getGapClass(section.gap)
          )}
        >
          {section.fields.map((field, fieldIndex) => 
            renderField(field, section.columns, fieldIndex)
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={cn("space-y-6", className)}>
      {sections.map((section, index) => renderSection(section, index))}
    </div>
  );
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Crea una configuración básica de 2 columnas para datos generales
 */
export const createTwoColumnSection = (
  title: string,
  fields: ReactNode[],
  gap: 'sm' | 'md' | 'lg' = 'md'
): FormGridSection => ({
  title,
  columns: 2,
  gap,
  fields: fields.map(component => ({ component })),
});

/**
 * Crea una configuración de 3 columnas para datos de imputación
 */
export const createThreeColumnSection = (
  title: string, 
  fields: ReactNode[],
  gap: 'sm' | 'md' | 'lg' = 'md'
): FormGridSection => ({
  title,
  columns: 3, 
  gap,
  fields: fields.map(component => ({ component })),
});

/**
 * Crea una configuración de campo completo (full span)
 */
export const createFullSpanSection = (
  title: string,
  fields: ReactNode[]
): FormGridSection => ({
  title,
  columns: 1,
  gap: 'md',
  fields: fields.map(component => ({ component, span: 1 })),
});