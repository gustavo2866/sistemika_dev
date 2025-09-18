import {
  type InputProps,
  useInput,
  useResourceContext,
  FieldTitle,
} from "ra-core";
import { sanitizeInputRestProps } from "@/lib/sanitizeInputRestProps";
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
  const { label, source, multiline, className, helperText, placeholder, ...rest } = props;
  const { id, field, isRequired } = useInput(props);
  // Mostrar asterisco si viene de RA (validate/isRequired), del prop isRequired explícito o del prop HTML required
  const showRequired =
    isRequired || !!(props as { isRequired?: boolean }).isRequired || !!(props as { required?: boolean }).required;

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
        {multiline ? (
          <Textarea 
            placeholder={placeholder}
            {...sanitizeInputRestProps(rest)} 
            {...field} 
            required={!!(props as { required?: boolean }).required}
          />
        ) : (
          <Input 
            placeholder={placeholder}
            {...sanitizeInputRestProps(rest)} 
            {...field}
            required={!!(props as { required?: boolean }).required}
          />
        )}
      </FormControl>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};
