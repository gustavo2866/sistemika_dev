import { Select, SelectItem, SelectContent, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "./FormWrappers.tsx";
import { CoreFormField, useForm_Field } from "./useForm_Field.tsx";
import { FieldValues, Path, Control, RegisterOptions } from "react-hook-form";

export interface CoreSelectOption {
  value: string;
  label: string;
}

export interface CoreSelectProps<T extends FieldValues = any> {
  name: Path<T>;
  label?: string;
  options: CoreSelectOption[];
  control?: Control<T>;
  rules?: RegisterOptions<T, Path<T>>;
  placeholder?: string;
}

export function FormSelect<T extends FieldValues = any>({
  name,
  label,
  options,
  control,
  rules,
  placeholder,
}: CoreSelectProps<T>) {
  const methods = useForm_Field<T>();
  const isRequired = !!rules?.required;
  const safeId = String(name).replace(/\./g, "__");

  return (
    <CoreFormField<T>
      name={name}
      control={control || methods.control}
      rules={rules}
      render={(field, fieldState) => (
        <div>
          <FormLabel htmlFor={safeId} required={isRequired}>
            {label}
          </FormLabel>
          <FormControl>
            <Select value={field.value ?? ""} onValueChange={field.onChange}>
              <SelectTrigger
                id={safeId}
                className="w-full"
                ref={field.ref}
                onBlur={field.onBlur}
                name={field.name}
                aria-invalid={!!fieldState.error || undefined}
              >
                <SelectValue placeholder={placeholder || "Selecciona una opción"} />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage id={`${safeId}-error`} error={fieldState?.error?.message} />
        </div>
      )}
    />
  );
}
