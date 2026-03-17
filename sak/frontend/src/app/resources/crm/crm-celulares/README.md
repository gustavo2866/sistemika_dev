# Patron del resource `crm-celulares`

Este recurso documenta como debe armarse el CRUD de `crm-celulares`
siguiendo el mismo patron aplicado en `crm-catalogos-condiciones-pago`.

El objetivo de este archivo es doble:

- entender rapidamente como esta organizado el codigo del resource;
- servir como referencia para mantener el mismo patron en otros resources CRM.

## Objetivo del patron

Separar claramente tres capas:

1. `shadcn admin kit` y wrappers base del proyecto:
   - viven en `frontend/src/components/*`;
   - no deben moverse ni modificarse como parte de este patron;
   - ejemplos usados aca: `List`, `Create`, `Edit`, `Show`, `SimpleForm`,
     `CreateButton`, `ExportButton`, `FilterButton`.
2. `shadcn/ui`:
   - viven en `frontend/src/components/ui/*`;
   - tampoco deben moverse ni modificarse;
   - ejemplos usados aca: `Badge`, `Card`.
3. componentes custom reutilizables del sistema:
   - deben vivir en `frontend/src/components/forms/form_order`;
   - ejemplos usados aca: `FormText`, `FormBoolean`, `SectionBaseTemplate`,
     `ResponsiveDataTable`, `ListPaginator`, `FormOrderToolbar`,
     `FormOrderListRowActions`, `FormOrderCancelButton`,
     `FormOrderEditButton`, `FormOrderDeleteButton`.

## Estructura del resource

Este resource usa la estructura CRUD corta del proyecto:

- `List.tsx`: listado, filtros y tabla responsive.
- `form.tsx`: formulario reutilizado por create y edit.
- `create.tsx`: wrapper de alta.
- `edit.tsx`: wrapper de edicion.
- `show.tsx`: detalle solo lectura.
- `model.ts`: dominio puro, schema, defaults y helpers.
- `index.ts`: exports del modulo.

## Responsabilidad de cada archivo

### `model.ts`

Debe contener solo dominio puro:

- tipos;
- schema `zod`;
- reglas de validacion;
- defaults;
- helpers puros;
- normalizacion del payload.

En este resource:

- `crmCelularSchema` define el contrato del formulario;
- `CRM_CELULAR_DEFAULTS` centraliza defaults;
- `normalizeCelularPayload()` limpia strings y normaliza `activo`;
- `getCelularEstadoLabel()` y `getCelularBadgeClass()` encapsulan el estado.

### `form.tsx`

Debe contener composicion de UI del formulario usando:

- `SimpleForm` del kit base;
- `zodResolver(...)` para conectar el schema del `model`;
- componentes reutilizables de `form_order` para campos y secciones.

En este resource:

- `CRMCelularForm` es el formulario principal;
- `SectionBaseTemplate` organiza el bloque editable;
- `CamposPrincipalesCelular` y `AyudaCelularCRM` son helpers locales.

### `List.tsx`

Debe construir el listado combinando:

- wrapper `List` del kit base;
- filtros desde `buildListFilters(...)`;
- grilla desde `ResponsiveDataTable`;
- acciones reusables desde `form_order`.

En este resource:

- `listFilters` define los filtros persistidos;
- `CRMCelularListActions` compone filtros, alta y exportacion;
- `FormOrderListRowActions` resuelve acciones por fila;
- `ListPaginator` estandariza la paginacion.

### `create.tsx`

Debe ser un wrapper fino sobre `Create`:

- define `title`;
- define `redirect`;
- aplica `transform` si el payload necesita normalizacion;
- soporta `embedded` cuando el resource se reutiliza dentro de otros layouts.

### `edit.tsx`

Debe ser un wrapper fino sobre `Edit`:

- reutiliza el mismo formulario;
- puede definir acciones de cabecera;
- usa `transform`;
- soporta `embedded`, `id` y `redirect`.

### `show.tsx`

Debe contener la vista solo lectura:

- wrapper `Show` del kit base;
- acciones reusables desde `form_order`;
- primitives `ui/*` si hacen falta para layout visual.

En este resource:

- `CRMCelularShowTitle` arma el encabezado contextual;
- `CRMCelularShowContent` muestra el detalle en cards;
- `DatoSoloLectura` y `TextoConFallback` son helpers locales.

## Flujo de datos del resource

1. `create.tsx` y `edit.tsx` renderizan `CRMCelularForm`.
2. `CRMCelularForm` toma defaults desde `model.ts`.
3. El schema `zod` valida el payload en frontend.
4. `normalizeCelularPayload()` adapta los datos antes de persistir.
5. `show.tsx` y `List.tsx` consumen los mismos helpers de estado definidos en
   `model.ts`.

## Checklist para mantener el patron

1. Mantener la validacion y normalizacion dentro de `model.ts`.
2. Evitar helpers reutilizables fuera de `form_order`.
3. Reutilizar `form.tsx` desde `create.tsx` y `edit.tsx`.
4. Mantener `List.tsx` con `buildListFilters + ResponsiveDataTable + ListPaginator`.
5. Documentar cualquier helper nuevo compartido moviendolo a `form_order`.
