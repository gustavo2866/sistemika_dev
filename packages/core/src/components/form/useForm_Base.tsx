import React from "react";
import { FormInput } from "./FormInput.tsx";
import { FormSelect } from "./FormSelect.tsx";
import { FormCheckbox } from "./FormCheckbox.tsx";
import { FormTextarea } from "./FormTextarea.tsx";
import { useForm, UseFormProps, } from "react-hook-form";

// Tipos para campos dinámicos
export type FormFieldDef = {
  name: string;
  label?: string;
  type: "text" | "email" | "select" | "checkbox" | "textarea";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  rules?: any;
};

export interface FormBaseOptions {
  fields: FormFieldDef[];
  defaultValues?: Record<string, any>;
  onSubmit?: (data: any) => void;
  mode?: UseFormProps<any>["mode"];
}

export function useForm_Base(options: FormBaseOptions) {
  const form = useForm({
    defaultValues: options.defaultValues,
    mode: "all",
  });

  // Renderiza un solo campo
  function renderField(field: FormFieldDef) {
    if (field.type === "text" || field.type === "email") {
      return (
        <FormInput
          key={field.name}
          name={field.name}
          label={field.label}
          control={form.control}
          rules={field.rules}
          placeholder={field.placeholder}
        />
      );
    }
    if (field.type === "select") {
      return (
        <FormSelect
          key={field.name}
          name={field.name}
          label={field.label}
          control={form.control}
          options={field.options || []}
          rules={field.rules}
        />
      );
    }
    if (field.type === "checkbox") {
      return (
        <FormCheckbox
          key={field.name}
          name={field.name}
          label={field.label}
          control={form.control}
          rules={field.rules}
        />
      );
    }
    if (field.type === "textarea") {
      return (
        <FormTextarea
          key={field.name}
          name={field.name}
          label={field.label}
          control={form.control}
          rules={field.rules}
          placeholder={field.placeholder}
        />
      );
    }
    return null;
  }

  // Solo expone la lógica y el método renderField
  return { ...form, renderField };
}

// ...existing code...
