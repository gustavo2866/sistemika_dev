/**
 * DetailItemsManager Component
 * 
 * Manages an array of detail items (sub-records) within a form.
 * Displays items in a grid and handles add/edit/delete operations.
 */

"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetalleItemCard } from "../DetalleItemCard";
import type { DetailItemConfig } from "./types";
import { DetailItemDialog } from "./DetailItemDialog";

interface DetailItemsManagerProps<TDetail = any> {
  items: TDetail[];
  onChange: (items: TDetail[]) => void;
  config: DetailItemConfig<TDetail>;
}

export function DetailItemsManager<TDetail = any>({
  items,
  onChange,
  config,
}: DetailItemsManagerProps<TDetail>) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAdd = () => {
    setEditingIndex(null);
    setDialogOpen(true);
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setDialogOpen(true);
  };

  const handleDelete = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handleSaveItem = (item: TDetail) => {
    if (editingIndex !== null) {
      // Edit existing
      const newItems = [...items];
      newItems[editingIndex] = item;
      onChange(newItems);
    } else {
      // Add new
      onChange([...items, item]);
    }
    setDialogOpen(false);
    setEditingIndex(null);
  };

  const handleCancel = () => {
    setDialogOpen(false);
    setEditingIndex(null);
  };

  return (
    <div className="space-y-4">
      {/* Items Grid */}
      {items.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item, index) => {
            const badge = config.getCardBadge?.(item);
            return (
              <DetalleItemCard
                key={index}
                title={config.getCardTitle(item)}
                subtitle={config.getCardDescription?.(item)}
                badges={badge ? [{ label: badge, variant: "secondary" }] : undefined}
                onEdit={() => handleEdit(index)}
                onDelete={() => handleDelete(index)}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          No hay artículos agregados. Presione el botón para agregar.
        </div>
      )}

      {/* Add Button */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleAdd}
        disabled={config.maxItems !== undefined && items.length >= config.maxItems}
      >
        <Plus className="h-4 w-4 mr-2" />
        Agregar Artículo
      </Button>

      {/* Validation Message */}
      {config.minItems !== undefined && items.length < config.minItems && (
        <p className="text-sm text-red-500">
          Debe agregar al menos {config.minItems} artículo(s)
        </p>
      )}

      {/* Edit/Add Dialog */}
      <DetailItemDialog
        open={dialogOpen}
        onClose={handleCancel}
        onSave={handleSaveItem}
        item={editingIndex !== null ? items[editingIndex] : config.defaultItem()}
        config={config}
        isEdit={editingIndex !== null}
      />
    </div>
  );
}
