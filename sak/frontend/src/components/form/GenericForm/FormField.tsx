/**
 * FormField Component
 * 
 * Renders a single form field based on its configuration.
 * Handles different field types (text, number, select, etc.) and validation.
 */

"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ReferenceField } from "@/components/form/ReferenceField";
import type { FieldConfig } from "./types";

interface FormFieldProps<T = any> {
  config: FieldConfig<T>;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}

export function FormField<T = any>({
  config,
  value,
  onChange,
  error,
}: FormFieldProps<T>) {
  const fieldId = `field-${String(config.name)}`;

  // Custom render if provided
  if (config.customRender) {
    return config.customRender({ value, onChange, error });
  }

  const renderField = () => {
    switch (config.type) {
      case "text":
        return (
          <Input
            id={fieldId}
            type="text"
            placeholder={config.placeholder}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={config.disabled}
            className={error ? "border-red-500" : ""}
          />
        );

      case "textarea":
        return (
          <Textarea
            id={fieldId}
            placeholder={config.placeholder}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={config.disabled}
            className={error ? "border-red-500" : ""}
            rows={4}
          />
        );

      case "number":
        return (
          <Input
            id={fieldId}
            type="number"
            placeholder={config.placeholder}
            value={value || ""}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            disabled={config.disabled}
            min={config.min}
            max={config.max}
            step={config.step}
            className={error ? "border-red-500" : ""}
          />
        );

      case "date":
        return (
          <Input
            id={fieldId}
            type="date"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={config.disabled}
            className={error ? "border-red-500" : ""}
          />
        );

      case "select":
        return (
          <Select
            value={value ?? ""}
            onValueChange={onChange}
            disabled={config.disabled}
          >
            <SelectTrigger className={error ? "border-red-500" : ""}>
              <SelectValue placeholder={config.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {config.options?.map((option) => (
                <SelectItem
                  key={option.value}
                  value={String(option.value)}
                  disabled={option.disabled}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={fieldId}
              checked={value || false}
              onCheckedChange={onChange}
              disabled={config.disabled}
            />
            <Label
              htmlFor={fieldId}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {config.label}
            </Label>
          </div>
        );

      case "reference":
        return <ReferenceField config={config} value={value} onChange={onChange} />;

      case "combobox":
        // For combobox, we'll use the ArticuloCombobox component
        // This is a placeholder - actual implementation will use the specific component
        return (
          <div className="text-sm text-muted-foreground">
            Combobox field (use ArticuloCombobox or similar)
          </div>
        );

      default:
        return (
          <div className="text-sm text-muted-foreground">
            Tipo de campo no soportado: {config.type}
          </div>
        );
    }
  };

  // Don't render label for checkbox (it has its own label)
  if (config.type === "checkbox") {
    return (
      <div className={config.fullWidth ? "lg:col-span-2" : ""}>
        {renderField()}
        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div className={config.fullWidth ? "lg:col-span-2" : ""}>
      <Label htmlFor={fieldId}>
        {config.label}
        {config.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <div className="mt-1.5">{renderField()}</div>
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}
