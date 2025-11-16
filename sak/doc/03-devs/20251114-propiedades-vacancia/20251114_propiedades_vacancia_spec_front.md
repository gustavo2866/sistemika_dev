# SPEC FRONT - Propiedades con Vacancia

> **Referencia primaria:** `20251114_propiedades_vacancia_spec_backend.md`  
> **Version:** 0.1 (borrador frontend) - 2025-11-15

---

## Resumen Ejecutivo
- Extender el modulo de propiedades para capturar los nuevos campos funcionales (ambientes, m2, valores economicos, fechas clave y comentarios de estado) y reflejarlos en formularios, listados y vistas Show.
- Incorporar en la vista de propiedad un flujo guiado de cambio de estado que ejecute `POST /api/propiedades/{id}/cambiar-estado`, actualice la vacancia activa y muestre una linea de tiempo de estados con duraciones calculadas.
- Crear el recurso `vacancias` en React Admin (list/show) para auditar ciclos, filtrar por fecha, estado o atributos de la propiedad y editar solamente comentarios cuando sea necesario.
- Sumar un dashboard especifico de vacancias (referencia directa al layout de shadcn Admin Kit) con filtros por rango de fechas y atributos de propiedad para exponer KPIs (tiempo promedio total, tiempo en reparacion, porcentaje de propiedades disponibles, outliers, etc.).

---

## 1. Modelo y helpers compartidos

### 1.1 Tipos y schemas
- Crear `frontend/src/app/resources/propiedades/model.ts` para centralizar los tipos:
  ```ts
  export type PropiedadEstado = "1-recibida" | "2-en_reparacion" | "3-disponible" | "4-alquilada" | "5-retirada";

  export type Propiedad = {
    id: number;
    nombre: string;
    tipo: string;
    propietario: string;
    estado: PropiedadEstado;
    ambientes?: number | null;
    metros_cuadrados?: number | null;
    valor_alquiler?: number | null;
    expensas?: number | null;
    fecha_ingreso?: string | null;
    vencimiento_contrato?: string | null;
    estado_fecha: string;
    estado_comentario?: string | null;
    vacancias?: Vacancia[];
  };

  export type Vacancia = {
    id: number;
    propiedad_id: number;
    ciclo_activo: boolean;
    fecha_recibida?: string | null;
    comentario_recibida?: string | null;
    fecha_en_reparacion?: string | null;
    comentario_en_reparacion?: string | null;
    fecha_disponible?: string | null;
    comentario_disponible?: string | null;
    fecha_alquilada?: string | null;
    comentario_alquilada?: string | null;
    fecha_retirada?: string | null;
    comentario_retirada?: string | null;
    dias_reparacion?: number | null;
    dias_disponible?: number | null;
    dias_totales?: number | null;
    dias_reparacion_calculado?: number | null;
    dias_disponible_calculado?: number | null;
    dias_totales_calculado?: number | null;
  };
  ```
- Usar `createEntitySchema` para validar formularios:
  - `propiedadSchema`: `nombre`, `tipo`, `propietario` requeridos (max 200). `ambientes` entero >=0, `metros_cuadrados` decimal >=0, `valor_alquiler` y `expensas` como currency >=0, fechas en formato ISO, `estado_comentario` max 500.
  - `vacanciaComentarioSchema`: permitir actualizacion solo de los campos `comentario_*`.

### 1.2 Constantes y helpers
- Definir en `model.ts`:
  - `ESTADOS_PROPIEDAD_OPTIONS` (label + value + color Tailwind) para reutilizar en selects, badges y timeline.
  - `VACANCIA_STATE_STEPS = ["recibida","en_reparacion","disponible","alquilada","retirada"]` para mapear dinamicamente fechas/comentarios.
- Crear `frontend/src/lib/vacancias/metrics.ts` con utilidades:
  - `getDias(value?: number | null, fallback?: number | null)` para priorizar `dias_x_calculado`.
  - `buildVacanciaKPIs(vacancias: Vacancia[], filtros)` que retorna `totalActivas`, `promedioDiasTotales`, `promedioDiasReparacion`, `promedioDiasDisponible`, `%Retiro`.
- Exportar `formatEstadoPropiedad` (usa `ESTADOS_PROPIEDAD_OPTIONS`) y `formatCurrencyField` si no existe.

---

## 2. Recurso Propiedades

### 2.1 Listado y filtros
- Actualizar `frontend/src/app/resources/propiedades/list.tsx`:
  - Consumir `filters` avanzados: `TextInput` para `q`, `tipo`, `propietario`; `SelectInput` multi para `estado`; `NumberInputRange` para `ambientes`, `metros_cuadrados`, `valor_alquiler`; `DateInputRange` para `fecha_ingreso` y `estado_fecha`.
  - Columnas nuevas: `ambientes`, `metros_cuadrados`, `valor_alquiler` (formateado), `estado` como `StatusBadge`, `dias_vacancia` (si hay vacancia activa mostrar `dias_totales_calculado`), `ciclo_activo` (chip "Vacante" / "Cerrada").
  - Incluir acción rápida "Ir a vacancia" que abre el registro activo en un Drawer (ver 3.2).

### 2.2 Formulario (Create/Edit)
- Reemplazar el formulario plano por `SimpleForm` + `FormSection`:
  1. **Datos generales:** nombre, tipo, propietario (TextInput).
  2. **Caracteristicas:** `NumberInput` para ambientes, `DecimalInput` para m2 (dos decimales), `Select` de tipo (cargar catálogos existentes si aplica).
  3. **Economia:** `MoneyInput` para `valor_alquiler` y `expensas`.
  4. **Fechas:** `DateInput` para `fecha_ingreso` y `vencimiento_contrato`.
  5. **Estado actual:** `RadioGroup` o `SelectInput` para `estado` usando `ESTADOS_PROPIEDAD_OPTIONS`, `DateInput` read-only `estado_fecha`, `Textarea` `estado_comentario`.
- Validar con `propiedadSchema` y formatear payload a numeros/fechas ISO antes de enviar (`parseFloat`, `formatISO`).
- Mostrar alerta si se guarda con `estado="5-retirada"` (advierte que cierra ciclo y ocultara propiedad de combos).

### 2.3 Vista Show y componentes auxiliares
- Crear `frontend/src/app/resources/propiedades/components/VacanciaTimeline.tsx`:
  - Timeline vertical con los 5 estados (usa `ESTADOS_PROPIEDAD_OPTIONS` para icono/color).
  - Cada item muestra fecha (RelativeTime + formato corto), comentario, y si pertenece al ciclo activo (badge "Activo").
- `PropiedadShow` debe:
  - Solicitar `propiedad` con `expand=vacancias` (ver seccion 5).
  - Renderizar secciones: Datos generales, Economia, Estado actual, Vacancia activa (capsulas con `dias_*_calculado`), Historial (timeline).
  - Agregar panel lateral con los ultimos 3 cambios (mostrar `estado`, `estado_fecha`, `estado_comentario`).

### 2.4 Cambio de estado guiado
- Nuevo boton `Cambiar estado` (en toolbar de edit/show) que abre un `Dialog`:
  - Campos: `SelectInput` `nuevo_estado` (excluye estado actual); `Textarea` comentario requerido si el destino es `2-en_reparacion`, `4-alquilada` o `5-retirada`; `Switch` "Generar aviso" (placeholder para futuras notificaciones).
  - Al confirmar usa `useDataProvider` para invocar `POST /api/propiedades/{id}/cambiar-estado` con body `{ nuevo_estado, comentario }`.
  - Mostrar `Alert` de error si backend devuelve 400 por transicion invalida.
  - Refrescar record + `vacancias` via `refresh()` y `invalidateStore("vacancias")`.

### 2.5 Integracion con otros recursos
- `ReferenceInput` que apuntan a `propiedades` (facturas, solicitudes, etc.) deben leer el nuevo `recordRepresentation` (`nombre` + estado). Agregar `optionText={(record) => \`\${record.nombre} · \${formatEstadoPropiedad(record.estado)}\`}` para dar contexto.
- Documentar en `frontend/BUILD_REPORT.md` que las grillas de solicitudes y facturas pueden ahora consultar `propiedades?estado__eq=3-disponible` para evitar seleccionar propiedades retiradas.

---

## 3. Recurso `vacancias`

### 3.1 Estructura del modulo
- Directorio `frontend/src/app/resources/vacancias/` con archivos `model.ts`, `list.tsx`, `show.tsx`, `index.ts`.
- Registrar en `frontend/src/app/resources/index.ts` y en `AdminApp.tsx` (`Resource name="vacancias"` con icono `History` o `Activity`, opciones label "Vacancias").

### 3.2 Listado
- Endpoint base: `GET /api/vacancias`. Siempre enviar `meta.query = { expand: "propiedad", order_by: "-fecha_recibida" }`.
- Filtros:
  - `SelectInput` `ciclo_activo`.
  - `ReferenceInput` `propiedad_id`.
  - `DateRange` para `fecha_recibida` y `fecha_alquilada`.
  - `MultiSelect` para `propiedad.estado` (usar `filter: { "propiedad.estado__in": value }`).
- Columnas:
  - Propiedad (mostrar `nombre` + `tipo`).
  - Estado actual (badge segun `ciclo_activo`).
  - `fecha_recibida`, `fecha_disponible`, `fecha_alquilada`.
  - `dias_reparacion`, `dias_disponible`, `dias_totales` (usar helper `renderDias` que toma calculado o persistido).
  - Acciones: `ShowButton` + `Button` "Ver propiedad" (link `/propiedades/:id/show`).

### 3.3 Vista Show
- Mostrar cabecera con estado (Activo/Cerrado) y datos clave de la propiedad.
- Dos tarjetas:
  1. **Metrica resumen:** `dias_totales`, `dias_reparacion`, `dias_disponible`, fecha de cierre si existe.
  2. **Comentarios por estado:** tabla con columnas Estado, Fecha, Comentario, editable solo en comentarios.
- Agregar seccion `Historial de eventos` reutilizando `VacanciaTimeline` pero resaltando el ciclo actual.
- Boton `Editar comentarios` abre `Drawer` con checkboxes por estado; cada campo se valida con `maxLength 500`. Guardar via `PUT /api/vacancias/{id}` enviando solo `comentario_*`.
- No permitir modificar manualmente las fechas (solo lectura).

### 3.4 Hooks y cache
- Crear `useVacancias(options)` en `resources/vacancias/hooks.ts` que envuelve `useDataProvider` + `useQuery` para dashboard y timeline reutilizando `meta`.
- Implementar `prefetchVacanciaActiva(propiedadId)` para que `PropiedadShow` cargue el ciclo activo sin bloquear la UI.

---

## 4. Dashboard de Vacancias

### 4.1 Alcance y referencia visual
- Nuevo recurso `dashboard-vacancias` (solo `list.tsx`) siguiendo el layout del dashboard oficial de **shadcn Admin Kit**: barra superior con filtros, tarjetas KPI, graficos (AreaChart, Radial progress, tabla).
- Ubicacion: `frontend/src/app/resources/dashboard-vacancias/list.tsx`. Registrar en `AdminApp.tsx` como `Resource name="dashboard-vacancias"` con icono `BarChart2` y label "Vacancias".

### 4.2 Filtros globales
- Toolbar superior (sticky) con:
  - `DateRangePicker` (componente shadcn) para `fecha_recibida` y `fecha_alquilada`.
  - `Select` multivalor `tipo_propiedad`.
  - `Select` `estado_propiedad` (valores 1-5).
  - `Slider` doble para `ambientes` y `metros_cuadrados`.
  - `Select` `buckets` de valor alquiler (0-200k, 200k-400k, >400k).
- Cada cambio de filtro actualiza el estado compartido `DashboardVacanciaFilters` y dispara `useVacanciaMetrics(filters)` (usa `GET /api/vacancias` con `expand=propiedad`, `limit=500`, paginacion incremental si `total > 500`).

### 4.3 Tarjetas KPI
- Primera fila (4 cards) siguiendo el estilo shadcn:
  1. `Promedio dias totales` (muestra comparativa vs periodo anterior).
  2. `Propiedades con vacancia activa` (badge verde si bajo SLA <30 dias, rojo >=60).
  3. `Promedio dias en reparacion`.
  4. `% Ciclos cerrados en el rango`.
- Cada tarjeta muestra valor principal, subtexto y tendencia (flecha + porcentaje) usando `TrendingUp`/`TrendingDown`.

### 4.4 Graficos
- Dos columnas tipo shadcn:
  - **AreaChart multi serie:** eje X = fecha de inicio (mensual), series = `dias_reparacion`, `dias_disponible`, `dias_totales`. Usa `recharts` como en `dashboard-proyectos`.
  - **BarChart apilada:** agrupar por `tipo_propiedad` y mostrar cantidad de ciclos en cada estado final (`alquilada`, `retirada`).
- Segunda fila:
  - **Radial progress / donut:** distribucion de propiedades por tramo de tiempo (`0-15`, `16-30`, `31-60`, `>60` dias).
  - **Tabla de outliers** (Top 10 vacancias mas largas) usando `DataTable` con columnas Propiedad, Dias totales, Estado actual, Comentario ultimo.
- Todos los graficos deben respetar colores de shadcn Admin Kit (azul, verde, violeta, naranja). Declarar paleta en `dashboard-vacancias/constants.ts`.

### 4.5 Indicadores accionables
- Card adicional "Alertas" con lista de propiedades cuya vacancia supera el SLA configurado (por default 45 dias). Cada item muestra botones:
  - `Ver propiedad` (navega a show).
  - `Cambiar estado` (abre dialog reutilizando componente de 2.4).
  - `Agregar comentario` (abre drawer de vacancia).
- Incluir toggle "Solo propiedades con expensas > 100k" que filtra en memoria.

---

## 5. Integracion tecnica y testing

### 5.1 Data Provider y llamadas custom
- Extender `frontend/src/lib/dataProvider.ts`:
  - Permitir `params.meta?.query` para `getList/getOne`: `const query = { ...params.filter, ...(params.meta?.query ?? {}) };`.
  - Agregar helper `customMethod(path, options)` expuesto a traves de `dataProvider` para `cambiar-estado`.
  - Soportar `meta.expand` (string o string[]) generando `expand=propiedad,vacancias`.
  - Respetar `limit`/`offset` personalizados (dashboard usara `limit=500` sin paginar RA).

### 5.2 Estado y cache
- Usar `useQueryClient` para invalidar `["vacancias","list",filters]` luego del cambio de estado.
- Las vistas `show` deben mostrar skeletons (usar `CardSkeleton`) mientras se resuelve `expand=vacancias`.
- Para dashboard, cachear resultados 60s (`staleTime`) y mostrar `lastUpdated` en toolbar.

### 5.3 Testing y verificacion
- Actualizar `frontend/test-backend.js` para incluir smoke `GET /api/vacancias?limit=1`.
- Agregar pruebas unitarias (React Testing Library) para:
  - `VacanciaTimeline` (renderiza pasos con fechas).
  - `DashboardVacanciasList` (aplica filtros y muestra KPIs stub).
  - `ChangeStateDialog` (bloquea transicion invalida).
- QA manual: checklist en `doc/03-devs/20251114-propiedades-vacancia/README.md` con flujos:
  1. Crear propiedad -> confirmar que genera vacancia activa.
  2. Cambiar estado a `2-en_reparacion` -> se actualiza timeline.
  3. Filtrar vacancias activas -> coincide con dashboard.
  4. Dashboard -> filtros de fecha cambian KPIs y graficos.

---

## 6. Preguntas abiertas / decisiones pendientes
1. **SLA de vacancia larga:** se asumio 45 dias para destacar alertas. Confirmar con negocio si el umbral debe ser configurable desde backend.
ok
2. **Edicion manual de fechas en vacancias:** hoy se marcan de solo lectura. Necesitamos confirmar si soporte requiere corregir fechas desde el frontend (implicaria habilitar DateInput con permisos).
por ahora no
3. **Limite de registros para dashboard:** se planea pedir hasta 500 vacancias. Si el tenant supera ese numero deberiamos paginar y agregar agregaciones backend (`GET /propiedades/reportes/metricas-vacancia`). Confirmar volumen esperado.
ok volumen esperado
4. **Colorimetria de estados:** se propuso un set fijo (verde=disponible, azul=recibida, amarillo=reparacion, violeta=alquilada, gris=retirada). Validar con UX para mantener consistencia con otros modulos.
ok
5. **Permisos:** no existe rol especifico. Se asume que cualquier usuario con acceso a propiedades podra ver vacancias y dashboard. Confirmar si se necesita feature flag antes de publicar.
ok por ahora

Una vez respondidas estas preguntas, actualizar este SPEC y estimar effort individual para backlog (propiedades, vacancias CRUD, dashboard) antes de comenzar el sprint.
