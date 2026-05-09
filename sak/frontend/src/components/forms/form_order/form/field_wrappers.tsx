"use client";

import { cn } from "@/lib/utils";
import {
  FieldTitle,
  type InputProps,
  useInput,
  useResourceContext,
} from "ra-core";
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
  FormError,
  FormField,
  FormLabel,
} from "@/components/form";
import { InputHelperText } from "@/components/input-helper-text";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildFieldClassName,
  FORM_FIELD_DEFAULT_WIDTH_CLASS,
  FORM_FIELD_LABEL_CLASS,
  FORM_SELECT_TRIGGER_CLASS,
  FORM_VALUE_BASE_CLASS,
} from "./field_styles";
import {
  buildQuincenaDateValue,
  getQuincenaDateParts,
  type QuincenaValue,
} from "./quincena_date";

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

export type FormQuincenaDateProps = InputProps & FieldWrapperProps;

export const FormQuincenaDate = ({
  widthClass,
  className,
  helperText,
  label,
  source,
  ...props
}: FormQuincenaDateProps) => {
  const resource = useResourceContext(props);
  const { id, field, isRequired } = useInput({
    ...props,
    helperText,
    label,
    source,
  });
  const { month, quincena } = getQuincenaDateParts(field.value);

  const handleMonthChange = (nextMonth: string) => {
    field.onChange(buildQuincenaDateValue(nextMonth, quincena));
  };

  const handleQuincenaChange = (nextQuincena: string) => {
    field.onChange(buildQuincenaDateValue(month, nextQuincena as QuincenaValue));
  };

  return (
    <FormField
      id={id}
      name={field.name}
      className={buildFieldClassName(widthClass, className)}
    >
      {label !== false ? (
        <FormLabel>
          <FieldTitle
            label={label}
            source={source}
            resource={resource}
            isRequired={isRequired}
          />
        </FormLabel>
      ) : null}
      <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-1.5">
        <Input
          id={id}
          type="month"
          value={month}
          onChange={(event) => handleMonthChange(event.target.value)}
          onBlur={field.onBlur}
          name={`${field.name}__month`}
          ref={field.ref}
          disabled={field.disabled}
        />
        <Select
          value={quincena}
          onValueChange={handleQuincenaChange}
          disabled={field.disabled}
        >
          <SelectTrigger className={cn(FORM_SELECT_TRIGGER_CLASS, "w-full")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="text-[9px] sm:text-[10px]">
            <SelectItem value="1" className="h-7 text-[9px] sm:text-[10px]">
              1ra
            </SelectItem>
            <SelectItem value="2" className="h-7 text-[9px] sm:text-[10px]">
              2da
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};

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
}: SelectInputProps & FieldWrapperProps & { fixedWidth?: string }) => {
  const fixedStyle: React.CSSProperties = {
    width: fixedWidth,
    minWidth: fixedWidth,
    maxWidth: fixedWidth,
    flex: "0 0 auto",
    ...triggerProps?.style,
  };

  return (
    <SelectInput
      {...props}
      className={buildFieldClassName(widthClass, className)}
      triggerProps={{
        ...triggerProps,
        className: cn(
          FORM_SELECT_TRIGGER_CLASS,
          "shrink-0",
          triggerProps?.className,
        ),
        style: fixedStyle,
      }}
    />
  );
};

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
