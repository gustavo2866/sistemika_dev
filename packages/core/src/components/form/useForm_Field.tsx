import React, { ReactElement } from "react";
import {
  useFormContext,
  Controller,
  FieldValues,
  UseControllerReturn,
  Path,
  Control,
  RegisterOptions,
} from "react-hook-form";

/**
 * rules: validaciones; si usas deps, tipalas como Path<T> | Path<T>[]
 * Ej: rules={{ required: true, deps: ['user.email' as Path<T>] }}
 */
export interface CoreFormFieldProps<T extends FieldValues = any> {
  name: Path<T>;
  control?: Control<T>;
  rules?: (
    Omit<RegisterOptions<T, Path<T>>, "valueAsNumber" | "valueAsDate" | "setValueAs" | "disabled">
    & { deps?: Path<T> | Path<T>[] }
  );
  render: (
    field: UseControllerReturn<T>["field"],
    fieldState: UseControllerReturn<T>["fieldState"]
  ) => ReactElement;
}

export function useForm_Field<T extends FieldValues = any>() {
  return useFormContext<T>();
}

export function CoreFormField<T extends FieldValues = any>({
  name,
  control,
  rules,
  render,
}: CoreFormFieldProps<T>) {
  const ctx = useForm_Field<T>();
  const ctl = (control ?? ctx?.control) as Control<T> | undefined;

  if (!ctl) {
    throw new Error("CoreFormField: se requiere `control` o envolver en <FormProvider>.");
  }

  return (
    <Controller
      name={name}
      control={ctl}
      rules={rules}
      render={({ field, fieldState }) => render(field, fieldState)}
    />
  );
}
