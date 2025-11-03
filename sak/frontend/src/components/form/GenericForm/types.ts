/**
 * Generic Form Configuration Types
 * 
 * This module defines the type system for declarative form configuration.
 * It allows forms to be defined via configuration objects rather than hardcoded JSX.
 */

export type FieldType = 
  | "text" 
  | "textarea" 
  | "number" 
  | "date" 
  | "select" 
  | "combobox"
  | "reference"
  | "checkbox" 
  | "custom";

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface ValidationRule {
  type: "required" | "min" | "max" | "pattern" | "custom";
  value?: number | string | RegExp;
  message?: string;
  validator?: (value: any) => string | null;
}

/**
 * Configuration for a single form field
 */
export interface FieldConfig<T = any> {
  name: keyof T;
  label: string;
  type: FieldType;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  validations?: ValidationRule[];
  
  // For select/combobox fields
  options?: SelectOption[];
  fetchOptions?: () => Promise<SelectOption[]>;
  searchable?: boolean;
  
  // For reference fields (foreign keys)
  reference?: string;          // Resource name (e.g., "usuarios")
  referenceSource?: string;    // Field to display (e.g., "nombre")
  referenceFilters?: Record<string, any>;  // Additional filters
  
  // For number fields
  min?: number;
  max?: number;
  step?: number;
  
  // For custom rendering
  customRender?: (props: {
    value: any;
    onChange: (value: any) => void;
    error?: string;
  }) => React.ReactNode;
  
  // Layout
  fullWidth?: boolean;
  className?: string;
  
  // Title field marker - used for section subtitles
  isTitle?: boolean;
}

/**
 * Configuration for detail items (nested arrays in forms)
 */
export interface DetailItemConfig<TDetail = any> {
  fields: FieldConfig<TDetail>[];
  defaultItem: () => TDetail;
  getCardTitle: (item: TDetail) => string;
  getCardDescription?: (item: TDetail) => string;
  getCardBadge?: (item: TDetail) => string;
  
  // Validation
  validateItem?: (item: TDetail) => Record<string, string>;
  minItems?: number;
  maxItems?: number;
}

/**
 * Configuration for a collapsible form section
 */
export interface SectionConfig<T = any> {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  /** 
   * Controls default open behavior based on mode
   * - 'always': Always use defaultOpen value
   * - 'create-only': Open in create, closed in edit
   * - 'edit-only': Closed in create, open in edit
   */
  defaultOpenBehavior?: 'always' | 'create-only' | 'edit-only';
  fields?: FieldConfig<T>[];
  detailItems?: {
    name: keyof T;
    config: DetailItemConfig;
  };
  customRender?: (props: {
    formData: T;
    updateField: (field: keyof T, value: any) => void;
  }) => React.ReactNode;
  /**
   * Show subtitle with concatenated title fields
   */
  showTitleSubtitle?: boolean;
}

/**
 * Main form configuration interface
 */
export interface FormConfig<T = any> {
  resource: string;
  title?: string;
  sections: SectionConfig<T>[];
  
  // Form-level validation
  validate?: (data: T) => Record<string, string>;
  
  // Form-level hooks
  onBeforeSave?: (data: T) => T | Promise<T>;
  onAfterSave?: (data: T) => void | Promise<void>;
  
  // UI customization
  submitLabel?: string;
  cancelLabel?: string;
  showDeleteButton?: boolean;
  
  // Behavior
  enableEnterKeyNavigation?: boolean;
  redirectAfterSave?: string | ((id: any) => string);
}

/**
 * Props for the GenericForm component
 */
export interface GenericFormProps<T = any> {
  config: FormConfig<T>;
  recordId?: string | number;
  onCustomAction?: (action: string, data: any) => void;
}
