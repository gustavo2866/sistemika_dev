import { Input } from "@workspace/ui/components/input";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "./FormWrappers.tsx";
import { CoreFormField, useForm_Field } from "./useForm_Field.tsx";
import { FieldValues, Path } from "react-hook-form";

export interface CoreInputProps<T extends FieldValues = any> {
  name: Path<T>;
  label?: string;
  control?: any;
  rules?: any;
  placeholder?: string;
}

export function FormInput<T extends FieldValues = any>({ name, label, control, rules, placeholder }: CoreInputProps<T>) {
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
              <Input {...field} id={name} placeholder={placeholder} value={field.value ?? ''} />
            </FormControl>
            {fieldState?.error && <FormMessage>{fieldState.error.message}</FormMessage>}
          </FormItem>
        </FormField>
      )}
    />
  );
}
