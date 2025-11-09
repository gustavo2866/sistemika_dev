import { type ReactNode, useEffect, useMemo, useState } from "react";
import { type FieldValues, useForm } from "react-hook-form";
import {
  FormDetailSectionAction,
  FormDetailSectionContext,
  type FormDetailSectionContextValue,
} from "./form-detail-section-context";
import { useDetailCRUD } from "./hooks/useDetailCRUD";
import type { FormDetailSchema } from "@/lib/form-detail-schema";
import type { DetailSchemaReferenceField } from "@/lib/form-detail-schema";
import { useDataProvider } from "ra-core";

type ReferenceOption = { id: number; nombre: string };

const useSchemaReferenceOptions = (
  referenceFields: DetailSchemaReferenceField[] = []
) => {
  const dataProvider = useDataProvider();
  const [optionsMap, setOptionsMap] = useState<
    Record<string, ReferenceOption[]>
  >({});
  const signature = useMemo(
    () =>
      referenceFields.map((field) => ({
        fieldName: field.fieldName,
        resource: field.resource,
        optionTextField: field.optionTextField ?? "nombre",
        perPage: field.perPage ?? 100,
        sortField: field.sortField,
        sortOrder: field.sortOrder ?? "ASC",
        transformOption: field.transformOption,
      })),
    [referenceFields]
  );

  useEffect(() => {
    if (!signature.length) {
      return;
    }

    let mounted = true;

    signature.forEach((field) => {
      const optionTextField = field.optionTextField;
      dataProvider
        .getList(field.resource, {
          pagination: { page: 1, perPage: field.perPage },
          sort: {
            field: field.sortField ?? optionTextField,
            order: field.sortOrder,
          },
          filter: {},
        })
        .then(({ data }) => {
          if (!mounted) return;
          setOptionsMap((prev) => ({
            ...prev,
            [field.fieldName]: data.map((item: any) =>
              field.transformOption
                ? field.transformOption(item)
                : {
                    id: Number(item.id),
                    nombre: item[optionTextField] ?? item.nombre ?? "",
                  }
            ),
          }));
        })
        .catch((error) => {
          console.error("Error loading reference options", field.resource, error);
        });
    });

    return () => {
      mounted = false;
    };
  }, [dataProvider, signature]);

  return optionsMap;
};

export interface FormDetailSectionSubmitPayload<TDetail> {
  action: FormDetailSectionAction;
  item: TDetail;
}

type SchemaFormValues<TSchema> = TSchema extends FormDetailSchema<
  infer TForm,
  any
>
  ? TForm
  : FieldValues;

type SchemaDetail<TSchema> = TSchema extends FormDetailSchema<
  any,
  infer TDetail
>
  ? TDetail
  : unknown;

export interface FormDetailSectionProps<TSchema extends FormDetailSchema<any, any>> {
  name: string;
  schema: TSchema;
  minItems?: number;
  onAfterSubmit?: (payload: FormDetailSectionSubmitPayload<
    SchemaDetail<TSchema>
  >) => void;
  onAfterDelete?: (payload: { item: SchemaDetail<TSchema> }) => void;
  children: ReactNode;
}

export const FormDetailSection = <TSchema extends FormDetailSchema<any, any>>({
  name,
  schema,
  minItems,
  onAfterSubmit,
  onAfterDelete,
  children,
}: FormDetailSectionProps<TSchema>) => {
  type TForm = SchemaFormValues<TSchema>;
  type TDetail = SchemaDetail<TSchema>;

  const detalleForm = useForm<TForm>({
    defaultValues: schema.defaults(),
  });

  const referenceFields = schema.referenceFields ?? [];
  const referenceOptionsMap = useSchemaReferenceOptions(referenceFields);

  const getReferenceOptions = (fieldName: string) =>
    referenceOptionsMap[fieldName] ?? [];

  const {
    fields,
    sortedEntries,
    dialogOpen,
    setDialogOpen,
    editingIndex,
    setEditingIndex,
    handleAdd,
    handleDelete,
    handleSubmit,
    handleCancel,
  } = useDetailCRUD<TForm, TDetail>({
    fieldName: name,
    detalleForm,
    defaultValues: schema.defaults(),
  });

  const actionRef = () =>
    (editingIndex == null ? "create" : "update") as FormDetailSectionAction;

  const startCreate = () => {
    handleAdd();
    setDialogOpen(true);
  };

  const startEdit = (originalIndex: number) => {
    const current = fields[originalIndex] as unknown as TDetail | undefined;
    if (!current) return;
    const formValues =
      schema.toForm(current) ?? (detalleForm.getValues() as TForm);
    detalleForm.reset(formValues);
    setEditingIndex(originalIndex);
    setDialogOpen(true);
  };

  const editBySortedIndex = (sortedIndex: number) => {
    const entry = sortedEntries[sortedIndex];
    if (!entry) return;
    startEdit(entry.originalIndex);
  };

  const deleteByOriginalIndex = (originalIndex: number) => {
    const current = fields[originalIndex] as unknown as TDetail | undefined;
    handleDelete(originalIndex);
    if (current) {
      onAfterDelete?.({ item: current });
    }
  };

  const deleteBySortedIndex = (sortedIndex: number) => {
    const entry = sortedEntries[sortedIndex];
    if (!entry) return;
    deleteByOriginalIndex(entry.originalIndex);
  };

  const submitHandler = detalleForm.handleSubmit(async (values) => {
    const action = actionRef();
    const normalized = schema.toModel(values, {
      getReferenceOptions,
    });

    handleSubmit(normalized, () => {
      onAfterSubmit?.({ action, item: normalized });
    });
  });

  const items = useMemo(() => sortedEntries.map((entry) => entry.item), [sortedEntries]);

  const contextValue: FormDetailSectionContextValue<TForm, TDetail> = {
    fieldName: name,
    detalleForm,
    dialogOpen,
    setDialogOpen,
    editingIndex,
    setEditingIndex,
    minItems,
    sortedEntries,
    items,
    handleStartCreate: startCreate,
    handleStartEdit: startEdit,
    handleEditBySortedIndex: editBySortedIndex,
    handleDeleteByOriginalIndex: deleteByOriginalIndex,
    handleDeleteBySortedIndex: deleteBySortedIndex,
    handleFormSubmit: submitHandler,
    handleCancel,
    resolveAction: actionRef,
  };

  return (
    <FormDetailSectionContext.Provider value={contextValue}>
      {children}
    </FormDetailSectionContext.Provider>
  );
};
