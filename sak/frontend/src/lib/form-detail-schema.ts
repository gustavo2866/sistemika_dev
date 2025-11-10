import type { FieldValues } from "react-hook-form";

export type DetailSchemaReferenceField = {
  fieldName: string;
  resource: string;
  optionTextField: string;
  perPage?: number;
  sortField?: string;
  sortOrder?: "ASC" | "DESC";
  transformOption?: (item: { id: number | string; [key: string]: any }) => {
    id: number;
    nombre: string;
  };
};

type StringFieldConfig = {
  type: "string";
  required?: boolean;
  trim?: boolean;
  maxLength?: number;
  defaultValue?: string;
};

type NumberFieldConfig = {
  type: "number";
  required?: boolean;
  min?: number;
  max?: number;
  valueAsNumber?: boolean;
  defaultValue?: number;
};

type SelectFieldConfig = {
  type: "select";
  required?: boolean;
  options: Array<{ id: string; name: string }>;
  defaultValue?: string;
};

type ReferenceFieldConfig = {
  type: "reference";
  required?: boolean;
  resource: string;
  labelField: string;
  persistLabelAs?: string;
  perPage?: number;
  sortField?: string;
  sortOrder?: "ASC" | "DESC";
  defaultValue?: string;
};

export type DetailSchemaField =
  | StringFieldConfig
  | NumberFieldConfig
  | SelectFieldConfig
  | ReferenceFieldConfig;

export type DetailSchemaContext = {
  getReferenceOptions: (
    fieldName: string
  ) => Array<{ id: number; nombre: string }>;
};

export interface FormDetailSchema<TForm extends FieldValues, TDetail> {
  defaults: () => TForm;
  toForm: (detail: TDetail) => TForm;
  toModel: (values: TForm, ctx?: DetailSchemaContext) => TDetail;
  referenceFields?: DetailSchemaReferenceField[];
  fields?: Record<string, DetailSchemaField>;
}

type DetailSchemaDefinition<TForm extends FieldValues, TDetail> = {
  defaults?: () => TForm;
  fields?: Record<string, DetailSchemaField>;
  toForm?: (detail: TDetail) => TForm;
  toModel?: (values: TForm, ctx?: DetailSchemaContext) => TDetail;
  referenceFields?: DetailSchemaReferenceField[];
};

const deriveReferenceFields = (
  fields?: Record<string, DetailSchemaField>
): DetailSchemaReferenceField[] | undefined => {
  if (!fields) return undefined;
  return Object.entries(fields)
    .filter(([, field]) => field.type === "reference")
    .map(([fieldName, field]) => {
      const refField = field as ReferenceFieldConfig;
      const optionTextField = refField.labelField;
      return {
        fieldName,
        resource: refField.resource,
        optionTextField,
        perPage: refField.perPage,
        sortField: refField.sortField ?? optionTextField,
        sortOrder: refField.sortOrder ?? "ASC",
        transformOption: (item: { id: number | string; [key: string]: any }) => ({
          id: Number(item.id),
          nombre: item[optionTextField] ?? item.nombre ?? "",
        }),
      };
    });
};

const deriveDefaults = <TForm extends FieldValues>(
  fields?: Record<string, DetailSchemaField>,
  providedDefaults?: () => TForm
): (() => TForm) => {
  if (providedDefaults) {
    return providedDefaults;
  }
  return () => {
    const result: Record<string, unknown> = {};
    if (fields) {
      for (const [key, config] of Object.entries(fields)) {
        switch (config.type) {
          case "string":
            result[key] = config.defaultValue ?? "";
            break;
          case "number":
            result[key] = config.defaultValue ?? 0;
            break;
          case "select":
            result[key] = config.defaultValue ?? "";
            break;
          case "reference":
            result[key] = config.defaultValue ?? "";
            if (config.persistLabelAs) {
              result[config.persistLabelAs] = "";
            }
            break;
          default:
            result[key] = "";
        }
      }
    }
    return result as TForm;
  };
};

const defaultToForm = <TForm extends FieldValues, TDetail>(
  fields: Record<string, DetailSchemaField>,
  detail: TDetail
): TForm => {
  const result: Record<string, unknown> = {};
  for (const [key, config] of Object.entries(fields)) {
    const value = (detail as Record<string, unknown>)[key];
    if (config.type === "reference") {
      result[key] = value != null ? String(value) : "";
    } else {
      result[key] = value ?? "";
    }
  }
  return result as TForm;
};

const defaultToModel = <TForm extends FieldValues, TDetail>(
  fields: Record<string, DetailSchemaField>,
  values: TForm,
  ctx?: DetailSchemaContext
): TDetail => {
  const result: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const [key, config] of Object.entries(fields)) {
    const value = (values as Record<string, unknown>)[key];

    switch (config.type) {
      case "string": {
        let str = typeof value === "string" ? value : String(value ?? "");
        if (config.trim) {
          str = str.trim();
        }
        if (config.required && !str) {
          errors[key] = "Campo requerido";
        }
        if (config.maxLength && str.length > config.maxLength) {
          errors[key] = `Máximo ${config.maxLength} caracteres`;
        }
        result[key] = str;
        break;
      }
      case "select": {
        const str = typeof value === "string" ? value : String(value ?? "");
        if (config.required && !str) {
          errors[key] = "Campo requerido";
        }
        result[key] = str;
        break;
      }
      case "number": {
        let num = typeof value === "number" ? value : Number(value ?? 0);
        if (Number.isNaN(num)) {
          errors[key] = "Debe ser un número válido";
          num = config.min ?? 0;
        }
        if (config.required && (num === undefined || num === null)) {
          errors[key] = "Campo requerido";
        }
        if (config.min !== undefined && num < config.min) {
          errors[key] = `Debe ser mayor o igual a ${config.min}`;
        }
        if (config.max !== undefined && num > config.max) {
          errors[key] = `Debe ser menor o igual a ${config.max}`;
        }
        result[key] = num;
        break;
      }
      case "reference": {
        const refId =
          value !== undefined && value !== null && value !== ""
            ? Number(value)
            : null;
        if (config.required && (refId === null || Number.isNaN(refId))) {
          errors[key] = "Campo requerido";
        }
        result[key] = refId;

        if (config.persistLabelAs) {
          const options = ctx?.getReferenceOptions(key) ?? [];
          const selected = options.find(
            (option) => String(option.id) === String(value)
          );
          result[config.persistLabelAs] = selected?.nombre ?? "";
        }
        break;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    throw { errors };
  }

  return result as TDetail;
};

export const createDetailSchema = <
  TForm extends FieldValues,
  TDetail
>(
  definition: DetailSchemaDefinition<TForm, TDetail>
): FormDetailSchema<TForm, TDetail> => {
  const referenceFields =
    definition.referenceFields ?? deriveReferenceFields(definition.fields);

  const fields = definition.fields;
  const defaults = deriveDefaults(fields, definition.defaults);

  const toForm =
    definition.toForm ??
    (fields
      ? (detail: TDetail) => defaultToForm(fields, detail)
      : ((detail: TDetail) => detail as unknown as TForm));

  const toModel =
    definition.toModel ??
    (fields
      ? (values: TForm, ctx?: DetailSchemaContext) =>
          defaultToModel(fields, values, ctx)
      : ((values: TForm) => values as unknown as TDetail));

  return {
    defaults,
    toForm,
    toModel,
    referenceFields,
    fields,
  };
};
export function createEntitySchema<
  TForm extends FieldValues,
  TDetail
>(definition: DetailSchemaDefinition<TForm, TDetail>) {
  return createDetailSchema(definition);
}
export const stringField = (config: Omit<StringFieldConfig, "type"> = {}) => ({
  type: "string",
  trim: true,
  defaultValue: "",
  ...config,
}) as StringFieldConfig;

export const numberField = (config: Omit<NumberFieldConfig, "type"> = {}) => ({
  type: "number",
  valueAsNumber: true,
  defaultValue: 0,
  ...config,
}) as NumberFieldConfig;

export const selectField = (config: Omit<SelectFieldConfig, "type">) => ({
  type: "select",
  defaultValue: config.defaultValue ?? "",
  ...config,
}) as SelectFieldConfig;

export const referenceField = (
  config: Omit<ReferenceFieldConfig, "type">
) =>
  ({
    type: "reference",
    sortOrder: "ASC",
    defaultValue: "",
    ...config,
  }) as ReferenceFieldConfig;
