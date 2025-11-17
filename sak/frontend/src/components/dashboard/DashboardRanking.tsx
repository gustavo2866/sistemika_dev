"use client";

import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Props para el componente DashboardRanking
 */
export interface DashboardRankingProps<T> {
  /** Título del ranking */
  title: string;
  
  /** Array de items a mostrar en el ranking */
  items: T[];
  
  /** Estado de carga */
  loading?: boolean;
  
  /** Mensaje cuando no hay items */
  emptyMessage?: string;
  
  /** Función render para cada item del ranking */
  renderItem: (item: T, index: number) => ReactNode;
  
  /** Filtros opcionales */
  filters?: {
    /** Filtro principal (tipo) */
    primary?: {
      label: string;
      value: string;
      options: Array<{ value: string; label: string }>;
      onChange: (value: string) => void;
    };
    
    /** Filtro secundario (período, categoría, etc) */
    secondary?: {
      label: string;
      value: string;
      options: Array<{ value: string; label: string }>;
      onChange: (value: string) => void;
    };
  };
  
  /** Función de exportación opcional */
  onExport?: () => void;
  
  /** Texto del botón de exportación */
  exportLabel?: string;
  
  /** Altura del contenedor (default: 500px) */
  height?: string;
  
  /** Altura máxima del scroll (default: 440px) */
  maxScrollHeight?: string;
  
  /** Clases CSS adicionales */
  className?: string;
}

/**
 * Componente genérico de ranking/lista ordenada para dashboards
 * 
 * Permite mostrar listas ordenadas con filtros, exportación y contenido personalizado.
 * El contenido de cada item se define mediante JSX usando la prop renderItem.
 * 
 * @example
 * ```tsx
 * <DashboardRanking
 *   title="Top Ventas"
 *   items={salesData}
 *   renderItem={(item) => (
 *     <div className="flex justify-between">
 *       <span>{item.product}</span>
 *       <span>{item.amount}</span>
 *     </div>
 *   )}
 *   filters={{
 *     primary: {
 *       label: "Categoría",
 *       value: category,
 *       options: categoryOptions,
 *       onChange: setCategory
 *     }
 *   }}
 *   onExport={handleExport}
 * />
 * ```
 */
export function DashboardRanking<T>({
  title,
  items,
  loading = false,
  emptyMessage = "No hay datos para mostrar.",
  renderItem,
  filters,
  onExport,
  exportLabel = "Exportar",
  height = "500px",
  maxScrollHeight = "440px",
  className,
}: DashboardRankingProps<T>) {
  const hasPrimaryFilter = filters?.primary;
  const hasSecondaryFilter = filters?.secondary;
  const hasFilters = hasPrimaryFilter || hasSecondaryFilter || onExport;

  return (
    <Card className={className} style={{ height }}>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>{title}</CardTitle>
        
        {hasFilters && (
      <div className="flex flex-wrap items-end gap-3 text-sm">
            {/* Filtro principal */}
            {hasPrimaryFilter && filters.primary && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="primary-filter" className="text-xs uppercase tracking-wide text-muted-foreground">
                  {filters.primary.label}
                </Label>
                <Select
                  value={filters.primary.value}
                  onValueChange={filters.primary.onChange}
                >
                  <SelectTrigger id="primary-filter" className="h-9 w-[170px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filters.primary.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Filtro secundario */}
            {hasSecondaryFilter && filters.secondary && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="secondary-filter" className="text-xs uppercase tracking-wide text-muted-foreground">
                  {filters.secondary.label}
                </Label>
                <Select
                  value={filters.secondary.value}
                  onValueChange={filters.secondary.onChange}
                >
                  <SelectTrigger id="secondary-filter" className="h-9 w-[170px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filters.secondary.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Botón de exportación */}
            {onExport && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 rounded-full border border-border/70 hover:border-primary/60"
                onClick={onExport}
                aria-label={exportLabel}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      
      <CardContent style={{ height: `calc(${height} - 80px)` }}>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div 
            className="space-y-2 overflow-y-auto pr-1" 
            style={{ maxHeight: maxScrollHeight }}
          >
            {items.map((item, index) => renderItem(item, index))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DashboardRanking;
