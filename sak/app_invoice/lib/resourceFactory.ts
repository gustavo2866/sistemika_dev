import { ReactElement } from "react";

// Tipos para la configuración declarativa
export interface FieldConfig {
  type: 'text' | 'textarea' | 'email' | 'tel' | 'number' | 'date' | 'select' | 'reference' | 'image';
  label?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  choices?: Array<{ id: string | number; name: string }>;
  reference?: string;
  optionText?: string;
  defaultValue?: string | number | boolean | Date;
  gridCols?: 1 | 2;
  helperText?: string;
}

export interface FilterConfig {
  source: string;
  type: 'search' | 'text' | 'select' | 'reference';
  placeholder?: string;
  alwaysOn?: boolean;
  choices?: Array<{ id: string | number; name: string }> | string;
  reference?: string;
  optionText?: string;
}

export interface ColumnConfig {
  source: string;
  label?: string;
  type?: 'text' | 'badge' | 'reference' | 'date' | 'image';
  reference?: string;
  display?: string;
}

export interface FormSectionConfig {
  title: string;
  description?: string;
  icon?: string;
  fields: string[];
}

export interface ResourceConfig {
  name: string;
  displayName: string;
  recordRepresentation: string;
  fields: Record<string, FieldConfig>;
  filters: FilterConfig[];
  columns: ColumnConfig[];
  relations?: Record<string, {
    field: string;
    reference: string;
    display: string;
  }>;
  formSections?: FormSectionConfig[];
}

// Factory para crear componentes de recursos
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const createResourceComponents = (config: ResourceConfig) => {
  // Por ahora retornamos null - implementaremos los componentes genéricos después
  return {
    List: () => null as ReactElement | null,
    Create: () => null as ReactElement | null,
    Edit: () => null as ReactElement | null,
    Show: () => null as ReactElement | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Form: ({ mode }: { mode: string }) => null as ReactElement | null
  };
};

// Hook para obtener configuración de recurso
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const useResourceConfig = (resourceName: string): ResourceConfig | null => {
  // Por ahora retornamos null - implementaremos la lógica después
  return null;
};
