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
    placeholder,
    resource: resourceProp,
    parse = convertStringToNumber,
    onFocus,
    ...rest
  } = props;
  const resource = useResourceContext({ resource: resourceProp });

  const { id, field, isRequired } = useInput(props);
  // Mostrar asterisco si viene de RA (validate/isRequired) o del prop HTML required
  const showRequired =
    isRequired || !!(props as { isRequired?: boolean }).isRequired || !!(props as { required?: boolean }).required;

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

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    onFocus?.(event);
    hasFocus.current = true;
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    field.onBlur?.(event);
    hasFocus.current = false;
    setValue(field.value?.toString() ?? "");
  };

  useEffect(() => {
    if (!hasFocus.current) {
      setValue(field.value?.toString() ?? "");
    }
  }, [field.value]);

  return (
    <FormField id={id} className={className} name={field.name}>
      {label !== false && (
        <FormLabel>
          <FieldTitle
            label={label}
            source={source}
            resource={resource}
            isRequired={showRequired}
          />
        </FormLabel>
      )}
      <FormControl>
        <Input
          placeholder={placeholder}
          {...rest}
          {...field}
          type="number"
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          required={!!(props as { required?: boolean }).required}
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
