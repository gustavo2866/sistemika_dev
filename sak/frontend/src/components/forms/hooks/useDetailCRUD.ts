import { useMemo, useState } from "react";
import { useFormContext, useFieldArray, FieldValues, UseFormReturn } from "react-hook-form";

export interface UseDetailCRUDReturn<_TForm extends FieldValues, TDetail> {
  fields: any[];
  sortedEntries: Array<{ item: TDetail; originalIndex: number }>;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  editingIndex: number | null;
  setEditingIndex: (index: number | null) => void;
  handleAdd: () => void;
  handleEdit: (index: number) => void;
  handleDelete: (index: number) => void;
  handleClearAll: () => void;
  handleSubmit: (normalized: TDetail, callback?: () => void) => void;
  handleCancel: () => void;
}

interface UseDetailCRUDOptions<TForm extends FieldValues> {
  fieldName: string;
  detalleForm: UseFormReturn<TForm>;
  defaultValues: TForm;
}

export function useDetailCRUD<TForm extends FieldValues, TDetail extends { id?: number; tempId?: number }>({
  fieldName,
  detalleForm,
  defaultValues,
}: UseDetailCRUDOptions<TForm>): UseDetailCRUDReturn<TForm, TDetail> {
  const { control } = useFormContext();
  const { fields, append, update, remove } = useFieldArray({
    control,
    name: fieldName,
    keyName: "fieldId",
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const sortedEntries = useMemo(
    () =>
      fields
        .map((item, originalIndex) => ({ item: item as unknown as TDetail, originalIndex }))
        .sort((a, b) => {
          const idA = a.item.id ?? a.item.tempId ?? 0;
          const idB = b.item.id ?? b.item.tempId ?? 0;
          return Number(idB) - Number(idA);
        }),
    [fields]
  );

  const handleAdd = () => {
    setEditingIndex(null);
    detalleForm.reset(defaultValues);
  };

  const handleEdit = (index: number) => {
    const current = fields[index] as any;
    detalleForm.reset(current);
    setEditingIndex(index);
  };

  const handleDelete = (index: number) => {
    remove(index);
  };

  const handleClearAll = () => {
    // Eliminar todos los elementos del array
    for (let i = fields.length - 1; i >= 0; i--) {
      remove(i);
    }
    // Cerrar dialog si está abierto y resetear estado
    setDialogOpen(false);
    setEditingIndex(null);
    detalleForm.reset(defaultValues);
  };

  const handleSubmit = (normalized: TDetail, callback?: () => void) => {
    if (editingIndex == null) {
      append(
        {
          ...normalized,
          tempId: Date.now(),
        } as any,
        { shouldFocus: false }
      );
      callback?.();
    } else {
      const existing = fields[editingIndex] as any;
      update(editingIndex, {
        ...existing,
        ...normalized,
        tempId: existing.tempId ?? Date.now(),
      });
    }
    handleCancel();
  };

  const handleCancel = () => {
    setDialogOpen(false);
    setEditingIndex(null);
    detalleForm.reset(defaultValues);
  };

  return {
    fields,
    sortedEntries,
    dialogOpen,
    setDialogOpen,
    editingIndex,
    setEditingIndex,
    handleAdd,
    handleEdit,
    handleDelete,
    handleClearAll,
    handleSubmit,
    handleCancel,
  };
}
