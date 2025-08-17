import { useForm, UseFormProps } from "react-hook-form";
import { FormInput } from "./FormInput.tsx";
import { FormSelect } from "./FormSelect.tsx";
import { FormCheckbox } from "./FormCheckbox.tsx";
import { FormTextarea } from "./FormTextarea.tsx";

// Tipos para campos dinámicos (sin romper tu API actual)
export type FormFieldDef = {
  name: string;
  label?: string;
  type: "text" | "email" | "select" | "checkbox" | "textarea";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  rules?: any; // si quieres tiparlo: RegisterOptions<FieldValues, any>
};

export interface FormBaseOptions {
  fields: FormFieldDef[];
  defaultValues?: Record<string, any>;
  onSubmit?: (data: any) => void;
  mode?: UseFormProps<any>["mode"];
  resolver?: UseFormProps<any>["resolver"];  
}

export function useForm_Base(options: FormBaseOptions) {
  const form = useForm({
    defaultValues: options.defaultValues,
    mode: options.mode ?? "onSubmit",
    resolver: options.resolver,  
  });

  // Renderiza un solo campo
  function renderField(field: FormFieldDef) {
    // Combina required del JSON con rules del campo
    const mergedRules = {
      ...(field.rules || {}),
      ...(field.required
        ? { required: field?.rules?.required ?? "Campo obligatorio" }
        : {}),
    };

    if (field.type === "text" || field.type === "email") {
      return (
        <FormInput
          key={field.name}
          name={field.name}
          label={field.label}
          control={form.control}
          rules={mergedRules}
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
          rules={mergedRules}
          // mejor placeholder explícito, no reutilizar label
          placeholder={field.placeholder || "Selecciona una opción"}
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
          rules={mergedRules}
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
          rules={mergedRules}
          placeholder={field.placeholder}
        />
      );
    }

    return null;
  }

  // Solo expone la lógica y el método renderField
  return { ...form, renderField };
}
