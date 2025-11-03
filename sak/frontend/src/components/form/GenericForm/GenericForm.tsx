/**
 * GenericForm Component
 * 
 * Main form engine that renders a complete form based on declarative configuration.
 * Handles form state, validation, submission, and integrates with React Admin.
 */

"use client";

import React from "react";
import { RecordContextProvider } from "ra-core";
import { FormActionButtons } from "../FormActionButtons";
import { FormSection } from "./FormSection";
import { DetailItemsManager } from "./DetailItemsManager";
import { useFormLogic } from "./hooks";
import type { GenericFormProps } from "./types";

export function GenericForm<T extends Record<string, any>>({
  config,
  recordId,
}: GenericFormProps<T>) {
  const {
    formData,
    updateField,
    loading,
    saving,
    errors,
    handleSave,
    handleCancel,
  } = useFormLogic<T>(config, recordId);

  // Detect if we're in create mode (no recordId)
  const isCreateMode = !recordId;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  return (
    <RecordContextProvider value={formData}>
      <div className="space-y-4 pb-20">
        {/* Form Title */}
        {config.title && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{config.title}</h1>
          </div>
        )}

        {/* Form Sections */}
        {config.sections.map((sectionConfig, index) => (
          <FormSection
            key={index}
            config={sectionConfig}
            formData={formData}
            updateField={updateField}
            errors={errors}
            isCreateMode={isCreateMode}
          >
            {/* If section has detail items, render the manager */}
            {sectionConfig.detailItems && (
              <DetailItemsManager
                items={formData[sectionConfig.detailItems.name] || []}
                onChange={(items) =>
                  updateField(sectionConfig.detailItems!.name, items)
                }
                config={sectionConfig.detailItems.config}
              />
            )}
          </FormSection>
        ))}

        {/* Action Buttons */}
        <FormActionButtons
          onSave={handleSave}
          onCancel={handleCancel}
          loading={saving}
          saveText={config.submitLabel}
          cancelText={config.cancelLabel}
        />
      </div>
    </RecordContextProvider>
  );
}
