# GenericForm - Guía Completa de Configuración

## Índice

1. [Introducción](#introducción)
2. [Configuración Básica](#configuración-básica)
3. [Tipos de Campo](#tipos-de-campo)
4. [Validaciones](#validaciones)
5. [Referencias y Relaciones](#referencias-y-relaciones)
6. [Campos Condicionales](#campos-condicionales)
7. [Configuración de Layout](#configuración-de-layout)
8. [Ejemplos Completos](#ejemplos-completos)

---

## Introducción

`GenericForm` es un sistema declarativo para crear formularios en React Admin. En lugar de escribir componentes JSX manualmente, defines una configuración en un archivo `.config.ts` que describe todos los campos, validaciones y comportamiento del formulario.

### Ventajas

- ✅ **Código reducido**: ~95% menos código comparado con formularios imperativos
- ✅ **Mantenimiento simple**: Toda la configuración en un solo lugar
- ✅ **Type-safe**: TypeScript garantiza tipos correctos
- ✅ **Consistente**: Todos los formularios siguen el mismo patrón
- ✅ **Reutilizable**: Fácil de extender y adaptar

### Estructura de Archivos

```
app/resources/[recurso]/
├── types.ts          # Tipos TypeScript y constantes
├── form.config.ts    # Configuración declarativa del formulario
└── form.tsx          # Wrapper simple que usa GenericForm
```

---

## Configuración Básica

### Ejemplo Mínimo

```typescript
// form.config.ts
import { FormConfig } from "@/components/form/GenericForm";

export const miRecursoFormConfig: FormConfig = {
  resource: "mi-recurso",
  
  fields: [
    {
      source: "nombre",
      label: "Nombre",
      type: "text",
      isRequired: true,
    },
  ],
};
```

### Uso en el Componente

```tsx
// form.tsx
"use client";

import { GenericForm } from "@/components/form/GenericForm";
import { miRecursoFormConfig } from "./form.config";

export const MiRecursoForm = () => {
  return <GenericForm config={miRecursoFormConfig} />;
};
```

### Propiedades de FormConfig

```typescript
interface FormConfig {
  resource: string;                    // Nombre del recurso
  title?: string;                      // Título del formulario
  fields: FieldConfig[];               // Array de campos
  layout?: "single" | "two-columns";   // Layout del formulario
  defaultValues?: Record<string, any>; // Valores por defecto
  redirectOnSuccess?: string | false;  // Redirección después de guardar
  toolbar?: {                          // Configuración de la barra de herramientas
    showSave?: boolean;
    showDelete?: boolean;
    saveLabel?: string;
    deleteLabel?: string;
  };
}
```

---

## Tipos de Campo

### 1. Text Input

Campo de texto simple.

```typescript
{
  source: "nombre",
  label: "Nombre",
  type: "text",
  isRequired: true,
  placeholder: "Ingrese el nombre",
  helperText: "Nombre completo del recurso",
}
```

**Validaciones disponibles:**
- `isRequired`: Campo obligatorio
- `minLength`: Longitud mínima
- `maxLength`: Longitud máxima
- `pattern`: Expresión regular
- `validate`: Función custom

### 2. Number Input

Campo numérico con validación.

```typescript
{
  source: "precio",
  label: "Precio",
  type: "number",
  isRequired: true,
  min: 0,
  max: 999999,
  step: 0.01,
}
```

**Opciones:**
- `min`: Valor mínimo
- `max`: Valor máximo
- `step`: Incremento (ej: 0.01 para decimales)

### 3. Email Input

Campo específico para emails con validación automática.

```typescript
{
  source: "email",
  label: "Email",
  type: "email",
  isRequired: true,
  placeholder: "usuario@ejemplo.com",
}
```

### 4. Password Input

Campo de contraseña con opcionalidad.

```typescript
{
  source: "password",
  label: "Contraseña",
  type: "password",
  isRequired: true,
  minLength: 8,
  helperText: "Mínimo 8 caracteres",
}
```

### 5. Textarea

Campo de texto multilinea.

```typescript
{
  source: "descripcion",
  label: "Descripción",
  type: "textarea",
  rows: 5,
  placeholder: "Ingrese una descripción detallada",
}
```

**Opciones:**
- `rows`: Número de líneas visibles (default: 3)

### 6. Select (Choice)

Campo de selección con opciones predefinidas.

```typescript
{
  source: "tipo",
  label: "Tipo",
  type: "select",
  isRequired: true,
  choices: [
    { id: "normal", name: "Normal" },
    { id: "urgente", name: "Urgente" },
    { id: "especial", name: "Especial" },
  ],
}
```

**Con constantes reutilizables:**

```typescript
// types.ts
export const tipoChoices = [
  { id: "normal", name: "Normal" },
  { id: "urgente", name: "Urgente" },
] as const;

// form.config.ts
{
  source: "tipo",
  type: "select",
  choices: tipoChoices,
}
```

### 7. Date Input

Campo de fecha.

```typescript
{
  source: "fecha_nacimiento",
  label: "Fecha de Nacimiento",
  type: "date",
  isRequired: true,
}
```

### 8. DateTime Input

Campo de fecha y hora.

```typescript
{
  source: "fecha_entrega",
  label: "Fecha de Entrega",
  type: "datetime",
  isRequired: true,
}
```

### 9. Boolean (Checkbox)

Checkbox para valores booleanos.

```typescript
{
  source: "activo",
  label: "Activo",
  type: "boolean",
  defaultValue: true,
}
```

### 10. File Upload

Campo para subir archivos.

```typescript
{
  source: "avatar",
  label: "Foto de Perfil",
  type: "file",
  accept: "image/*",
  maxSize: 5000000, // 5MB en bytes
}
```

**Opciones:**
- `accept`: Tipos de archivo permitidos (ej: "image/*", ".pdf", ".doc,.docx")
- `maxSize`: Tamaño máximo en bytes
- `multiple`: Permitir múltiples archivos

---

## Validaciones

### Validaciones Básicas

```typescript
{
  source: "nombre",
  type: "text",
  isRequired: true,           // Campo obligatorio
  minLength: 3,               // Mínimo 3 caracteres
  maxLength: 100,             // Máximo 100 caracteres
}
```

### Validación con Pattern (Regex)

```typescript
{
  source: "codigo",
  type: "text",
  pattern: /^[A-Z]{3}-\d{3}$/, // Formato: ABC-123
  helperText: "Formato: XXX-999",
}
```

### Validación Custom

```typescript
{
  source: "edad",
  type: "number",
  validate: (value) => {
    if (value < 18) {
      return "Debe ser mayor de 18 años";
    }
    if (value > 120) {
      return "Edad no válida";
    }
    return undefined; // Sin errores
  },
}
```

### Validaciones Múltiples

```typescript
{
  source: "username",
  type: "text",
  isRequired: true,
  minLength: 4,
  maxLength: 20,
  pattern: /^[a-z0-9_]+$/,
  validate: async (value) => {
    // Validación asíncrona (ej: verificar disponibilidad)
    const exists = await checkUsernameExists(value);
    if (exists) {
      return "Este nombre de usuario ya está en uso";
    }
  },
}
```

---

## Referencias y Relaciones

### ReferenceInput Simple

Selección de un registro relacionado.

```typescript
{
  source: "categoria_id",
  label: "Categoría",
  type: "reference",
  reference: "categorias",      // Recurso relacionado
  referenceField: "nombre",     // Campo a mostrar
  isRequired: true,
}
```

### ReferenceInput con Filtro

Filtrar opciones basado en otro campo.

```typescript
{
  source: "subcategoria_id",
  label: "Subcategoría",
  type: "reference",
  reference: "subcategorias",
  referenceField: "nombre",
  filter: (values) => ({
    // Filtrar por categoría seleccionada
    categoria_id: values.categoria_id,
  }),
  // Solo mostrar si hay categoría seleccionada
  isVisible: (values) => !!values.categoria_id,
}
```

### AutocompleteInput

Para referencias con muchas opciones.

```typescript
{
  source: "cliente_id",
  label: "Cliente",
  type: "autocomplete",
  reference: "clientes",
  referenceField: "nombre_completo",
  isRequired: true,
  placeholder: "Buscar cliente...",
}
```

### ReferenceArrayInput

Selección múltiple de referencias.

```typescript
{
  source: "etiquetas",
  label: "Etiquetas",
  type: "reference-array",
  reference: "etiquetas",
  referenceField: "nombre",
}
```

---

## Campos Condicionales

### Mostrar/Ocultar basado en otro campo

```typescript
{
  source: "tiene_descuento",
  label: "Tiene Descuento",
  type: "boolean",
},
{
  source: "porcentaje_descuento",
  label: "Porcentaje de Descuento",
  type: "number",
  min: 0,
  max: 100,
  // Solo visible si tiene_descuento es true
  isVisible: (values) => values.tiene_descuento === true,
}
```

### Múltiples Condiciones

```typescript
{
  source: "metodo_pago",
  label: "Método de Pago",
  type: "select",
  choices: [
    { id: "efectivo", name: "Efectivo" },
    { id: "tarjeta", name: "Tarjeta" },
    { id: "transferencia", name: "Transferencia" },
  ],
},
{
  source: "numero_tarjeta",
  label: "Número de Tarjeta",
  type: "text",
  isVisible: (values) => values.metodo_pago === "tarjeta",
  isRequired: (values) => values.metodo_pago === "tarjeta",
},
{
  source: "banco",
  label: "Banco",
  type: "select",
  choices: bancoChoices,
  isVisible: (values) => 
    values.metodo_pago === "tarjeta" || 
    values.metodo_pago === "transferencia",
}
```

### Habilitar/Deshabilitar

```typescript
{
  source: "codigo_producto",
  label: "Código de Producto",
  type: "text",
  // Deshabilitar en modo edición
  isDisabled: (values, mode) => mode === "edit",
}
```

---

## Configuración de Layout

### Layout de Una Columna (Default)

```typescript
export const formConfig: FormConfig = {
  resource: "productos",
  layout: "single", // o simplemente omitir
  fields: [
    { source: "nombre", type: "text" },
    { source: "descripcion", type: "textarea" },
    { source: "precio", type: "number" },
  ],
};
```

### Layout de Dos Columnas

```typescript
export const formConfig: FormConfig = {
  resource: "productos",
  layout: "two-columns",
  fields: [
    // Los campos se distribuyen automáticamente en dos columnas
    { source: "nombre", type: "text" },
    { source: "codigo", type: "text" },
    { source: "categoria_id", type: "reference", reference: "categorias" },
    { source: "precio", type: "number" },
    { source: "stock", type: "number" },
    { source: "activo", type: "boolean" },
    // Los textarea ocupan ambas columnas automáticamente
    { source: "descripcion", type: "textarea" },
  ],
};
```

### Control Manual de Columnas

```typescript
{
  source: "descripcion_completa",
  type: "textarea",
  fullWidth: true, // Forzar ocupar ancho completo
}
```

---

## Ejemplos Completos

### Ejemplo 1: Formulario de Producto

```typescript
// types.ts
export const categoriaChoices = [
  { id: "electrónica", name: "Electrónica" },
  { id: "ropa", name: "Ropa" },
  { id: "alimentos", name: "Alimentos" },
] as const;

export interface ProductoFormValues {
  nombre: string;
  codigo: string;
  descripcion?: string;
  categoria: string;
  precio: number;
  stock: number;
  activo: boolean;
  proveedor_id: number;
  imagen?: File;
}

// form.config.ts
import { FormConfig } from "@/components/form/GenericForm";
import { categoriaChoices } from "./types";

export const productoFormConfig: FormConfig = {
  resource: "productos",
  title: "Producto",
  layout: "two-columns",
  
  fields: [
    {
      source: "nombre",
      label: "Nombre del Producto",
      type: "text",
      isRequired: true,
      maxLength: 100,
      placeholder: "Ej: Laptop Dell XPS 15",
    },
    {
      source: "codigo",
      label: "Código SKU",
      type: "text",
      isRequired: true,
      pattern: /^[A-Z0-9-]+$/,
      helperText: "Solo mayúsculas, números y guiones",
    },
    {
      source: "categoria",
      label: "Categoría",
      type: "select",
      choices: categoriaChoices,
      isRequired: true,
    },
    {
      source: "proveedor_id",
      label: "Proveedor",
      type: "reference",
      reference: "proveedores",
      referenceField: "nombre",
      isRequired: true,
    },
    {
      source: "precio",
      label: "Precio",
      type: "number",
      isRequired: true,
      min: 0,
      step: 0.01,
    },
    {
      source: "stock",
      label: "Stock",
      type: "number",
      isRequired: true,
      min: 0,
    },
    {
      source: "activo",
      label: "Activo",
      type: "boolean",
      defaultValue: true,
    },
    {
      source: "descripcion",
      label: "Descripción",
      type: "textarea",
      rows: 5,
      maxLength: 500,
      fullWidth: true,
    },
    {
      source: "imagen",
      label: "Imagen del Producto",
      type: "file",
      accept: "image/*",
      maxSize: 2000000, // 2MB
      fullWidth: true,
    },
  ],
  
  toolbar: {
    showSave: true,
    showDelete: true,
    saveLabel: "Guardar Producto",
  },
};

// form.tsx
"use client";

import { GenericForm } from "@/components/form/GenericForm";
import { productoFormConfig } from "./form.config";

export const ProductoForm = () => {
  return <GenericForm config={productoFormConfig} />;
};
```

### Ejemplo 2: Formulario con Campos Condicionales

```typescript
// form.config.ts
export const ordenFormConfig: FormConfig = {
  resource: "ordenes",
  
  fields: [
    {
      source: "cliente_id",
      label: "Cliente",
      type: "autocomplete",
      reference: "clientes",
      referenceField: "nombre",
      isRequired: true,
    },
    {
      source: "tipo_orden",
      label: "Tipo de Orden",
      type: "select",
      choices: [
        { id: "normal", name: "Normal" },
        { id: "urgente", name: "Urgente" },
        { id: "programada", name: "Programada" },
      ],
      isRequired: true,
    },
    {
      source: "fecha_entrega",
      label: "Fecha de Entrega",
      type: "datetime",
      isVisible: (values) => values.tipo_orden === "programada",
      isRequired: (values) => values.tipo_orden === "programada",
    },
    {
      source: "requiere_factura",
      label: "Requiere Factura",
      type: "boolean",
      defaultValue: false,
    },
    {
      source: "rfc",
      label: "RFC",
      type: "text",
      isVisible: (values) => values.requiere_factura === true,
      isRequired: (values) => values.requiere_factura === true,
      pattern: /^[A-Z]{4}\d{6}[A-Z0-9]{3}$/,
      helperText: "Formato: AAAA######XXX",
    },
    {
      source: "razon_social",
      label: "Razón Social",
      type: "text",
      isVisible: (values) => values.requiere_factura === true,
      isRequired: (values) => values.requiere_factura === true,
    },
    {
      source: "comentarios",
      label: "Comentarios",
      type: "textarea",
      rows: 4,
    },
  ],
};
```

### Ejemplo 3: Formulario con Validación Compleja

```typescript
export const usuarioFormConfig: FormConfig = {
  resource: "usuarios",
  
  fields: [
    {
      source: "nombre",
      label: "Nombre Completo",
      type: "text",
      isRequired: true,
      minLength: 3,
      maxLength: 100,
    },
    {
      source: "email",
      label: "Email",
      type: "email",
      isRequired: true,
      validate: async (value) => {
        // Validar formato de email corporativo
        if (!value.endsWith("@empresa.com")) {
          return "Debe usar un email corporativo (@empresa.com)";
        }
        
        // Verificar que no exista
        const exists = await checkEmailExists(value);
        if (exists) {
          return "Este email ya está registrado";
        }
      },
    },
    {
      source: "password",
      label: "Contraseña",
      type: "password",
      isRequired: true,
      minLength: 8,
      validate: (value) => {
        // Validar complejidad de contraseña
        if (!/[A-Z]/.test(value)) {
          return "Debe contener al menos una mayúscula";
        }
        if (!/[a-z]/.test(value)) {
          return "Debe contener al menos una minúscula";
        }
        if (!/[0-9]/.test(value)) {
          return "Debe contener al menos un número";
        }
        if (!/[!@#$%^&*]/.test(value)) {
          return "Debe contener al menos un carácter especial";
        }
      },
    },
    {
      source: "confirm_password",
      label: "Confirmar Contraseña",
      type: "password",
      isRequired: true,
      validate: (value, values) => {
        if (value !== values.password) {
          return "Las contraseñas no coinciden";
        }
      },
    },
    {
      source: "rol",
      label: "Rol",
      type: "select",
      choices: [
        { id: "admin", name: "Administrador" },
        { id: "user", name: "Usuario" },
        { id: "guest", name: "Invitado" },
      ],
      isRequired: true,
    },
  ],
};
```

---

## API Reference Completa

### FieldConfig Interface

```typescript
interface FieldConfig {
  // Básico
  source: string;                          // Nombre del campo (requerido)
  label?: string;                          // Etiqueta visible
  type: FieldType;                         // Tipo de campo (requerido)
  
  // Validación
  isRequired?: boolean | ((values: any) => boolean);
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  validate?: (value: any, values: any) => string | undefined | Promise<string | undefined>;
  
  // UI
  placeholder?: string;
  helperText?: string;
  defaultValue?: any;
  fullWidth?: boolean;
  
  // Condicionales
  isVisible?: (values: any, mode: "create" | "edit") => boolean;
  isDisabled?: (values: any, mode: "create" | "edit") => boolean;
  
  // Específicos por tipo
  rows?: number;                           // textarea
  choices?: Choice[];                      // select
  reference?: string;                      // reference, autocomplete
  referenceField?: string;                 // reference, autocomplete
  filter?: (values: any) => any;          // reference
  accept?: string;                         // file
  maxSize?: number;                        // file
  multiple?: boolean;                      // file
  step?: number;                           // number
}
```

### FieldType

```typescript
type FieldType = 
  | "text"
  | "number"
  | "email"
  | "password"
  | "textarea"
  | "select"
  | "date"
  | "datetime"
  | "boolean"
  | "file"
  | "reference"
  | "autocomplete"
  | "reference-array";
```

---

## Mejores Prácticas

### 1. Organización de Archivos

✅ **Recomendado:**
```
resources/productos/
├── types.ts          # Tipos e interfaces
├── form.config.ts    # Configuración del formulario
├── form.tsx          # Wrapper simple
└── List.tsx          # Componente de lista
```

❌ **Evitar:**
- Mezclar configuración con lógica de negocio
- Duplicar choices en múltiples archivos

### 2. Constantes Reutilizables

✅ **Recomendado:**
```typescript
// types.ts
export const estadoChoices = [
  { id: "activo", name: "Activo" },
  { id: "inactivo", name: "Inactivo" },
] as const;

// Usar en múltiples lugares
```

### 3. Validaciones Complejas

✅ **Recomendado:**
```typescript
// utils/validators.ts
export const validateRFC = (value: string) => {
  if (!/^[A-Z]{4}\d{6}[A-Z0-9]{3}$/.test(value)) {
    return "RFC inválido";
  }
};

// form.config.ts
{
  source: "rfc",
  validate: validateRFC,
}
```

### 4. Type Safety

✅ **Recomendado:**
```typescript
// types.ts
export interface ProductoFormValues {
  nombre: string;
  precio: number;
  activo: boolean;
}

// form.config.ts
export const formConfig: FormConfig<ProductoFormValues> = {
  // TypeScript validará que los campos coincidan
};
```

---

## Troubleshooting

### El campo no aparece

- ✅ Verificar que `source` coincida exactamente con el nombre del campo
- ✅ Verificar condición `isVisible` si existe
- ✅ Verificar que el campo esté en el array `fields`

### La validación no funciona

- ✅ Validar que la función retorne `string` (error) o `undefined` (sin error)
- ✅ Para async, asegurar que retorne `Promise<string | undefined>`
- ✅ Verificar que `isRequired` esté configurado correctamente

### El valor no se guarda

- ✅ Verificar que `source` coincida con el campo del backend
- ✅ Verificar que no haya errores de validación
- ✅ Revisar la consola del navegador para errores

### La referencia no carga opciones

- ✅ Verificar que el recurso `reference` exista
- ✅ Verificar que `referenceField` sea un campo válido
- ✅ Verificar permisos del recurso en el backend

---

## Migración desde Formularios Imperativos

### Antes (Imperativo)

```tsx
export const ProductoForm = () => {
  return (
    <SimpleForm>
      <TextInput source="nombre" label="Nombre" validate={required()} />
      <NumberInput source="precio" label="Precio" validate={required()} />
      <ReferenceInput source="categoria_id" reference="categorias">
        <SelectInput optionText="nombre" validate={required()} />
      </ReferenceInput>
      <BooleanInput source="activo" label="Activo" />
      <TextInput source="descripcion" label="Descripción" multiline rows={5} />
    </SimpleForm>
  );
};
```

### Después (Declarativo)

```typescript
// form.config.ts
export const productoFormConfig: FormConfig = {
  resource: "productos",
  fields: [
    { source: "nombre", label: "Nombre", type: "text", isRequired: true },
    { source: "precio", label: "Precio", type: "number", isRequired: true },
    { source: "categoria_id", label: "Categoría", type: "reference", reference: "categorias", referenceField: "nombre", isRequired: true },
    { source: "activo", label: "Activo", type: "boolean" },
    { source: "descripcion", label: "Descripción", type: "textarea", rows: 5 },
  ],
};

// form.tsx
export const ProductoForm = () => {
  return <GenericForm config={productoFormConfig} />;
};
```

**Reducción de código: ~60-95% según complejidad**

---

## Soporte y Extensión

### Agregar un Nuevo Tipo de Campo

1. Actualizar el tipo `FieldType` en `types.ts`
2. Agregar el caso en `useFieldRenderer.tsx`
3. Implementar el componente correspondiente

### Agregar Validaciones Globales

```typescript
// utils/globalValidators.ts
export const globalValidators = {
  rfc: (value: string) => { /* ... */ },
  curp: (value: string) => { /* ... */ },
  phone: (value: string) => { /* ... */ },
};

// Usar en configuración
{
  source: "rfc",
  validate: globalValidators.rfc,
}
```

---

## Changelog

- **v1.0** - Implementación inicial con tipos básicos
- **v1.1** - Agregado soporte para campos condicionales
- **v1.2** - Agregado layout de dos columnas
- **v1.3** - Agregado soporte para validaciones async
