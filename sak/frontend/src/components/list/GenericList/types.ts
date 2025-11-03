/**
 * Type definitions for ConfigurableList system
 * 
 * This file contains all the types needed to configure declarative lists
 */

import { ReactNode } from "react";
import { Identifier, DataProvider, SortPayload } from "ra-core";

// ==========================================
// ACTION TYPES
// ==========================================

/**
 * Where the action appears for individual rows
 */
export type IndividualActionPosition = 
  | "inline"   // Button/icon visible in the row
  | "menu"     // Inside popup menu "..."
  | "column"   // Dedicated column
  | "none";    // Does not appear in individual rows

/**
 * Button variant (from shadcn/ui)
 */
export type ActionVariant = 
  | "default" 
  | "destructive" 
  | "outline" 
  | "secondary" 
  | "ghost";

/**
 * Helpers available in action execution
 */
export interface ActionHelpers {
  notify: (message: string, options?: { type: "success" | "error" | "info" }) => void;
  refresh: () => void;
  dataProvider: DataProvider;
  navigate: (path: string) => void;
  unselectAll?: () => void;  // Only available in bulk actions
  dialogData?: any;           // Dialog data if dialog was used
}

/**
 * Confirmation dialog configuration
 */
export interface ActionConfirm {
  title: string;
  content: string | ((count: number, records?: any[]) => string);
}

/**
 * Input dialog field configuration
 */
export interface DialogField {
  name: string;
  type: "text" | "select" | "number" | "date" | "checkbox";
  label: string;
  required?: boolean;
  multiline?: boolean;
  choices?: ReadonlyArray<{ readonly id: any; readonly name: string }>;
  defaultValue?: any;
  placeholder?: string;
}

/**
 * Input dialog configuration
 */
export interface ActionDialog {
  title: string;
  description?: string;
  fields: DialogField[];
}

/**
 * Column-specific action configuration
 */
export interface ActionColumnConfig {
  width?: number;
  align?: "left" | "center" | "right";
  header?: string;  // Override label for column header
}

/**
 * Action configuration
 */
export interface ActionConfig {
  name: string;
  label: string;
  icon?: string;  // Icon name from lucide-react
  variant?: ActionVariant;
  
  // ⭐ ACTION SCOPE
  individual: IndividualActionPosition;  // Where it appears for individual rows
  bulk: boolean;                          // Whether it appears in bulk actions bar
  
  // Execution
  action?: (
    ids: Identifier[],
    helpers: ActionHelpers,
  ) => void | Promise<void>;
  
  // Custom hook (for React hooks usage)
  useAction?: () => (ids: Identifier[], record?: any) => void | Promise<void>;
  
  // Simplified mutation
  mutation?: {
    type: "updateMany" | "deleteMany" | "create";
    data?: Record<string, any> | ((record?: any) => Record<string, any>);
    endpoint?: string;
  };
  
  // Input dialog
  dialog?: ActionDialog;
  
  // Confirmation
  confirm?: ActionConfirm;
  
  // Messages
  successMessage?: string | ((count: number, records?: any[]) => string);
  errorMessage?: string | ((error: any) => string);
  
  // Conditional visibility (for individual)
  isVisible?: (record?: any) => boolean;
  
  // Enable/disable (for individual)
  isEnabled?: (record?: any) => boolean;
  
  // Column-specific configuration
  columnConfig?: ActionColumnConfig;
  
  // Menu separator
  separator?: "before" | "after";
  
  // Custom render (advanced)
  render?: (ids: Identifier[], record?: any) => ReactNode;
}

/**
 * Row actions layout configuration
 */
export interface RowActionsLayout {
  inline?: {
    maxVisible?: number;     // Max inline buttons (default: 3)
    showLabels?: boolean;    // Show text (default: false)
    size?: "sm" | "md";      // Button size
    gap?: number;            // Spacing (default: 1)
  };
  menu?: {
    icon?: string;           // Menu button icon (default: MoreVertical)
    label?: string;          // Accessibility label
    variant?: ActionVariant; // Button variant
    position?: "left" | "right"; // Column side
    showIcon?: boolean;      // Show if actions exist
  };
}

// ==========================================
// COLUMN TYPES
// ==========================================

/**
 * Field types for rendering
 */
export type FieldType = 
  | "text" 
  | "number" 
  | "date" 
  | "datetime"
  | "boolean" 
  | "choice" 
  | "reference"
  | "custom";

/**
 * Choice option
 */
export interface Choice {
  readonly id: string | number;
  readonly name: string;
}

/**
 * Column configuration
 */
export interface ColumnConfig {
  source: string;
  label: string;
  type?: FieldType;
  sortable?: boolean;
  
  // For specific types
  choices?: readonly Choice[];     // For type: "choice"
  reference?: string;              // For type: "reference"
  referenceField?: string;         // For type: "reference"
  link?: boolean;                  // For type: "reference"
  preloaded?: boolean;             // If backend already expanded
  preloadedPath?: string;          // Path to expanded object
  truncate?: number;               // For type: "text"
  format?: (value: any) => string; // Custom formatting
  render?: (record: any) => ReactNode; // Custom render
  
  // Column styling
  width?: number;
  align?: "left" | "center" | "right";
}

// ==========================================
// FILTER TYPES
// ==========================================

/**
 * Filter types
 */
export type FilterType = 
  | "text" 
  | "number" 
  | "select" 
  | "date" 
  | "boolean"
  | "reference";

/**
 * Filter configuration
 */
export interface FilterConfig {
  source: string;
  type: FilterType;
  label?: string | false;
  placeholder?: string;
  alwaysOn?: boolean;
  choices?: readonly Choice[];
  defaultValue?: any;
  
  // For reference filters
  reference?: string;
  referenceField?: string;
  
  // Custom component
  render?: (props: any) => ReactNode;
}

// ==========================================
// MOBILE TYPES
// ==========================================

/**
 * Mobile field configuration
 */
export interface MobileFieldConfig {
  source: string;
  type?: FieldType;
  reference?: string;
  referenceField?: string;
  format?: (value: any) => string;
}

/**
 * Mobile view configuration
 */
export interface MobileConfig {
  primaryField: string;
  secondaryFields?: string[];
  badge?: {
    source: string;
    choices?: readonly Choice[];
  };
  detailFields?: MobileFieldConfig[];
  descriptionField?: {
    source: string;
    truncate?: number;
  };
  customCard?: (record: any) => ReactNode;
}

// ==========================================
// MAIN LIST CONFIG
// ==========================================

/**
 * Complete list configuration
 */
export interface ListConfig {
  resource: string;
  title?: string;
  
  // Pagination and sorting
  perPage?: number;
  defaultSort?: SortPayload;
  
  // Filters
  filters?: FilterConfig[];
  
  // Columns
  columns: ColumnConfig[];
  
  // Mobile view
  mobile?: MobileConfig;
  
  // ⭐ UNIFIED ACTIONS
  actions?: ActionConfig[];
  
  // Row actions layout
  rowActionsLayout?: RowActionsLayout;
  
  // Row click behavior
  rowClick?: string | ((id: Identifier) => string);
  
  // Empty state
  emptyText?: string;
  emptyIcon?: string;
  
  // Custom components
  customComponents?: {
    listActions?: ReactNode;
    bulkActions?: ReactNode;
    emptyState?: ReactNode;
  };
}
