/**
 * Hook to render columns based on configuration
 */

import { ReactNode } from "react";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";
import { ReferenceField } from "@/components/reference-field";
import { ColumnConfig } from "../types";

export function useColumnRenderer() {
  const renderColumn = (col: ColumnConfig): ReactNode => {
    // Custom render function - will be called by DataTable with record
    if (col.render) {
      // Return a component that will call the render function
      return <TextField source={col.source} />;  // Fallback, render should handle it
    }
    
    // Format function (handled by TextField internally)
    // if (col.format) {
    //   return <TextField source={col.source} />;
    // }
    
    // Type-based rendering
    switch (col.type) {
      case "reference":
        if (col.preloaded && col.preloadedPath) {
          // Use already loaded data
          return <TextField source={`${col.preloadedPath}.${col.referenceField}`} />;
        }
        // Fetch reference
        return (
          <ReferenceField 
            source={col.source} 
            reference={col.reference!}
            link={col.link ? "show" : false}
          >
            <TextField source={col.referenceField!} />
          </ReferenceField>
        );
        
      case "date":
      case "datetime":
        return <DateField source={col.source} showTime={col.type === "datetime"} />;
        
      case "choice":
        return <TextField source={col.source} />;  // TODO: Map choice
        
      case "boolean":
        return <TextField source={col.source} />;  // TODO: Boolean render
        
      case "number":
        return <TextField source={col.source} />;
        
      case "text":
      default:
        return <TextField source={col.source} />;
    }
  };
  
  return renderColumn;
}
