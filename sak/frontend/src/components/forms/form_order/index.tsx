import { CircleX, Eye, Save } from "lucide-react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/form";
import { DeleteButton } from "@/components/delete-button";
import { ShowButton } from "@/components/show-button";
import { cn } from "@/lib/utils";
export {
  CompactReferenceInput,
  CompactSelectInput,
  CompactTextInput,
  buildListFilters,
} from "./filter";
export type { FilterBuilderItem } from "./filter";
export { ListLabel } from "./list/list_label";
export type { ListLabelProps } from "./list/list_label";
export { ListDate, ListEstado, ListID, ListMoney, ListStatus, ListText, ListTextarea } from "./list/list_fields";
export type { ListIDProps, ListMoneyProps, ListStatusProps, ListTextareaProps, ListTextProps } from "./list/list_fields";
export { ListColumn } from "./list/list_column";
export type { ListColumnProps } from "./list/list_column";
export { ListPaginator } from "./list/list_paginator";
export { FormOrderBulkActionsToolbar } from "./list/bulk/bulk_actions_toolbar";
export { FormOrderBulkDeleteButton } from "./list/bulk/bulk_delete_button";
export { FormOrderBulkExportButton } from "./list/bulk/bulk_export_button";
export { FormOrderListRowActions } from "./list/actions/list_row_actions";
export { ResponsiveDataTable } from "./list/responsive-data-table";
export { HiddenInput } from "./form/hidden_input";
export { SectionCard } from "./form/section_card";
export { DetalleFooterButtons } from "./form/detalle_footer_buttons";
export { CalculatedImporte } from "./form/calculated_importe";
export { TotalCompute } from "./form/total_compute";
export { DetalleHeaderActions } from "./form/detalle_header_actions";
export { DetalleDeleteButton } from "./form/detalle_delete_button";
export { DetalleToggleButton } from "./form/detalle_toggle_button";

const baseButtonClasses =
  "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs gap-1";

export const FormOrderCancelButton = (props: React.ComponentProps<"button">) => {
  const navigate = useNavigate();
  const { className, ...rest } = props;
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => navigate(-1)}
      className={cn(baseButtonClasses, className)}
      {...rest}
    >
      <CircleX className="size-3 sm:size-4" />
      Cancelar
    </Button>
  );
};

export type FormOrderSaveButtonProps = React.ComponentProps<typeof SaveButton>;

export const FormOrderSaveButton = (props: FormOrderSaveButtonProps) => {
  const { className, ...rest } = props;
  return (
    <SaveButton
      label="Guardar"
      className={cn(baseButtonClasses, className)}
      icon={<Save className="size-3 sm:size-4" />}
      {...rest}
    />
  );
};

export const FormOrderDeleteButton = (props: React.ComponentProps<typeof DeleteButton>) => {
  const { className, ...rest } = props;
  return (
    <DeleteButton
      label="Eliminar"
      size="sm"
      className={cn(baseButtonClasses, className)}
      variant="outline"
      {...rest}
    />
  );
};

export const FormOrderShowButton = (props: React.ComponentProps<typeof ShowButton>) => {
  const { className, ...rest } = props;
  return (
    <ShowButton
      label="Ver"
      className={cn(baseButtonClasses, className)}
      icon={<Eye className="size-3 sm:size-4" />}
      {...rest}
    />
  );
};

export const FormOrderToolbar = ({
  className,
  cancelProps,
  saveProps,
}: {
  className?: string;
  cancelProps?: React.ComponentProps<typeof FormOrderCancelButton>;
  saveProps?: FormOrderSaveButtonProps;
}) => {
  return (
    <div className={cn("flex w-full items-center justify-end gap-2", className)}>
      <FormOrderCancelButton {...cancelProps} />
      <FormOrderSaveButton {...saveProps} />
    </div>
  );
};

export const FormOrderEditActions = ({
  className,
  showProps,
  deleteProps,
}: {
  className?: string;
  showProps?: React.ComponentProps<typeof FormOrderShowButton>;
  deleteProps?: React.ComponentProps<typeof FormOrderDeleteButton>;
}) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <FormOrderShowButton {...showProps} />
      <FormOrderDeleteButton {...deleteProps} />
    </div>
  );
};
