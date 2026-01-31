// Exporta todos los componentes compactos para filtros
export { CompactTextInput } from "./compact-text-input";
export { CompactSelectInput } from "./compact-select-input";  
export { CompactReferenceInput } from "./compact-reference-input";
export { buildListFilters } from "./builder";
export type { FilterBuilderItem } from "./builder";

// Re-exporta tipos si son necesarios
export type { TextInputProps } from "@/components/text-input";
export type { SelectInputProps } from "@/components/select-input";
export type { ReferenceInputProps } from "@/components/reference-input";
