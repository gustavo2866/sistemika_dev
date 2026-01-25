/**
 * OportunidadSelector - Componente reutilizable para seleccionar oportunidades
 * 
 * Encapsula toda la lógica de formateo y configuración para mostrar oportunidades
 * en formato "titulo - contacto (tipo)" de manera consistente en toda la aplicación.
 * 
 * USO:
 * - En formularios principales: <OportunidadSelector source="oportunidad_id" />
 * - En modo controlado: <OportunidadSelector value={value} onChange={onChange} />
 * - Con filtros: <OportunidadSelector filter={{ activo: true }} />
 */

"use client";

import { CompactComboboxQuery, ComboboxQuery } from "@/components/forms";
import type { ComboboxQueryProps } from "@/components/forms/combobox-query";

// Configuración base para oportunidades
const OPORTUNIDADES_BASE_CONFIG = {
  resource: "crm/oportunidades",
  labelField: "titulo",
  limit: 200,
  staleTime: 5 * 60 * 1000,
} as const;

// Formatter reutilizable para el display de oportunidades
const formatOportunidad = (item: any): string => {
  const titulo = (item.titulo || "")?.slice(0, 20)?.trim();
  const contacto = (item.contacto?.nombre_completo || item.contacto_nombre || "")?.slice(0, 15)?.trim();
  const tipo = (item.tipo_operacion?.nombre || "")?.slice(0, 3)?.trim();
  
  const parts = [];
  if (titulo) parts.push(titulo);
  if (contacto) parts.push(contacto);
  if (tipo) parts.push(`(${tipo})`);
  
  if (parts.length === 0) return `#${item.id}`;
  
  const result = parts.slice(0, -1).join(" - ");
  const lastPart = parts[parts.length - 1];
  
  if (lastPart?.startsWith("(")) {
    return result ? `${result} ${lastPart}` : lastPart;
  }
  
  return parts.join(" - ");
};

// Props específicas para el selector de oportunidades
export interface OportunidadSelectorProps extends Omit<ComboboxQueryProps, "resource" | "labelField" | "formatter"> {
  /** Variante del componente */
  variant?: "compact" | "normal";
  /** Configuración del popover para mejor visualización */
  showWideDropdown?: boolean;
  /** Clases CSS personalizadas para el popover del dropdown */
  popoverClassName?: string;
}

/**
 * Selector de oportunidades con formato consistente
 */
export const OportunidadSelector = ({
  variant = "compact",
  showWideDropdown = true,
  filter = { activo: true },
  placeholder = "Selecciona una oportunidad",
  className = "w-full",
  popoverClassName,
  ...props
}: OportunidadSelectorProps) => {
  const baseProps = {
    ...OPORTUNIDADES_BASE_CONFIG,
    ...props,
    filter,
    placeholder,
    className,
    formatter: formatOportunidad,
    popoverClassName: showWideDropdown 
      ? `w-96 max-w-2xl text-xs ${popoverClassName || ""}`.trim()
      : popoverClassName,
  };

  if (variant === "compact") {
    return <CompactComboboxQuery {...baseProps} />;
  }

  return <ComboboxQuery {...baseProps} />;
};

/**
 * Versión compacta (alias para convenience)
 */
export const CompactOportunidadSelector = (props: Omit<OportunidadSelectorProps, "variant">) => (
  <OportunidadSelector {...props} variant="compact" />
);

/**
 * Versión normal (alias para convenience)
 */
export const NormalOportunidadSelector = (props: Omit<OportunidadSelectorProps, "variant">) => (
  <OportunidadSelector {...props} variant="normal" />
);