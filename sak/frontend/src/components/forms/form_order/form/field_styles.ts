import { cn } from "@/lib/utils";

export const FORM_FIELD_DEFAULT_WIDTH_CLASS = "w-full sm:w-[200px]";

export const FORM_FIELD_LABEL_CLASS =
  "mb-0 text-[9px] leading-none font-semibold sm:text-[10px]";

export const FORM_FIELD_BASE_CLASS =
  "grid gap-[1px] sm:gap-[2px] " +
  "[&_label]:mb-0 [&_label]:leading-none [&_label]:font-semibold " +
  "[&_label]:text-[9px] sm:[&_label]:text-[10px] " +
  "[&_input]:h-5 [&_input]:px-2 [&_input]:bg-background [&_input]:text-[9px] sm:[&_input]:text-[10px] " +
  "[&_input:disabled]:bg-transparent [&_input:disabled]:text-muted-foreground " +
  "[&_input:disabled]:opacity-70 [&_input:disabled]:border-0 " +
  "[&_input:disabled]:shadow-none " +
  "[&_textarea]:min-h-[20px] sm:[&_textarea]:min-h-[22px] " +
  "[&_textarea]:bg-background " +
  "[&_textarea]:px-2 [&_textarea]:text-[9px] sm:[&_textarea]:text-[10px] " +
  "[&_textarea:disabled]:bg-transparent [&_textarea:disabled]:text-muted-foreground " +
  "[&_textarea:disabled]:opacity-70 [&_textarea:disabled]:border-0 " +
  "[&_textarea:disabled]:shadow-none " +
  "[&_[role=combobox]]:h-5 [&_[role=combobox]]:px-2 [&_[role=combobox]]:bg-background " +
  "[&_[role=combobox]]:text-[9px] sm:[&_[role=combobox]]:text-[10px] " +
  "[&_[role=combobox]_span]:text-[9px] sm:[&_[role=combobox]_span]:text-[10px] " +
  "[&_[role=combobox]:disabled]:bg-transparent " +
  "[&_[role=combobox]:disabled]:text-muted-foreground " +
  "[&_[role=combobox]:disabled]:opacity-70 " +
  "[&_[role=combobox]:disabled]:border-0 " +
  "[&_[role=combobox]:disabled]:shadow-none";

export const FORM_SELECT_TRIGGER_CLASS =
  "h-5 px-2 text-[9px] sm:text-[10px] disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-70 disabled:border-0 disabled:shadow-none";

export const FORM_VALUE_BASE_CLASS =
  "flex h-5 items-center justify-end rounded-md border border-border " +
  "bg-muted/30 px-2 text-[9px] sm:text-[10px] font-medium text-right";

export const FORM_VALUE_READONLY_CLASS =
  "border-0 bg-transparent shadow-none px-0 text-muted-foreground";

export const FORM_FIELD_READONLY_CLASS =
  "pointer-events-none " +
  "[&_input]:bg-transparent [&_input]:text-muted-foreground [&_input]:opacity-70 " +
  "[&_input]:border-0 [&_input]:shadow-none " +
  "[&_textarea]:bg-transparent [&_textarea]:text-muted-foreground [&_textarea]:opacity-70 " +
  "[&_textarea]:border-0 [&_textarea]:shadow-none " +
  "[&_[role=combobox]]:bg-transparent [&_[role=combobox]]:text-muted-foreground " +
  "[&_[role=combobox]]:opacity-70 [&_[role=combobox]]:border-0 " +
  "[&_[role=combobox]]:shadow-none " +
  "[&_[role=combobox]_svg]:hidden";

export const buildFieldClassName = (
  widthClass?: string,
  className?: string,
) =>
  cn(
    FORM_FIELD_BASE_CLASS,
    widthClass ?? FORM_FIELD_DEFAULT_WIDTH_CLASS,
    className,
  );
