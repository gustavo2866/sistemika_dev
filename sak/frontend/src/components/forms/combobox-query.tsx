/**
 * ComboboxQuery - Componente genérico con React Query
 * 
 * COBERTURA:
 * - Escenario 2: Tablas ligeras (<100 registros)
 * - Escenario 3: Tablas pesadas (con búsqueda/filtro)
 * - Escenario 4: Opciones condicionales (con enabled/filter)
 * 
 * USO:
 * - Cabecera: Con prop `source` (integración React Admin)
 * - Subformulario: Con props `value/onChange` (modo controlado)
 * 
 * CONFIGURACIÓN:
 * - Definir en model.ts con constantes REFERENCE
 * - Form solo agrega lógica de presentación (filter, enabled)
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";
import { useController } from "react-hook-form";
import { Combobox } from "./combobox";

export interface ComboboxQueryProps {
  // Configuración de carga (definida en model.ts)
  resource: string;
  labelField: string;
  limit?: number;
  staleTime?: number;
  
  // Filtros dinámicos (definidos en form.tsx)
  filter?: Record<string, any>;
  enabled?: boolean;
  dependsOn?: any;
  
  // Modo React Admin (cabecera)
  source?: string;
  
  // Modo standalone (subformulario)
  value?: string;
  onChange?: (value: string) => void;
  
  // UI
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Tipo para opciones del combobox
 */
interface ComboboxOption {
  id: number | string;
  nombre: string;
}

/**
 * Transforma datos del dataProvider a formato ComboboxOption
 */
const transformToOptions = (
  data: any[],
  labelField: string
): ComboboxOption[] => {
  return data.map((item) => ({
    id: String(item.id),
    nombre: item[labelField] || "",
  }));
};

export const ComboboxQuery = (props: ComboboxQueryProps) => {
  const {
    resource,
    labelField,
    limit = 100,
    staleTime = 5 * 60 * 1000, // 5 minutos por defecto
    filter = {},
    enabled = true,
    dependsOn,
    source,
    value: valueProp,
    onChange: onChangeProp,
    placeholder,
    disabled,
    className,
  } = props;

  const dataProvider = useDataProvider();

  // Hook incondicional - solo se usa si source existe
  const controller = useController({
    name: source || `_combobox_${resource}`,
    disabled: disabled ?? !source,
  });

  // React Query - Carga con caché
  const {
    data: rawData,
    isLoading,
  } = useQuery({
    queryKey: ["reference", resource, labelField, limit, filter, dependsOn],
    queryFn: async () => {
      const { data } = await dataProvider.getList(resource, {
        pagination: { page: 1, perPage: limit },
        sort: { field: labelField, order: "ASC" },
        filter,
      });
      return data;
    },
    enabled: enabled && !!resource && !!labelField,
    staleTime,
  });

  // Transformar datos a formato esperado
  const options = rawData ? transformToOptions(rawData, labelField) : [];

  // Determinar value y onChange según el modo
  const value = source ? controller.field.value : valueProp;
  const onChange = source ? controller.field.onChange : onChangeProp;

  return (
    <Combobox
      options={options}
      loading={isLoading}
      value={value || ""}
      onChange={onChange || (() => {})}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
};
