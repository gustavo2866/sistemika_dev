# 🚀 PLAN DE DEPLOYMENT - Centro de Costo en PRODUCCIÓN

> **Feature:** Agregar Centro de Costo y Precio a Solicitudes  
> **Target:** Base de datos NEON (Producción)  
> **Fecha Plan:** 2025-11-13  
> **Revisión Migración:** `90f5f68df0bf`

---

## 📋 RESUMEN EJECUTIVO

**Cambios a aplicar:**
1. ✅ Crear tabla `centros_costo`
2. ✅ Agregar campos `precio`, `importe` a `solicitud_detalles`
3. ✅ Agregar FK `centro_costo_id` a `solicitudes`
4. ✅ Popular centros de costo desde datos existentes
5. ✅ Crear centros de costo generales (seeds)

**Duración estimada:** 10-15 minutos  
**Downtime requerido:** NO (operaciones compatibles con producción activa)  
**Rollback disponible:** SÍ (función `downgrade()` en migración + restore de backup)  
**Deployment de backend:** Automático via GitHub Actions (no requiere acción manual)

---

## ⚠️ CONSIDERACIONES CRÍTICAS

**Orden de Ejecución (CRÍTICO)**
```
1. BACKUP de tablas afectadas (solicitudes, solicitud_detalles)
2. Ejecutar migración Alembic (90f5f68df0bf)
   └─ Crea tabla centros_costo
   └─ Inserta centro por defecto "Sin Asignar" (ID=1)
   └─ Agrega centro_costo_id como nullable
   └─ Actualiza solicitudes existentes → centro_costo_id = 1
   └─ Hace centro_costo_id NOT NULL
   └─ Crea FK constraint
   └─ Agrega precio/importe a solicitud_detalles
3. Ejecutar script de población (populate_centros_costo.py)
4. Ejecutar script de datos seed (seed_centros_generales.py) - OPCIONAL
5. Validación de deployment (validate_deployment.py)
6. Backend se desplegará automáticamente via GitHub Actions ✅
```

### Riesgos Mitigados
| Riesgo | Mitigación Implementada |
|--------|------------------------|
| Solicitudes sin centro de costo | Migración asigna ID=1 por defecto ANTES de hacer NOT NULL |
| FK constraint violation | Se crea centro "Sin Asignar" ANTES de actualizar solicitudes |
| Pérdida de datos | Campos precio/importe tienen `server_default='0'` |
| Inconsistencia en orden | Script valida migración aplicada antes de popular |

---

## 🔧 PASO 1: PRE-DEPLOYMENT (Local)

### 1.1 Verificación de Migración Local

```powershell
# Verificar que la migración está aplicada en local
cd c:\Users\gpalmieri\source\sistemika\sak\backend
alembic current

# Output esperado:
# 90f5f68df0bf (head)
```

**✅ Estado actual:** Migración `90f5f68df0bf` aplicada en local

### 1.2 Verificar Integridad de Scripts

```powershell
# Verificar que existen los scripts necesarios
dir doc\03-devs\20251111_solicitudes_CentroCosto_req\*.py

# Archivos requeridos:
# ✅ populate_centros_costo.py
# ✅ seed_centros_generales.py (a crear)
```

### 1.3 Testing Local (CRÍTICO)

```powershell
# Ejecutar tests de integración
cd c:\Users\gpalmieri\source\sistemika\sak
pytest doc\03-devs\20251111_solicitudes_CentroCosto_req\test_centro_costo_endpoints.py -v
pytest doc\03-devs\20251111_solicitudes_CentroCosto_req\test_solicitud_centro_costo.py -v

# Todos los tests deben pasar antes de proceder
```

---

## 🗄️ PASO 2: BACKUP DE TABLAS AFECTADAS (PRODUCCIÓN)

### 2.1 Backup Selectivo de Tablas (RECOMENDADO)

**Backup solo de las tablas que se modificarán:**

```powershell
# Definir variables de conexión
$NEON_HOST = "ep-cool-meadow-12345678.us-east-2.aws.neon.tech"
$NEON_USER = "sak_user"
$NEON_DB = "sak_production"
$BACKUP_DATE = (Get-Date -Format "yyyyMMdd_HHmmss")
$BACKUP_FILE = "backup_tables_centro_costo_$BACKUP_DATE.sql"

# Crear directorio de backups si no existe
New-Item -ItemType Directory -Force -Path "doc\03-devs\20251111_solicitudes_CentroCosto_req\backups"

# Backup de tablas afectadas (formato SQL plano para fácil inspección)
pg_dump -h $NEON_HOST -U $NEON_USER -d $NEON_DB `
        --table=solicitudes `
        --table=solicitud_detalles `
        --no-owner --no-privileges `
        --data-only `
        --inserts `
        -f "doc\03-devs\20251111_solicitudes_CentroCosto_req\backups\$BACKUP_FILE"
```

**Alternativa con psql (si no tienes pg_dump local):**

```sql
-- Conectar a NEON con psql o DataGrip y ejecutar:

-- Exportar datos de solicitudes
\copy (SELECT * FROM solicitudes ORDER BY id) TO 'backup_solicitudes_20251113.csv' WITH CSV HEADER;

-- Exportar datos de solicitud_detalles  
\copy (SELECT * FROM solicitud_detalles ORDER BY id) TO 'backup_solicitud_detalles_20251113.csv' WITH CSV HEADER;

-- Contar registros para verificación
SELECT 'solicitudes' as tabla, COUNT(*) as registros FROM solicitudes
UNION ALL
SELECT 'solicitud_detalles', COUNT(*) FROM solicitud_detalles;
```

**Verificar backup creado:**

```powershell
# Ver tamaño del archivo
Get-Item "doc\03-devs\20251111_solicitudes_CentroCosto_req\backups\backup_tables_*.sql" | 
    Select-Object Name, Length, LastWriteTime

# Ver primeras líneas del backup
Get-Content "doc\03-devs\20251111_solicitudes_CentroCosto_req\backups\backup_tables_*.sql" -TotalCount 20
```

### 2.2 Snapshot de NEON (Opcional - Solo si se requiere backup completo)

```bash
# Desde Consola Web NEON:
# 1. Navegar a: Projects > sak_production > Settings > Backups
# 2. Crear snapshot manual: "pre-centro-costo-20251113"
# 3. Anotar Branch ID para posible rollback

# NOTA: NEON mantiene backups automáticos de 7 días, pero un snapshot manual 
# proporciona un punto de restauración garantizado.
```

### 2.3 Registrar Conteos Pre-Migración

```sql
-- Guardar estos números ANTES de migración para verificación posterior
SELECT 
    'solicitudes' as tabla,
    COUNT(*) as total_registros,
    COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as registros_activos,
    MAX(id) as max_id
FROM solicitudes
UNION ALL
SELECT 
    'solicitud_detalles',
    COUNT(*),
    COUNT(CASE WHEN deleted_at IS NULL THEN 1 END),
    MAX(id)
FROM solicitud_detalles;

-- Anotar estos números:
-- solicitudes: ______ registros totales, ______ activos
-- solicitud_detalles: ______ registros totales, ______ activos
```

---

## 🔄 PASO 3: CONECTAR A BASE DE DATOS PRODUCCIÓN

### 3.1 Configurar Variables de Entorno

**Crear archivo `.env.production.local` (temporal, no commitear):**
```bash
# Backend: c:\Users\gpalmieri\source\sistemika\sak\backend\.env.production.local

# Base de datos NEON Producción
DATABASE_URL=postgresql://<NEON_USER>:<NEON_PASSWORD>@<NEON_HOST>/sak_production?sslmode=require

# Ejemplo (REEMPLAZAR con credenciales reales):
DATABASE_URL=postgresql://sak_user:XXXXXXXXXXX@ep-cool-meadow-12345678.us-east-2.aws.neon.tech/sak_production?sslmode=require

# Modo producción
ENVIRONMENT=production
```

### 3.2 Verificar Conexión

```powershell
# Script de verificación de conexión
cd c:\Users\gpalmieri\source\sistemika\sak\backend

# Crear script temporal test_connection_prod.py
$script = @'
import os
from sqlmodel import Session, select, text
from app.db import engine

try:
    with Session(engine) as session:
        result = session.exec(text("SELECT version()")).first()
        print(f"✅ Conexión exitosa a: {result[0][:50]}...")
        
        # Verificar tabla solicitudes
        count = session.exec(text("SELECT COUNT(*) FROM solicitudes")).first()
        print(f"✅ Solicitudes en producción: {count[0]}")
        
        print("\n✅ Base de datos lista para migración")
except Exception as e:
    print(f"❌ Error de conexión: {e}")
'@

Set-Content -Path test_connection_prod.py -Value $script

# Ejecutar con .env.production.local
python test_connection_prod.py
```

**Output esperado:**
```
✅ Conexión exitosa a: PostgreSQL 15.x on x86_64-pc-linux-gnu...
✅ Solicitudes en producción: XX
✅ Base de datos lista para migración
```

---

## 🚀 PASO 4: EJECUTAR MIGRACIÓN ALEMBIC (PRODUCCIÓN)

### 4.1 Pre-Verificación

```powershell
cd c:\Users\gpalmieri\source\sistemika\sak\backend

# Verificar estado actual de migraciones en PRODUCCIÓN
alembic current

# Verificar historial
alembic history
```

**Output esperado:**
```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
b1d5f5c2279f (head)  # Debe ser la revisión anterior a 90f5f68df0bf
```

### 4.2 Ejecutar Migración

```powershell
# CRÍTICO: Ejecutar con .env.production.local configurado
alembic upgrade head

# Salida esperada:
# INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
# INFO  [alembic.runtime.migration] Will assume transactional DDL.
# INFO  [alembic.runtime.migration] Running upgrade b1d5f5c2279f -> 90f5f68df0bf, add centro_costo and update solicitudes
```

### 4.3 Verificación Post-Migración

```powershell
# Verificar migración aplicada
alembic current

# Output esperado:
# 90f5f68df0bf (head)
```

### 4.4 Validación de Cambios en Base de Datos

```sql
-- Conectar a NEON con psql o DataGrip

-- 1. Verificar tabla centros_costo creada
SELECT COUNT(*) FROM centros_costo;
-- Esperado: 1 (el centro "Sin Asignar" creado por la migración)

-- 2. Verificar columnas en solicitud_detalles
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'solicitud_detalles' 
  AND column_name IN ('precio', 'importe');
-- Esperado: 2 filas (precio DECIMAL, importe DECIMAL, ambos NOT NULL)

-- 3. Verificar columna en solicitudes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'solicitudes' 
  AND column_name = 'centro_costo_id';
-- Esperado: 1 fila (centro_costo_id INTEGER NOT NULL)

-- 4. Verificar FK constraint
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'solicitudes'
  AND kcu.column_name = 'centro_costo_id';
-- Esperado: 1 fila (FK a centros_costo.id)

-- 5. Verificar que todas las solicitudes tienen centro_costo_id = 1
SELECT 
    COUNT(*) as total_solicitudes,
    COUNT(centro_costo_id) as con_centro_costo,
    COUNT(CASE WHEN centro_costo_id = 1 THEN 1 END) as con_centro_por_defecto
FROM solicitudes;
-- Esperado: total = con_centro_costo = con_centro_por_defecto
```

---

## 📊 PASO 5: POPULAR CENTROS DE COSTO

### 5.1 Ejecutar Script de Población

```powershell
cd c:\Users\gpalmieri\source\sistemika\sak

# CRÍTICO: Asegurar que usa .env.production.local
python doc\03-devs\20251111_solicitudes_CentroCosto_req\populate_centros_costo.py
```

**Output esperado:**
```
🚀 Iniciando población de centros de costo...
📊 Centros de costo existentes: 1

📋 Procesando propiedades...
  ✅ Creado: Propiedad - Torres del Sol (PROP-0001)
  ✅ Creado: Propiedad - Residencial Las Palmas (PROP-0002)
  ... (X propiedades)

📋 Procesando proyectos...
  ✅ Creado: Proyecto - Remodelación Centro de Servicios (PROY-0001)
  ✅ Creado: Proyecto - Expansión Área Comercial (PROY-0002)
  ... (Y proyectos)

📋 Procesando centros de costo generales...
  ✅ Creado: Administración General (GEN-0001)
  ✅ Creado: Marketing y Ventas (GEN-0002)
  ✅ Creado: Recursos Humanos (GEN-0003)
  ✅ Creado: Infraestructura IT (GEN-0004)

✅ Población completada exitosamente!

📊 Total centros de costo creados: XX
   - Sin Asignar: 1
   - Propiedades: X
   - Proyectos: Y
   - Generales: 4
```

### 5.2 Verificación de Población

```sql
-- Verificar centros de costo creados
SELECT tipo, COUNT(*) as cantidad 
FROM centros_costo 
WHERE deleted_at IS NULL
GROUP BY tipo
ORDER BY tipo;

-- Esperado:
-- General    | 5  (Sin Asignar + 4 generales)
-- Propiedad  | X  (cantidad de propiedades)
-- Proyecto   | Y  (cantidad de proyectos)

-- Verificar que no hay duplicados
SELECT nombre, COUNT(*) 
FROM centros_costo 
GROUP BY nombre 
HAVING COUNT(*) > 1;
-- Esperado: 0 filas (sin duplicados)

-- Ver listado completo
SELECT id, nombre, tipo, codigo_contable, activo
FROM centros_costo
ORDER BY tipo, nombre
LIMIT 20;
```

---

## 🌱 PASO 6: DATOS SEED ADICIONALES (Opcional)

### 6.1 Crear Script de Seeds Generales

**Archivo: `doc\03-devs\20251111_solicitudes_CentroCosto_req\seed_centros_generales.py`**

```python
"""
Script para crear centros de costo generales adicionales si son necesarios
Ejecutar DESPUÉS de populate_centros_costo.py

Ubicación: doc/03-devs/20251111_solicitudes_CentroCosto_req/seed_centros_generales.py
"""
import sys
import os
from pathlib import Path

backend_path = Path(__file__).parent.parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from sqlmodel import Session, select  # type: ignore
from app.db import engine  # type: ignore
from app.models import CentroCosto  # type: ignore

def seed_additional_centros():
    """Crear centros de costo adicionales para casos especiales"""
    with Session(engine) as session:
        print("🌱 Iniciando seed de centros de costo adicionales...")
        
        # Centros adicionales (agregar según necesidad del negocio)
        adicionales = [
            # Tipo Socios
            {
                "nombre": "Socio - Distribución Utilidades",
                "tipo": "Socios",
                "codigo_contable": "SOC-0001",
                "descripcion": "Centro de costo para distribución de utilidades a socios",
                "activo": True
            },
            # Tipo General adicionales
            {
                "nombre": "Mantenimiento y Reparaciones",
                "tipo": "General",
                "codigo_contable": "GEN-0005",
                "descripcion": "Gastos de mantenimiento general y reparaciones",
                "activo": True
            },
            {
                "nombre": "Servicios Públicos",
                "tipo": "General",
                "codigo_contable": "GEN-0006",
                "descripcion": "Gastos de luz, agua, gas y servicios públicos",
                "activo": True
            },
            {
                "nombre": "Seguros y Garantías",
                "tipo": "General",
                "codigo_contable": "GEN-0007",
                "descripcion": "Gastos de seguros y garantías",
                "activo": True
            },
        ]
        
        created = 0
        for data in adicionales:
            # Verificar si ya existe
            existing = session.exec(
                select(CentroCosto).where(CentroCosto.nombre == data["nombre"])
            ).first()
            
            if existing:
                print(f"  ⏭️  Ya existe: {existing.nombre}")
                continue
            
            centro = CentroCosto(**data)
            session.add(centro)
            created += 1
            print(f"  ✅ Creado: {centro.nombre} ({centro.codigo_contable})")
        
        if created > 0:
            session.commit()
            print(f"\n✅ Seed completado: {created} centros adicionales creados")
        else:
            print("\n✅ Todos los centros adicionales ya existían")

if __name__ == "__main__":
    seed_additional_centros()
```

### 6.2 Ejecutar Seeds (Opcional)

```powershell
cd c:\Users\gpalmieri\source\sistemika\sak

# Solo si se necesitan centros adicionales
python doc\03-devs\20251111_solicitudes_CentroCosto_req\seed_centros_generales.py
```

---

## ✅ PASO 7: VERIFICACIÓN POST-DEPLOYMENT

### 7.1 Verificación de Integridad de Datos

```sql
-- 1. Verificar que NO hay solicitudes sin centro de costo
SELECT COUNT(*) 
FROM solicitudes 
WHERE centro_costo_id IS NULL;
-- Esperado: 0

-- 2. Verificar distribución de solicitudes por centro de costo
SELECT 
    cc.nombre,
    cc.tipo,
    COUNT(s.id) as cantidad_solicitudes
FROM centros_costo cc
LEFT JOIN solicitudes s ON s.centro_costo_id = cc.id
GROUP BY cc.id, cc.nombre, cc.tipo
ORDER BY cantidad_solicitudes DESC
LIMIT 10;
-- Verificar que la mayoría está en "Sin Asignar" (ID=1)

-- 3. Verificar campos precio/importe en detalles
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN precio = 0 THEN 1 END) as con_precio_cero,
    COUNT(CASE WHEN importe = 0 THEN 1 END) as con_importe_cero
FROM solicitud_detalles;
-- Esperado: todos con precio=0 e importe=0 (datos migratos)

-- 4. Verificar índices creados
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'centros_costo';
-- Esperado: 3 índices (nombre, tipo, codigo_contable)
```

### 7.2 Verificación de API Endpoints

```powershell
# Iniciar servidor backend (si no está corriendo)
cd c:\Users\gpalmieri\source\sistemika\sak\backend
uvicorn app.main:app --reload --port 8000

# En otra terminal, probar endpoints
```

**Test 1: Listar centros de costo**
```http
GET http://localhost:8000/api/centros-costo
Content-Type: application/json

# Respuesta esperada: 200 OK con lista de centros
```

**Test 2: Filtrar por tipo**
```http
GET http://localhost:8000/api/centros-costo?filter={"tipo":"Propiedad"}

# Respuesta esperada: solo centros tipo Propiedad
```

**Test 3: Crear solicitud con centro de costo**
```http
POST http://localhost:8000/api/solicitudes
Content-Type: application/json

{
  "tipo_solicitud_id": 1,
  "departamento_id": 1,
  "solicitante_id": 1,
  "centro_costo_id": 2,
  "fecha_necesidad": "2025-12-01",
  "comentario": "Test con centro de costo"
}

# Respuesta esperada: 201 Created
```

**Test 4: Obtener solicitud con centro de costo expandido**
```http
GET http://localhost:8000/api/solicitudes/1

# Verificar que response incluye:
# {
#   "id": 1,
#   "centro_costo_id": 1,
#   "centro_costo": {
#     "id": 1,
#     "nombre": "Sin Asignar",
#     "tipo": "General"
#   }
# }
```

### 7.3 Testing Automatizado

```powershell
cd c:\Users\gpalmieri\source\sistemika\sak

# Ejecutar suite de tests contra producción (CUIDADO - usar con precaución)
pytest doc\03-devs\20251111_solicitudes_CentroCosto_req\test_centro_costo_endpoints.py -v --tb=short

# Si tests crean datos, eliminarlos manualmente después
```

---

## 🎯 PASO 8: VALIDACIÓN FINAL

### 9.1 Checklist de Validación

- [ ] Migración `90f5f68df0bf` aplicada en producción
- [ ] Tabla `centros_costo` creada con 1+ registros
- [ ] Todas las solicitudes tienen `centro_costo_id` asignado
- [ ] Campos `precio` e `importe` existen en `solicitud_detalles`
- [ ] FK constraint creada entre `solicitudes` y `centros_costo`
- [ ] Centros de costo de propiedades creados
- [ ] Centros de costo de proyectos creados
- [ ] Centros de costo generales creados
- [ ] Endpoint `/api/centros-costo` funciona
- [ ] Filtros por tipo funcionan
- [ ] Solicitudes retornan `centro_costo` expandido
- [ ] Logs sin errores críticos
- [ ] **Backend se desplegará automáticamente via GitHub Actions** ✅

### 9.2 Verificación de Performance

```sql
-- Verificar tiempo de respuesta de queries con join
EXPLAIN ANALYZE
SELECT s.*, cc.nombre as centro_costo_nombre
FROM solicitudes s
JOIN centros_costo cc ON s.centro_costo_id = cc.id
WHERE s.deleted_at IS NULL
LIMIT 100;

-- Execution Time debe ser < 50ms
```

### 9.3 Monitoreo Post-Deployment

```sql
-- Query para monitorear en las próximas 24h
-- Verificar que no hay errores de FK constraint
SELECT 
    NOW() as timestamp,
    COUNT(*) as total_solicitudes,
    COUNT(DISTINCT centro_costo_id) as centros_usados,
    COUNT(CASE WHEN centro_costo_id = 1 THEN 1 END) as sin_asignar
FROM solicitudes
WHERE deleted_at IS NULL;

-- Ejecutar cada 4 horas y comparar resultados
```

---

## 🔄 ROLLBACK (Solo en caso de emergencia)

### Opción 1: Rollback de Migración Alembic

```powershell
cd c:\Users\gpalmieri\source\sistemika\sak\backend

# Revertir a revisión anterior
alembic downgrade b1d5f5c2279f

# Esto ejecutará:
# - DROP FK constraint
# - DROP COLUMN centro_costo_id de solicitudes
# - DROP COLUMN precio, importe de solicitud_detalles
# - DROP TABLE centros_costo
```

**⚠️ ADVERTENCIA:** Esto eliminará TODOS los centros de costo creados y la asociación con solicitudes. Solo usar si hay error crítico.

### Opción 2: Restaurar desde Backup NEON

```bash
# Restaurar desde snapshot NEON
# Desde consola web:
# 1. Projects > sak_production > Settings > Backups
# 2. Seleccionar snapshot "pre-centro-costo-20251113"
# 3. Click "Restore to branch" o "Restore to main"

# O desde pg_restore:
pg_restore -h <NEON_HOST> \
           -U <NEON_USER> \
           -d sak_production \
           -c \
           backup_pre_centro_costo_20251113.dump
```

### Opción 3: Rollback Parcial (Mantener estructura, limpiar datos)

```sql
-- Si solo se necesita revertir datos pero mantener estructura
BEGIN;

-- Eliminar centros de costo creados (excepto el por defecto)
DELETE FROM centros_costo WHERE id > 1;

-- Resetear todas las solicitudes al centro por defecto
UPDATE solicitudes SET centro_costo_id = 1;

-- Resetear precio/importe a 0
UPDATE solicitud_detalles SET precio = 0, importe = 0;

COMMIT;
```

---

## 📊 MONITOREO POST-DEPLOYMENT (Primeras 48h)

### Métricas a Vigilar

```sql
-- Query 1: Verificar crecimiento de centros de costo
SELECT 
    DATE(created_at) as fecha,
    tipo,
    COUNT(*) as nuevos_centros
FROM centros_costo
WHERE created_at > NOW() - INTERVAL '48 hours'
GROUP BY DATE(created_at), tipo
ORDER BY fecha DESC;

-- Query 2: Verificar uso de centros de costo en nuevas solicitudes
SELECT 
    cc.nombre,
    COUNT(s.id) as solicitudes_nuevas
FROM solicitudes s
JOIN centros_costo cc ON s.centro_costo_id = cc.id
WHERE s.created_at > NOW() - INTERVAL '48 hours'
GROUP BY cc.nombre
ORDER BY solicitudes_nuevas DESC;

-- Query 3: Detectar posibles errores
SELECT 
    COUNT(*) as solicitudes_sin_centro
FROM solicitudes
WHERE centro_costo_id IS NULL
  AND deleted_at IS NULL;
-- Debe ser siempre 0

-- Query 4: Verificar precio/importe en nuevos detalles
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN precio > 0 THEN 1 END) as con_precio,
    AVG(CASE WHEN precio > 0 THEN precio END) as precio_promedio
FROM solicitud_detalles
WHERE created_at > NOW() - INTERVAL '48 hours';
```

---

## 📝 REGISTRO DE DEPLOYMENT

### Información del Deployment

| Campo | Valor |
|-------|-------|
| **Fecha de Deployment** | ________________ |
| **Hora Inicio** | ________________ |
| **Hora Fin** | ________________ |
| **Ejecutado por** | ________________ |
| **Revisión Alembic Aplicada** | `90f5f68df0bf` |
| **Backup ID/Snapshot** | ________________ |
| **Centros de Costo Creados** | ________________ |
| **Solicitudes Migradas** | ________________ |

### Checklist de Ejecución

- [ ] Paso 1: Pre-deployment verificado
- [ ] Paso 2: Backup de BD completado
- [ ] Paso 3: Conexión a producción establecida
- [ ] Paso 4: Migración Alembic ejecutada
- [ ] Paso 5: Script de población ejecutado
- [ ] Paso 6: Seeds adicionales (si aplica)
- [ ] Paso 7: Verificación post-deployment OK
- [ ] Paso 8: Código backend desplegado
- [ ] Paso 9: Validación final completada

### Observaciones

```
Registrar aquí cualquier incidencia, warning o decisión tomada durante el deployment:

_________________________________________________________________________
_________________________________________________________________________
_________________________________________________________________________
```

### Aprobación

| Rol | Nombre | Fecha/Hora | Firma |
|-----|--------|------------|-------|
| **Ejecutor** | _________ | ________ | _____ |
| **Revisor** | _________ | ________ | _____ |

---

## 📞 CONTACTOS DE EMERGENCIA

**En caso de error crítico durante deployment:**

1. **STOP**: No continuar con siguientes pasos
2. **EVALUAR**: Revisar logs y error message
3. **DECIDIR**: 
   - Si es recoverable → Ajustar y continuar
   - Si NO es recoverable → Ejecutar ROLLBACK
4. **COMUNICAR**: Notificar a equipo

**Contactos:**
- Desarrollador Principal: [Nombre] - [Email/Tel]
- DevOps: [Nombre] - [Email/Tel]
- Product Owner: [Nombre] - [Email/Tel]

---

**Estado del Plan:** ✅ READY FOR EXECUTION  
**Última Actualización:** 2025-11-13  
**Próxima Revisión:** Post-deployment (48h después)
