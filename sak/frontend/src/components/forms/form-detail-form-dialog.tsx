import { FormProvider, type FieldValues, type UseFormReturn } from "react-hook-form";
import { FormDialog } from "./form-dialog";
import { useFormDetailSectionContext } from "./form-detail-section-context";
import { type FormDetailSectionAction } from "./form-detail-section-context";
import { type ReactNode } from "react";

type FormDetailFormChildren<TForm extends FieldValues> =
  | ReactNode
  | ((form: UseFormReturn<TForm>) => ReactNode);

export interface FormDetailFormDialogProps<TForm extends FieldValues> {
  title?: string | ((meta: { action: FormDetailSectionAction }) => string);
  description?: string;
  submitLabel?: string;
  updateLabel?: string;
  children: FormDetailFormChildren<TForm>;
  showFooter?: boolean;
}

export const FormDetailFormDialog = <TForm extends FieldValues>({
  title,
  description,
  submitLabel = "Agregar",
  updateLabel = "Actualizar",
  children,
  showFooter = true,
}: FormDetailFormDialogProps<TForm>) => {
  const {
    dialogOpen,
    setDialogOpen,
    handleFormSubmit,
    handleCancel,
    resolveAction,
    detalleForm,
  } = useFormDetailSectionContext<TForm>();

  const action = resolveAction();
  const resolvedTitle =
    typeof title === "function"
      ? title({ action })
      : title ?? (action === "create" ? "Agregar item" : "Editar item");
  const resolvedSubmitLabel = action === "create" ? submitLabel : updateLabel;

  return (
    <FormDialog
      open={dialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleCancel();
        }
        setDialogOpen(open);
      }}
      title={resolvedTitle}
      description={description}
      onSubmit={handleFormSubmit}
      onCancel={handleCancel}
      submitLabel={resolvedSubmitLabel}
      showFooter={showFooter}
    >
      <FormProvider {...detalleForm}>
        {typeof children === "function" ? children(detalleForm) : children}
      </FormProvider>
    </FormDialog>
  );
};
