# Especificacion Tecnica - Dashboard CRM Oportunidades

> **Requerimiento base:** `20251124_crm_dashboar_req.md`  
> **Patron de referencia:** Dashboard Vacancias (`backend/app/services/vacancia_dashboard.py` + `/api/dashboard/vacancias`)  
> **Modelo de datos:** `CRMOportunidad`, `CRMOportunidadLogEstado`, `Propiedad`, catalogos CRM (tipos de operacion, motivo perdida)  
> **Version:** 0.1 (borrador) - 2025-11-24  
> **Autor:** Codex

---

## 0. Alcance y lineamientos
- Crear un dashboard CRM que replique la experiencia de `dashboard_vacancias`: barra de filtros, tarjetas KPI, graficos y tabla que comparte los mismos filtros y permite navegar el detalle.
- Datos fuente: oportunidades CRM + propiedades vinculadas. No se crean entidades nuevas; se aprovechan `CRMOportunidad` (estado, fechas, valores) y `CRMOportunidadLogEstado` (historial de cambios).
- Backend expone 2 endpoints (`/api/dashboard/crm` y `/api/dashboard/crm/detalle`) siguiendo el contrato de vacancias (misma estrategia de parseo de filtros, paginado y `filtrar_respuesta`). Toda la logica de agregacion se ejecuta en el servicio backend.
- Frontend (React Admin + shadcn Admin Kit) suma el recurso `dashboard-crm` para consumir los endpoints anteriores, reusar los componentes del dashboard de vacancias y mantener consistencia visual.

---

## 1. Modelo y entradas disponibles

### 1.1 Entidades relevantes
- **CRMOportunidad (`backend/app/models/crm_oportunidad.py`)**
  - Campos a consumir: `id`, `created_at`, `estado`, `fecha_estado`, `tipo_operacion_id`, `propiedad_id`, `contacto_id`, `responsable_id`, `monto`, `moneda_id`, `probabilidad`, `fecha_cierre_estimada`, `descripcion_estado`, `cotizacion_aplicada`, `deleted_at`.
  - Relaciones necesarias: `propiedad` (para tipo y valores economicos), `tipo_operacion`, `contacto`, `responsable`, `moneda`, `emprendimiento` (para filtro futuro).
- **CRMOportunidadLogEstado (`backend/app/models/crm_oportunidad_log_estado.py`)**
  - Fuente para detectar fecha exacta de cambio a `5-ganada`, `4-reserva` o `6-perdida`. Campos: `estado_nuevo`, `fecha_registro`, `monto`, `moneda_id`, `condicion_pago_id`, `descripcion`.
- **Propiedad (`backend/app/models/propiedad.py`)**
  - Campos de filtro y montos: `tipo`, `estado`, `valor_alquiler`, `precio_venta_estimado`, `costo_propiedad`, `propietario`, `ambientes`, `emprendimiento_id`, `deleted_at`.
- **Catalogos CRM (`crm_catalogos.py`)**
  - Tipos de operacion (ej. venta, alquiler, emprendimiento) para exponer labels y filtros multiselect.

### 1.2 Fechas y estados
- `created_at` = fecha de alta de la oportunidad.
- `fecha_estado` = fecha del ultimo cambio de estado (valor en el registro actual).
- `logs_estado` = historial completo; permite detectar la fecha en la que la oportunidad se **cerro** (ganada o perdida) y la fecha de paso por cada etapa.
- Estados validos (`EstadoOportunidad`): `1-abierta`, `2-visita`, `3-cotiza`, `4-reserva`, `5-ganada`, `6-perdida`.

### 1.3 Parametros y filtros (GET /api/dashboard/crm)
- `startDate`, `endDate` (YYYY-MM-DD, obligatorios)  rango utilizado en todos los calculos (igual que `dashboard_vacancias`, timezone UTC-3).
- `tipoOperacion` (int | multi)  `CRMOportunidad.tipo_operacion_id`.
- `tipoPropiedad` (str | multi)  `Propiedad.tipo`.
- `responsable` (int | multi opcional)  `CRMOportunidad.responsable_id`.
- `propietario` (str opcional, LIKE case-insensitive).
- `includeItems` (bool)  opcional para alinear con vacancias (evitar query adicional cuando no se requiere ranking).
- `limitTop` (int, default 5, max 20)  cantidad de registros que regresan en la seccion ranking.
- `kpi` / `estado` / `bucket` / paginacion se manejan en `/detalle`.

---

## 2. Definicion de indicadores

### 2.1 Condiciones base
- Se considera que una oportunidad pertenece al **periodo** si se cumple cualquiera de los casos del requerimiento (a, b, c):
  1. Se cerro (ganada o perdida) entre `startDate` y `endDate` (inclusive)  requiere leer `logs_estado` y tomar la primera marca donde `estado_nuevo`  {`5-ganada`, `6-perdida`} dentro del rango.
  2. Se creo antes o durante `endDate` **y** su fecha de cierre es posterior al rango  oportunidad estuvo activa durante el periodo aunque se haya cerrado despues.
  3. Se creo antes o durante `endDate` y todavia NO tiene cierre (no existe log `ganada/perdida`)  sigue abierta.
- Las fechas se calculan en base a `created_at.date()`, `fecha_cierre_real` (log `ganada/perdida`) y `fecha_cierre_teorica` (`fecha_cierre_estimada` como fallback solo para mostrar en detalle).

### 2.2 Montos y monedas
- **Monto de referencia:** tomar primero `CRMOportunidad.monto`. Si es `None`, usar:
  - `Propiedad.precio_venta_estimado` para operaciones `venta`/`emprendimiento`.
  - `Propiedad.valor_alquiler` para operaciones `alquiler`.
  - `Propiedad.costo_propiedad` como ultimo recurso.
- El monto se expresa en la moneda original (`CRMOportunidad.moneda_id` o `Propiedad.precio_moneda_id`). No hay conversion automatica en esta iteracion; se incluye contador de registros sin monto para control.

### 2.3 KPIs cabecera
1. **Totales**
   - `count`: cantidad de oportunidades que califican para el periodo (casos a+b+c).
   - `amount`: suma de `monto_estimado` de esas oportunidades (ignora `None`).
2. **Nuevas**
   - `count`: oportunidades con `created_at.date()` dentro del rango.
   - `amount`: suma de montos asociados a esas nuevas oportunidades.
   - `incremento`: `(count_nuevas / max(count_totales,1)) * 100`  porcentaje.
3. **Ganadas**
   - `count`: oportunidades cuya primera transicion a `5-ganada` sucedio dentro del rango.
   - `amount`: suma de montos de esas oportunidades.
   - `conversion`: `(count_ganadas / max(count_totales,1)) * 100`.
4. **Pendientes (extra sugerido)**: oportunidades activas al cierre del periodo (sin cierre o cierre posterior) para exponer backlog y usarlo en el embudo.

### 2.4 Graficos
- **Embudo:** para cada etapa (`1-abierta`  `6-perdida`), contar oportunidades vigentes en el rango y sumar sus montos.
  - Estado asociado = ultimo `log` antes o igual a `endDate` (si no hay log, usar `estado` actual).
  - Cada etapa devuelve: `estado`, `label`, `cantidad`, `monto`, `conversion_acumulada` (count etapa / totales) y `drop_vs_prev`.
- **Evolucion mensual:** buckets `YYYY-MM` entre `startDate` y `endDate` (inclusive). Por bucket:
  - `totales`: count de oportunidades activas en ese mes (aplica regla de inclusion vs. rango mensual).
  - `nuevas`: count creadas ese mes.
  - `ganadas`: count con cierre (ganada) en ese mes.
  - Montos agregados por cada metrica (para usar en grafico stacked/line).
  - Mantener prop consistente con vacancias: `buckets` ordenados + `label` amigable.

### 2.5 Ranking / detalle
- Ranking principal = top `limitTop` oportunidades ordenadas por `monto_estimado` (desc) o `created_at` (desc) cuando no existe monto.
- Cada tarjeta KPI dispara el modal/lista con el subconjunto correspondiente. `/detalle` debe aceptar `kpiKey` (`totales`, `nuevas`, `ganadas`, `pendientes`) y devolver la paginacion solicitada.
- Campos a mostrar en el detalle:
  - `oportunidad`: `id`, `descripcion_estado`, `estado`, `created_at`, `fecha_estado`, `responsable`, `contacto`, `tipo_operacion`, `probabilidad`, `propiedad` (nombre, tipo, valor).
  - `fechas`: `fecha_creacion`, `fecha_ganada`, `fecha_perdida`, `dias_en_pipeline` (= min(endDate, fecha_cierre) - fecha_creacion).
  - `montos`: `monto_original`, `moneda`, `monto_propiedad`, flags `tieneMonto`.
  - `origen`: `propietario`, `tipo_propiedad`, `emprendimiento`.

---

## 3. Backend

### 3.1 Servicio `crm_dashboard`
Crear `backend/app/services/crm_dashboard.py` siguiendo la estructura de `vacancia_dashboard.py`:

```python
@dataclass
class CalculatedOportunidad:
    oportunidad: CRMOportunidad
    fecha_creacion: date
    fecha_cierre: date | None
    estado_actual: str
    estado_al_corte: str
    monto_estimado: Decimal | None
    monto_propiedad: Decimal | None
    es_nueva: bool
    es_ganada_periodo: bool
    bucket: str  # YYYY-MM
```

Funciones principales:
1. `_parse_date(value)` y `_parse_decimal(value)` reutilizadas del patron vacancias para sanitizar entradas.
2. `_infer_estado_al_corte(oportunidad, end_date)`:
   - Ordenar `logs_estado` asc por `fecha_registro` (asegurar `selectinload` + `order_by`).
   - Recorrer hasta `end_date` y retornar ultimo `estado_nuevo`. Si no hay logs, usar `estado` actual.
3. `_fecha_cierre(oportunidad)`:
   - Buscar primer log `estado_nuevo in {5-ganada, 6-perdida}`.
4. `_monto_estimado(oportunidad)`:
   - Prioriza `oportunidad.monto`. Si `None`, leer `propiedad` segun reglas 2.2.
5. `fetch_oportunidades_for_dashboard(session, start_date, end_date, **filtros)`:
   - Parseo de fechas (YYYY-MM-DD)  `date`.
   - Query base `select(CRMOportunidad).where(CRMOportunidad.deleted_at.is_(None))`.
   - `options`: `selectinload(CRMOportunidad.propiedad)`, `selectinload(CRMOportunidad.tipo_operacion)`, `selectinload(CRMOportunidad.contacto)`, `selectinload(CRMOportunidad.responsable)`, `selectinload(CRMOportunidad.logs_estado)`.
   - Filtros: `tipo_operacion_id.in_(...)`, `Propiedad.tipo.in_(...)`, `Propiedad.propietario contains`, `CRMOportunidad.responsable_id.in_(...)`. Para filtros de propiedad se requiere `join` similar a vacancias (`join(Propiedad, CRMOportunidad.propiedad_id == Propiedad.id)`).
   - Para cada registro aplica la regla de inclusion (2.1). Si no califica, se descarta.
   - Devuelve lista de `CalculatedOportunidad` (sirve tanto para KPIs como para `/detalle`). Mantener fallback try/except para registros inconsistentes como en vacancias.

### 3.2 `build_crm_dashboard_payload`
Input: lista de `CalculatedOportunidad`, rango y `limit_top`.
Output sugerido:
```jsonc
{
  "range": {"startDate": "...", "endDate": "..."},
  "filters": {...},  // eco de lo recibido
  "kpis": {
    "totales": {"count": 0, "amount": 0, "incremento": 0},
    "nuevas": {"count": 0, "amount": 0, "incremento": 0},
    "ganadas": {"count": 0, "amount": 0, "conversion": 0},
    "pendientes": {"count": 0, "amount": 0}
  },
  "funnel": [
    {"estado": "1-abierta", "label": "Abierta", "count": 0, "amount": 0, "conversion": 0},
    ...
  ],
  "evolucion": [
    {"bucket": "2025-07", "totales": 0, "nuevas": 0, "ganadas": 0, "amountTotales": 0, ...}
  ],
  "ranking": {
    "totales": [...],  // top limitTop
    "nuevas": [...],
    "ganadas": [...]
  },
  "stats": {
    "sinMonto": 0,
    "sinPropiedad": 0
  }
}
```
Detalles de calculo:
- `kpis.totales.amount` = suma de montos de todos los calculados.
- `kpis.nuevas` usa `es_nueva` flag (`fecha_creacion` dentro del rango).
- `kpis.ganadas` usa `es_ganada_periodo` flag.
- `funnel` se arma recorriendo `CalculatedOportunidad.estado_al_corte` y sumando. Se calcula `conversion` incremental (count etapa / count totales) y `drop_vs_prev` para el grafico de embudo.
- `evolucion`:
  - `bucket` = `fecha_creacion.strftime("%Y-%m")` para nuevas, `fecha_cierre.strftime("%Y-%m")` para ganadas, y para totales considerar el mes en el que estuvo activo (usar helper `_month_span(fecha_inicio, fecha_fin)` que devuelva todos los buckets involucrados).
- `ranking`:
  - `totales`: top `limit_top` por `monto_estimado` (desc). Si hay empate o `None`, usar `created_at` desc.
  - `nuevas`, `ganadas`: filtrar por flag antes de ordenar.
  - Formato del item: `{"oportunidad": filtrar_respuesta(oportunidad), "monto": 0, "estado": "", "fecha": "2025-11-01", "kpiKey": "nuevas"}`.

### 3.3 API Endpoints
1. `GET /api/dashboard/crm`
   - Query params descritos en 1.3.
   - Flujo: llamar `fetch_oportunidades_for_dashboard`  `build_crm_dashboard_payload`  limpiar relaciones con `filtrar_respuesta` (igual que vacancias) para cada item de ranking.
   - HTTP 400 con `detail.error` en caso de errores de conversion de fecha; se loggea error server side.
2. `GET /api/dashboard/crm/detalle`
   - Query params:
     - `startDate`, `endDate`, `tipoOperacion`, `tipoPropiedad`, `responsable`, `propietario` (mismos filtros).
     - `kpiKey` (`totales` default, `nuevas`, `ganadas`, `pendientes`).
     - `stage` (opcional)  filtra por `estado_al_corte`.
     - `bucket` (opcional)  `YYYY-MM`.
     - `orderBy` (`monto`, `created_at`, `fecha_cierre`, `probabilidad`), `orderDir` (`asc|desc`).
     - `page`, `perPage` igual que vacancias (perPage max 200).
   - Respuesta:
```jsonc
{
  "data": [
    {
      "oportunidad": { ...filtrar_respuesta... },
      "fecha_creacion": "2025-10-02",
      "fecha_cierre": "2025-11-04",
      "estado_al_corte": "5-ganada",
      "dias_pipeline": 33,
      "monto": 150000,
      "moneda": "ARS",
      "kpiKey": "ganadas",
      "bucket": "2025-11"
    }
  ],
  "total": 120,
  "page": 1,
  "perPage": 25
}
```
   - Reutiliza la misma lista `CalculatedOportunidad` (no se recalcula query). Filtra en memoria por `kpiKey`, `stage`, `bucket`, luego aplica ordenamiento y paginado.

### 3.4 Performance, caching y QA
- Query base debe incluir `where(CRMOportunidad.deleted_at.is_(None))` y `Propiedad.deleted_at.is_(None)` si aplica.
- Indices existentes (`idx_crm_oportunidad_estado_fecha`, `idx_crm_oportunidad_tipo_estado`) ayudan para filtros de estado/tipo. Evaluar indice adicional en `CRMOportunidad.created_at` si el volumen crece.
- Agregar cache in-memory (TTL 60s) opcional con `functools.lru_cache` + clave `(startDate, endDate, filtros ordenados)` como en vacancias (revisar si se necesita; dejar hook para configuracion `CACHE_DASHBOARD_CRM`).
- Tests sugeridos:
  1. Unit tests de `_fecha_cierre`, `_monto_estimado`, `_month_span` con escenarios de datos incompletos.
  2. Test funcional `doc/03-devs/20251124-crm_dashboard/test_dashboard_crm.py` replicando `06-test_dashboard_vacancia.py`: verifica KPIs, ranking, y detalle con filtros.
  3. Script manual para data seed (tomar `scripts/seed_crm.py`).

---

## 4. Frontend (React Admin + shadcn)

### 4.1 Estructura
- Nuevo recurso `dashboard-crm` en `frontend/src/app/resources/dashboard-crm/` con archivos:
  - `hooks.ts`  `useCrmDashboard(filters)` (GET `/api/dashboard/crm`) y `useCrmDashboardDetalle(args)` (GET `/api/dashboard/crm/detalle`).
  - `filters.tsx`  barra superior con componentes reutilizables de `dashboard-vacancias` (DateRangePicker, Selects).
  - `KPICards.tsx`, `FunnelChart.tsx`, `MonthlyChart.tsx`, `RankingTable.tsx`, `DetalleDrawer.tsx` siguiendo layout del dashboard de vacancias (cards en grid 2x2, charts en 2 columnas, tabla full width).
  - `list.tsx`  punto de entrada del recurso (React Admin `ListContextProvider` opcional unicamente para permisos, no se usa dataProvider nativo).
- Registrar recurso en `frontend/src/app/AdminApp.tsx`: `<Resource name="dashboard-crm" options={{ label: "CRM Dashboard", icon: BarChart3 }} list={DashboardCRMPage} />`.

### 4.2 Filtros y estado
- Estados controlados en `dashboard-crm/store.ts` (opcional) o `useDashboardFilters` (ya usado en vacancias). Campos:
  - `range`: {startDate, endDate} (por defecto ultimos 30 dias).
  - `tipoOperacionIds`: multi-select (`useReferenceInput` contra `/crm/tipos-operacion`).
  - `tipoPropiedad`: multi-select basado en `propiedades` (traer lista en background).
  - `responsableIds`: multi-select `users`.
  - `propietario`: text input (debounce 400ms).
- Cuando cambian filtros, se dispara `useCrmDashboard` y se invalida `useCrmDashboardDetalle`.

### 4.3 Presentacion de datos
- **Tarjetas KPI**: componente generico (color, valor, variacion). Cada card recibe `onClick(kpiKey)` para abrir `DetalleDrawer` con el dataset correspondiente.
- **Grafico embudo**: usar `@nivo/funnel` o `recharts` `FunnelChart` (igual que vacancias). Mostrar conteo y monto. Etiquetas localizadas (`Abierta`, `Visita`, `Cotiza`, `Reserva`, `Ganada`, `Perdida`).
- **Grafico evolucion**: `AreaChart` multi-serie (`totales`, `nuevas`, `ganadas`). Permitir toggle para mostrar `amount` vs `count` si en payload se proveen ambos (prop `mode`).
- **Ranking**: lista tipo `Card` con info resumida (estado, responsable, propiedad, monto). Boton "Ver todas" abre `DetalleDrawer` en modo ranking.
- **DetalleDrawer**:
  - Tabs por KPI.
  - Tabla RA `Datagrid` Lite con columnas: Oportunidad, Propiedad, Tipo, Estado, Responsable, Montos, Fechas, Probabilidad.
  - Controles: `orderBy`, `orderDir`, `page`, `perPage`, `filter stage`, `filter bucket`.
  - Cargar datos lazy via `useCrmDashboardDetalle` (debounce 200ms) e indicar loading overlay.
- Mostrar `sinMonto` y `sinPropiedad` (cuando payload `stats` > 0) como alertas informativas bajo las KPIs.

### 4.4 Estado y errores
- Manejar `isFetching` para mostrar skeletons en tarjetas/graficos (igual a vacancias).
- Cuando el backend retorna 400, renderizar `Alert` con mensaje `detail.error` y permitir reintentar.
- Guardar los filtros en `localStorage` (clave `dashboard-crm-filters`) para persistencia entre sesiones, replicando logica de `dashboard-vacancias`.

---

## 5. Consultas y definiciones pendientes
1. **Campo monetario por tipo de operacion:** confirmar si siempre existe `CRMOportunidad.monto` o debemos inferir de `propiedad.valor_alquiler` / `precio_venta_estimado`. Se necesita conversion de moneda (tal como se pidio en `20251118_oportunidades_req_dashboard.md`)?
2. **Reaperturas:** si una oportunidad gana, vuelve a abrirse y luego gana nuevamente, se contabiliza cada cierre o solo el primero dentro del periodo? (propuesta actual: primer log `5-ganada` en el rango).
3. **Estado "cerrado" en KPI Totales:** se incluyen perdidas o solo ganadas? (interpretamos "se cerraron" como `ganada` o `perdida`; confirmar).
4. **Filtro `tipoPropiedad`:** el catalogo esta normalizado o debemos trabajar con `Propiedad.tipo` (texto libre)? Si hay catalogos, conviene exponer `propiedades/tipos`.
5. **Selector de moneda para visualizacion:** el requerimiento general de 18/11 contemplaba elegir moneda; este dashboard inicial lo omite. Debe anadirse ahora el selector + conversion usando `cotizaciones`?
6. **Grafico de evolucion mensual:** confirmar si el bucket debe considerar solo las fechas reales (`created_at`/`fecha_ganada`) o si se esperan buckets sin datos para mantener linea continua (vacancias usa bucket "Historico" para previos).
7. **Ranking:** El "Ranking" debe ser unico (top general) o mostrar el conjunto asociado a cada KPI card (actualmente se propone `ranking.totales/nuevas/ganadas` + detalle)?
8. **Permisos / feature flag:** quien puede ver `dashboard-crm`? No hay rol definido; necesitamos confirmacion antes de exponer en produccion.
9. **Timezone:** todo se calcula en UTC actualmente. Se debe ajustar a UTC-3 para cortes diarios? (vacancias no ajusta).
10. **Limites de datos:** se espera mas de 5k oportunidades activas? Si si, evaluar agregar paginacion server-side antes de cargar todos los registros en memoria (actualmente se sigue patron vacancias  carga total y filtra). Confirmar volumen esperado.

Una vez respondidas, actualizar el spec y estimar esfuerzo de backend/frontend/testing para incorporarlo al sprint.
