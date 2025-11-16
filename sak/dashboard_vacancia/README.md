# Dashboard de Vacancias - Endpoints y Pruebas

## Endpoints

### 1) KPIs y buckets
- **Ruta:** `GET /api/dashboard/vacancias`
- **Parámetros obligatorios:**  
  - `startDate` (YYYY-MM-DD)  
  - `endDate` (YYYY-MM-DD)
- **Parámetros opcionales:**  
  - `estadoPropiedad` (p.ej. `2-en_reparacion`)  
  - `propietario` (substring case-insensitive)  
  - `ambientes` (entero)  
  - `limitTop` (1-50, default 5)  
  - `includeItems` (bool; si `true` incluye todas las vacancias calculadas, útil para modales)
- **Lógica de selección:** vacancias con `fecha_recibida <= cut` donde `cut = min(endDate, hoy)` y que no hayan cerrado antes de `startDate`.
- **Cálculo por vacancia:** se corta cada ciclo al rango `[startDate, cut]`, se calculan `dias_totales`, `dias_reparacion`, `dias_disponible`, estado al corte (Activo/Alquilada/Retirada) y bucket de inicio (`YYYY-MM` o `Historico` si empezó antes del rango).
- **Respuesta (campos clave):**  
  - `range`: `{ startDate, endDate }`  
  - `kpis`: `totalVacancias`, `promedioDiasTotales`, `promedioDiasReparacion`, `promedioDiasDisponible`, `porcentajeRetiro`  
  - `buckets`: lista de `{ bucket, count, dias_totales, dias_reparacion, dias_disponible }`  
  - `estados_finales`: `{ activo, alquilada, retirada }`  
  - `top`: top N por `dias_totales` con `vacancia` filtrada  
  - `items` (solo si `includeItems=true`): idem top pero con todas las vacancias.

### 2) Detalle paginado
- **Ruta:** `GET /api/dashboard/vacancias/detalle`
- **Parámetros obligatorios:** `startDate`, `endDate`
- **Opcionales:** `estadoPropiedad`, `propietario`, `ambientes`, `page` (>=1), `perPage` (1-200), `orderBy` (`dias_totales|dias_reparacion|dias_disponible`), `orderDir` (`asc|desc`).
- **Respuesta:** `{ data: [...], total, page, perPage }` donde cada item incluye `vacancia` filtrada, `dias_totales`, `dias_reparacion`, `dias_disponible`, `estado_corte`, `bucket`.

## Pruebas manuales (curl/HTTPie)

Ejemplo KPIs con items:
```
curl -s "http://localhost:8000/api/dashboard/vacancias?startDate=2024-01-01&endDate=2024-12-31&includeItems=true"
```

Ejemplo detalle paginado:
```
curl -s "http://localhost:8000/api/dashboard/vacancias/detalle?startDate=2024-01-01&endDate=2024-12-31&page=1&perPage=20&orderBy=dias_totales&orderDir=desc"
```

Checks de consistencia:
- `kpis.totalVacancias` debe coincidir con `items.length` si `includeItems=true`, y con `total` de `/detalle` con mismos filtros.
- Suma de buckets `count` = `totalVacancias`.
- `top` de KPIs debe coincidir con los primeros N (ordenados) de `/detalle` con `orderBy=dias_totales&orderDir=desc`.

## Pruebas automatizadas

Ejecutar:
```
pytest backend/tests/test_vacancia_dashboard.py backend/tests/test_vacancia_dashboard_endpoints.py
```
- `test_vacancia_dashboard.py` valida cálculo por vacancia, bucket histórico y payload.
- `test_vacancia_dashboard_endpoints.py` valida consistencia entre KPIs y detalle (con datos simulados y paginación).

## Problemas comunes
- **400 con `"error": "fecha_recibida"`**: hay vacancias con fechas inválidas o DB sin datos; cargar/migrar datos y asegurar `fecha_recibida` poblada.
- **404 al llamar desde frontend**: usar `NEXT_PUBLIC_API_URL` apuntando al backend (ej. `http://localhost:8000`); el frontend usa `${apiUrl}/api/dashboard/vacancias`.
- **Todo en cero**: normalmente DB sin vacancias en el rango o sin tabla/migraciones; verificar con las llamadas de ejemplo y revisar datos origen.

## Workflow sugerido para validar
1) Verificar health: `curl http://localhost:8000/health`
2) Invocar KPIs con `includeItems=true` en un rango amplio y revisar que `totalVacancias > 0`.
3) Invocar `/detalle` con mismo rango y confirmar que `total` coincide con `kpis.totalVacancias`.
4) Abrir el dashboard en el frontend y corroborar que los valores coinciden con las respuestas anteriores.
