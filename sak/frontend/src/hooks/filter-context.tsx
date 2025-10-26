import * as React from "react";
import { useContext } from "react";

export interface FilterElementProps {
  alwaysOn?: boolean;
  context?: string;
  defaultValue?: unknown;
  resource?: string;
  record?: object;
  source: string;
  disabled?: boolean;
  label?: React.ReactNode;

  [key: string]: unknown; // Allow any other prop
}

export type FilterContextType =
  | React.ReactElement<FilterElementProps>[]
  | undefined;

/**
 * Make filters accessible to sub components
 * @deprecated Use FilterContext from `ra-core` once available.
 */
export const FilterContext = React.createContext<FilterContextType>(undefined);

/**
 * @deprecated Use useFilterContext from `ra-core` once available.
 */
export const useFilterContext = (): FilterContextType => {
  return useContext(FilterContext);
};
