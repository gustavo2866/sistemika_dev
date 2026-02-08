import { useState } from "react";
import { RaRecord, useFieldValue } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { NumberField, type NumberFieldProps } from "@/components/number-field";
import { TextField, type TextFieldProps } from "@/components/text-field";
import { DateField, type DateFieldProps } from "@/components/date-field";
import { cn } from "@/lib/utils";
import { FieldProps } from "@/lib/field.type";

export type ListTextProps<RecordType extends RaRecord = RaRecord> = TextFieldProps<RecordType> & {
  widthClass?: string;
  width?: number | string;
};

export const ListText = <RecordType extends RaRecord = RaRecord>({
  className,
  widthClass,
  width,
  ...props
}: ListTextProps<RecordType>) => {
  return (
    <TextField
      {...props}
      className={cn("text-[10px] text-foreground", widthClass, className)}
      style={width != null ? { width } : undefined}
    />
  );
};

export type ListIDProps<RecordType extends RaRecord = RaRecord> = TextFieldProps<RecordType> & {
  widthClass?: string;
  width?: number | string;
};

export const ListID = <RecordType extends RaRecord = RaRecord>({
  className,
  widthClass = "w-[30px]",
  width,
  ...props
}: ListIDProps<RecordType>) => {
  return (
    <TextField
      {...props}
      className={cn("text-[9px] tabular-nums text-muted-foreground", widthClass, className)}
      style={width != null ? { width } : undefined}
    />
  );
};

export type ListMoneyProps<RecordType extends RaRecord = RaRecord> = NumberFieldProps<RecordType> & {
  showCurrency?: boolean;
};

export const ListMoney = <RecordType extends RaRecord = RaRecord>({
  options,
  className,
  showCurrency = true,
  ...props
}: ListMoneyProps<RecordType>) => {
  const mergedOptions: Intl.NumberFormatOptions = {
    style: showCurrency ? "currency" : "decimal",
    currency: showCurrency ? "ARS" : undefined,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  };

  return (
    <NumberField
      {...props}
      options={mergedOptions}
      className={cn("text-[10px] tabular-nums whitespace-nowrap", className)}
    />
  );
};

export const ListDate = <RecordType extends RaRecord = RaRecord>({
  className,
  ...props
}: DateFieldProps<RecordType>) => {
  return (
    <DateField
      {...props}
      className={cn("text-[10px] whitespace-nowrap", className)}
    />
  );
};

export type ListStatusProps<RecordType extends RaRecord = RaRecord> = FieldProps<RecordType> & {
  className?: string;
  variant?: "default" | "outline" | "secondary" | "destructive";
  statusClasses?: Record<string, string>;
  emptyLabel?: string;
};

export const ListStatus = <RecordType extends RaRecord = RaRecord>({
  className,
  variant = "outline",
  statusClasses,
  emptyLabel = "-",
  ...props
}: ListStatusProps<RecordType>) => {
  const value = useFieldValue(props);
  if (value == null || value === "") {
    return <span className={cn("text-[11px] text-muted-foreground", className)}>{emptyLabel}</span>;
  }

  const valueKey = String(value);
  const lookupKey = valueKey.toLowerCase();
  const badgeClass = statusClasses?.[valueKey] ?? statusClasses?.[lookupKey];

  return (
    <Badge
      variant={variant}
      className={cn("text-[9px] font-medium", badgeClass, className)}
    >
      {valueKey}
    </Badge>
  );
};

export const ListEstado = ListStatus;

export type ListTextareaProps<RecordType extends RaRecord = RaRecord> = FieldProps<RecordType> & {
  className?: string;
  maxLength?: number;
};

export const ListTextarea = <RecordType extends RaRecord = RaRecord>({
  className,
  maxLength = 80,
  ...props
}: ListTextareaProps<RecordType>) => {
  const value = useFieldValue(props);
  const [expanded, setExpanded] = useState(false);
  const text = value == null ? "" : String(value);
  const isLong = text.length > maxLength;
  const display = expanded || !isLong ? text : text.slice(0, maxLength).trimEnd();

  if (!text) {
    return <span className={cn("text-[11px] text-muted-foreground", className)}>-</span>;
  }

  return (
    <span className={cn("text-[10px] text-foreground", className)}>
      {display}
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="ml-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
        >
          …
        </button>
      ) : null}
    </span>
  );
};
