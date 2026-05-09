# PO Dashboard

Dashboard operativo de ordenes de compra basado en el patron aplicado en
`propiedades-dashboard`.

El recurso separa estado, view-models y render para que el flujo de retorno,
la actualizacion de datos y el layout responsive no queden mezclados en la
pagina principal.

## Alcance

Incluye:

- cabecera
- filtros primarios y adicionales
- bloque KPI con toggle propio
- selectores por estado
- alarmas verticales compactas
- lista de detalle con scroll infinito
- acciones rapidas de orden
- snapshot/restore al volver desde formularios externos

## Estructura

```text
po-dashboard/
  list.tsx
  model.ts
  return-state.ts
  state-helpers.ts
  use-po-dashboard.ts
  components/
    header/
    primary-filters/
    kpi-row/
    main-panel/
      dashboard-main-panel.tsx
      dashboard-list-section.tsx
      po-orders-detail-table.tsx
      use-dashboard-main-panel.ts
```

## Responsabilidades

### `list.tsx`

Compone la pagina y conecta las piezas principales.

- crea el `SectionShell`
- conecta `usePoDashboard`
- arma view-models para header, filtros, KPI y panel principal
- resuelve navegacion desde el dashboard hacia ordenes y recursos relacionados
- guarda contexto antes de salir a rutas administradas
- dispara `refreshDashboard` desde la accion visual de refresh

No debe contener fetch, transformaciones pesadas ni reglas de sincronizacion.

### `model.ts`

Define el contrato del recurso.

- tipos de respuesta
- tipos de filtros
- claves KPI y alarmas
- constantes de UI
- page size y viewport del detalle
- formatters y helpers puros

### `state-helpers.ts`

Agrupa helpers transversales del hook.

- snapshot en `sessionStorage`
- request keys
- fetch autenticado
- comparacion de orden previa vs actual
- decision de refresh al volver
- matching de items por id

### `return-state.ts`

Maneja el marcador de retorno entre el dashboard y formularios externos.

El marker conserva:

- orden activa
- filtros
- periodo
- KPI de detalle
- alarma seleccionada
- estado de filtros adicionales
- flags de refresh puntual o completo

Esto permite volver al dashboard sin perder el contexto visual.

### `use-po-dashboard.ts`

Hook principal del recurso.

Responsabilidades:

- estado global del dashboard
- carga del bundle principal
- carga del detalle paginado
- carga de selectores rapidos
- carga de catalogos
- snapshot/restore al volver desde formularios
- refresh interno mediante `refreshSeq`
- sincronizacion puntual de alarmas con `alerta-item`
- refresh completo cuando el cambio lo requiere

No renderiza UI ni define layout.

### `components/header`

Cabecera visual del dashboard.

### `components/primary-filters`

Filtros superiores.

- periodo
- solicitante
- proveedor
- tipo de solicitud
- toggle de filtros adicionales

### `components/kpi-row`

Bloque KPI PO.

- compras del periodo
- top proveedores
- evolucion
- composicion por tipo de solicitud

### `components/main-panel`

Panel operativo.

- cards de estado
- alarmas verticales
- titulo dinamico del detalle
- empty state dinamico
- lista expandible

Archivos principales:

- `dashboard-main-panel.tsx`: coordina cards, alarmas y seccion de lista.
- `use-dashboard-main-panel.ts`: arma el view-model del panel.
- `dashboard-list-section.tsx`: maneja titulo, toggle, loading, empty state,
  viewport e infinite scroll.
- `po-orders-detail-table.tsx`: concentra tabla responsive, cards mobile,
  columnas, celdas y acciones de fila.

## Flujo de datos

`use-po-dashboard.ts` consume:

- `/api/dashboard/po/bundle`
- `/api/dashboard/po/selectors`
- `/api/dashboard/po/detalle`
- `/api/dashboard/po/detalle-alerta`
- `/api/dashboard/po/alerta-item`

La carga principal usa request keys derivadas de filtros, periodo y `refreshSeq`.
`refreshDashboard` incrementa `refreshSeq`, evitando hard refresh de pagina.

## Flujo de retorno

Antes de navegar a una orden u otro recurso administrado, `list.tsx` guarda el
contexto actual mediante `saveDashboardReturnMarker`.

Al volver:

1. `use-po-dashboard.ts` restaura filtros, periodo, KPI, alarma y filtros
   adicionales.
2. Si corresponde, compara la orden previa contra la actual.
3. Si hay alarma activa, consulta `alerta-item`.
4. Si la orden ya no pertenece a la alarma, la remueve localmente y ajusta el
   contador.
5. Si el cambio requiere recarga completa, ejecuta refresh del bundle.

## Lista de detalle

El detalle se divide en dos capas:

- `dashboard-list-section.tsx`: estructura de seccion, expansion y scroll.
- `po-orders-detail-table.tsx`: render de tabla y cards mobile.

La tabla usa `ResponsiveDataTable` con:

- `table-fixed`
- `min-w-full`
- `w-full`
- overflow horizontal controlado
- columnas con anchos estables
- card mobile especifica para ordenes

Este esquema replica la estrategia responsive de `propiedades-dashboard`.

## Reglas de diseno del patron

- El hook principal concentra fetch, restore y sincronizacion.
- Los view-models intermedios son chicos y especificos.
- Los componentes visuales reciben datos listos para renderizar.
- La lista compleja vive en un archivo propio.
- El dashboard guarda el contexto antes de salir; los recursos externos no
  necesitan conocer el detalle del dashboard.
- La accion de refresh debe usar `refreshDashboard`, no `window.location.reload`.

## Como reutilizar este patron

Para crear o normalizar otro dashboard:

1. Definir contratos y constantes en `model.ts`.
2. Concentrar fetch, snapshots y refresh en el hook principal.
3. Crear view-models por seccion visual.
4. Mantener `list.tsx` como composicion y navegacion.
5. Separar la lista compleja en un componente de tabla propio.
6. Usar return marker para restaurar filtros, selector, KPI y alarma.
7. Validar flujo funcional de salida, edicion, vuelta y conservacion de contexto.

## Que evitar

- mezclar layout, fetch y reglas de refresh en un solo archivo
- usar hard refresh para actualizar el dashboard
- esconder reglas de negocio en componentes visuales
- acoplar formularios externos a la estructura interna del dashboard
- duplicar helpers de snapshot o comparacion de registros

## Validacion funcional recomendada

1. Entrar a `po-dashboard`.
2. Cambiar periodo/filtros.
3. Seleccionar KPI o alarma.
4. Abrir una orden.
5. Editar o ejecutar una accion.
6. Volver al dashboard.
7. Confirmar que conserva selector, filtros, alarma y lista activa.
8. Confirmar que los datos actualizados se reflejan sin recargar la pagina.
