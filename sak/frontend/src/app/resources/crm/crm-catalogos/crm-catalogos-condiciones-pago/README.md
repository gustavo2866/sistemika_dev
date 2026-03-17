# Patron del resource `crm-catalogos-condiciones-pago`

Este recurso documenta como debe armarse un CRUD simple de catalogo siguiendo el
patron actual del proyecto.

El objetivo de este archivo es doble:

- entender rapidamente como esta organizado el codigo del resource;
- servir como referencia para aplicar el mismo patron en otros resources.

## Objetivo del patron

Separar claramente tres capas:

1. `shadcn admin kit` y wrappers base del proyecto:
   - viven en `frontend/src/components/*`;
   - no deben moverse ni modificarse como parte de este patron;
   - ejemplos usados aca: `List`, `Create`, `Edit`, `Show`, `SimpleForm`,
     `CreateButton`, `ExportButton`, `FilterButton`, `TextField`.
2. `shadcn/ui`:
   - viven en `frontend/src/components/ui/*`;
   - tampoco deben moverse ni modificarse;
   - ejemplos usados aca: `Badge`, `Card`.
3. componentes custom reutilizables del sistema:
   - deben vivir en `frontend/src/components/forms/form_order`;
   - ejemplos usados aca: `FormText`, `FormTextarea`, `FormBoolean`,
     `SectionBaseTemplate`, `ResponsiveDataTable`, `ListPaginator`,
     `FormOrderToolbar`, `FormOrderListRowActions`,
     `FormOrderCancelButton`, `FormOrderEditButton`.

Regla operativa:

- si un componente reusable custom no pertenece al kit base ni a `ui/*`, debe
  terminar en `form_order`;
- en esta etapa, si aparece uno reusable fuera de `form_order`, conviene
  copiarlo a `form_order` antes que moverlo para no afectar otros resources.

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

- `crmCondicionPagoSchema` define el contrato del formulario;
- `CRM_CONDICION_PAGO_DEFAULTS` centraliza defaults;
- `normalizeCondicionPagoPayload()` limpia strings y normaliza `activo`;
- `getCondicionPagoEstadoLabel()` y `getCondicionPagoBadgeClass()` encapsulan
  reglas visuales simples del estado.

`model.ts` no debe usar hooks, `dataProvider` ni JSX.

### `form.tsx`

Debe contener composicion de UI del formulario, usando:

- `SimpleForm` del kit base;
- `zodResolver(...)` para conectar el schema del `model`;
- componentes reutilizables de `form_order` para los campos y secciones.

En este resource:

- `CRMCondicionPagoForm` es el formulario principal;
- `SimpleForm` recibe `defaultValues={CRM_CONDICION_PAGO_DEFAULTS}`;
- `resolver={zodResolver(crmCondicionPagoSchema)}` conecta el schema;
- `toolbar={<FormOrderToolbar />}` reutiliza acciones estandar;
- `SectionBaseTemplate` arma la seccion principal;
- `CondicionPagoMainFields` y `CondicionPagoOptionalFields` son helpers locales
  del resource, no compartidos.

Regla:

- si un helper de `form.tsx` empieza a repetirse en otros resources, deja de ser
  local y debe copiarse a `form_order`.

### `List.tsx`

Debe construir el listado combinando:

- wrapper `List` del kit base;
- filtros desde `buildListFilters(...)`;
- grilla desde `ResponsiveDataTable`;
- acciones reusables desde `form_order` cuando existan.

En este resource:

- `filters` se define con `buildListFilters(...)`;
- `ListActions` es local al resource y compone botones del kit base;
- `FormOrderListRowActions` resuelve las acciones por fila;
- `ListPaginator` estandariza la paginacion;
- `TextListColumn`, `BooleanListColumn` y `ListText` evitan repetir markup.

### `create.tsx`

Debe ser un wrapper fino sobre `Create`:

- define `title`;
- define `redirect`;
- aplica `transform` si el payload necesita normalizacion;
- renderiza el `Form` compartido.

En este resource:

- usa `normalizeCondicionPagoPayload` antes de enviar datos;
- compone un titulo con `Badge`, que es valido porque viene de `ui/*`.

### `edit.tsx`

Debe ser un wrapper fino sobre `Edit`:

- reutiliza el mismo formulario;
- puede definir acciones de cabecera;
- puede usar `transform`.

En este resource:

- usa `FormOrderDeleteButton` como accion principal;
- reutiliza `normalizeCondicionPagoPayload`;
- arma el titulo desde `useEditContext`.

### `show.tsx`

Debe contener la vista solo lectura:

- wrapper `Show` del kit base;
- acciones reusables desde `form_order` cuando existan;
- primitives `ui/*` si hacen falta para layout visual.

En este resource:

- `Show` arma el contexto;
- `FormOrderEditButton` y `FormOrderCancelButton` resuelven acciones;
- `Badge` y `Card` vienen de `ui/*`, por lo tanto son validos;
- `LabelValue` es un helper local del resource.

Regla:

- si aparece el mismo patron `LabelValue` en varios resources, debe copiarse a
  `form_order` y dejar de definirse localmente.

## Flujo de datos del resource

1. `create.tsx` y `edit.tsx` renderizan `CRMCondicionPagoForm`.
2. `CRMCondicionPagoForm` toma defaults desde `model.ts`.
3. El schema `zod` valida el payload en el frontend.
4. `normalizeCondicionPagoPayload()` adapta los datos antes de persistir.
5. `show.tsx` y `List.tsx` consumen los mismos helpers de estado definidos en
   `model.ts`.

Esto evita duplicar reglas entre vistas.

## Que se considera valido dentro del patron

### Valido

- usar wrappers base desde `@/components/*`;
- usar primitives desde `@/components/ui/*`;
- usar componentes custom reusables desde `@/components/forms/form_order`;
- usar helpers locales dentro del resource mientras no sean compartidos.

### No valido

- crear componentes reusable custom en otra carpeta si no pertenecen al kit base
  ni a `ui/*`;
- duplicar logica de validacion o defaults fuera de `model.ts`;
- mezclar hooks o acceso a datos dentro de `model.ts`.

## Checklist para replicar este patron en otro resource

1. Crear `model.ts` con:
   - tipos del dominio;
   - schema `zod`;
   - defaults;
   - helpers puros;
   - normalizador del payload si aplica.
2. Crear `form.tsx` con:
   - `SimpleForm`;
   - `zodResolver(schema)`;
   - toolbar reusable;
   - secciones y campos desde `form_order`.
3. Crear `List.tsx` con:
   - `List`;
   - `buildListFilters(...)`;
   - `ResponsiveDataTable`;
   - paginator y acciones por fila reusables.
4. Crear `create.tsx` y `edit.tsx` como wrappers finos del formulario.
5. Crear `show.tsx` solo si el recurso necesita detalle.
6. Exportar todo desde `index.ts`.
7. Si detectas un helper reusable custom fuera de `form_order`, copiarlo a
   `form_order` antes de usarlo en mas resources.

## Referencias utiles

- `frontend/src/components/forms/form_order/`
- `frontend/src/components/`
- `doc/patrones/crud_frontend.md`
- `frontend/src/app/resources/po/po-orders/README.md`
