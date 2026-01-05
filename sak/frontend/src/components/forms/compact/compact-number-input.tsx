import type { NumberInputProps } from "@/components/number-input";
import { useInput, useResourceContext, FieldTitle } from "ra-core";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FocusEvent } from "react";
import { FormControl, FormError, FormField, FormLabel } from "@/components/form";
import { Input } from "@/components/ui/input";
import { InputHelperText } from "@/components/input-helper-text";
import { cn } from "@/lib/utils";

type CompactNumberInputProps = NumberInputProps & {
  inputClassName?: string;
};

const compactInputClass = "h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm";

export const CompactNumberInput = (props: CompactNumberInputProps) => {
  const {
    label,
    source,
    className,
    inputClassName,
    resource: resourceProp,
    validate: _validateProp,
    format: _formatProp,
    parse = convertStringToNumber,
    onFocus,
    ...rest
  } = props;
  const resource = useResourceContext({ resource: resourceProp });

  const { id, field, isRequired } = useInput(props);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const numberValue = parse(value);

    setValue(value);
    field.onChange(numberValue ?? 0);
  };

  const [value, setValue] = useState<string | undefined>(
    field.value?.toString() ?? "",
  );

  const hasFocus = useRef(false);

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    onFocus?.(event);
    hasFocus.current = true;
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
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
            isRequired={isRequired}
          />
        </FormLabel>
      )}
      <FormControl>
        <Input
          {...rest}
          {...field}
          type="number"
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(compactInputClass, inputClassName)}
        />
      </FormControl>
      <InputHelperText helperText={props.helperText} />
      <FormError />
    </FormField>
  );
};

const convertStringToNumber = (value?: string | null) => {
  if (value == null || value === "") {
    return null;
  }
  const float = parseFloat(value);

  return isNaN(float) ? 0 : float;
};
