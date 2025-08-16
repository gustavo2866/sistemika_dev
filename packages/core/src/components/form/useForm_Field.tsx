import React, { ReactElement } from "react";
import { useFormContext, Controller, FieldValues, UseControllerReturn, Path, Control, RegisterOptions } from "react-hook-form";

/**
 * rules: para validaciones, si usas deps, deben ser del tipo Path<T> (no string)
 * Ejemplo: rules={{ required: true, deps: ["campo1", "campo2"] }}
 */
export interface CoreFormFieldProps<T extends FieldValues = any> {
  name: Path<T>;
  control?: Control<T>;
  rules?: Omit<RegisterOptions<T, Path<T>>, "valueAsNumber" | "valueAsDate" | "setValueAs" | "disabled">;
  render: (field: UseControllerReturn<T>["field"], fieldState: UseControllerReturn<T>["fieldState"]) => ReactElement;
}

export function useForm_Field<T extends FieldValues = any>() {
  return useFormContext<T>();
}

export function CoreFormField<T extends FieldValues = any>({ name, control, rules, render }: CoreFormFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control as Control<T>}
      rules={rules}
      render={({ field, fieldState }) => render(field, fieldState)}
    />
  );
}
