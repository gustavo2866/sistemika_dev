/**
 * FormSection Component
 * 
 * Renders a collapsible section of the form with fields or custom content.
 * Supports title fields and dynamic collapse behavior based on create/edit mode.
 */

"use client";

import React, { useState, useMemo } from "react";
import { CollapsibleFormSection } from "../CollapsibleFormSection";
import { FormField } from "./FormField";
import type { SectionConfig, SelectOption } from "./types";

interface FormSectionProps<T = any> {
  config: SectionConfig<T>;
  formData: T;
  updateField: (field: keyof T, value: any) => void;
  errors: Record<string, string>;
  children?: React.ReactNode;
  isCreateMode?: boolean;
}

export function FormSection<T = any>({
  config,
  formData,
  updateField,
  errors,
  children,
  isCreateMode = false,
}: FormSectionProps<T>) {
  // Determine initial open state based on behavior
  const getInitialOpenState = () => {
    const behavior = config.defaultOpenBehavior || 'always';
    
    switch (behavior) {
      case 'create-only':
        return isCreateMode;
      case 'edit-only':
        return !isCreateMode;
      case 'always':
      default:
        return config.defaultOpen !== false;
    }
  };

  const [isOpen, setIsOpen] = useState(getInitialOpenState());

  // Generate subtitle from title fields
  const subtitle = useMemo(() => {
    if (!config.showTitleSubtitle || !config.fields) return undefined;

    const titleFields = config.fields.filter(f => f.isTitle);
    if (titleFields.length === 0) return undefined;

    const titleValues = titleFields
      .map(field => {
        const value = formData[field.name];
        
        // Handle different field types
        if (value == null || value === '') return null;
        
        // For select fields, get the label
        if (field.type === 'select' && field.options) {
          const option = field.options.find((opt: SelectOption) => opt.value === value);
          return option ? option.label : value;
        }
        
        // For dates, format nicely
        if (field.type === 'date' && typeof value === 'string') {
          const date = new Date(value);
          return date.toLocaleDateString();
        }
        
        return String(value);
      })
      .filter(Boolean);

    return titleValues.length > 0 ? titleValues.join(' - ') : undefined;
  }, [config.showTitleSubtitle, config.fields, formData]);

  return (
    <CollapsibleFormSection
      title={config.title}
      subtitle={subtitle}
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      {/* Custom render has priority */}
      {config.customRender ? (
        config.customRender({ formData, updateField })
      ) : config.fields ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {config.fields.map((fieldConfig) => (
            <FormField
              key={String(fieldConfig.name)}
              config={fieldConfig}
              value={formData[fieldConfig.name]}
              onChange={(value) => updateField(fieldConfig.name, value)}
              error={errors[String(fieldConfig.name)]}
            />
          ))}
        </div>
      ) : null}
      
      {/* Allow children for detail items or other custom content */}
      {children}
    </CollapsibleFormSection>
  );
}
