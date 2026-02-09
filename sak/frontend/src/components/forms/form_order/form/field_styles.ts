import { cn } from "@/lib/utils";

export const FORM_FIELD_DEFAULT_WIDTH_CLASS = "w-full sm:w-[200px]";

export const FORM_FIELD_LABEL_CLASS =
  "mb-0 text-[9px] leading-none font-semibold sm:text-[10px]";

export const FORM_FIELD_BASE_CLASS =
  "grid gap-[1px] sm:gap-[2px] " +
  "[&_label]:mb-0 [&_label]:leading-none [&_label]:font-semibold " +
  "[&_label]:text-[9px] sm:[&_label]:text-[10px] " +
  "[&_input]:h-5 [&_input]:px-2 [&_input]:text-[9px] sm:[&_input]:text-[10px] " +
  "[&_textarea]:min-h-[20px] sm:[&_textarea]:min-h-[22px] " +
  "[&_textarea]:px-2 [&_textarea]:text-[9px] sm:[&_textarea]:text-[10px] " +
  "[&_[role=combobox]]:h-5 [&_[role=combobox]]:px-2 " +
  "[&_[role=combobox]]:text-[9px] sm:[&_[role=combobox]]:text-[10px] " +
  "[&_[role=combobox]_span]:text-[9px] sm:[&_[role=combobox]_span]:text-[10px]";

export const FORM_SELECT_TRIGGER_CLASS =
  "h-5 px-2 text-[9px] sm:text-[10px]";

export const FORM_VALUE_BASE_CLASS =
  "flex h-5 items-center justify-end rounded-md border border-border " +
  "bg-muted/30 px-2 text-[9px] sm:text-[10px] font-medium text-right";

export const buildFieldClassName = (
  widthClass?: string,
  className?: string,
) =>
  cn(
    FORM_FIELD_BASE_CLASS,
    widthClass ?? FORM_FIELD_DEFAULT_WIDTH_CLASS,
    className,
  );
