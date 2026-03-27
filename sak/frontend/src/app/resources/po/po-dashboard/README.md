# PO Dashboard

Patron base para dashboards PO con:

- cabecera
- filtros primarios
- bloque KPI con toggle propio
- alarmas
- selectores por estado
- lista con scroll infinito
- acciones rapidas

## Objetivo

Este recurso replica la arquitectura limpia de `crm-dashboard`, cambiando solo lo minimo indispensable del dominio PO.

Separa tres capas:

1. `use-po-dashboard.ts`
   Orquesta estado, fetch, snapshot, sincronizacion de retorno y reglas de refresh.

2. `components/*/use-*.ts`
   Construyen view-models chicos para cada seccion visual.

3. `components/*/*.tsx`
   Renderizan UI sin conocer endpoints ni reglas de negocio complejas.

La idea es reutilizar esta estructura en futuros dashboards, cambiando:

- tipos de datos
- endpoints
- tarjetas KPI
- alarmas
- columnas de lista
- acciones rapidas

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
```

## Responsabilidades por archivo

### `list.tsx`

Compone la pagina.

- arma `SectionShell`
- conecta `usePoDashboard`
- crea los view-models de header, filtros, KPI y panel principal
- resuelve navegacion al abrir ordenes

No deberia contener reglas de fetch ni transformaciones pesadas.

### `model.ts`

Contrato del recurso.

- tipos de respuesta
- tipos de filtros
- formatters
- constantes UI
- helpers puros de fechas y query params

Si otro dashboard comparte patrones, este archivo es la referencia para definir:

- response model
- page size
- visible rows
- items de alertas
- tarjetas KPI

### `state-helpers.ts`

Helpers transversales del hook.

- snapshot en `sessionStorage`
- request keys
- comparacion de orden previa vs actual
- decision de refresh
- fetch autenticado
- helpers de matching por id

Este archivo evita que `use-po-dashboard.ts` se convierta en un bloque monolitico.

### `use-po-dashboard.ts`

Hook principal del recurso.

Responsabilidades:

- estado global del dashboard
- carga del bundle principal
- carga del detalle paginado
- carga de selectores rapidos
- carga de catalogos
- snapshot/restore al volver desde formularios
- sync de alarmas activas usando `alerta-item`

No deberia renderizar UI ni formatear presentacion.

### `return-state.ts`

Maneja el marcador de retorno entre dashboard y formularios externos.

Sirve para:

- volver al dashboard sin perder contexto
- refrescar una orden puntual
- refrescar todo el dashboard cuando hace falta

### `components/header`

Solo cabecera visual.

### `components/primary-filters`

Filtros superiores.

- periodo
- solicitante
- filtros adicionales de proveedor y tipo solicitud

Usa componentes del stack `form_order`.

### `components/kpi-row`

Bloque KPI PO.

- compras del periodo
- top proveedores
- evolucion
- composicion por tipo solicitud

### `components/main-panel`

Seccion operativa del dashboard.

- selectores
- alarmas
- lista
- acciones rapidas

`dashboard-list-section.tsx` concentra la parte mas sensible:

- tabla responsive
- scroll infinito
- toggle mostrar/ocultar
- viewport fijo

## Flujo de datos

### 1. Carga principal

`use-po-dashboard.ts` consume:

- `/api/dashboard/po/bundle`
- `/api/dashboard/po/selectors`
- `/api/dashboard/po/detalle`
- `/api/dashboard/po/detalle-alerta`
- `/api/dashboard/po/alerta-item`

### 2. Snapshot de retorno

Antes de salir a editar una orden, se guarda:

- ruta de retorno
- orden activa
- snapshot del dashboard

Al volver:

- se compara la orden actual con la previa
- si hay alarma activa, se consulta `alerta-item`
- si el item ya no pertenece a la alarma, se elimina localmente y se decrementa el contador

### 3. Lista con scroll infinito

La lista usa:

- `ResponsiveDataTable`
- viewport fijo
- `IntersectionObserver`
- sentinel invisible al final

Esto evita mezclar la logica de paginacion con la pagina completa.

## Reglas de diseño que conviene repetir

- el hook principal concentra fetch y sync
- los view-models intermedios son chicos y especificos
- los componentes visuales reciben datos listos para render
- la lista compleja va en un archivo propio
- la navegacion de retorno se resuelve dentro del dashboard, no en recursos externos

## Como reutilizar este patron

Para crear otro dashboard:

1. copiar la estructura del recurso
2. redefinir contratos en `model.ts`
3. reemplazar endpoints en `use-*.ts`
4. mantener `state-helpers.ts` como base de snapshot y refresh
5. adaptar `dashboard-list-section.tsx` a las columnas y acciones del nuevo dominio
6. ajustar `README.md` con el contrato nuevo

## Que no repetir

- mezclar layout, fetch y reglas de refresh en un solo archivo
- esconder logica de negocio en componentes visuales
- acoplar recursos externos al dashboard para que sepan como volver
- duplicar helpers de snapshot o comparacion de registros

## Proximos candidatos a extraccion

Si este patron se replica:

- mover `state-helpers.ts` a una capa shared de dashboards
- extraer un `DashboardShell`
- extraer un `DashboardInfiniteListSection`
- extraer un contrato comun para `return-state`
