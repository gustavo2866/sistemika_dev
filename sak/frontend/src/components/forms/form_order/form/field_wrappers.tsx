"use client";

import { cn } from "@/lib/utils";
import { TextInput, type TextInputProps } from "@/components/text-input";
import { NumberInput, type NumberInputProps } from "@/components/number-input";
import {
  SelectInput,
  type SelectInputProps,
} from "@/components/select-input";
import { AutocompleteInput } from "@/components/autocomplete-input";
import {
  ReferenceInput,
  type ReferenceInputProps,
} from "@/components/reference-input";
import {
  BooleanInput,
  type BooleanInputProps,
} from "@/components/boolean-input";
import {
  buildFieldClassName,
  FORM_FIELD_DEFAULT_WIDTH_CLASS,
  FORM_FIELD_LABEL_CLASS,
  FORM_SELECT_TRIGGER_CLASS,
  FORM_VALUE_BASE_CLASS,
} from "./field_styles";

type FieldWrapperProps = {
  widthClass?: string;
  className?: string;
};

export const FormText = ({
  widthClass,
  className,
  ...props
}: TextInputProps & FieldWrapperProps) => (
  <TextInput
    {...props}
    className={buildFieldClassName(widthClass, className)}
  />
);

export const FormTextarea = ({
  widthClass,
  className,
  ...props
}: TextInputProps & FieldWrapperProps) => (
  <TextInput
    {...props}
    multiline
    className={buildFieldClassName(widthClass, className)}
  />
);

export const FormDate = ({
  widthClass,
  className,
  ...props
}: TextInputProps & FieldWrapperProps) => (
  <TextInput
    {...props}
    type="date"
    className={buildFieldClassName(widthClass, className)}
  />
);

export const FormNumber = ({
  widthClass,
  className,
  ...props
}: NumberInputProps & FieldWrapperProps) => (
  <NumberInput
    {...props}
    className={buildFieldClassName(widthClass, className)}
  />
);

export const FormSelect = ({
  widthClass,
  className,
  triggerProps,
  ...props
}: SelectInputProps & FieldWrapperProps) => (
  <SelectInput
    {...props}
    className={buildFieldClassName(widthClass, className)}
    triggerProps={{
      ...triggerProps,
      className: cn(FORM_SELECT_TRIGGER_CLASS, triggerProps?.className),
    }}
  />
);

export const FormSelectFijo = ({
  widthClass,
  className,
  triggerProps,
  fixedWidth = "110px",
  ...props
}: SelectInputProps & FieldWrapperProps & { fixedWidth?: string }) => (
  <SelectInput
    {...props}
    className={buildFieldClassName(widthClass, className)}
    triggerProps={{
      ...triggerProps,
      className: cn(
        FORM_SELECT_TRIGGER_CLASS, 
        `!w-[${fixedWidth}] !max-w-[${fixedWidth}] !min-w-[${fixedWidth}]`,
        triggerProps?.className
      ),
      style: {
        width: `${fixedWidth} !important`,
        minWidth: `${fixedWidth} !important`, 
        maxWidth: `${fixedWidth} !important`,
        ...triggerProps?.style
      }
    }}
  />
);

export const FormAutocomplete = ({
  widthClass,
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteInput> & FieldWrapperProps) => (
  <AutocompleteInput
    {...props}
    className={buildFieldClassName(widthClass, className)}
  />
);

export type FormReferenceAutocompleteProps = {
  referenceProps: ReferenceInputProps;
  inputProps: React.ComponentProps<typeof AutocompleteInput>;
  widthClass?: string;
  className?: string;
};

export const FormReferenceAutocomplete = ({
  referenceProps,
  inputProps,
  widthClass,
  className,
}: FormReferenceAutocompleteProps) => (
  <ReferenceInput {...referenceProps}>
    <AutocompleteInput
      {...inputProps}
      className={buildFieldClassName(
        widthClass,
        cn(className, inputProps.className),
      )}
    />
  </ReferenceInput>
);

export type FormBooleanProps = BooleanInputProps & {
  className?: string;
};

export const FormBoolean = ({ className, ...props }: FormBooleanProps) => (
  <BooleanInput
    {...props}
    className={cn(
      "gap-0.5 sm:gap-1 [&_[data-slot=form-label]]:text-[9px] sm:[&_[data-slot=form-label]]:text-[10px] " +
        "[&_[data-slot=form-label]]:leading-none " +
        "[&_[data-slot=switch]]:h-4 [&_[data-slot=switch]]:w-6 " +
        "[&_[data-slot=switch-thumb]]:size-3",
      className,
    )}
  />
);

export const FormValue = ({
  label = false,
  widthClass,
  className,
  valueClassName,
  children,
}: {
  label?: React.ReactNode | false;
  widthClass?: string;
  className?: string;
  valueClassName?: string;
  children: React.ReactNode;
}) => {
  const showLabel = label !== false && label != null;

  return (
    <div
      className={cn(
        "grid gap-[1px] sm:gap-[2px]",
        widthClass ?? FORM_FIELD_DEFAULT_WIDTH_CLASS,
        className,
      )}
    >
      {showLabel ? (
        <div className={FORM_FIELD_LABEL_CLASS}>{label}</div>
      ) : null}
      <div className={cn(FORM_VALUE_BASE_CLASS, valueClassName)}>
        {children}
      </div>
    </div>
  );
};
