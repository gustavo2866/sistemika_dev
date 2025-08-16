import { Textarea } from "@workspace/ui/components/textarea";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "./FormWrappers.tsx";
import { CoreFormField, useForm_Field } from "./useForm_Field.tsx";
import { FieldValues, Path } from "react-hook-form";

export interface CoreTextareaProps<T extends FieldValues = any> {
  name: Path<T>;
  label?: string;
  control?: any;
  rules?: any;
  placeholder?: string;
}

export function FormTextarea<T extends FieldValues = any>({ name, label, control, rules, placeholder }: CoreTextareaProps<T>) {
  const methods = useForm_Field<T>();
  return (
    <CoreFormField<T>
      name={name}
      control={control || methods.control}
      rules={rules}
      render={(field, fieldState) => (
        <FormField>
          <FormItem>
            {label && <FormLabel>{label}</FormLabel>}
            <FormControl>
              <Textarea {...field} id={name} placeholder={placeholder} />
            </FormControl>
            {fieldState?.error && <FormMessage>{fieldState.error.message}</FormMessage>}
          </FormItem>
        </FormField>
      )}
    />
  );
}
