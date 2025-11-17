"use client";

import { cn } from "@/lib/utils";

/**
 * Props para el componente KpiSparkline
 */
export interface KpiSparklineProps {
  /** Array de valores numéricos para graficar */
  data: number[];
  
  /** Altura del gráfico en píxeles */
  height?: number;
  
  /** Color de la línea */
  color?: string;
  
  /** Tipo de gráfico */
  type?: "line" | "area";
  
  /** Clases CSS adicionales */
  className?: string;
}

/**
 * Mini gráfico de línea/área para tendencias (SVG simple)
 * 
 * @example
 * ```tsx
 * <KpiSparkline 
 *   data={[10, 15, 12, 18, 22, 20, 25]} 
 *   height={40} 
 *   color="#16a34a"
 *   type="area"
 * />
 * ```
 */
export const KpiSparkline = ({
  data,
  height = 40,
  color = "#3b82f6",
  type = "line",
  className,
}: KpiSparklineProps) => {
  if (data.length === 0) return null;

  const width = 100;
  const padding = 2;
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * (width - padding * 2) + padding;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return { x, y };
  });
  
  const pathData = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
    
  const areaPath = type === "area"
    ? `${pathData} L ${width - padding} ${height} L ${padding} ${height} Z`
    : pathData;

  return (
    <div className={cn("w-full", className)}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        {type === "area" && (
          <path
            d={areaPath}
            fill={color}
            fillOpacity="0.2"
            stroke="none"
          />
        )}
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
