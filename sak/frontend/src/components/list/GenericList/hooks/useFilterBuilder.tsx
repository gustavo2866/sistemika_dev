/**
 * Hook to build filter components from configuration
 */

import { ReactElement } from "react";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { ReferenceInput } from "@/components/reference-input";
import { FilterConfig } from "../types";

export function useFilterBuilder(filters?: FilterConfig[]): ReactElement<any>[] {
  if (!filters || filters.length === 0) return [];
  
  return filters.map((filter, index) => {
    // Custom render
    if (filter.render) {
      return filter.render({ key: `filter-${index}` }) as ReactElement;
    }
    
    // Type-based filter
    switch (filter.type) {
      case "text":
        return (
          <TextInput
            key={filter.source}
            source={filter.source}
            label={filter.label}
            placeholder={filter.placeholder}
            alwaysOn={filter.alwaysOn}
            defaultValue={filter.defaultValue}
          />
        );
        
      case "select":
        return (
          <SelectInput
            key={filter.source}
            source={filter.source}
            label={filter.label}
            choices={filter.choices ? [...filter.choices] : []}
            alwaysOn={filter.alwaysOn}
            defaultValue={filter.defaultValue}
          />
        );
        
      case "reference":
        if (!filter.reference) {
          console.error(`Filter ${filter.source} is type "reference" but missing "reference" property`);
          return (
            <TextInput
              key={filter.source}
              source={filter.source}
              label={filter.label}
            />
          );
        }
        return (
          <ReferenceInput
            key={filter.source}
            source={filter.source}
            reference={filter.reference}
            label={filter.label}
          >
            <SelectInput 
              optionText={filter.referenceField || "nombre"}
              emptyText="Todos"
            />
          </ReferenceInput>
        );
        
      // TODO: Add more filter types (date, number, boolean, etc.)
      
      default:
        return (
          <TextInput
            key={filter.source}
            source={filter.source}
            label={filter.label}
            placeholder={filter.placeholder}
          />
        );
    }
  });
}
