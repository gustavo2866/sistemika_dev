# Patron CRUD frontend (ejemplo: solicitudes)

Este patron describe el CRUD generico del frontend usando `Solicitudes` como ejemplo.

## Archivos base
- frontend/src/lib/dataProvider.ts
- frontend/src/app/admin/AdminApp.tsx
- frontend/src/app/resources/solicitudes/List.tsx
- frontend/src/app/resources/solicitudes/form.tsx
- frontend/src/app/resources/solicitudes/create.tsx
- frontend/src/app/resources/solicitudes/edit.tsx

## Data provider
`frontend/src/lib/dataProvider.ts` usa `ra-data-simple-rest` con:
- `apiUrl` desde `NEXT_PUBLIC_API_URL`.
- Header `Authorization: Bearer <token>` si existe `auth_token`.
- Metodos CRUD standard (`getList`, `getOne`, `create`, `update`, `delete`).

Esto espera que el backend exponga:
- `Content-Range` para `getList`.
- Endpoints REST basicos por recurso.

## Registro del recurso
`frontend/src/app/admin/AdminApp.tsx` registra el recurso:
```tsx
<Resource
  name="solicitudes"
  list={SolicitudList}
  create={SolicitudCreate}
  edit={SolicitudEdit}
  recordRepresentation="id"
  options={{ label: "Solicitudes" }}
/>
```

El `name` debe coincidir con el prefix del backend (ej: `/solicitudes`).

## Listado y filtros
`frontend/src/app/resources/solicitudes/List.tsx`:
- Usa `List` y `DataTable`.
- Envia filtros como `q`, `estado`, `tipo_solicitud_id`, etc.
- `ReferenceInput` y `ReferenceField` consultan recursos relacionados.

## Formulario compartido
`frontend/src/app/resources/solicitudes/form.tsx` se usa en create y edit:
- `SimpleForm` con `defaultValues`.
- `FormDetailSection` maneja `detalles` (one-to-many).
- Calcula `total` a partir de `detalles`.

El payload incluye `detalles` y el backend lo sincroniza via `NestedCRUD`.

## Logica de dominio en model.ts
La logica de dominio vive en `frontend/src/app/resources/solicitudes/model.ts`:
- Tipos y schemas (por ejemplo, `Solicitud`, `SolicitudDetalle`).
- Constantes de negocio (ej: `ESTADO_CHOICES`, `UNIDAD_MEDIDA_CHOICES`).
- Reglas de validacion y defaults (ej: `VALIDATION_RULES`, `solicitudCabeceraSchema`).
- Helpers de negocio (ej: `getArticuloFilterByTipo`, `getDepartamentoDefaultByTipo`).

Regla: mantener validaciones, defaults y reglas de negocio en `model.ts`, y dejar
los componentes (`form.tsx`, `List.tsx`) enfocados en UI y wiring.

## Create / Edit
- `create.tsx` usa `<Create>` con `redirect="list"`.
- `edit.tsx` usa `<Edit>` y reutiliza el mismo form.
