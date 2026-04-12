# Spec — Dashboard de Propiedades

**Ruta destino:** `frontend/src/app/resources/inmobiliaria/prop-dashboard/`  
**Patrón base:** CRM Dashboard (`crm-dashboard`) — split fast + heavy, parallel on filter change  
**Referencia de selectores:** `inmobiliaria/propiedades/panel.tsx` + `propiedades_dashboard.py`

---

## 1. Objetivo

Panel gerencial para el módulo inmobiliario que centraliza el estado de la cartera de propiedades alquiladas, mostrando:

- **KPIs de vacancia** con corte temporal (período seleccionado)
- **Evolución temporal** de la vacancia
- **Selectores de estado** (tarjetas agrupadas por `propiedades_status`)
- **Alertas** para contratos próximos a vencer o renovar
- **Panel de detalle** paginado con infinite scroll

---

## 2. Estructura de archivos

```
frontend/src/app/resources/inmobiliaria/prop-dashboard/
  list.tsx                          ← Página principal (DashboardPropiedadesList)
  model.ts                          ← Tipos TS, constantes, formatters
  use-prop-dashboard.ts             ← Hook raíz (todo el fetching + estado)
  state-helpers.ts                  ← Snapshot sessionStorage, request keys
  return-state.ts                   ← Marcador "volver al dashboard"
  components/
    header/
      DashboardPropHeader.tsx
      use-dashboard-prop-header.ts  ← View-model puro
    primary-filters/
      DashboardPropFilters.tsx
      use-dashboard-prop-filters.ts ← View-model puro
    kpi-row/
      DashboardPropKpiRow.tsx
      use-dashboard-prop-kpi-row.ts ← View-model puro
    main-panel/
      DashboardPropMainPanel.tsx
      use-dashboard-prop-main-panel.ts ← View-model puro

backend/app/
  routers/prop_dashboard_router.py
  services/prop_dashboard.py
```

---

## 3. Estados de propiedad

Referencia: `status_transitions.ts` / `propiedades_status` (tabla DB)

| ID | nombre | orden | Vacancia activa |
|----|--------|-------|-----------------|
| 1 | Recibida | 1 | ✅ Inicio vacancia (`vacancia_fecha = estado_fecha`) |
| 2 | En Reparación | 2 | ✅ Continúa vacancia |
| 3 | Disponible | 3 | ✅ Continúa vacancia |
| 4 | Realizada | 4 | ❌ Fin vacancia (`vacancia_fecha = null`) |
| 5 | Retirada | 5 | — (fuera de cartera activa) |

**Vacancia activa** = `propiedad.vacancia_activa == True` (estados 1, 2, 3)

---

## 4. Lógica de días de vacancia con corte de período

### 4.1 Concepto

Los días de vacancia se calculan con `period_end_date` como fecha de corte, **no con la fecha de hoy**. Esto permite análisis histórico: si selecciono "marzo 2025", los días de vacancia reflejan el estado al 31/03/2025.

```
dias_vacancia_propiedad = period_end_date - vacancia_fecha
```

Aplicable solo si `vacancia_fecha <= period_end_date` y `vacancia_activa == True` (o si la propiedad estuvo vacante en algún momento del período).

### 4.2 Clasificación de vacancias

| Clasificación | Condición |
|---|---|
| **vacancias_periodo** | `vacancia_fecha >= startDate AND vacancia_fecha <= endDate` (iniciaron vacancia dentro del período) |
| **vacancias_anteriores** | `vacancia_fecha < startDate AND vacancia_activa == True` (ya estaban vacantes al inicio del período) |
| **recibidas** | `propiedad_status_id = 1` (snapshot actual al corte del período) |
| **en_reparacion** | `propiedad_status_id = 2` (snapshot actual al corte del período) |
| **disponible** | `propiedad_status_id = 3` (snapshot actual al corte del período) |
| **realizada** | `propiedad_status_id = 4` (snapshot actual al corte del período) |

> **Nota backend:** Para el snapshot "al corte del período" se recomienda usar `PropiedadesLogStatus` para reconstruir el estado que tenía cada propiedad en `period_end_date`. Si no existe log, se usa el estado actual como aproximación.

### 4.3 Métricas por KPI

Cada KPI expone:
- `count`: cantidad de propiedades
- `dias_vacancia_promedio`: promedio de `period_end_date - vacancia_fecha` para el grupo (solo propiedades con vacancia activa)
- `dias_vacancia_total`: suma total de días de vacancia del grupo
- `variacion_vs_anterior`: delta de `count` respecto al período anterior (%)

---

## 5. Backend — Endpoints

Todos bajo prefijo **`/api/dashboard/propiedades`**

### 5.1 `GET /bundle`

**Parámetros:**
| Param | Tipo | Descripción |
|---|---|---|
| `startDate` | `date` | Inicio del período (`YYYY-MM-DD`) |
| `endDate` | `date` | Fin del período (`YYYY-MM-DD`) |
| `tipoOperacionId` | `int \| "todos"` | Filtro tipo operación |
| `emprendimientoId` | `int \| "todos"` | Filtro emprendimiento |
| `periodType` | `str` | `mes \| trimestre \| semestre \| anio` (para cálculo de período anterior) |
| `trendSteps` | `str` | Ej: `-3,-2,-1,0` — pasos para evolución temporal |
| `previousStep` | `str` | Ej: `-1` — paso para período anterior |

**Respuesta:**
```json
{
  "current": { ...PropDashboardResponse },
  "previous": { ...PropDashboardResponse },
  "trend": [
    { "bucket": "Ene 2025", "total_vacantes": 12, "nuevas": 3, "resueltas": 2, "promedio_dias": 28 },
    ...
  ]
}
```

**`PropDashboardResponse` schema:**
```json
{
  "range": { "startDate": "2025-01-01", "endDate": "2025-03-31" },
  "filters": { "tipoOperacionId": "todos", "emprendimientoId": "todos" },
  "kpis": {
    "vacancias_periodo": {
      "count": 5,
      "dias_vacancia_promedio": 22.4,
      "dias_vacancia_total": 112,
      "variacion_vs_anterior": 10.0
    },
    "vacancias_anteriores": { "count": 8, "dias_vacancia_promedio": 45.2, "dias_vacancia_total": 362, "variacion_vs_anterior": -5.0 },
    "recibidas":      { "count": 3, "dias_vacancia_promedio": 12.0, "dias_vacancia_total": 36 },
    "en_reparacion":  { "count": 4, "dias_vacancia_promedio": 18.5, "dias_vacancia_total": 74 },
    "disponible":     { "count": 6, "dias_vacancia_promedio": 31.0, "dias_vacancia_total": 186 },
    "realizada":      { "count": 22 }
  },
  "period_summary": {
    "activas_inicio": 13,
    "activas_fin": 13,
    "netas": 0,
    "nuevas_vacancias": 5,
    "vacancias_resueltas": 3
  },
  "selectors": {
    "recibida":      { "count": 3 },
    "en_reparacion": { "count": 4 },
    "disponible":    { "count": 6 },
    "realizada":     { "count": 22, "vencimiento_lt_60": 4, "renovacion_lt_60": 2 },
    "retirada":      { "count": 5, "lt_30": 2, "gt_30": 3 }
  },
  "alerts": {
    "vencimiento_lt_60": 4,
    "renovacion_lt_60": 2
  },
  "stats": { "sin_vacancia_fecha": 1, "sin_tipo_operacion": 0 }
}
```

### 5.2 `GET /selectors`

Consulta SQL aggregada rápida (sin cargar logs). Snapshot al momento exacto de la consulta.

**Parámetros:** `tipoOperacionId`, `emprendimientoId`, `pivotDate` (opcional, default=today)

**Respuesta:**
```json
{
  "recibida":      { "count": 3 },
  "en_reparacion": { "count": 4 },
  "disponible":    { "count": 6 },
  "realizada":     { "count": 22, "vencimiento_lt_60": 4, "renovacion_lt_60": 2 },
  "retirada":      { "count": 5, "lt_30": 2, "gt_30": 3 }
}
```

**Lógica de sub-buckets (igual que `propiedades/panel.tsx`):**
- `vencimiento_lt_60`: `propiedad_status = Realizada` AND `0 ≤ (vencimiento_contrato - pivotDate) < 60`
- `renovacion_lt_60`: `propiedad_status = Realizada` AND `0 ≤ (fecha_renovacion - pivotDate) < 60`
- `lt_30`: `propiedad_status = Retirada` AND `estado_fecha >= pivotDate - 30`
- `gt_30`: `propiedad_status = Retirada` AND `estado_fecha < pivotDate - 30`

### 5.3 `GET /detalle`

Lista paginada para una tarjeta de selector activada.

**Parámetros:** `selectorKey` (`recibida | en_reparacion | disponible | realizada | retirada`), `subBucket` (opcional: `vencimiento_lt_60 | renovacion_lt_60 | lt_30 | gt_30`), `page`, `pageSize`, filtros de fecha y tipo operación.

**Respuesta:**
```json
{
  "data": [
    {
      "propiedad_id": 12,
      "nombre": "Depto 3A",
      "propietario": "Juan Pérez",
      "tipo_propiedad": "Departamento",
      "estado": "Disponible",
      "vacancia_fecha": "2025-01-15",
      "dias_vacancia": 45,
      "vencimiento_contrato": null,
      "fecha_renovacion": null,
      "valor_alquiler": 180000
    }
  ],
  "total": 6,
  "page": 1,
  "perPage": 15
}
```

### 5.4 `GET /detalle-alerta`

Lista paginada específica para las alertas de vencimiento/renovación.

**Parámetros:** `alertKey` (`vencimiento_lt_60 | renovacion_lt_60`), `page`, `pageSize`, filtros.

**Respuesta:** igual que `/detalle` pero con campos `dias_para_vencimiento` y `dias_para_renovacion`.

---

## 6. Frontend — Flujo de carga

Igual que CRM Dashboard (`useCrmDashboard`):

### 6.1 On mount / cambio de filtros (`dashboardRequestKey`)

Se disparan **en paralelo**:

1. `GET /selectors` → rápido, popula las tarjetas de estado de inmediato
2. `GET /bundle` → completo, popula KPIs, evolución, period_summary, alerts

### 6.2 On cambio de detalle (`detailRequestKey`)

Se dispara según la selección activa:

- Si hay selector activo (sin alerta): `GET /detalle?selectorKey=...&subBucket=...&page=...`
- Si hay alerta activa: `GET /detalle-alerta?alertKey=...&page=...`
- Infinite scroll: páginas se acumulan (`[...prev, ...newItems]`), `hasMoreDetail` controla el botón "Cargar más"

### 6.3 On return desde edición

- Antes de navegar: snapshot del estado completo → `sessionStorage`
- Al volver (dentro de TTL): hidratar snapshot, evitar refetch
- Post-hidratación: re-fetch de `/selectors` para verificar conteos actualizados

---

## 7. Hook raíz — `usePropDashboard`

```typescript
// Estado central
periodType: PeriodType                  // mes | trimestre | semestre | anio
filters: PropDashboardFilters           // { startDate, endDate, tipoOperacionId, emprendimientoId }
dashboardData: PropDashboardResponse | null
dashboardLoading: boolean
selectorData: PropSelectorResponse | null  // fast selector data
selectorLoading: boolean

// Panel de detalle
activeSelectorKey: PropSelectorKey | null   // recibida | en_reparacion | disponible | realizada | retirada
activeSubBucket: string | null             // vencimiento_lt_60 | renovacion_lt_60 | lt_30 | gt_30
activeAlertKey: PropAlertKey | null        // vencimiento_lt_60 | renovacion_lt_60
detailData: PropDetallePaginado | null
detailLoading: boolean
detailPage: number
hasMoreDetail: boolean

// Acciones
setFilters(f: PropDashboardFilters): void
setPeriodType(p: PeriodType): void
setActiveSelectorKey(k: PropSelectorKey | null, sub?: string): void
setActiveAlertKey(k: PropAlertKey | null): void
loadMoreDetail(): void
```

---

## 8. Componentes UI

### 8.1 Jerarquía

```
DashboardPropiedadesList (list.tsx)
  └── usePropDashboard()                     ← hub central de datos
  └── DashboardPropHeader
        └── useDashboardPropHeader()         ← view-model puro
            - PeriodRangeNavigator           ← selector de período (reutilizable)
            - Filtros rápidos (tipo operación, emprendimiento)
  └── DashboardPropKpiRow
        └── useDashboardPropKpiRow()
            - 6 KPI cards en fila:
              vacancias_periodo | vacancias_anteriores | recibidas | en_reparacion | disponible | realizada
            - Gráfico de evolución temporal (evolucion[])
  └── DashboardPropMainPanel
        └── useDashboardPropMainPanel()
            - Columna izquierda: Selector cards (5 estados + sub-buckets)
            - Columna derecha: Alert cards (vencimiento_lt_60, renovacion_lt_60) + Detalle paginado
```

### 8.2 KPI Cards

Cada card muestra:
- **Título** del KPI
- **Count** (número grande principal)
- **Días de vacancia promedio** (sub-métrica)
- **Variación vs período anterior** (flecha + porcentaje, solo en vacancias_periodo y vacancias_anteriores)

| KPI key | Título | Sub-métrica |
|---|---|---|
| `vacancias_periodo` | "Vacancias del período" | Prom. días + Δ vs anterior |
| `vacancias_anteriores` | "Vacancias anteriores" | Prom. días + Δ vs anterior |
| `recibidas` | "Recibidas" | Prom. días desde recepción |
| `en_reparacion` | "En reparación" | Prom. días en reparación |
| `disponible` | "Disponible" | Prom. días disponible |
| `realizada` | "Realizadas" | — (sin días vacancia) |

### 8.3 Selector Cards (igual que `propiedades/panel.tsx`)

| Selector | Sub-buckets | Icono sugerido |
|---|---|---|
| Recibida (azul) | — | `Home` |
| En Reparación (ámbar) | — | `Wrench` |
| Disponible (verde) | — | `CheckCircle` |
| Realizada (violeta) | `Vencimiento <60d` badge rojo, `Renovación <60d` badge naranja | `Key` |
| Retirada (rojo) | `<30 días` / `>30 días` | `X` |

Al hacer click en una card (o sub-bucket) se activa el panel de detalle filtrando por ese estado/sub-bucket.

### 8.4 Alert Cards

Separadas de los selectores, posicionadas sobre el panel de detalle:

| Alert key | Título | Umbral | Color |
|---|---|---|---|
| `vencimiento_lt_60` | "Vencimientos próximos" | < 60 días | Rojo |
| `renovacion_lt_60` | "Renovaciones próximas" | < 60 días | Naranja |

Al hacer click en una alert card se activa `activeAlertKey` y el detalle carga `/detalle-alerta`.

### 8.5 Panel de detalle (columna derecha)

Tabla con infinite scroll mostrando:
- Nombre propiedad → link a edición
- Propietario
- Estado actual (badge)
- Días de vacancia
- Fecha vacancia inicio
- Vencimiento contrato (si aplica)
- Valor alquiler

---

## 9. Tipos TypeScript clave (`model.ts`)

```typescript
export type PropSelectorKey = "recibida" | "en_reparacion" | "disponible" | "realizada" | "retirada";
export type PropAlertKey = "vencimiento_lt_60" | "renovacion_lt_60";
export type PropKpiKey = "vacancias_periodo" | "vacancias_anteriores" | "recibidas" | "en_reparacion" | "disponible" | "realizada";

export type PropKpiData = {
  count: number;
  dias_vacancia_promedio: number;
  dias_vacancia_total: number;
  variacion_vs_anterior?: number;
};

export type PropSelectorCard = {
  key: PropSelectorKey;
  count: number;
  // Sub-buckets opcionales
  vencimiento_lt_60?: number;
  renovacion_lt_60?: number;
  lt_30?: number;
  gt_30?: number;
};

export type PropDashboardFilters = {
  startDate: string;
  endDate: string;
  tipoOperacionId: string;
  emprendimientoId: string;
};

export type PropTrendPoint = {
  bucket: string;            // Ej: "Ene 2025"
  total_vacantes: number;
  nuevas: number;
  resueltas: number;
  promedio_dias: number;
};

export type PropDetalleItem = {
  propiedad_id: number;
  nombre: string;
  propietario: string | null;
  tipo_propiedad: string | null;
  estado: string;
  vacancia_fecha: string | null;
  dias_vacancia: number;
  vencimiento_contrato: string | null;
  fecha_renovacion: string | null;
  valor_alquiler: number | null;
  dias_para_vencimiento?: number | null;
  dias_para_renovacion?: number | null;
};
```

---

## 10. Backend — Servicios (`prop_dashboard.py`)

### Funciones principales

#### `build_prop_dashboard_bundle(session, start_date, end_date, tipo_operacion_id, emprendimiento_id, period_type, trend_steps, previous_step)`

1. Llama a `_build_period(session, start_date, end_date, ...)` → `PropDashboardResponse` para el período actual
2. Calcula `prev_start, prev_end` según `period_type` y `previous_step`
3. Llama a `_build_period(session, prev_start, prev_end, ...)` → período anterior
4. Llama a `_build_trend(session, trend_steps, period_type, ...)` → array de `PropTrendPoint`
5. Retorna `{ current, previous, trend }`

#### `_build_period(session, start_date, end_date, tipo_operacion_id, emprendimiento_id) → PropDashboardResponse`

```python
# 1. Query base: propiedades con sus status y vacancia_fecha
q = (
    session.query(Propiedad, PropiedadesStatus)
    .join(PropiedadesStatus, Propiedad.propiedad_status_id == PropiedadesStatus.id)
    .filter(Propiedad.tipo_operacion_id == tipo_operacion_id)  # si aplica
    .filter(Propiedad.emprendimiento_id == emprendimiento_id)  # si aplica
    .all()
)

# 2. Para cada propiedad, calcular dias_vacancia al corte del período
for propiedad, status in q:
    if propiedad.vacancia_fecha:
        cut = end_date  # corte al fin del período
        dias = max(0, (cut - propiedad.vacancia_fecha).days)
    ...

# 3. Clasificar en KPI keys usando vacancia_fecha vs start_date/end_date
# 4. Calcular promedio por grupo
# 5. Calcular selectors (counts por status + sub-buckets para realizada/retirada)
# 6. Calcular alerts (vencimiento_lt_60, renovacion_lt_60 vs end_date)
# 7. Calcular period_summary (activas al inicio, activas al fin, netas)
```

**Lógica period_summary:**
- `activas_inicio` = propiedades con `vacancia_fecha <= start_date` y (`realizada_fecha > start_date` OR aún vacantes)
- `activas_fin` = propiedades con `vacancia_activa == True` al corte de `end_date` (o `vacancia_fecha <= end_date` y sin fecha realizada)
- `nuevas_vacancias` = `len(vacancias_periodo)`
- `vacancias_resueltas` = propiedades que pasaron a Realizada durante el período

#### `build_prop_selectors(session, tipo_operacion_id, emprendimiento_id, pivot_date) → dict`

SQL aggregado puro, sin ORM pesado:
```sql
SELECT ps.nombre, COUNT(p.id) as total
FROM propiedades p
JOIN propiedades_status ps ON p.propiedad_status_id = ps.id
WHERE p.tipo_operacion_id = :tipo_op  -- si aplica
GROUP BY ps.nombre, ps.orden
ORDER BY ps.orden
```

Sub-buckets inline:
```sql
-- vencimiento_lt_60
SELECT COUNT(*) FROM propiedades p
JOIN propiedades_status ps ON p.propiedad_status_id = ps.id
WHERE ps.nombre = 'Realizada'
  AND p.vencimiento_contrato >= :pivot
  AND p.vencimiento_contrato < :pivot + 60 days

-- renovacion_lt_60
SELECT COUNT(*) FROM propiedades p
JOIN propiedades_status ps ON p.propiedad_status_id = ps.id
WHERE ps.nombre = 'Realizada'
  AND p.fecha_renovacion >= :pivot
  AND p.fecha_renovacion < :pivot + 60 days
  AND p.fecha_renovacion <= p.vencimiento_contrato  -- no posterior al vencimiento
```

#### `build_prop_detalle(session, selector_key, sub_bucket, page, page_size, ...) → PropDetallePaginado`

Filtra propiedades según `selector_key` → `propiedad_status.nombre`, aplica sub-bucket si hay, pagina y retorna `PropDetalleItem[]`.

#### `build_prop_detalle_alerta(session, alert_key, page, page_size, pivot_date, ...) → PropDetallePaginado`

- `vencimiento_lt_60`: filtra Realizadas con `0 ≤ (vencimiento_contrato - pivot_date) < 60`
- `renovacion_lt_60`: filtra Realizadas con `0 ≤ (fecha_renovacion - pivot_date) < 60`

---

## 11. Router (`prop_dashboard_router.py`)

```python
router = APIRouter(prefix="/api/dashboard/propiedades", tags=["prop-dashboard"])

@router.get("/bundle")
async def get_bundle(
    startDate: date,
    endDate: date,
    tipoOperacionId: str = "todos",
    emprendimientoId: str = "todos",
    periodType: str = "trimestre",
    trendSteps: str = "-3,-2,-1,0",
    previousStep: str = "-1",
    session: Session = Depends(get_db),
):
    ...

@router.get("/selectors")
async def get_selectors(
    tipoOperacionId: str = "todos",
    emprendimientoId: str = "todos",
    pivotDate: Optional[date] = None,
    session: Session = Depends(get_db),
):
    ...

@router.get("/detalle")
async def get_detalle(
    selectorKey: str,
    subBucket: Optional[str] = None,
    page: int = 1,
    pageSize: int = 15,
    startDate: Optional[date] = None,
    endDate: Optional[date] = None,
    tipoOperacionId: str = "todos",
    emprendimientoId: str = "todos",
    session: Session = Depends(get_db),
):
    ...

@router.get("/detalle-alerta")
async def get_detalle_alerta(
    alertKey: str,
    page: int = 1,
    pageSize: int = 15,
    tipoOperacionId: str = "todos",
    emprendimientoId: str = "todos",
    pivotDate: Optional[date] = None,
    session: Session = Depends(get_db),
):
    ...
```

---

## 12. Filtros disponibles (header)

| Filtro | Tipo | Notas |
|---|---|---|
| Período | `PeriodRangeNavigator` | mes / trimestre / cuatrimestre / semestre / año |
| Tipo Operación | Select | Catálogo `/crm/catalogos/tipos-operacion` (excluye mantenimiento) |
| Emprendimiento | Select | Catálogo `/emprendimientos` |

---

## 13. Consideraciones de implementación

### Día de corte del período

El campo `vacancia_fecha` en la tabla `propiedades` marca el inicio de la vacancia al entrar en estado "Recibida". El cálculo de días de vacancia al corte del período es:

```python
dias = max(0, (end_date - propiedad.vacancia_fecha).days)
```

Si la propiedad se **realizó** dentro del período (ya no está vacante al corte), se puede usar `PropiedadesLogStatus` para conocer la fecha exacta de cierre de vacancia y calcular los días reales dentro del período:

```python
# Si há log de transición a Realizada dentro del período
dias = (fecha_realizacion - vacancia_fecha).days
```

### Período anterior (comparativa)

El cálculo del período anterior sigue el mismo patrón que CRM dashboard: desplazar `start_date` y `end_date` N meses hacia atrás según `period_type`.

### Registro en AdminApp y Sidebar

- Registrar la ruta en `frontend/src/app/admin/AdminApp.tsx`
- Agregar item en `frontend/src/components/app-sidebar.tsx` bajo sección Inmobiliaria

### Reutilización de componentes

- `PeriodRangeNavigator` — reutilizar del CRM dashboard
- `SectionBaseTemplate`, `ListText`, `ListDate`, `ListEstado` — reutilizar de `form_order`
- Badge colors para estados: reutilizar `PROPIEDAD_STATUS_BADGES` de `propiedades/model.tsx`

---

## 14. Diagrama de flujo de datos

```
┌─────────────────────────────────────────────────────┐
│                 DashboardPropiedadesList              │
│                  usePropDashboard()                   │
│                                                       │
│  onChange(filters/period)                             │
│  ┌──────────────────┐    ┌────────────────────────┐  │
│  │ GET /selectors   │    │ GET /bundle             │  │
│  │ (rápido, SQL ag) │    │ { current, prev, trend }│  │
│  │ → selectorData   │    │ → dashboardData         │  │
│  └──────────────────┘    └────────────────────────┘  │
│                                                       │
│  onChange(activeSelector/subBucket/alertKey/page)     │
│  ┌──────────────────────────────────────────────────┐ │
│  │ GET /detalle  OR  GET /detalle-alerta            │ │
│  │ → detailData (acumulado por página)              │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
           │              │               │
    KpiRow panel    MainPanel         Header
  (view-model puro) (view-model puro) (view-model puro)
```
