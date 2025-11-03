# GenericList - Guía Completa de Configuración

> **🎉 ARQUITECTURA MEJORADA (Nov 2025)**
> 
> GenericList ahora usa **un solo componente responsive** (DataTable) para desktop y mobile, eliminando la duplicación de lógica. El mismo componente muestra una tabla en desktop y cards en mobile, compartiendo toda la lógica de navegación, selección y acciones.
>
> **Ventajas:**
> - ✅ Un solo camino de código (sin branches mobile/desktop)
> - ✅ Comportamiento idéntico en ambas vistas
> - ✅ Sin problemas de sincronización de eventos
> - ✅ Más simple de mantener y debuggear

## Índice

1. [Introducción](#introducción)
2. [Configuración Básica](#configuración-básica)
3. [Filtros](#filtros)
4. [Columnas](#columnas)
5. [Acciones](#acciones)
6. [Mobile Layout](#mobile-layout)
7. [Sorting y Paginación](#sorting-y-paginación)
8. [Ejemplos Completos](#ejemplos-completos)

---

## Introducción

`GenericList` es un sistema declarativo para crear listas/tablas en React Admin. Similar a `GenericForm`, reemplaza componentes imperativos con una configuración declarativa que describe filtros, columnas, acciones y comportamiento.

### Ventajas

- ✅ **Código reducido**: ~95% menos código comparado con listas imperativas
- ✅ **Configuración centralizada**: Todo en un archivo `list.config.ts`
- ✅ **Type-safe**: TypeScript garantiza tipos correctos
- ✅ **Consistente**: Patrón uniforme en todas las listas
- ✅ **Responsive**: Un solo componente adaptativo para desktop y mobile
- ✅ **Acciones unificadas**: Sistema flexible para acciones individuales y masivas

### Estructura de Archivos

```
app/resources/[recurso]/
├── types.ts          # Tipos TypeScript y constantes
├── list.config.ts    # Configuración declarativa de la lista
└── List.tsx          # Wrapper simple que usa GenericList
```

---

## Configuración Básica

### Ejemplo Mínimo

```typescript
// list.config.ts
import { ListConfig } from "@/components/list/GenericList";

export const miRecursoListConfig: ListConfig = {
  resource: "mi-recurso",
  
  filters: [
    {
      source: "q",
      type: "text",
      label: false,
      placeholder: "Buscar...",
      alwaysOn: true,
    },
  ],
  
  columns: [
    { source: "id", label: "ID" },
    { source: "nombre", label: "Nombre" },
  ],
};
```

### Uso en el Componente

```tsx
// List.tsx
"use client";

import { GenericList } from "@/components/list/GenericList";
import { miRecursoListConfig } from "./list.config";

export const MiRecursoList = () => {
  return <GenericList config={miRecursoListConfig} />;
};
```

### Propiedades de ListConfig

```typescript
interface ListConfig {
  resource: string;                    // Nombre del recurso (requerido)
  title?: string;                      // Título de la lista
  filters?: FilterConfig[];            // Configuración de filtros
  columns: ColumnConfig[];             // Configuración de columnas (requerido)
  actions?: ActionConfig[];            // Acciones disponibles
  
  // Paginación y ordenamiento
  perPage?: number;                    // Registros por página (default: 10)
  defaultSort?: {                      // Ordenamiento por defecto
    field: string;
    order: "ASC" | "DESC";
  };
  
  // Comportamiento
  rowClick?: string | ((id: any) => string); // URL al hacer click en fila
  
  // Mobile
  mobile?: MobileConfig;               // Configuración específica para mobile
  
  // Layout de acciones
  rowActionsLayout?: {
    position: "inline" | "menu" | "column" | "mixed";
    maxInline?: number;                // Máximo de acciones inline antes de usar menú
  };
}
```

---

## Filtros

Los filtros permiten a los usuarios buscar y filtrar registros en la lista.

### Filtro de Texto (Búsqueda)

```typescript
{
  source: "q",
  type: "text",
  label: false,                    // Sin etiqueta visible
  placeholder: "Buscar por nombre, código...",
  alwaysOn: true,                  // Siempre visible
}
```

**Opciones:**
- `alwaysOn`: Si es `true`, el filtro siempre está visible
- `label`: Etiqueta del filtro (puede ser `false` para ocultarla)
- `placeholder`: Texto placeholder

### Filtro Select (Opciones)

```typescript
{
  source: "estado",
  type: "select",
  label: "Estado",
  choices: [
    { id: "activo", name: "Activo" },
    { id: "inactivo", name: "Inactivo" },
    { id: "pendiente", name: "Pendiente" },
  ],
  defaultValue: "activo",          // Valor por defecto
}
```

**Con constantes reutilizables:**

```typescript
// types.ts
export const estadoChoices = [
  { id: "activo", name: "Activo" },
  { id: "inactivo", name: "Inactivo" },
] as const;

// list.config.ts
{
  source: "estado",
  type: "select",
  choices: estadoChoices,
}
```

### Filtro de Referencia

```typescript
{
  source: "categoria_id",
  type: "reference",
  label: "Categoría",
  reference: "categorias",
  referenceField: "nombre",
}
```

### Múltiples Filtros

```typescript
filters: [
  {
    source: "q",
    type: "text",
    label: false,
    placeholder: "Buscar productos...",
    alwaysOn: true,
  },
  {
    source: "categoria_id",
    type: "select",
    label: "Categoría",
    choices: categoriaChoices,
  },
  {
    source: "activo",
    type: "select",
    label: "Estado",
    choices: [
      { id: "true", name: "Activo" },
      { id: "false", name: "Inactivo" },
    ],
  },
  {
    source: "proveedor_id",
    type: "reference",
    label: "Proveedor",
    reference: "proveedores",
    referenceField: "nombre",
  },
],
```

---

## Columnas

Las columnas definen qué datos se muestran en la tabla.

### Columna de Texto Simple

```typescript
{
  source: "nombre",
  label: "Nombre",
  sortable: true,                  // Habilita ordenamiento
}
```

### Columna de Fecha

```typescript
{
  source: "fecha_creacion",
  label: "Fecha de Creación",
  type: "date",
  sortable: true,
}
```

### Columna de Choice (Select)

Muestra el label del choice en lugar del ID.

```typescript
{
  source: "tipo",
  label: "Tipo",
  type: "choice",
  choices: [
    { id: "normal", name: "Normal" },
    { id: "urgente", name: "Urgente" },
  ],
  sortable: true,
}
```

### Columna de Referencia

Muestra datos de un recurso relacionado.

```typescript
{
  source: "categoria_id",
  label: "Categoría",
  type: "reference",
  reference: "categorias",
  referenceField: "nombre",
}
```

**Con preload para optimización:**

```typescript
{
  source: "categoria_id",
  label: "Categoría",
  type: "reference",
  reference: "categorias",
  referenceField: "nombre",
  preload: true,                   // Precarga todas las categorías
}
```

### Columna Boolean

```typescript
{
  source: "activo",
  label: "Activo",
  type: "boolean",
}
```

### Columna con Render Custom

Para casos complejos donde necesitas renderizado personalizado.

```typescript
{
  source: "precio",
  label: "Precio",
  render: (record) => {
    return (
      <span className="font-bold text-green-600">
        ${record.precio.toFixed(2)}
      </span>
    );
  },
}
```

### Columna con Truncate

Trunca texto largo automáticamente.

```typescript
{
  source: "descripcion",
  label: "Descripción",
  truncate: 50,                    // Máximo 50 caracteres
}
```

### Ejemplo Completo de Columnas

```typescript
columns: [
  {
    source: "id",
    label: "ID",
    sortable: true,
  },
  {
    source: "codigo",
    label: "Código",
    sortable: true,
  },
  {
    source: "nombre",
    label: "Nombre",
    sortable: true,
  },
  {
    source: "categoria_id",
    label: "Categoría",
    type: "reference",
    reference: "categorias",
    referenceField: "nombre",
    preload: true,
  },
  {
    source: "tipo",
    label: "Tipo",
    type: "choice",
    choices: tipoChoices,
  },
  {
    source: "precio",
    label: "Precio",
    render: (record) => `$${record.precio.toFixed(2)}`,
  },
  {
    source: "stock",
    label: "Stock",
    sortable: true,
  },
  {
    source: "activo",
    label: "Activo",
    type: "boolean",
  },
  {
    source: "fecha_creacion",
    label: "Creado",
    type: "date",
    sortable: true,
  },
],
```

---

## Acciones

Las acciones permiten ejecutar operaciones sobre uno o múltiples registros. El sistema soporta:

- **Acciones individuales**: Se ejecutan sobre un registro
- **Acciones masivas (bulk)**: Se ejecutan sobre múltiples registros seleccionados
- **Posicionamiento flexible**: Inline, menú, columna o mixto

### Estructura de ActionConfig

```typescript
interface ActionConfig {
  name: string;                    // Identificador único
  label: string;                   // Texto visible
  icon?: string;                   // Icono lucide-react
  variant?: ActionVariant;         // Estilo del botón
  
  // Scope de la acción
  individual: IndividualActionPosition;  // "inline" | "menu" | "column" | "none"
  bulk: boolean;                   // Si está disponible para bulk
  
  // Comportamiento
  action?: (ids: any[], record?: any) => void | Promise<void>;
  mutation?: MutationConfig;       // Mutación react-admin
  dialog?: DialogConfig;           // Mostrar dialog antes de ejecutar
  confirm?: ConfirmConfig;         // Confirmación simple
  
  // Visibilidad y habilitación
  isVisible?: (record?: any) => boolean;
  isEnabled?: (record?: any) => boolean;
}
```

### Posiciones de Acciones Individuales

```typescript
type IndividualActionPosition = 
  | "inline"   // Botones visibles en cada fila
  | "menu"     // Dentro de un menú "..." 
  | "column"   // Columna dedicada de acciones
  | "none";    // Solo disponible como bulk
```

### Ejemplo 1: Acción de Edición (Inline)

```typescript
{
  name: "edit",
  label: "Editar",
  icon: "Edit",
  variant: "outline",
  individual: "inline",
  bulk: false,
  action: (ids, record) => {
    window.location.href = `/productos/${record.id}/edit`;
  },
}
```

### Ejemplo 2: Acción de Eliminación (Menú + Bulk)

```typescript
{
  name: "delete",
  label: "Eliminar",
  icon: "Trash2",
  variant: "destructive",
  individual: "menu",
  bulk: true,
  confirm: {
    title: "¿Eliminar registros?",
    content: "Esta acción no se puede deshacer.",
  },
  mutation: {
    type: "deleteMany",
  },
}
```

### Ejemplo 3: Acción con Dialog

```typescript
{
  name: "approve",
  label: "Aprobar",
  icon: "CheckCircle",
  variant: "default",
  individual: "inline",
  bulk: true,
  dialog: {
    title: "Aprobar Orden",
    fields: [
      {
        source: "comentario_aprobacion",
        label: "Comentario",
        type: "textarea",
        isRequired: true,
      },
      {
        source: "fecha_aprobacion",
        label: "Fecha de Aprobación",
        type: "date",
        defaultValue: new Date().toISOString().split('T')[0],
      },
    ],
  },
  mutation: {
    type: "updateMany",
    data: (dialogValues) => ({
      estado: "aprobado",
      ...dialogValues,
    }),
  },
}
```

### Ejemplo 4: Acción Custom con Lógica Compleja

```typescript
{
  name: "export",
  label: "Exportar",
  icon: "Download",
  individual: "none",
  bulk: true,
  action: async (ids) => {
    try {
      const response = await fetch(`/api/productos/export`, {
        method: "POST",
        body: JSON.stringify({ ids }),
        headers: { "Content-Type": "application/json" },
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `productos-${Date.now()}.xlsx`;
      a.click();
    } catch (error) {
      console.error("Error al exportar:", error);
    }
  },
}
```

### Ejemplo 5: Acción Condicional

```typescript
{
  name: "activate",
  label: "Activar",
  icon: "Power",
  individual: "inline",
  bulk: true,
  // Solo visible si el registro está inactivo
  isVisible: (record) => record?.activo === false,
  mutation: {
    type: "updateMany",
    data: { activo: true },
  },
}
```

### Layout de Acciones

#### Inline (Botones visibles)

```typescript
rowActionsLayout: {
  position: "inline",
}
```

Todas las acciones con `individual: "inline"` se muestran como botones en cada fila.

#### Menu (Dropdown "...")

```typescript
rowActionsLayout: {
  position: "menu",
}
```

Todas las acciones individuales se agrupan en un menú dropdown.

#### Mixed (Mixto)

```typescript
rowActionsLayout: {
  position: "mixed",
  maxInline: 2,                    // Primeras 2 inline, resto en menú
}
```

Las primeras N acciones se muestran inline, el resto en un menú.

### Ejemplo Completo de Acciones

```typescript
actions: [
  {
    name: "edit",
    label: "Editar",
    icon: "Edit",
    variant: "outline",
    individual: "inline",
    bulk: false,
    action: (ids, record) => {
      window.location.href = `/productos/${record.id}/edit`;
    },
  },
  {
    name: "view",
    label: "Ver Detalles",
    icon: "Eye",
    individual: "menu",
    bulk: false,
    action: (ids, record) => {
      window.location.href = `/productos/${record.id}`;
    },
  },
  {
    name: "duplicate",
    label: "Duplicar",
    icon: "Copy",
    individual: "menu",
    bulk: false,
    confirm: {
      title: "¿Duplicar producto?",
      content: "Se creará una copia exacta del producto.",
    },
    mutation: {
      type: "create",
      data: (_, record) => ({
        ...record,
        id: undefined,
        nombre: `${record.nombre} (Copia)`,
      }),
    },
  },
  {
    name: "activate",
    label: "Activar",
    icon: "Power",
    variant: "default",
    individual: "inline",
    bulk: true,
    isVisible: (record) => record?.activo === false,
    mutation: {
      type: "updateMany",
      data: { activo: true },
    },
  },
  {
    name: "deactivate",
    label: "Desactivar",
    icon: "PowerOff",
    variant: "secondary",
    individual: "inline",
    bulk: true,
    isVisible: (record) => record?.activo === true,
    mutation: {
      type: "updateMany",
      data: { activo: false },
    },
  },
  {
    name: "delete",
    label: "Eliminar",
    icon: "Trash2",
    variant: "destructive",
    individual: "menu",
    bulk: true,
    confirm: {
      title: "¿Eliminar productos?",
      content: "Esta acción no se puede deshacer.",
    },
    mutation: {
      type: "deleteMany",
    },
  },
  {
    name: "export",
    label: "Exportar",
    icon: "Download",
    individual: "none",
    bulk: true,
    action: async (ids) => {
      // Lógica de exportación personalizada
      await exportToExcel(ids);
    },
  },
],

rowActionsLayout: {
  position: "mixed",
  maxInline: 2,
}
```

---

## Mobile Layout

Configuración específica para la vista mobile (cards en lugar de tabla).

### Configuración Básica

```typescript
mobile: {
  primaryField: "nombre",          // Campo principal (más destacado)
  secondaryField: "codigo",        // Campo secundario
  metaFields: [                    // Campos de metadata
    "categoria_id",
    "fecha_creacion",
  ],
  badge: {                         // Badge en la tarjeta
    source: "estado",
    choices: estadoChoices,
  },
}
```

### Ejemplo Completo Mobile

```typescript
mobile: {
  primaryField: "nombre",
  secondaryField: "codigo",
  metaFields: [
    "categoria_id",
    "proveedor_id",
    "fecha_creacion",
  ],
  badge: {
    source: "tipo",
    choices: [
      { id: "normal", name: "Normal" },
      { id: "premium", name: "Premium" },
    ],
  },
  thumbnail: "imagen_url",         // URL de imagen para thumbnail
}
```

---

## Sorting y Paginación

### Configuración de Paginación

```typescript
perPage: 25,                       // Registros por página
```

### Ordenamiento por Defecto

```typescript
defaultSort: {
  field: "fecha_creacion",
  order: "DESC",
}
```

### Habilitar Sorting en Columnas

```typescript
{
  source: "nombre",
  label: "Nombre",
  sortable: true,                  // Permite ordenar por esta columna
}
```

---

## Ejemplos Completos

### Ejemplo 1: Lista de Productos

```typescript
// types.ts
export const categoriaChoices = [
  { id: "electrónica", name: "Electrónica" },
  { id: "ropa", name: "Ropa" },
  { id: "alimentos", name: "Alimentos" },
] as const;

// list.config.ts
import { ListConfig } from "@/components/list/GenericList";
import { categoriaChoices } from "./types";

export const productoListConfig: ListConfig = {
  resource: "productos",
  title: "Productos",
  
  perPage: 25,
  defaultSort: { field: "id", order: "DESC" },
  
  filters: [
    {
      source: "q",
      type: "text",
      label: false,
      placeholder: "Buscar por nombre, código...",
      alwaysOn: true,
    },
    {
      source: "categoria",
      type: "select",
      label: "Categoría",
      choices: categoriaChoices,
    },
    {
      source: "activo",
      type: "select",
      label: "Estado",
      choices: [
        { id: "true", name: "Activo" },
        { id: "false", name: "Inactivo" },
      ],
    },
  ],
  
  columns: [
    {
      source: "id",
      label: "ID",
      sortable: true,
    },
    {
      source: "codigo",
      label: "Código",
      sortable: true,
    },
    {
      source: "nombre",
      label: "Nombre",
      sortable: true,
    },
    {
      source: "categoria",
      label: "Categoría",
      type: "choice",
      choices: categoriaChoices,
    },
    {
      source: "precio",
      label: "Precio",
      render: (record) => `$${record.precio.toFixed(2)}`,
      sortable: true,
    },
    {
      source: "stock",
      label: "Stock",
      sortable: true,
    },
    {
      source: "activo",
      label: "Activo",
      type: "boolean",
    },
  ],
  
  actions: [
    {
      name: "edit",
      label: "Editar",
      icon: "Edit",
      variant: "outline",
      individual: "inline",
      bulk: false,
      action: (ids, record) => {
        window.location.href = `/productos/${record.id}/edit`;
      },
    },
    {
      name: "delete",
      label: "Eliminar",
      icon: "Trash2",
      variant: "destructive",
      individual: "menu",
      bulk: true,
      confirm: {
        title: "¿Eliminar productos?",
        content: "Esta acción no se puede deshacer.",
      },
      mutation: {
        type: "deleteMany",
      },
    },
  ],
  
  rowActionsLayout: {
    position: "mixed",
    maxInline: 1,
  },
  
  rowClick: (id) => `/productos/${id}`,
  
  mobile: {
    primaryField: "nombre",
    secondaryField: "codigo",
    metaFields: ["categoria", "precio"],
    badge: {
      source: "activo",
      choices: [
        { id: true, name: "Activo" },
        { id: false, name: "Inactivo" },
      ],
    },
  },
};

// List.tsx
"use client";

import { GenericList } from "@/components/list/GenericList";
import { productoListConfig } from "./list.config";

export const ProductoList = () => {
  return <GenericList config={productoListConfig} />;
};
```

### Ejemplo 2: Lista de Órdenes con Acciones Complejas

```typescript
export const ordenListConfig: ListConfig = {
  resource: "ordenes",
  title: "Órdenes de Compra",
  
  perPage: 20,
  defaultSort: { field: "fecha_creacion", order: "DESC" },
  
  filters: [
    {
      source: "q",
      type: "text",
      label: false,
      placeholder: "Buscar órdenes...",
      alwaysOn: true,
    },
    {
      source: "estado",
      type: "select",
      label: "Estado",
      choices: [
        { id: "pendiente", name: "Pendiente" },
        { id: "aprobada", name: "Aprobada" },
        { id: "rechazada", name: "Rechazada" },
        { id: "completada", name: "Completada" },
      ],
    },
    {
      source: "cliente_id",
      type: "reference",
      label: "Cliente",
      reference: "clientes",
      referenceField: "nombre",
    },
  ],
  
  columns: [
    { source: "numero_orden", label: "Orden #", sortable: true },
    {
      source: "cliente_id",
      label: "Cliente",
      type: "reference",
      reference: "clientes",
      referenceField: "nombre",
    },
    {
      source: "estado",
      label: "Estado",
      type: "choice",
      choices: [
        { id: "pendiente", name: "Pendiente" },
        { id: "aprobada", name: "Aprobada" },
        { id: "rechazada", name: "Rechazada" },
        { id: "completada", name: "Completada" },
      ],
    },
    {
      source: "total",
      label: "Total",
      render: (record) => `$${record.total.toFixed(2)}`,
      sortable: true,
    },
    {
      source: "fecha_creacion",
      label: "Fecha",
      type: "date",
      sortable: true,
    },
  ],
  
  actions: [
    {
      name: "view",
      label: "Ver",
      icon: "Eye",
      variant: "outline",
      individual: "inline",
      bulk: false,
      action: (ids, record) => {
        window.location.href = `/ordenes/${record.id}`;
      },
    },
    {
      name: "approve",
      label: "Aprobar",
      icon: "CheckCircle",
      variant: "default",
      individual: "inline",
      bulk: true,
      isVisible: (record) => record?.estado === "pendiente",
      dialog: {
        title: "Aprobar Orden",
        fields: [
          {
            source: "comentario",
            label: "Comentario de Aprobación",
            type: "textarea",
          },
        ],
      },
      mutation: {
        type: "updateMany",
        data: (dialogValues) => ({
          estado: "aprobada",
          fecha_aprobacion: new Date().toISOString(),
          ...dialogValues,
        }),
      },
    },
    {
      name: "reject",
      label: "Rechazar",
      icon: "XCircle",
      variant: "destructive",
      individual: "menu",
      bulk: true,
      isVisible: (record) => record?.estado === "pendiente",
      dialog: {
        title: "Rechazar Orden",
        fields: [
          {
            source: "motivo_rechazo",
            label: "Motivo del Rechazo",
            type: "textarea",
            isRequired: true,
          },
        ],
      },
      mutation: {
        type: "updateMany",
        data: (dialogValues) => ({
          estado: "rechazada",
          fecha_rechazo: new Date().toISOString(),
          ...dialogValues,
        }),
      },
    },
    {
      name: "complete",
      label: "Completar",
      icon: "CheckCheck",
      individual: "menu",
      bulk: false,
      isVisible: (record) => record?.estado === "aprobada",
      confirm: {
        title: "¿Marcar como completada?",
        content: "La orden se marcará como completada.",
      },
      mutation: {
        type: "updateMany",
        data: {
          estado: "completada",
          fecha_completada: new Date().toISOString(),
        },
      },
    },
    {
      name: "export",
      label: "Exportar",
      icon: "Download",
      individual: "none",
      bulk: true,
      action: async (ids) => {
        const response = await fetch("/api/ordenes/export", {
          method: "POST",
          body: JSON.stringify({ ids }),
          headers: { "Content-Type": "application/json" },
        });
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ordenes-${Date.now()}.xlsx`;
        a.click();
      },
    },
  ],
  
  rowActionsLayout: {
    position: "mixed",
    maxInline: 2,
  },
  
  rowClick: (id) => `/ordenes/${id}`,
  
  mobile: {
    primaryField: "numero_orden",
    metaFields: ["cliente_id", "fecha_creacion"],
    badge: {
      source: "estado",
      choices: [
        { id: "pendiente", name: "Pendiente" },
        { id: "aprobada", name: "Aprobada" },
        { id: "rechazada", name: "Rechazada" },
        { id: "completada", name: "Completada" },
      ],
    },
  },
};
```

### Ejemplo 3: Lista Simple sin Acciones

```typescript
export const categoriaListConfig: ListConfig = {
  resource: "categorias",
  
  filters: [
    {
      source: "q",
      type: "text",
      label: false,
      placeholder: "Buscar categorías...",
      alwaysOn: true,
    },
  ],
  
  columns: [
    { source: "id", label: "ID", sortable: true },
    { source: "nombre", label: "Nombre", sortable: true },
    { source: "descripcion", label: "Descripción", truncate: 50 },
    { source: "activo", label: "Activo", type: "boolean" },
  ],
  
  rowClick: (id) => `/categorias/${id}/edit`,
};
```

---

## API Reference Completa

### ListConfig Interface

```typescript
interface ListConfig {
  resource: string;
  title?: string;
  filters?: FilterConfig[];
  columns: ColumnConfig[];
  actions?: ActionConfig[];
  perPage?: number;
  defaultSort?: {
    field: string;
    order: "ASC" | "DESC";
  };
  rowClick?: string | ((id: any) => string);
  mobile?: MobileConfig;
  rowActionsLayout?: {
    position: "inline" | "menu" | "column" | "mixed";
    maxInline?: number;
  };
}
```

### FilterConfig Interface

```typescript
interface FilterConfig {
  source: string;
  type: "text" | "select" | "reference";
  label?: string | false;
  placeholder?: string;
  alwaysOn?: boolean;
  defaultValue?: any;
  choices?: readonly Choice[];
  reference?: string;
  referenceField?: string;
}
```

### ColumnConfig Interface

```typescript
interface ColumnConfig {
  source: string;
  label: string;
  type?: "text" | "date" | "choice" | "reference" | "boolean";
  sortable?: boolean;
  truncate?: number;
  render?: (record: any) => React.ReactNode;
  choices?: readonly Choice[];
  reference?: string;
  referenceField?: string;
  preload?: boolean;
}
```

### ActionConfig Interface

```typescript
interface ActionConfig {
  name: string;
  label: string;
  icon?: string;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost";
  individual: "inline" | "menu" | "column" | "none";
  bulk: boolean;
  action?: (ids: any[], record?: any) => void | Promise<void>;
  mutation?: {
    type: "updateMany" | "deleteMany" | "create";
    data?: any | ((dialogValues?: any, record?: any) => any);
  };
  dialog?: {
    title: string;
    fields: FieldConfig[];
  };
  confirm?: {
    title: string;
    content: string;
  };
  isVisible?: (record?: any) => boolean;
  isEnabled?: (record?: any) => boolean;
}
```

### MobileConfig Interface

```typescript
interface MobileConfig {
  primaryField: string;
  secondaryField?: string;
  metaFields?: string[];
  badge?: {
    source: string;
    choices: readonly Choice[];
  };
  thumbnail?: string;
}
```

---

## Mejores Prácticas

### 1. Organización de Configuración

✅ **Recomendado:**
```typescript
// types.ts - Constantes compartidas
export const estadoChoices = [...] as const;

// list.config.ts - Configuración de lista
export const miRecursoListConfig: ListConfig = {...};

// form.config.ts - Configuración de formulario
export const miRecursoFormConfig: FormConfig = {...};
```

### 2. Reutilización de Choices

✅ **Recomendado:**
```typescript
// Definir una vez en types.ts
export const tipoChoices = [...] as const;

// Usar en múltiples lugares
// list.config.ts
filters: [{ choices: tipoChoices }],
columns: [{ choices: tipoChoices }],

// form.config.ts
fields: [{ choices: tipoChoices }]
```

### 3. Acciones Condicionales

✅ **Recomendado:**
```typescript
{
  name: "approve",
  isVisible: (record) => record?.estado === "pendiente",
  isEnabled: (record) => record?.total > 0,
}
```

### 4. Type Safety

✅ **Recomendado:**
```typescript
// Definir tipo del registro
interface Producto {
  id: number;
  nombre: string;
  precio: number;
}

// Usar en render
render: (record: Producto) => `$${record.precio.toFixed(2)}`
```

---

## Troubleshooting

### Los filtros no funcionan

- ✅ Verificar que `source` coincida con el campo del backend
- ✅ Para select, verificar que `choices` tenga el formato correcto
- ✅ Para reference, verificar que el recurso exista

### Las columnas no muestran datos

- ✅ Verificar que `source` coincida con el campo en el response
- ✅ Para referencias, verificar `reference` y `referenceField`
- ✅ Revisar console para errores

### Las acciones no aparecen

- ✅ Verificar que `individual` o `bulk` estén configurados
- ✅ Revisar condiciones `isVisible`
- ✅ Verificar `rowActionsLayout`

### El ordenamiento no funciona

- ✅ Verificar que la columna tenga `sortable: true`
- ✅ Verificar que el backend soporte sorting en ese campo
- ✅ Revisar `defaultSort` si hay configuración inicial

---

## Migración desde Listas Imperativas

### Antes (Imperativo) - 273 líneas

```tsx
export const ProductoList = () => {
  const isMobile = useIsMobile();
  
  return (
    <List filters={filters} actions={<ListActions />}>
      {isMobile ? (
        <ProductoMobileCards />
      ) : (
        <DataTable bulkActionButtons={<BulkActions />}>
          <DataTable.Col source="id" label="ID" />
          <DataTable.Col source="nombre" label="Nombre">
            <TextField source="nombre" />
          </DataTable.Col>
          {/* ... más columnas ... */}
        </DataTable>
      )}
    </List>
  );
};

// + 200 líneas más de mobile cards, acciones, etc.
```

### Después (Declarativo) - 15 líneas

```typescript
// list.config.ts
export const productoListConfig: ListConfig = {
  resource: "productos",
  filters: [...],
  columns: [...],
  actions: [...],
  mobile: {...},
};

// List.tsx
export const ProductoList = () => {
  return <GenericList config={productoListConfig} />;
};
```

**Reducción: 273 → 15 líneas (-95%)**

---

## Roadmap y Extensión

### Próximas Características

- [ ] Filtros avanzados (date range, number range)
- [ ] Columnas agrupadas
- [ ] Exportación automática a CSV/Excel
- [ ] Drag & drop para reordenar
- [ ] Columnas personalizables por usuario
- [ ] Templates para acciones comunes

### Extender el Sistema

1. **Agregar un nuevo tipo de filtro:**
   - Actualizar `FilterConfig` en types.ts
   - Implementar en `useFilterBuilder`

2. **Agregar un nuevo tipo de columna:**
   - Actualizar `ColumnConfig` en types.ts
   - Implementar en `useColumnRenderer`

3. **Crear templates de acciones:**
   ```typescript
   export const commonActions = {
     edit: (resource: string): ActionConfig => ({
       name: "edit",
       label: "Editar",
       icon: "Edit",
       individual: "inline",
       bulk: false,
       action: (ids, record) => {
         window.location.href = `/${resource}/${record.id}/edit`;
       },
     }),
   };
   ```

---

## Changelog

- **v1.0** - Implementación inicial
- **v1.1** - Agregado sistema de acciones unificado
- **v1.2** - Soporte para mobile layout
- **v1.3** - Agregado row click configurable
