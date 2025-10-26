"use client";

// Tipos y utilidades genericas para transformar valores entre modelo y formulario.

export type ValidationRule<
  FormValue = unknown,
  FormValues extends Record<string, unknown> = Record<string, unknown>,
> = {
  nombre: string;
  mensaje: string;
  validar: (valor: FormValue, contexto: { formulario: FormValues }) => boolean;
};

export type ScalarFieldSchema<FormValue = unknown, ModelValue = unknown> = {
  type?: "scalar";
  formDefault: FormValue | (() => FormValue);
  toForm?: (valorModelo: ModelValue) => FormValue;
  toModel?: (valorFormulario: FormValue) => ModelValue;
  includeInPayload?: boolean;
  validations?: ValidationRule<FormValue>[];
  computed?: {
    dependencies: string[];
    compute: (formulario: Record<string, unknown>) => FormValue;
  };
};

export interface ObjectSchema<
  Fields extends Record<
    string,
    ScalarFieldSchema<any, any> | ArrayFieldSchema<any>
  > = Record<string, ScalarFieldSchema<any, any> | ArrayFieldSchema<any>>
> {
  fields: Fields;
}

export interface ArrayFieldSchema<ItemSchema extends ObjectSchema = ObjectSchema> {
  type: "array";
  formDefault: () => unknown;
  item: ItemSchema;
  includeInPayload?: boolean;
}

export type FieldSchema =
  | ScalarFieldSchema<any, any>
  | ArrayFieldSchema<ObjectSchema>;

type FormValueFromField<Field> =
  Field extends ScalarFieldSchema<infer FormValue, any>
    ? FormValue
    : Field extends ArrayFieldSchema<infer ItemSchema>
      ? Array<FormValuesFromSchema<ItemSchema>>
      : never;

type ModelValueFromField<Field> =
  Field extends ScalarFieldSchema<any, infer ModelValue>
    ? ModelValue
    : Field extends ArrayFieldSchema<infer ItemSchema>
      ? Array<ModelValuesFromSchema<ItemSchema>>
      : never;

export type FormValuesFromSchema<Schema extends ObjectSchema> = {
  [Key in keyof Schema["fields"]]: FormValueFromField<Schema["fields"][Key]>;
};

export type ModelValuesFromSchema<Schema extends ObjectSchema> = {
  [Key in keyof Schema["fields"]]: ModelValueFromField<Schema["fields"][Key]>;
};

export type PayloadFromSchema<Schema extends ObjectSchema> = {
  [Key in keyof Schema["fields"] as Schema["fields"][Key] extends {
    includeInPayload: false;
  }
    ? never
    : Key]: Schema["fields"][Key] extends ArrayFieldSchema<infer ItemSchema>
    ? Array<PayloadFromSchema<ItemSchema>>
    : Schema["fields"][Key] extends ScalarFieldSchema<any, infer ModelValue>
      ? ModelValue
      : never;
};

const resolveDefault = <T>(valor: T | (() => T)): T =>
  typeof valor === "function" ? (valor as () => T)() : valor;

const isArraySchema = (schema: FieldSchema): schema is ArrayFieldSchema =>
  (schema as ArrayFieldSchema).type === "array";

export const createFormDefaults = <Schema extends ObjectSchema>(
  schema: Schema,
): FormValuesFromSchema<Schema> => {
  const resultado: Record<string, unknown> = {};
  const fields = schema.fields;
  const claves = Object.keys(fields) as Array<keyof typeof fields>;

  for (const clave of claves) {
    const definicion = fields[clave];
    if (isArraySchema(definicion)) {
      resultado[clave as string] = definicion.formDefault();
    } else {
      resultado[clave as string] = resolveDefault(definicion.formDefault);
    }
  }

  aplicarCamposComputados(schema, resultado);
  return resultado as FormValuesFromSchema<Schema>;
};

export const modelToForm = <Schema extends ObjectSchema>(
  schema: Schema,
  modelo: Partial<ModelValuesFromSchema<Schema>> | undefined,
): FormValuesFromSchema<Schema> => {
  const formulario = createFormDefaults(schema) as Record<string, unknown>;
  const origen = (modelo as Record<string, unknown>) ?? {};
  const fields = schema.fields;
  const claves = Object.keys(fields) as Array<keyof typeof fields>;

  for (const clave of claves) {
    const definicion = fields[clave];
    if (isArraySchema(definicion)) {
      const valorModelo = Array.isArray(origen[clave as string])
        ? (origen[clave as string] as unknown[])
        : [];
      formulario[clave as string] = valorModelo.map((item) =>
        modelToForm(definicion.item, item as Record<string, unknown>),
      );
    } else {
      const scalar = definicion as ScalarFieldSchema<any, any>;
      const valorModelo = origen[clave as string];
      if (valorModelo !== undefined && valorModelo !== null) {
        formulario[clave as string] = scalar.toForm
          ? scalar.toForm(valorModelo as never)
          : valorModelo;
      }
    }
  }

  aplicarCamposComputados(schema, formulario);
  return formulario as FormValuesFromSchema<Schema>;
};

export const formToModel = <Schema extends ObjectSchema>(
  schema: Schema,
  formulario: Partial<FormValuesFromSchema<Schema>>,
): PayloadFromSchema<Schema> => {
  const resultado: Record<string, unknown> = {};
  const origen = formulario as Record<string, unknown>;
  const fields = schema.fields;
  const claves = Object.keys(fields) as Array<keyof typeof fields>;

  for (const clave of claves) {
    const definicion = fields[clave];
    if (definicion.includeInPayload === false) {
      continue;
    }

    if (isArraySchema(definicion)) {
      const valorFormulario = Array.isArray(origen[clave as string])
        ? (origen[clave as string] as unknown[])
        : [];
      resultado[clave as string] = valorFormulario.map((item) =>
        formToModel(definicion.item, item as Record<string, unknown>),
      );
    } else {
      const scalar = definicion as ScalarFieldSchema<any, any>;
      const valorFormulario = origen[clave as string] as unknown;
      const valorModelo = scalar.toModel
        ? scalar.toModel(valorFormulario as never)
        : valorFormulario;

      if (valorModelo !== undefined) {
        resultado[clave as string] = valorModelo;
      }
    }
  }

  return resultado as PayloadFromSchema<Schema>;
};

export const buildFormValues = <Schema extends ObjectSchema>(
  schema: Schema,
  registro?: Partial<ModelValuesFromSchema<Schema>>,
) => {
  const defaults = createFormDefaults(schema);
  if (!registro) {
    return defaults;
  }
  const traducido = modelToForm(schema, registro);
  return { ...defaults, ...traducido } as FormValuesFromSchema<Schema>;
};

export const buildPayload = <Schema extends ObjectSchema>(
  schema: Schema,
  valores: Partial<FormValuesFromSchema<Schema>>,
) => formToModel(schema, valores);

export const recopilarValidaciones = <Schema extends ObjectSchema>(
  schema: Schema,
) => {
  const resultado: Record<string, ValidationRule[]> = {};
  const fields = schema.fields;
  const claves = Object.keys(fields) as Array<keyof typeof fields>;

  for (const clave of claves) {
    const definicion = fields[clave];
    if (isArraySchema(definicion)) {
      resultado[clave as string] = [];
    } else {
      const scalar = definicion as ScalarFieldSchema<any, any>;
      resultado[clave as string] = scalar.validations ?? [];
    }
  }

  return resultado;
};

const aplicarCamposComputados = (
  schema: ObjectSchema,
  formulario: Record<string, unknown>,
) => {
  const fields = schema.fields;
  const claves = Object.keys(fields) as Array<keyof typeof fields>;

  for (const clave of claves) {
    const definicion = fields[clave];
    if (isArraySchema(definicion)) {
      continue;
    }
    const scalar = definicion as ScalarFieldSchema<any, any>;
    if (scalar.computed) {
      formulario[clave as string] = scalar.computed.compute(formulario);
    }
  }
};

export const toNumber = (valor: unknown): number | undefined => {
  if (typeof valor === "number" && Number.isFinite(valor)) {
    return valor;
  }
  if (typeof valor === "string" && valor.trim().length > 0) {
    const convertido = Number(valor);
    if (Number.isFinite(convertido)) {
      return convertido;
    }
  }
  return undefined;
};

export const sanitizeText = (valor: unknown): string | undefined => {
  if (typeof valor !== "string") {
    return undefined;
  }
  const texto = valor.trim();
  return texto.length > 0 ? texto : undefined;
};

// Devuelve un mensaje de error amigable para mostrar en notificaciones.
export const getSolicitudErrorMessage = (error: unknown, fallback: string) => {
  if (!error) {
    return fallback;
  }
  if (typeof error === "string") {
    return error;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
};

// Genera un resumen compacto con tipo, comentario y fecha.
export const formatSolicitudSummary = (params: {
  tipo?: string | null;
  comentario?: string | null;
  fechaNecesidad?: string | null;
}) => {
  const tipoTexto = params.tipo === "directa" ? "Compra Directa" : "Normal";
  const comentarioBase = params.comentario ?? "";
  const comentarioTexto =
    comentarioBase.length > 50
      ? `${comentarioBase.substring(0, 50)}...`
      : comentarioBase || "Sin comentario";
  const fechaTexto = params.fechaNecesidad || "Sin fecha";

  return `${tipoTexto} | ${comentarioTexto} | ${fechaTexto}`;
};

// Devuelve una descripcion truncada para mostrar en tarjetas/listados.
export const truncateDescripcion = (valor: string | null | undefined) => {
  if (!valor) {
    return "Sin descripcion";
  }
  return valor.length > 35 ? `${valor.substring(0, 35).trimEnd()}...` : valor;
};
