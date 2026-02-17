# Patron CRUD (PoInvoiceStatusFin)

Este recurso aplica el patron CRUD estandar usado en `po-orders`, adaptado a un
CRUD simple (sin Detalle) para **estados financieros de factura OC**. La idea
es reutilizar estas piezas en otras entidades.

## Archivos y responsabilidades
- `List.tsx`: listado con `ResponsiveDataTable`, filtros compactos y acciones.
- `form.tsx`: formulario con `SectionBaseTemplate` + `FormOrderToolbar`.
- `create.tsx`: `Create` con `redirect="list"`.
- `edit.tsx`: `Edit` con acciones compactas (`FormOrderDeleteButton`).
- `model.ts`: schema `zod`, defaults y reglas de validacion.

## Piezas del patron (componentes reutilizables)
- **Listado**
  - `buildListFilters` para filtros compactos.
  - `ResponsiveDataTable` + wrappers de columnas:
    - `TextListColumn` (default 120px, wrap)
    - `NumberListColumn` (default 90px)
    - `DateListColumn` (default 90px)
    - `BooleanListColumn` (renderiza Si/No)
  - Acciones por fila: `FormOrderListRowActions` (menu editar/eliminar).
- **Formulario**
  - `SimpleForm` + `zodResolver(schema)`
  - `SectionBaseTemplate` para layout de secciones.
  - `FormOrderToolbar` para botones compactos (cancelar/guardar).
  - `FormBoolean` para switches compactos, alineados al resto.

## Pasos para aplicar el patron a otra entidad
1. Copiar estructura de carpeta:
   - `List.tsx`, `form.tsx`, `create.tsx`, `edit.tsx`, `model.ts`.
2. En `model.ts`:
   - Definir `VALIDATION_RULES`.
   - Crear `schema` con `zod` y exportar `FormValues`.
   - Definir defaults (ej: `DEFAULTS`).
3. En `form.tsx`:
   - `SimpleForm` con `resolver={zodResolver(schema)}`
   - `toolbar={<FormOrderToolbar />}`
   - Usar wrappers `FormText`, `FormNumber`, `FormTextarea`, `FormBoolean`.
4. En `List.tsx`:
   - Definir filtros con `buildListFilters`.
   - Usar `ResponsiveDataTable`.
   - Usar wrappers de columnas segun tipo (texto/numero/fecha/booleano).
   - Acciones: `FormOrderListRowActions`.
5. En `edit.tsx`:
   - Setear `actions` con `FormOrderDeleteButton` (compacto).
   - Ajustar `className` si el form tiene `max-w-*` distinto.
6. Registrar el recurso en `AdminApp.tsx`:
   - `list`, `create`, `edit` y `recordRepresentation`.

## Convenciones aplicadas
- **Texto**: wrap por defecto (evita solapamientos).
- **Booleanos**: mostrar `Si/No` en listados y mobile.
- **Mobile**:
  - `primaryField` = nombre.
  - `secondaryFields` = valores secundarios (incluye descripcion).

## Referencias
- `frontend/src/app/resources/po/po-orders/`
- `doc/patrones/crud_frontend.md`
