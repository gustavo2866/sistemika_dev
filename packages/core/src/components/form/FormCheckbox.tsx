import { Checkbox } from "@workspace/ui/components/checkbox";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "./FormWrappers.tsx";
import { CoreFormField, useForm_Field } from "./useForm_Field.tsx";
import { FieldValues, Path, Control, RegisterOptions } from "react-hook-form";

export interface CoreCheckboxProps<T extends FieldValues = any> {
  name: Path<T>;
  label?: string;
  control?: Control<T>;
  rules?: RegisterOptions<T, Path<T>>;
}

export function FormCheckbox<T extends FieldValues = any>({
  name,
  label,
  control,
  rules,
}: CoreCheckboxProps<T>) {
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
          <div className="flex items-center gap-2">
            <FormControl>
              <Checkbox
                id={safeId}
                checked={!!field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
                ref={field.ref}
                onBlur={field.onBlur}
                name={field.name}
              />
            </FormControl>
            <FormLabel htmlFor={safeId} required={isRequired}>
              {label}
            </FormLabel>
          </div>
          <FormMessage id={`${safeId}-error`} error={fieldState?.error?.message} />
        </div>
      )}
    />
  );
}
