import {
  type InputProps,
  useInput,
  useResourceContext,
  FieldTitle,
} from "ra-core";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InputHelperText } from "@/components/input-helper-text";

export type TextInputProps = InputProps & {
  multiline?: boolean;
} & React.ComponentProps<"textarea"> &
  React.ComponentProps<"input">;

export const TextInput = (props: TextInputProps) => {
  const resource = useResourceContext(props);
  const {
    label,
    source,
    multiline,
    className,
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
          <FieldTitle
            label={label}
            source={source}
            resource={resource}
            
          />
        </FormLabel>
      )}
      <FormControl>
        {multiline ? (
          <Textarea {...rest} {...field} />
        ) : (
          <Input {...rest} {...field} />
        )}
      </FormControl>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};


