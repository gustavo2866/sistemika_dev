/**
 * useMobileCardRenderer - Hook to render mobile card content
 * 
 * Renders card based on mobile configuration or fallback to first columns
 */

import { useMemo } from "react";
import type { RaRecord } from "ra-core";
import { ListConfig, ColumnConfig } from "../types";
import { ReferenceField } from "@/components/reference-field";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";

export const useMobileCardRenderer = (config: ListConfig) => {
  return useMemo(() => {
    return (record: RaRecord) => {
      // If mobile config exists, use it
      if (config.mobile) {
        return <MobileCardWithConfig config={config} record={record} />;
      }

      // Fallback: render first 3-4 columns
      const columns = config.columns.slice(0, 4);
      return <MobileCardFallback columns={columns} record={record} />;
    };
  }, [config]);
};

const MobileCardWithConfig = ({ 
  config, 
  record 
}: { 
  config: ListConfig; 
  record: RaRecord;
}) => {
  const mobile = config.mobile!;
  
  return (
    <div className="space-y-2">
      {/* Primary field - most prominent */}
      {mobile.primaryField && (
        <div className="font-semibold text-base">
          {record[mobile.primaryField]}
        </div>
      )}

      {/* Badge */}
      {mobile.badge && (
        <div className="inline-flex">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            {getBadgeLabel(record[mobile.badge.source], mobile.badge.choices)}
          </span>
        </div>
      )}

      {/* Secondary fields */}
      {mobile.secondaryFields && mobile.secondaryFields.length > 0 && (
        <div className="text-sm text-muted-foreground">
          {mobile.secondaryFields.map(field => record[field]).join(" • ")}
        </div>
      )}

      {/* Detail fields */}
      {mobile.detailFields && mobile.detailFields.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {mobile.detailFields.map((fieldConfig, idx) => {
            const field = typeof fieldConfig === "string" ? fieldConfig : fieldConfig.source;
            const column = config.columns.find(col => col.source === field);
            return (
              <span key={field}>
                {idx > 0 && <span className="mr-2">•</span>}
                {column ? (
                  <FieldRenderer column={column} record={record} />
                ) : (
                  record[field]
                )}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

const MobileCardFallback = ({ 
  columns, 
  record 
}: { 
  columns: ColumnConfig[];
  record: RaRecord;
}) => {
  return (
    <div className="space-y-2">
      {columns.map((column, idx) => (
        <div key={column.source} className={idx === 0 ? "font-semibold" : "text-sm"}>
          <span className="text-muted-foreground">{column.label}: </span>
          <FieldRenderer column={column} record={record} />
        </div>
      ))}
    </div>
  );
};

const FieldRenderer = ({ 
  column, 
  record 
}: { 
  column: ColumnConfig;
  record: RaRecord;
}) => {
  // If custom render exists, use it
  if (column.render) {
    return <>{column.render(record)}</>;
  }

  // Based on column type
  switch (column.type) {
    case "reference":
      return (
        <ReferenceField 
          source={column.source} 
          reference={column.reference!}
          link={false}
        >
          <TextField source={column.referenceField || "name"} />
        </ReferenceField>
      );
      
    case "date":
      return <DateField source={column.source} />;
      
    case "choice":
      return <>{getChoiceLabel(record[column.source], column.choices)}</>;
      
    case "boolean":
      return <>{record[column.source] ? "Sí" : "No"}</>;
      
    default:
      const value = record[column.source];
      if (column.truncate && typeof value === "string") {
        return <>{truncateString(value, column.truncate)}</>;
      }
      return <>{value}</>;
  }
};

const getChoiceLabel = (value: any, choices?: readonly any[]) => {
  if (!choices) return value;
  const choice = choices.find(c => c.id === value);
  return choice?.name || value;
};

const getBadgeLabel = (value: any, choices?: readonly any[]) => {
  return getChoiceLabel(value, choices);
};

const truncateString = (str: string, maxLength: number) => {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + "...";
};
