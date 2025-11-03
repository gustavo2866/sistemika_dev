# Botones y Filtros en GenericList

## Resumen

**GenericList YA incluye automáticamente** todos los elementos estándar de shadcn-admin-kit:
- ✅ Botón "Crear"
- ✅ Botón "Exportar"
- ✅ Filtros
- ✅ Breadcrumb
- ✅ Paginación
- ✅ Título

Estos se renderizan automáticamente porque GenericList usa el componente `List` de shadcn-admin-kit.

## Estructura Visual

```
┌─────────────────────────────────────────────────────┐
│ Home > Solicitudes de Compra              Breadcrumb│
├─────────────────────────────────────────────────────┤
│                                                      │
│ Solicitudes de Compra            [+ Crear] [Export] │  ← Título + Botones
│                                                      │
├─────────────────────────────────────────────────────┤
│ [Buscar solicitudes...    ] [Tipo ▼]        [⚙]    │  ← Filtros
├─────────────────────────────────────────────────────┤
│                                                      │
│ ID │ Tipo          │ Fecha Necesidad │ Acciones    │  ← Tabla/Cards
│ 20 │ Compra Directa│ 30/10/2025      │ [•••]       │
│ 19 │ Licitación    │ 28/10/2025      │ [•••]       │
│                                                      │
├─────────────────────────────────────────────────────┤
│                 [◀] 1 of 5 [▶]                      │  ← Paginación
└─────────────────────────────────────────────────────┘
```

## Componentes Incluidos Automáticamente

### 1. Botón Crear
**Ubicación:** Top-right, junto al botón Export  
**Condición:** Solo se muestra si el recurso tiene `hasCreate: true` en el resource definition  
**Componente:** `<CreateButton />` de shadcn-admin-kit  
**Ruta:** Navega a `/{resource}/create`

```typescript
// En AdminApp.tsx, verifica que el recurso tenga create:
<Resource
  name="solicitudes"
  list={SolicitudList}
  create={SolicitudCreate}  // ✅ Esto habilita el botón
  edit={SolicitudEdit}
/>
```

### 2. Botón Exportar
**Ubicación:** Top-right, después del botón Crear  
**Condición:** Siempre visible  
**Componente:** `<ExportButton />` de shadcn-admin-kit  
**Acción:** Exporta los registros actuales a CSV

### 3. Filtros
**Ubicación:** Debajo del título  
**Condición:** Se muestran si hay filtros en `config.filters`  
**Componente:** `<FilterForm />` de shadcn-admin-kit  
**Tipos soportados:**
- `text`: Input de texto libre
- `select`: Dropdown con opciones

```typescript
// En list.config.ts
filters: [
  {
    source: "q",
    type: "text",
    label: false,
    placeholder: "Buscar solicitudes",
    alwaysOn: true,  // Siempre visible (no colapsado)
  },
  {
    source: "tipo",
    type: "select",
    label: "Tipo",
    choices: solicitudTipoChoices,
    alwaysOn: false,  // Colapsado por defecto, visible al abrir filtros
  },
],
```

### 4. Breadcrumb
**Ubicación:** Top  
**Condición:** Siempre visible  
**Componente:** `<Breadcrumb />` de shadcn-admin-kit  
**Contenido:** `Home > {Resource Label}`

### 5. Título
**Ubicación:** Top-left  
**Condición:** Siempre visible  
**Fuente:** `config.title` o resource label por defecto

### 6. Paginación
**Ubicación:** Bottom  
**Condición:** Siempre visible  
**Componente:** `<ListPagination />` de shadcn-admin-kit  
**Control:** `config.perPage` define registros por página

## Cómo Funciona

### Flujo de Renderizado

```typescript
GenericList
  └─> List (shadcn-admin-kit)
       ├─> Breadcrumb          ✅ Incluido
       ├─> Title + Actions     ✅ Incluido
       │   ├─> CreateButton    ✅ Incluido
       │   └─> ExportButton    ✅ Incluido
       ├─> FilterForm          ✅ Incluido
       ├─> DataTable           ✅ Pasado como children
       └─> ListPagination      ✅ Incluido
```

### Código Real

```typescript
// GenericList.tsx (línea 39-43)
return (
  <List
    filters={filters}  // ✅ FilterForm los usa automáticamente
    perPage={config.perPage || 25}
    sort={config.defaultSort || { field: "id", order: "DESC" }}
  >
    <DataTable>
      {/* Columnas */}
    </DataTable>
  </List>
);
```

```typescript
// list.tsx (componente List de shadcn-admin-kit)
export const ListView = (props) => {
  const { hasCreate } = useResourceDefinition();
  
  return (
    <>
      <Breadcrumb>...</Breadcrumb>
      
      <div className="flex justify-between">
        <h2>{title}</h2>
        <div className="flex gap-2">
          {hasCreate ? <CreateButton /> : null}  // ✅ Auto
          <ExportButton />                       // ✅ Auto
        </div>
      </div>
      
      <FilterForm />  // ✅ Auto - usa los filters del contexto
      
      {children}  // ← DataTable se renderiza aquí
      
      {pagination}  // ✅ Auto
    </>
  );
};
```

## Configuración Completa de Ejemplo

```typescript
// list.config.ts
export const solicitudListConfig: ListConfig = {
  resource: "solicitudes",
  title: "Solicitudes de Compra",  // ✅ Título
  
  perPage: 25,  // ✅ Paginación
  defaultSort: { field: "id", order: "DESC" },
  
  // ✅ Filtros (renderizados por FilterForm)
  filters: [
    {
      source: "q",
      type: "text",
      placeholder: "Buscar solicitudes",
      alwaysOn: true,
    },
    {
      source: "tipo",
      type: "select",
      label: "Tipo",
      choices: solicitudTipoChoices,
    },
  ],
  
  // Columnas y acciones...
  columns: [...],
  actions: [...],
  
  // ✅ Mobile
  mobile: {
    primaryField: "tipo",
    secondaryFields: ["fecha_necesidad"],
  },
  
  // ✅ Click en fila
  rowClick: (id) => `/solicitudes/${id}/edit-mb`,
};
```

## Verificación de Elementos

Si no ves algún elemento, verifica:

### Botón Crear no aparece
```typescript
// AdminApp.tsx
<Resource
  name="solicitudes"
  list={SolicitudList}
  create={SolicitudCreate}  // ⚠️ Debe estar definido
  edit={SolicitudEdit}
/>
```

### Filtros no aparecen
```typescript
// list.config.ts
filters: [  // ⚠️ Debe tener al menos un filtro
  {
    source: "q",
    type: "text",
    alwaysOn: true,
  }
],
```

### Paginación no funciona
```typescript
// list.config.ts
perPage: 25,  // ⚠️ Debe estar definido
```

## Personalización de Botones

Si necesitas botones personalizados, puedes usar el prop `actions`:

```typescript
// En List.tsx (wrapper)
import { GenericList } from "@/components/list/GenericList";
import { solicitudListConfig } from "./list.config";
import { Button } from "@/components/ui/button";
import { CreateButton } from "@/components/create-button";

export const SolicitudList = () => {
  return (
    <List
      filters={useFilterBuilder(solicitudListConfig.filters)}
      perPage={solicitudListConfig.perPage}
      sort={solicitudListConfig.defaultSort}
      actions={
        <div className="flex gap-2">
          <CreateButton />
          <Button variant="outline">Custom Action</Button>
        </div>
      }
    >
      <DataTable>
        {/* ... */}
      </DataTable>
    </List>
  );
};
```

## Tipos de Filtros Disponibles

### Text Input
```typescript
{
  source: "q",
  type: "text",
  label: "Búsqueda",
  placeholder: "Buscar...",
  alwaysOn: true,
}
```

### Select Input
```typescript
{
  source: "tipo",
  type: "select",
  label: "Tipo",
  choices: [
    { id: "directa", name: "Compra Directa" },
    { id: "licitacion", name: "Licitación" }
  ],
}
```

### Custom Filter (TODO)
```typescript
{
  source: "fecha",
  render: ({ key }) => (
    <DateRangeInput key={key} source="fecha" />
  )
}
```

## Conclusión

✅ **GenericList ya incluye TODO** lo que necesitas del estándar shadcn-admin-kit  
✅ **No necesitas agregar nada** - todo funciona declarativamente  
✅ **Solo configura** `list.config.ts` y todo se renderiza automáticamente  
✅ **Personalización opcional** usando el prop `actions` si necesitas botones custom  

**Si algún elemento no aparece, verifica:**
1. Que el recurso tenga `create={...}` en AdminApp.tsx (para botón Crear)
2. Que `filters` tenga al menos un elemento en list.config.ts (para filtros)
3. Que `perPage` esté definido en list.config.ts (para paginación)
