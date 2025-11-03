/**
 * ReferenceField Component
 * 
 * Custom field for GenericForm that loads and displays reference data
 * without requiring React Admin's form context.
 */

"use client";

import { useEffect, useState } from "react";
import { useDataProvider } from "ra-core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FieldConfig } from "./GenericForm/types";

interface ReferenceFieldProps {
  config: FieldConfig;
  value: any;
  onChange: (value: any) => void;
}

export function ReferenceField({ config, value, onChange }: ReferenceFieldProps) {
  const dataProvider = useDataProvider();
  const [options, setOptions] = useState<Array<{ id: any; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!config.reference) return;

    const loadOptions = async () => {
      try {
        setLoading(true);
        
        const { data } = await dataProvider.getList(config.reference!, {
          pagination: { page: 1, perPage: 1000 },
          sort: { field: config.referenceSource || "nombre", order: "ASC" },
          filter: config.referenceFilters || {},
        });

        const optionTextField = config.referenceSource || "nombre";
        const mappedOptions = data.map((item: any) => ({
          id: item.id,
          name: item[optionTextField] || `ID: ${item.id}`,
        }));
        
        setOptions(mappedOptions);
      } catch (error) {
        console.error(`Error loading reference data from ${config.reference}:`, error);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };

    loadOptions();
  }, [config.reference, config.referenceSource, config.referenceFilters, dataProvider]);

  if (!config.reference) {
    return (
      <div className="text-sm text-red-500">
        Reference field requires &quot;reference&quot; prop (resource name)
      </div>
    );
  }

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Cargando..." />
        </SelectTrigger>
      </Select>
    );
  }

  // Si el campo está deshabilitado, mostrar solo el texto del valor seleccionado
  if (config.disabled) {
    const selectedOption = options.find(opt => opt.id === value || String(opt.id) === String(value));
    
    return (
      <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
        {selectedOption ? selectedOption.name : value ? `ID: ${value}` : "Sin seleccionar"}
      </div>
    );
  }

  return (
    <Select
      value={value != null ? String(value) : ""}
      onValueChange={(newValue) => onChange(newValue ? Number(newValue) : null)}
      disabled={false}
    >
      <SelectTrigger>
        <SelectValue placeholder={`Seleccionar ${config.label?.toLowerCase() || "opción"}...`} />
      </SelectTrigger>
      <SelectContent>
        {options.length === 0 ? (
          <div className="p-2 text-sm text-muted-foreground">No hay opciones disponibles</div>
        ) : (
          options.map((option) => (
            <SelectItem key={option.id} value={String(option.id)}>
              {option.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
