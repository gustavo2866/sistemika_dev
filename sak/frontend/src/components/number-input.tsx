import * as React from "react";
import { useEffect, useState } from "react";
import {
  FieldTitle,
  type InputProps,
  useInput,
  useResourceContext,
} from "ra-core";
import { FormControl, FormField, FormLabel } from "@/components/form";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/form";
import { InputHelperText } from "@/components/input-helper-text";

export const NumberInput = (props: NumberInputProps) => {
  const {
    label,
    source,
    className,
    resource: resourceProp,
    validate,
    format,
    parse = convertStringToNumber,
    onFocus,
    ...rest
  } = props;
  const resource = useResourceContext({ resource: resourceProp });

  const { id, field, isRequired } = useInput({
    ...rest,
    label,
    source,
    resource: resourceProp,
    validate,
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const numberValue = parse(value);

    setValue(value);
    field.onChange(numberValue ?? 0);
  };

  const [value, setValue] = useState<string | undefined>(
    field.value?.toString() ?? "",
  );

  const hasFocus = React.useRef(false);

  const formatValue = React.useCallback(
    (nextValue: unknown) => {
      if (!format) return nextValue?.toString() ?? "";
      return format(nextValue);
    },
    [format],
  );

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    onFocus?.(event);
    hasFocus.current = true;
    setValue(field.value?.toString() ?? "");
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    field.onBlur?.(event);
    hasFocus.current = false;
    setValue(formatValue(field.value));
  };

  useEffect(() => {
    if (!hasFocus.current) {
      setValue(formatValue(field.value));
    }
  }, [field.value, formatValue]);

  return (
    <FormField id={id} className={className} name={field.name}>
      {label !== false && (
        <FormLabel>
          <FieldTitle
            label={label}
            source={source}
            resource={resource}
            isRequired={isRequired}
          />
        </FormLabel>
      )}
      <FormControl>
        <Input
          {...rest}
          {...field}
          type={format ? "text" : "number"}
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </FormControl>
      <InputHelperText helperText={props.helperText} />
      <FormError />
    </FormField>
  );
};

export interface NumberInputProps
  extends InputProps,
    Omit<
      React.ComponentProps<"input">,
      "defaultValue" | "onBlur" | "onChange" | "type"
    > {
  parse?: (value: string) => number;
}

const convertStringToNumber = (value?: string | null) => {
  if (value == null || value === "") {
    return null;
  }
  const float = parseFloat(value);

  return isNaN(float) ? 0 : float;
};
