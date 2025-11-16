# Sistema de Propiedades con Vacancia

**Fecha de implementación:** 14-16 de noviembre, 2025  
**Estado:** ✅ Completado y funcional  
**Versión:** 1.0

## Descripción

Sistema completo de seguimiento de vacancia de propiedades que permite:
- Registrar ciclos de vacancia desde recepción hasta alquiler
- Calcular métricas de tiempo en cada estado
- Generar dashboards con KPIs y análisis temporal
- Aplicar filtros avanzados por estado, propietario, ambientes
- Exportar datos detallados con paginación

## Cambios en Base de Datos

### Tabla `propiedades` (modificada)
- `ambientes`: int (opcional) - Cantidad de ambientes
- `metros_cuadrados`: float (opcional) - Superficie en m²
- `valor_alquiler`: float (opcional) - Valor mensual de alquiler
- `expensas`: float (opcional) - Expensas mensuales
- `fecha_ingreso`: date (opcional) - Fecha original de ingreso
- `vencimiento_contrato`: date (opcional) - Fecha de vencimiento del contrato
- `estado_fecha`: datetime (requerido) - Timestamp del último cambio de estado
- `estado_comentario`: string (opcional) - Comentario sobre el cambio de estado
- `estado`: modificado para usar prefijos numéricos (1-recibida, 2-en_reparacion, etc.)

### Tabla `vacancias` (nueva)
- Campos de auditoría estándar (id, created_at, updated_at, deleted_at, version)
- `propiedad_id`: FK a propiedades
- `ciclo_activo`: bool - Indica si el ciclo está activo
- Fechas por estado: fecha_recibida, fecha_en_reparacion, fecha_disponible, fecha_alquilada, fecha_retirada
- Comentarios por estado: comentario_recibida, comentario_en_reparacion, etc.
- Métricas calculadas: dias_reparacion, dias_disponible, dias_totales

## Estados de Propiedad

1. **1-recibida**: Propiedad recibida, aún no disponible
2. **2-en_reparacion**: En proceso de reparación/acondicionamiento
3. **3-disponible**: Lista para alquilar
4. **4-alquilada**: Alquilada (cierra ciclo de vacancia)
5. **5-retirada**: Retirada del sistema (cierra ciclo sin alquilar)

## Transiciones Válidas

- Desde **1-recibida**: puede ir a 2, 3, o 4 (no puede ir directamente a 5)
- Desde **2-en_reparacion**: solo puede ir a 3 o 5
- Desde **3-disponible**: solo puede ir a 4 o 5
- Desde **4-alquilada**: solo puede ir a 1 (nuevo ciclo) o 5
- **5-retirada**: estado final, sin salida

## Scripts de Migración y Testing

### Scripts de Migración (01-05)

1. **01-migrate_propiedades_estados.py**: Migra estados a formato numérico
2. **02-seed_vacancias.py**: Crea vacancias para propiedades existentes
3. **03-validate_migration.py**: Valida integridad de datos
4. **04-seed_propiedades_ficticias.py**: Genera 20 propiedades de prueba
5. **05-completar_datos_propiedades.py**: Completa campos faltantes

### Scripts de Testing (06-15)

6. **06-test_dashboard_vacancia.py**: Suite completa de tests del dashboard
7. **07-test_manual_dashboard.py**: Test manual con output detallado
8. **08-verificar_datos_db.py**: Verifica datos en base de datos
9. **09-test_vacancias_activas.py**: Test específico de ciclos activos
10. **10-test_servicio_directo.py**: Test del servicio sin HTTP
11. **11-diagnosticar_query.py**: Diagnóstico de queries
12. **12-test_flujo_completo.py**: Test de flujo completo
13. **13-seed_mas_vacancias.py**: Genera 38 propiedades y 65 vacancias adicionales (8 escenarios)
14. **14-test_final_rangos.py**: Test con distintos rangos de fechas
15. **15-test_exhaustivo.py**: Test exhaustivo con 204 combinaciones

### Datos de Prueba Generados

**Totales:**
- 63 propiedades (25 originales + 38 nuevas)
- 106 vacancias (41 originales + 65 nuevas)
- Rango temporal: 2022-2026
- 8 escenarios distintos cubiertos

**Escenarios incluidos:**
1. Ciclos muy cortos (1-7 días)
2. Ciclos muy largos (>365 días)
3. Mucho tiempo en reparación (90-180 días)
4. Poco/sin reparación (0-3 días)
5. Propiedades retiradas
6. Múltiples ciclos históricos (4-6 por propiedad)
7. Variedad de tipos y ambientes
8. Distribución temporal amplia (2022-2026)

### Ejecución en Local

```powershell
# 1. Aplicar migración de Alembic
cd backend
alembic upgrade head

# 2. Migrar estados de propiedades
python ..\doc\03-devs\20251114-propiedades-vacancia\01-migrate_propiedades_estados.py

# 3. Crear vacancias
python ..\doc\03-devs\20251114-propiedades-vacancia\02-seed_vacancias.py

# 4. Validar (opcional)
python ..\doc\03-devs\20251114-propiedades-vacancia\03-validate_migration.py
```

### Ejecución en Producción (NEON)

```powershell
# 1. Conectarse a NEON
$env:DATABASE_URL = "postgresql://sak_owner:tu_password@ep-xyz.neon.tech/sak?sslmode=require"

# 2. Aplicar migración de Alembic
cd backend
alembic upgrade head

# 3. Migrar estados
python ..\doc\03-devs\20251114-propiedades-vacancia\01-migrate_propiedades_estados.py

# 4. Crear vacancias
python ..\doc\03-devs\20251114-propiedades-vacancia\02-seed_vacancias.py

# 5. Validar
python ..\doc\03-devs\20251114-propiedades-vacancia\03-validate_migration.py
```

## Endpoints Disponibles

### 1. Vacancias (CRUD genérico)
- `GET /api/vacancias` - Listar vacancias (soporta expand=propiedad)
- `GET /api/vacancias/{id}` - Obtener vacancia por ID
- `POST /api/vacancias` - Crear vacancia
- `PUT /api/vacancias/{id}` - Actualizar vacancia
- `DELETE /api/vacancias/{id}` - Soft delete de vacancia

### 2. Cambio de Estado de Propiedad
- `POST /api/propiedades/{id}/cambiar-estado`
  - Body: `{"nuevo_estado": "2-en_reparacion", "comentario": "Reparando baño"}`
  - Valida transiciones permitidas
  - Actualiza vacancia automáticamente
  - Cierra ciclo si pasa a 4-alquilada o 5-retirada

### 3. Dashboard de Vacancias ⭐ NUEVO

#### Endpoint Principal
```http
GET /api/dashboard/vacancias
  ?startDate=YYYY-MM-DD         (requerido)
  &endDate=YYYY-MM-DD           (requerido)
  &estadoPropiedad=X-estado     (opcional)
  &propietario=nombre           (opcional)
  &ambientes=N                  (opcional)
  &limitTop=N                   (opcional, default: 5)
  &includeItems=true/false      (opcional, default: false)
```

**Respuesta:**
```json
{
  "range": {
    "startDate": "2025-01-01",
    "endDate": "2025-11-16"
  },
  "kpis": {
    "totalVacancias": 93,
    "promedioDiasTotales": 130.2,
    "promedioDiasReparacion": 17.0,
    "promedioDiasDisponible": 112.6,
    "porcentajeRetiro": 4.3
  },
  "buckets": [
    {
      "bucket": "2025-01",
      "count": 12,
      "dias_totales": 1450.5,
      "dias_reparacion": 180.0,
      "dias_disponible": 1270.5
    }
  ],
  "estados_finales": {
    "activo": 32,
    "alquilada": 57,
    "retirada": 4
  },
  "top": [
    {
      "vacancia": {...},
      "dias_totales": 613,
      "dias_reparacion": 0,
      "dias_disponible": 608,
      "estado_corte": "Activo",
      "bucket": "2024-03"
    }
  ]
}
```

#### Endpoint de Detalle con Paginación
```http
GET /api/dashboard/vacancias/detalle
  ?startDate=YYYY-MM-DD         (requerido)
  &endDate=YYYY-MM-DD           (requerido)
  &page=N                       (opcional, default: 1)
  &perPage=N                    (opcional, default: 25)
  &orderBy=campo                (opcional, default: dias_totales)
  &orderDir=asc/desc            (opcional, default: desc)
  + filtros opcionales de propiedades
```

**Respuesta:**
```json
{
  "data": [...],
  "total": 93,
  "page": 1,
  "perPage": 25
}
```
  - Body: `{"nuevo_estado": "2-en_reparacion", "comentario": "Reparando baño"}`
  - Valida transiciones permitidas
  - Actualiza vacancia automáticamente
  - Cierra ciclo si pasa a 4-alquilada o 5-retirada

## Consultas Útiles

### Ver vacancias activas con propiedades
```
GET /api/vacancias?ciclo_activo__eq=true&expand=propiedad
```

### Ver propiedades disponibles
```
GET /api/propiedades?estado__eq=3-disponible
```

### Ver historial de vacancias de una propiedad
```
GET /api/vacancias?propiedad_id__eq=123&expand=propiedad
```

## Métricas Dinámicas

Las vacancias con `ciclo_activo=true` calculan métricas en tiempo real usando `datetime.utcnow()`:
- `dias_reparacion_calculado`: Días entre fecha_en_reparacion y fecha_disponible (o ahora)
- `dias_disponible_calculado`: Días entre fecha_disponible y fecha_alquilada (o ahora)
- `dias_totales_calculado`: Días totales desde fecha_recibida hasta cierre (o ahora)

Al cerrar un ciclo (estados 4 o 5), estas métricas se guardan en los campos `dias_*` de la tabla.

## Rollback

Si necesitas revertir la migración:

```powershell
cd backend
alembic downgrade -1
```

Esto eliminará la tabla `vacancias` y los nuevos campos de `propiedades`.

## Testing y Validación

### Tests Ejecutados - Todos ✅ PASANDO

**Test exhaustivo (15-test_exhaustivo.py):**
- 204 tests ejecutados
- 100% de tasa de éxito
- Combinaciones probadas:
  - 9 rangos de fechas distintos
  - 6 filtros por estado
  - 7 filtros por ambientes
  - 4 filtros por propietario
  - Múltiples combinaciones simultáneas
  - Casos especiales (rango 1 día, fechas futuras, etc.)
  - Paginación y ordenamiento
  - Validaciones de entrada

**Cobertura:**
- ✅ Endpoint principal con distintos rangos
- ✅ Endpoint detalle con paginación
- ✅ Filtros individuales y combinados
- ✅ Parámetro includeItems
- ✅ KPIs calculados correctamente
- ✅ Buckets temporales
- ✅ Estados finales
- ✅ Ordenamiento (asc/desc por distintos campos)
- ✅ Validaciones de entrada

**Resultado:** Dashboard 100% funcional y robusto

### Ejecución de Tests

```powershell
cd backend

# Suite completa
python ..\doc\03-devs\20251114-propiedades-vacancia\06-test_dashboard_vacancia.py

# Test exhaustivo (204 tests)
python ..\doc\03-devs\20251114-propiedades-vacancia\15-test_exhaustivo.py

# Test con distintos rangos
python ..\doc\03-devs\20251114-propiedades-vacancia\14-test_final_rangos.py
```

## Correcciones Aplicadas

### Issue Crítico Resuelto

**Problema:** Query en `fetch_vacancias_for_dashboard()` retornaba 0 items debido a import incorrecto de `select`.

**Causa:** SQLAlchemy vs SQLModel conflicto - el query retornaba objetos `Row` en lugar de instancias de `Vacancia`.

**Solución aplicada:**

**Archivo:** `backend/app/services/vacancia_dashboard.py`

```python
# Antes:
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlmodel import Session

query = select(Vacancia).options(selectinload(Vacancia.propiedad)).where(...)

# Después:
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select  # ← select de SQLModel

query = select(Vacancia).where(Vacancia.deleted_at.is_(None))
# Sin selectinload - evita problemas con joins

# Join explícito solo cuando hay filtros
if join_propiedad:
    query = query.join(Propiedad, Vacancia.propiedad_id == Propiedad.id, isouter=False)
```

**Resultado:** Dashboard completamente funcional con 93 vacancias procesadas correctamente.

## Documentación Adicional

### Para Desarrolladores
- `20251114_propiedades_vacancia_spec_backend.md` - Especificación técnica backend
- `20251114_propiedades_vacancia_spec_front.md` - Especificación frontend
- `20251114_propiedades_vacancia_req.md` - Requisitos originales
- `CORRECCION_Y_TESTING_COMPLETO.md` - Informe de corrección del dashboard
- `REPORTE_VERIFICACION_DASHBOARD.md` - Reporte de verificación inicial

### Para Usuarios Finales
- `GUIA_USUARIO_DASHBOARD.md` - Guía didáctica del dashboard (ver este documento)

## Notas Importantes

1. **Estados con prefijos numéricos**: Facilitan el ordenamiento y secuencia visual en el frontend
2. **Ciclos cerrados vs activos**: Solo puede haber 1 vacancia activa por propiedad
3. **Reutilización de CRUD**: El endpoint especializado usa `GenericCRUD` para evitar duplicación
4. **Soft deletes**: Las vacancias respetan el sistema de borrado lógico
5. **Auditoría**: Todos los cambios se registran con timestamps y comentarios

## Contacto y Soporte

Para dudas o problemas:
1. Consultar especificaciones técnicas en esta carpeta
2. Revisar logs de testing (scripts 06-15)
3. Verificar endpoint status: `GET /api/dashboard/vacancias/health` (si está implementado)

**Estado del Proyecto:**
- ✅ Backend: 100% funcional
- ✅ Dashboard API: 100% funcional
- ✅ Tests: 204/204 pasando
- ⏳ Frontend: Pendiente de implementación
- ⏳ Deploy a producción: Pendiente

**Última actualización:** 16 de noviembre, 2025
