import { createContext, useContext } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

export type FormDetailSectionAction = "create" | "update";

export interface FormDetailSectionContextValue<
  TForm extends FieldValues = FieldValues,
  TDetail = unknown,
> {
  fieldName: string;
  detalleForm: UseFormReturn<TForm>;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  editingIndex: number | null;
  setEditingIndex: (index: number | null) => void;
  minItems?: number;
  sortedEntries: Array<{ item: TDetail; originalIndex: number }>;
  items: TDetail[];
  handleStartCreate: () => void;
  handleStartEdit: (originalIndex: number) => void;
  handleEditBySortedIndex: (sortedIndex: number) => void;
  handleDeleteByOriginalIndex: (originalIndex: number) => void;
  handleDeleteBySortedIndex: (sortedIndex: number) => void;
  handleClearAll: () => void;
  handleFormSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  handleCancel: () => void;
  resolveAction: () => FormDetailSectionAction;
  getReferenceOptions: (fieldName: string) => Array<{ id: number; nombre: string }>;
  getReferenceLabel: (
    fieldName: string,
    value: number | string | null | undefined
  ) => string | undefined;
}

export const FormDetailSectionContext =
  createContext<FormDetailSectionContextValue | null>(null);

export function useFormDetailSectionContext<
  TForm extends FieldValues = FieldValues,
  TDetail = unknown,
>() {
  const context = useContext(
    FormDetailSectionContext,
  ) as FormDetailSectionContextValue<TForm, TDetail> | null;

  if (!context) {
    throw new Error("useFormDetailSectionContext debe usarse dentro de un FormDetailSection.");
  }

  return context;
}
