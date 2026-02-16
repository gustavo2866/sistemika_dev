# Patron CRUD (PoOrders)

Este recurso es la referencia base para formularios con **cabecera + detalle**.
El objetivo es separar **dominio**, **logica de UI** y **composicion**, y
reutilizar piezas en `form_order` para aplicar el mismo esquema a otras entidades.

## Archivos y responsabilidades
- `List.tsx`: listado con `ResponsiveDataTable`, filtros compactos y acciones por fila.
- `form.tsx`: **composicion** del formulario (cabecera, detalle, totales).
- `form_hooks.ts`: **logica de UI** y side-effects (defaults, guards, acciones).
- `model.ts`: **dominio puro** (schema zod, defaults, helpers, normalizadores).
- `form_generar.tsx` / `form_confirmar.tsx`: acciones especificas de Orden.
- `create.tsx` / `edit.tsx` / `show.tsx`: wrappers CRUD.

## Reglas de responsabilidad
- `model.ts`: sin hooks, sin dataProvider, sin UI.
- `form_hooks.ts`: puede usar hooks/dataProvider, pero no renderiza JSX.
- `form.tsx`: solo layout y composicion; usa hooks y componentes reutilizables.
- `form_order`: componentes reutilizables (botones, wrappers, templates, helpers).

## Patron de formulario (cabecera + detalle)
### Formulario principal
- `PoOrderForm`: `SimpleForm` + `zodResolver(poOrderSchema)`.
- Defaults via `usePoOrderFormDefaults` (hook).
- Toolbar compacta con `FormOrderCancelButton` / `FormOrderSaveButton`.

### Cabecera (SectionBaseTemplate)
- `CabeceraOrdenCompra` usa `SectionBaseTemplate`.
- Acciones de menu con `FormOrderHeaderMenuActions` (reutilizable).
- `useAccionesCabeceraOrden` devuelve flags/handlers (sin JSX).

### Detalle (SectionDetailTemplate2)
- `DetalleOrdenCompra` define `mainColumns` con `width`.
- `mainColumns` ahora soporta `mobileSpan` para ajustar el layout en mobile (por orden).
- `SectionDetailTemplate2` **arma la grilla** y la aplica a cabecera y filas.
- `DetailFieldCell` estandariza etiqueta mobile y layout base por campo.
- Defaults del detalle vienen de `getPoOrderDetalleDefaults()` en `model.ts`.

#### Layout mobile (cards)
- En mobile, las filas usan grid auto-fit con columnas mÃ­nimas compactas.
- El orden de los campos define el orden de columnas en mobile (campo 1 -> columna 1).
- `mobileSpan: "full"` hace que un campo ocupe toda la fila en mobile.

Ejemplo:
```ts
const columns: SectionDetailColumn[] = [
  { label: "Articulo", width: "220px", mobileSpan: "full" },
  { label: "Descripcion", width: "150px", mobileSpan: "full" },
  { label: "Cantidad", width: "64px", mobileSpan: 1 },
  { label: "Precio", width: "84px", mobileSpan: 1 },
  { label: "Importe", width: "84px", mobileSpan: 1 },
];
```

Notas:
- Aplica el mismo criterio en otros recursos (ej: `po-invoices/form.tsx`) para mantener cards compactas.

## Componentes reutilizables clave (form_order)
- `SectionBaseTemplate`: seccion con cabecera y menu de acciones.
- `SectionDetailTemplate2`: grid unificado cabecera/filas + acciones internas.
- `DetailFieldCell`: celda de campo del detalle (labels mobile + layout).
- `FormOrderHeaderMenuActions`: items de menu Preview/Eliminar reutilizables.
- `useIdentityFilterDefaults` + `IdentityFilterSync`: defaults y sync de filtro por identidad en listados.
- Wrappers de campos: `FormText`, `FormNumber`, `FormSelect`, etc.

## Pasos para aplicar el patron a otra entidad
1. Copiar estructura base (`List.tsx`, `form.tsx`, `form_hooks.ts`, `model.ts`).
2. En `model.ts`:
   - Definir schema zod y defaults.
   - Agregar helpers puros (ej: `isLocked`, `computeTotal`).
3. En `form_hooks.ts`:
   - Defaults iniciales y logica de negocio/UI con dataProvider.
   - Hooks deben devolver datos/handlers, no JSX.
4. En `form.tsx`:
   - Componer secciones con `SectionBaseTemplate` y `SectionDetailTemplate2`.
   - Definir `mainColumns` (ancho/orden) y usar `DetailFieldCell`.
5. Reusar piezas de `form_order` antes de crear componentes nuevos.

## Referencias
- `frontend/src/components/forms/form_order/`
- `doc/patrones/crud_frontend.md`
