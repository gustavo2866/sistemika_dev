# PoSolicitudes (PO Solicitudes)

Resumen funcional y puntos de integracion del recurso `po-solicitudes`.

## 1. Entradas principales

- Listado: `frontend/src/app/resources/po/po-solicitudes/List.tsx`
- Crear: `frontend/src/app/resources/po/po-solicitudes/create.tsx`
- Editar: `frontend/src/app/resources/po/po-solicitudes/edit.tsx`
- Ver: `frontend/src/app/resources/po/po-solicitudes/show.tsx`

## 2. Listado y filtros

El listado usa `List` (`@/components/list`) con filtros compactos declarados via
`buildListFilters`. Los filtros alwaysOn son `q` y `estado`, y el filtro
`solicitante_id` se muestra siempre.

Defaults actuales del listado:
- `estado: "borrador"`
- `solicitante_id: identity.id` (si hay identidad cargada)

### Sincronizacion con oportunidad

`PoSolicitudesFilterSync` aplica/limpia `oportunidad_id` segun la URL o estado
de navegacion. Esto permite:
- abrir la lista desde CRM con `oportunidad_id` y mantener el contexto,
- limpiar el filtro cuando no hay oportunidad en la navegacion actual.

El encabezado contextual de CRM vive en:
- `frontend/src/app/resources/po/po-solicitudes/list_header_crm.tsx`

## 3. Navegacion y contexto (returnTo)

La lista y los formularios usan `returnTo` para volver al origen:
- Se lee con `getReturnToFromLocation` desde `@/lib/oportunidad-context`.
- Se pasa en la URL como query param (`returnTo=...`).

El filtro de oportunidad se transmite en la URL usando `filter` (JSON) con
`appendFilterParam` + `buildOportunidadFilter` en `@/lib/oportunidad-context`.

## 4. Crear / Editar / Wizard

- `create.tsx` y `edit.tsx` usan `buildPoSolicitudPayload` para normalizar
  los datos antes de persistir.
- `create.tsx` abre el wizard cuando `wizard=asistida` en la URL.
- Al guardar, se navega a `returnTo` si existe; caso contrario vuelve a
  `/po-solicitudes`.

## 5. Formulario y detalle

La documentacion detallada del formulario esta en:
- `frontend/src/app/resources/po/po-solicitudes/form_readme.md`

Archivos clave del form:
- `form.tsx`: orquestacion + secciones
- `form_detalle.tsx`: UI de detalle
- `form_hooks.ts`: hooks y logica reusable
- `model.ts`: reglas, schemas y helpers de payload

