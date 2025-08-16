import { Select, SelectItem, SelectContent, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "./FormWrappers.tsx";
import { CoreFormField, useForm_Field } from "./useForm_Field.tsx";
import { FieldValues, Path } from "react-hook-form";

export interface CoreSelectOption {
  value: string;
  label: string;
}

export interface CoreSelectProps<T extends FieldValues = any> {
  name: Path<T>;
  label?: string;
  options: CoreSelectOption[];
  control?: any;
  rules?: any;
}

export function FormSelect<T extends FieldValues = any>({ name, label, options, control, rules }: CoreSelectProps<T>) {
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
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={label || "Selecciona una opción"} />
                </SelectTrigger>
                <SelectContent>
                  {options.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
            {fieldState?.error && <FormMessage>{fieldState.error.message}</FormMessage>}
          </FormItem>
        </FormField>
      )}
    />
  );
}
