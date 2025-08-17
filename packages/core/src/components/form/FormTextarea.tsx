import { Textarea } from "@workspace/ui/components/textarea";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "./FormWrappers.tsx";
import { CoreFormField, useForm_Field } from "./useForm_Field.tsx";
import { FieldValues, Path, Control, RegisterOptions } from "react-hook-form";

export interface CoreTextareaProps<T extends FieldValues = any> {
  name: Path<T>;
  label?: string;
  control?: Control<T>;
  rules?: RegisterOptions<T, Path<T>>;
  placeholder?: string;
  description?: string;
  rows?: number;
}

export function FormTextarea<T extends FieldValues = any>({
  name,
  label,
  control,
  rules,
  placeholder,
  description,
  rows,
}: CoreTextareaProps<T>) {
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
            <Textarea
              {...field}
              id={safeId}
              placeholder={placeholder}
              value={field.value ?? ""}
              rows={rows}
              aria-invalid={!!fieldState.error || undefined}
              aria-describedby={
                fieldState.error
                  ? `${safeId}-error`
                  : description
                  ? `${safeId}-desc`
                  : undefined
              }
            />
          </FormControl>
          {description && (
            <span id={`${safeId}-desc`} className="text-gray-500 text-xs">
              {description}
            </span>
          )}
          <FormMessage id={`${safeId}-error`} error={fieldState?.error?.message} />
        </div>
      )}
    />
  );
}