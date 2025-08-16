import { Checkbox } from "@workspace/ui/components/checkbox";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "./FormWrappers.tsx";
import { CoreFormField, useForm_Field } from "./useForm_Field.tsx";
import { FieldValues, Path } from "react-hook-form";

export interface CoreCheckboxProps<T extends FieldValues = any> {
  name: Path<T>;
  label?: string;
  control?: any;
  rules?: any;
}

export function FormCheckbox<T extends FieldValues = any>({ name, label, control, rules }: CoreCheckboxProps<T>) {
  const methods = useForm_Field<T>();
  return (
    <CoreFormField<T>
      name={name}
      control={control || methods.control}
      rules={rules}
      render={(field, fieldState) => (
        <FormField>
          <FormItem>
            <div className="flex items-center gap-2">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} id={name} />
              </FormControl>
              {label && <FormLabel>{label}</FormLabel>}
            </div>
            {fieldState?.error && <FormMessage>{fieldState.error.message}</FormMessage>}
          </FormItem>
        </FormField>
      )}
    />
  );
}
