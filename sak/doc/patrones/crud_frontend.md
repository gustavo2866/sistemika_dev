# Patron CRUD frontend (generico y reutilizable)

Este patron describe el CRUD generico del frontend sin depender de un recurso concreto.

## Archivos base (referencia general)
- Config del data provider (frontend/src/lib/dataProvider.ts)
- Registro del recurso (frontend/src/app/admin/AdminApp.tsx)
- Archivos del recurso (List.tsx, form.tsx, create.tsx, edit.tsx, model.ts)

## Ejemplos de referencia
Los ejemplos viven en `doc/patrones/ejemplos/crud_frontend/` y muestran:
- `list.example.tsx`: listado con datatable responsive (cards en mobile).
- `form.example.tsx`: formulario con wrappers compactos y secciones.
- `model.example.ts`: estructura base de tipos/constantes/helpers.

## Data provider
`frontend/src/lib/dataProvider.ts` usa `ra-data-simple-rest` con:
- `apiUrl` desde `NEXT_PUBLIC_API_URL`.
- Header `Authorization: Bearer <token>` si existe `auth_token`.
- Metodos CRUD standard (`getList`, `getOne`, `create`, `update`, `delete`).

Esto espera que el backend exponga:
- `Content-Range` para `getList`.
- Endpoints REST basicos por recurso.

## Registro del recurso
En `frontend/src/app/admin/AdminApp.tsx` se registra el recurso:
```tsx
<Resource
  name="<resource>"
  list={ResourceList}
  create={ResourceCreate}
  edit={ResourceEdit}
  recordRepresentation="id"
  options={{ label: "<Etiqueta>" }}
/>
```

El `name` debe coincidir con el prefix del backend (ej: `/resource`).

## Listado y filtros
- Usa `List` con datatable responsive (cards en mobile).
- Envia filtros como `q`, `estado`, y campos del dominio.
- `ReferenceInput` y `ReferenceField` consultan recursos relacionados.
- Acciones por fila via menu contextual y botones compactos.

## Formulario compartido
El `form.tsx` del recurso se usa en create y edit:
- `SimpleForm` con `defaultValues`.
- Layout por secciones cuando aplica (cabecera, imputacion, detalle).
- Usa wrappers compactos para inputs y grids.
- `FormDetailSection` maneja `detalles` (one-to-many) si aplica.
- Cards compactas para el detalle si hay listas de items.
- Calcula totales a partir de `detalles` si aplica.

El payload incluye `detalles` y el backend lo sincroniza via `NestedCRUD`.

## Logica de dominio en model.ts
La logica de dominio vive en `model.ts` del recurso:
- Tipos y schemas.
- Constantes de negocio.
- Reglas de validacion y defaults.
- Helpers de negocio.

Regla: mantener validaciones, defaults y reglas de negocio en `model.ts`, y dejar
los componentes (`form.tsx`, `List.tsx`) enfocados en UI y wiring.

## Create / Edit
- `create.tsx` usa `<Create>` con `redirect="list"`.
- `edit.tsx` usa `<Edit>` y reutiliza el mismo form.
