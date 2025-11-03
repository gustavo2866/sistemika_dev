/**
 * DetailItemDialog Component
 * 
 * Modal dialog for adding or editing a detail item.
 */

"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormField } from "./FormField";
import type { DetailItemConfig } from "./types";

interface DetailItemDialogProps<TDetail = any> {
  open: boolean;
  onClose: () => void;
  onSave: (item: TDetail) => void;
  item: TDetail;
  config: DetailItemConfig<TDetail>;
  isEdit: boolean;
}

export function DetailItemDialog<TDetail = any>({
  open,
  onClose,
  onSave,
  item,
  config,
  isEdit,
}: DetailItemDialogProps<TDetail>) {
  const [currentItem, setCurrentItem] = useState<TDetail>(item);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset when item changes
  useEffect(() => {
    setCurrentItem(item);
    setErrors({});
  }, [item]);

  const updateField = (field: keyof TDetail, value: any) => {
    setCurrentItem((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field as string]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field as string];
        return newErrors;
      });
    }
  };

  const handleSave = () => {
    // Validate if validator is provided
    if (config.validateItem) {
      const validationErrors = config.validateItem(currentItem);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
    }

    onSave(currentItem);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Artículo" : "Agregar Artículo"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {config.fields.map((fieldConfig) => (
            <FormField
              key={String(fieldConfig.name)}
              config={fieldConfig}
              value={currentItem[fieldConfig.name]}
              onChange={(value) => updateField(fieldConfig.name, value)}
              error={errors[String(fieldConfig.name)]}
            />
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave}>
            {isEdit ? "Actualizar" : "Agregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
