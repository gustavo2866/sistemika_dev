import type { TextInputProps } from "@/components/text-input";
import { useInput, useResourceContext, FieldTitle } from "ra-core";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InputHelperText } from "@/components/input-helper-text";
import { cn } from "@/lib/utils";

type CompactTextInputProps = TextInputProps & {
  inputClassName?: string;
  textareaClassName?: string;
};

const compactInputClass = "h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm";
const compactTextareaClass =
  "min-h-9 px-2 py-1 text-[11px] sm:min-h-16 sm:px-3 sm:py-2 sm:text-sm";

export const CompactTextInput = (props: CompactTextInputProps) => {
  const resource = useResourceContext(props);
  const {
    label,
    source,
    multiline,
    className,
    inputClassName,
    textareaClassName,
    helperText,
    validate: _validateProp,
    format: _formatProp,
    isRequired: _isRequired,
    defaultValue: _defaultValue,
    ...rest
  } = props;
  const { id, field } = useInput(props);

  return (
    <FormField id={id} className={className} name={field.name}>
      {label !== false && (
        <FormLabel>
          <FieldTitle label={label} source={source} resource={resource} />
        </FormLabel>
      )}
      <FormControl>
        {multiline ? (
          <Textarea
            {...rest}
            {...field}
            className={cn(compactTextareaClass, textareaClassName)}
          />
        ) : (
          <Input
            {...rest}
            {...field}
            className={cn(compactInputClass, inputClassName)}
          />
        )}
      </FormControl>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};
