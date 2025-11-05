/**
 * DetailItemsManager Component
 *
 * Manages an array of detail items (sub-records) within a form.
 * Displays items in a responsive grid and handles add/edit/delete operations.
 */

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Plus } from "lucide-react";
import { useDataProvider } from "ra-core";
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
  const dataProvider = useDataProvider();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [articulosMap, setArticulosMap] = useState<Record<number, string>>({});

  // Mantener un mapa con los nombres de los artículos para mostrar chips amigables
  useEffect(() => {
    const loadArticulos = async () => {
      const articuloField = config.fields.find(
        (field) => String(field.name) === "articulo_id"
      );
      if (!articuloField || !articuloField.reference) {
        return;
      }

      const articuloIds = items
        .map((item: any) => item.articulo_id)
        .filter((id): id is number => id != null && id > 0);

      if (articuloIds.length === 0) {
        return;
      }

      try {
        const { data } = await dataProvider.getList(articuloField.reference, {
          pagination: { page: 1, perPage: 1000 },
          sort: {
            field: articuloField.referenceSource || "nombre",
            order: "ASC",
          },
          filter: { id: articuloIds },
        });

        const map: Record<number, string> = {};
        data.forEach((articulo: any) => {
          map[articulo.id] =
            articulo[articuloField.referenceSource || "nombre"];
        });
        setArticulosMap(map);
      } catch (error) {
        console.error("Error loading articulos:", error);
      }
    };

    loadArticulos();
  }, [items, config.fields, dataProvider]);

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
    const normalizedItem = { ...(item as any) } as TDetail;
    if (editingIndex !== null) {
      const newItems = [...items];
      newItems[editingIndex] = normalizedItem;
      onChange(newItems);
    } else {
      onChange([...items, normalizedItem]);
    }
    setDialogOpen(false);
    setEditingIndex(null);
  };

  const handleCancel = () => {
    setDialogOpen(false);
    setEditingIndex(null);
  };

  const sortedEntries = useMemo(() => {
    return items
      .map((item, index) => ({ item, originalIndex: index }))
      .sort((a, b) => {
        const idA = (a.item as any)?.id;
        const idB = (b.item as any)?.id;

        if (idA != null && idB != null) {
          return Number(idB) - Number(idA);
        }
        if (idA != null) return -1;
        if (idB != null) return 1;

        return b.originalIndex - a.originalIndex;
      });
  }, [items]);

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={handleAdd}
        disabled={config.maxItems !== undefined && items.length >= config.maxItems}
      >
        <Plus className="mr-2 h-4 w-4" />
        Agregar artículo
      </Button>

      {sortedEntries.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sortedEntries.map(({ item, originalIndex }, renderedIndex) => {
            const articuloNombre = item.articulo_id
              ? articulosMap[item.articulo_id]
              : null;

            let badge = config.getCardBadge?.(item);
            if (articuloNombre) {
              badge = articuloNombre;
            }

            return (
              <DetalleItemCard
                key={(item as any)?.id ?? `${originalIndex}-${renderedIndex}`}
                title={config.getCardTitle(item)}
                subtitle={config.getCardDescription?.(item)}
                badges={badge ? [{ label: badge, variant: "secondary" }] : []}
                onEdit={() => handleEdit(originalIndex)}
                onDelete={() => handleDelete(originalIndex)}
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/40 py-10 text-center text-sm text-muted-foreground">
          Todavía no cargaste artículos. Usa el botón para agregar el primero.
        </div>
      )}

      {config.minItems !== undefined && items.length < config.minItems && (
        <p className="text-sm text-red-500">
          Debes agregar al menos {config.minItems} artículo(s)
        </p>
      )}

      <DetailItemDialog
        open={dialogOpen}
        onClose={handleCancel}
        onSave={handleSaveItem}
        item={
          editingIndex !== null ? items[editingIndex] : config.defaultItem()
        }
        config={config}
        isEdit={editingIndex !== null}
      />
    </div>
  );
}
