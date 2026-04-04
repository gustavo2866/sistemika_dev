import { CircleX, Eye, Pencil, Save } from "lucide-react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/form";
import { DeleteButton } from "@/components/delete-button";
import { ShowButton } from "@/components/show-button";
import { cn } from "@/lib/utils";
import { Link } from "react-router";
import { useCreatePath, useRecordContext, useResourceContext } from "ra-core";
export {
  CompactReferenceInput,
  CompactSelectInput,
  CompactTextInput,
  buildListFilters,
} from "./filter";
export type { FilterBuilderItem } from "./filter";
export { ListLabel } from "./list/list_label";
export type { ListLabelProps } from "./list/list_label";
export { ListBoolean, ListDate, ListEstado, ListID, ListMoney, ListNumber, ListStatus, ListText, ListTextarea } from "./list/list_fields";
export type { ListBooleanProps, ListIDProps, ListMoneyProps, ListNumberProps, ListStatusProps, ListTextareaProps, ListTextProps } from "./list/list_fields";
export { BooleanListColumn, DateListColumn, ListColumn, NumberListColumn, TextListColumn } from "./list/list_column";
export type { ListColumnProps } from "./list/list_column";
export { ListPaginator } from "./list/list_paginator";
export {
  CompactSoloActivasToggleFilter,
  SoloActivasToggleFilter,
} from "./list/solo_activas_toggle";
export {
  IdentityFilterSync,
  useIdentityFilterDefaults,
} from "./list/identity_filter";
export type { IdentityFilterDefaultsOptions, IdentityFilterSyncProps } from "./list/identity_filter";
export { FormOrderBulkActionsToolbar } from "./list/bulk/bulk_actions_toolbar";
export { FormOrderBulkDeleteButton } from "./list/bulk/bulk_delete_button";
export { FormOrderBulkExportButton } from "./list/bulk/bulk_export_button";
export {
  FormOrderListRowActions,
  useRowActionDialog,
} from "./list/actions/list_row_actions";
export { ResponsiveDataTable } from "./list/responsive-data-table";
export { HiddenInput } from "./form/hidden_input";
export { FormErrorSummary } from "./form/form_error_summary";
export { SectionCard } from "./form/section_card";
export { SectionBaseTemplate } from "./form/section_base_template";
export {
  SectionDetailTemplate,
  useDetailSectionContext,
} from "./form/section_detail_template";
export { SectionDetailTemplateGrid } from "./form/section_detail_template_grid";
export type { SectionDetailTemplateGridProps } from "./form/section_detail_template_grid";
export { SectionDetailTemplate2 } from "./form/section_detail_template2";
export type {
  SectionDetailColumn,
  SectionDetailFieldsProps,
  SectionDetailTemplate2Props,
} from "./form/section_detail_template2";
export {
  FormOrderHeaderMenuActions,
} from "./form/header_menu_actions";
export type { FormOrderHeaderMenuActionsProps } from "./form/header_menu_actions";
export * from "./dashboard";
export * from "./kanban";
export { DetailFooterButtons } from "./form/detail_footer_buttons";
export { CalculatedImporte } from "./form/calculated_importe";
export { TotalCompute } from "./form/total_compute";
export { DetailHeaderActions } from "./form/detail_header_actions";
export { DetailDeleteButton } from "./form/detail_delete_button";
export { DetailInfoButton } from "./form/detail_info_button";
export { DetailToggleButton } from "./form/detail_toggle_button";
export { DetailRowError } from "./form/detail_row_error";
export { DetailFieldCell } from "./form/detail_field_cell";
export type { DetailFieldCellProps } from "./form/detail_field_cell";
export {
  DetailRowProvider,
  useDetailRowContext,
} from "./form/detail_row_context";
export { ResponsiveDetailRow } from "./form/responsive_detail_row";
export { DetailIterator } from "./form/detail_iterator";
export {
  DetailRowDesktopActions,
  DetailRowMobileDelete,
  DetailRowMobileToggle,
  DetailRowActions,
} from "./form/detail_row_actions";
export {
  FormAutocomplete,
  FormBoolean,
  FormDate,
  FormNumber,
  FormReferenceAutocomplete,
  FormSelect,
  FormSelectFijo,
  FormText,
  FormTextarea,
  FormValue,
} from "./form/field_wrappers";
export type { FormReferenceAutocompleteProps } from "./form/field_wrappers";
export { PeriodRangeNavigator } from "./dashboard/period_range_navigator";
export type {
  PeriodRange,
  PeriodRangeNavigatorProps,
  PeriodType,
} from "./dashboard/period_range_navigator";
export { PeriodRangeNavigator as FormOrderPeriodRangeNavigator } from "./dashboard/period_range_navigator";
export {
  FORM_FIELD_DEFAULT_WIDTH_CLASS,
  FORM_FIELD_LABEL_CLASS,
  FORM_SELECT_TRIGGER_CLASS,
  FORM_FIELD_READONLY_CLASS,
  FORM_VALUE_READONLY_CLASS,
} from "./form/field_styles";
export { useActiveRow } from "./form/use_active_row";
export { useConfirmDelete } from "./form/use_confirm_delete";
export { useIdentityId } from "./form/use_identity_id";
export { FormOrderPrintButton } from "./show/print_button";
export { SetupLayout } from "./setup/SetupLayout";
export { SetupSidebar } from "./setup/SetupSidebar";
export { SetupSidebarItem } from "./setup/SetupSidebarItem";
export { SetupContentHeader } from "./setup/SetupContentHeader";
export { SetupViewSwitcher } from "./setup/SetupViewSwitcher";
export { SetupContentPanel } from "./setup/SetupContentPanel";
export { SetupEmptyState } from "./setup/SetupEmptyState";
export { SetupMobileNav } from "./setup/SetupMobileNav";
export type {
  SetupItem,
  SetupView,
  SetupListComponent,
  SetupCreateComponent,
  SetupEditComponent,
  SetupCustomComponent,
  SetupListComponentProps,
  SetupCreateComponentProps,
  SetupEditComponentProps,
  SetupCustomComponentProps,
} from "./setup/types";

const baseButtonClasses =
  "h-6 px-2 text-[9px] sm:h-7 sm:px-2.5 sm:text-[10px] gap-1";

const focusableSelector =
  "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

const getFormFocusables = (form: HTMLElement) =>
  Array.from(form.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (el) =>
      !el.hasAttribute("disabled") &&
      el.getAttribute("aria-disabled") !== "true" &&
      el.tabIndex !== -1 &&
      (el.offsetParent !== null || el.getClientRects().length > 0),
  );

export const handleFormTabLoop = (
  event: React.KeyboardEvent<HTMLElement>,
) => {
  if (event.defaultPrevented || event.key !== "Tab") return;
  const currentTarget = event.currentTarget as HTMLElement;
  const form = currentTarget.closest("form");
  if (!form) return;
  const focusables = getFormFocusables(form);
  if (!focusables.length) return;
  const active = document.activeElement as HTMLElement | null;
  const current =
    active && focusables.includes(active) ? active : currentTarget;
  const index = focusables.indexOf(current);
  if (index === -1) return;
  if (!event.shiftKey && index === focusables.length - 1) {
    event.preventDefault();
    focusables[0]?.focus();
  } else if (event.shiftKey && index === 0) {
    event.preventDefault();
    focusables[focusables.length - 1]?.focus();
  }
};

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
      tabIndex={-1}
    >
      <CircleX className="size-3 sm:size-4" />
      Cancelar
    </Button>
  );
};

export type FormOrderSaveButtonProps = React.ComponentProps<typeof SaveButton>;

export const FormOrderSaveButton = (props: FormOrderSaveButtonProps) => {
  const { className, onKeyDown, ...rest } = props;
  return (
    <SaveButton
      label="Guardar"
      className={cn(baseButtonClasses, className)}
      icon={<Save className="size-3 sm:size-4" />}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!event.defaultPrevented) {
          handleFormTabLoop(event);
        }
      }}
      tabIndex={-1}
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

export const FormOrderEditButton = ({
  label = "Editar",
  className,
}: {
  label?: string;
  className?: string;
}) => {
  const record = useRecordContext();
  const resource = useResourceContext();
  const createPath = useCreatePath();
  if (!record?.id || !resource) return null;
  const link = createPath({ resource, type: "edit", id: record.id });
  return (
    <Button
      asChild
      variant="outline"
      className={cn(baseButtonClasses, className)}
    >
      <Link to={link} onClick={stopPropagation}>
        <Pencil className="size-3 sm:size-4" />
        {label}
      </Link>
    </Button>
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

const stopPropagation = (event: React.MouseEvent) => event.stopPropagation();
