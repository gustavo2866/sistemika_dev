import { Input } from "@workspace/ui/components/input";
import { FormLabel, FormControl, FormMessage } from "./FormWrappers.tsx";
import { CoreFormField, useForm_Field } from "./useForm_Field.tsx";
import { FieldValues, Path, Control, RegisterOptions } from "react-hook-form";

export interface CoreInputProps<T extends FieldValues = any> {
  name: Path<T>;
  label?: string;
  control?: Control<T>;
  rules?: RegisterOptions<T, Path<T>>;
  placeholder?: string;
  description?: string;
}

export function FormInput<T extends FieldValues = any>({
  name,
  label,
  control,
  rules,
  placeholder,
  description,
}: CoreInputProps<T>) {
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
              <Input
                {...field}
                id={safeId}
                placeholder={placeholder}
                value={field.value ?? ""}
                aria-invalid={!!fieldState.error || undefined}
                aria-describedby={
                  fieldState.error
                    ? `${safeId}-error`
                    : description
                    ? `${safeId}-desc`
                    : undefined
                }
                className={fieldState.error ? "text-sm text-destructive" : undefined}
              />
              
            </FormControl>

            {description && (
              <span id={`${safeId}-desc`} className="text-gray-500 text-xs">
                {description}
              </span>
            )}

            {/* ✅ Solo un FormMessage */}
            <FormMessage id={`${safeId}-error`} error={fieldState?.error?.message} />

          </div>

      )}
    />
  );
}