# 🔍 COMANDOS DE VERIFICACIÓN - Deployment Centro de Costo

> Quick reference para verificar el deployment de Centro de Costo en producción

---

## 🗄️ VERIFICACIONES DE BASE DE DATOS

### 1. Verificar Migración Aplicada

```powershell
# Desde backend/
cd c:\Users\gpalmieri\source\sistemika\sak\backend
alembic current
```

**Output esperado:**
```
90f5f68df0bf (head)
```

---

### 2. Verificar Tabla centros_costo

```sql
-- Verificar estructura
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'centros_costo'
ORDER BY ordinal_position;

-- Contar registros
SELECT COUNT(*) FROM centros_costo WHERE deleted_at IS NULL;

-- Ver primeros registros
SELECT id, nombre, tipo, codigo_contable, activo 
FROM centros_costo 
WHERE deleted_at IS NULL
LIMIT 10;

-- Distribución por tipo
SELECT tipo, COUNT(*) as cantidad 
FROM centros_costo 
WHERE deleted_at IS NULL
GROUP BY tipo 
ORDER BY tipo;
```

**Output esperado (distribución):**
```
tipo       | cantidad
-----------|----------
General    | 5-11
Propiedad  | X
Proyecto   | Y
Socios     | 0-1
```

---

### 3. Verificar Campos en solicitud_detalles

```sql
-- Verificar columnas precio e importe
SELECT 
    column_name, 
    data_type, 
    numeric_precision, 
    numeric_scale,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'solicitud_detalles' 
  AND column_name IN ('precio', 'importe');

-- Verificar valores
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN precio = 0 THEN 1 END) as precio_cero,
    COUNT(CASE WHEN importe = 0 THEN 1 END) as importe_cero,
    COUNT(CASE WHEN precio IS NULL THEN 1 END) as precio_null,
    COUNT(CASE WHEN importe IS NULL THEN 1 END) as importe_null
FROM solicitud_detalles;
```

**Output esperado:**
```
total | precio_cero | importe_cero | precio_null | importe_null
------|-------------|--------------|-------------|-------------
  XXX |     XXX     |     XXX      |      0      |      0
```

---

### 4. Verificar Campo centro_costo_id en solicitudes

```sql
-- Verificar columna
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'solicitudes' 
  AND column_name = 'centro_costo_id';

-- Verificar FK constraint
SELECT 
    tc.constraint_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'solicitudes'
  AND kcu.column_name = 'centro_costo_id';

-- Verificar valores
SELECT 
    COUNT(*) as total_solicitudes,
    COUNT(centro_costo_id) as con_centro_costo,
    COUNT(CASE WHEN centro_costo_id IS NULL THEN 1 END) as sin_centro_costo,
    COUNT(CASE WHEN centro_costo_id = 1 THEN 1 END) as con_sin_asignar
FROM solicitudes
WHERE deleted_at IS NULL;
```

**Output esperado:**
```
total_solicitudes | con_centro_costo | sin_centro_costo | con_sin_asignar
------------------|------------------|------------------|----------------
       XXX        |       XXX        |        0         |      XXX
```

---

### 5. Verificar Índices Creados

```sql
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'centros_costo'
ORDER BY indexname;
```

**Output esperado:**
```
indexname                        | indexdef
---------------------------------|------------------------------------------
centros_costo_pkey              | CREATE UNIQUE INDEX ... ON centros_costo USING btree (id)
ix_centros_costo_codigo_contable| CREATE INDEX ... ON centros_costo USING btree (codigo_contable)
ix_centros_costo_nombre         | CREATE UNIQUE INDEX ... ON centros_costo USING btree (nombre)
ix_centros_costo_tipo           | CREATE INDEX ... ON centros_costo USING btree (tipo)
```

---

## 🌐 VERIFICACIONES DE API

### 1. Listar Centros de Costo

```bash
# Windows PowerShell
Invoke-RestMethod -Uri "http://localhost:8000/api/centros-costo" -Method Get | ConvertTo-Json -Depth 3

# Bash/curl
curl -X GET "http://localhost:8000/api/centros-costo" | jq
```

**Output esperado:** Array con 10-20+ centros de costo

---

### 2. Filtrar por Tipo

```bash
# PowerShell
$filter = @{tipo="General"} | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "http://localhost:8000/api/centros-costo?filter=$filter" -Method Get

# curl
curl -X GET "http://localhost:8000/api/centros-costo?filter=%7B%22tipo%22%3A%22General%22%7D"
```

**Output esperado:** Solo centros tipo "General"

---

### 3. Obtener Solicitud con Centro de Costo

```bash
# PowerShell
Invoke-RestMethod -Uri "http://localhost:8000/api/solicitudes/1" -Method Get | ConvertTo-Json -Depth 3

# curl
curl -X GET "http://localhost:8000/api/solicitudes/1" | jq
```

**Verificar en response:**
```json
{
  "id": 1,
  "centro_costo_id": 1,
  "centro_costo": {
    "id": 1,
    "nombre": "Sin Asignar",
    "tipo": "General",
    "codigo_contable": "GEN-0000"
  }
}
```

---

### 4. Crear Solicitud con Centro de Costo

```bash
# PowerShell
$body = @{
    tipo_solicitud_id = 1
    departamento_id = 1
    solicitante_id = 1
    centro_costo_id = 2
    fecha_necesidad = "2025-12-01"
    comentario = "Test deployment"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/api/solicitudes" `
    -Method Post `
    -Body $body `
    -ContentType "application/json"

# curl
curl -X POST "http://localhost:8000/api/solicitudes" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo_solicitud_id": 1,
    "departamento_id": 1,
    "solicitante_id": 1,
    "centro_costo_id": 2,
    "fecha_necesidad": "2025-12-01",
    "comentario": "Test deployment"
  }'
```

**Output esperado:** Status 201 Created

---

## 🐍 VERIFICACIONES CON PYTHON

### Script de Verificación Rápida

```python
# Guardar como: verify_quick.py
# Ejecutar desde: sak/

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from sqlmodel import Session, select, text
from app.db import engine
from app.models import CentroCosto, Solicitud, SolicitudDetalle

def verify():
    with Session(engine) as session:
        # 1. Contar centros de costo
        centros = session.exec(select(CentroCosto)).all()
        print(f"✅ Centros de costo: {len(centros)}")
        
        # 2. Verificar centro "Sin Asignar"
        sin_asignar = session.exec(
            select(CentroCosto).where(CentroCosto.id == 1)
        ).first()
        print(f"✅ Centro 'Sin Asignar': {sin_asignar.nombre if sin_asignar else 'NO EXISTE'}")
        
        # 3. Verificar solicitudes sin centro
        sin_centro = session.exec(
            select(Solicitud).where(Solicitud.centro_costo_id.is_(None))
        ).all()
        print(f"✅ Solicitudes sin centro: {len(sin_centro)} (debe ser 0)")
        
        # 4. Verificar relación funciona
        solicitud = session.exec(select(Solicitud).limit(1)).first()
        if solicitud:
            print(f"✅ Relación funciona: {solicitud.centro_costo.nombre}")
        
        # 5. Distribución por tipo
        tipos = session.exec(text("""
            SELECT tipo, COUNT(*) 
            FROM centros_costo 
            WHERE deleted_at IS NULL
            GROUP BY tipo
        """)).all()
        print("\n📊 Distribución por tipo:")
        for tipo, count in tipos:
            print(f"   - {tipo}: {count}")

if __name__ == "__main__":
    verify()
```

**Ejecución:**
```powershell
cd c:\Users\gpalmieri\source\sistemika\sak
python verify_quick.py
```

---

## 🧪 TESTS AUTOMATIZADOS

### Ejecutar Suite de Tests

```powershell
cd c:\Users\gpalmieri\source\sistemika\sak

# Tests de modelo
pytest doc\03-devs\20251111_solicitudes_CentroCosto_req\test_centro_costo_models.py -v

# Tests de endpoints (requiere servidor corriendo)
pytest doc\03-devs\20251111_solicitudes_CentroCosto_req\test_centro_costo_endpoints.py -v

# Tests de integración
pytest doc\03-devs\20251111_solicitudes_CentroCosto_req\test_solicitud_centro_costo.py -v

# Todos los tests
pytest doc\03-devs\20251111_solicitudes_CentroCosto_req\test_*.py -v
```

---

## 🚨 VERIFICACIÓN DE PROBLEMAS COMUNES

### Problema 1: Solicitudes sin centro_costo_id

```sql
-- Detectar
SELECT id, tipo_solicitud_id, fecha_necesidad 
FROM solicitudes 
WHERE centro_costo_id IS NULL 
  AND deleted_at IS NULL
LIMIT 10;

-- Solución
UPDATE solicitudes 
SET centro_costo_id = 1 
WHERE centro_costo_id IS NULL;
```

---

### Problema 2: Centro "Sin Asignar" no existe

```sql
-- Verificar
SELECT * FROM centros_costo WHERE id = 1;

-- Solución (si no existe)
INSERT INTO centros_costo (id, nombre, tipo, codigo_contable, descripcion, activo, created_at, updated_at, version)
VALUES (1, 'Sin Asignar', 'General', 'GEN-0000', 'Centro de costo por defecto', TRUE, NOW(), NOW(), 1);
```

---

### Problema 3: FK constraint falla

```sql
-- Verificar constraint
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'solicitudes' 
  AND constraint_type = 'FOREIGN KEY'
  AND constraint_name LIKE '%centro_costo%';

-- Si no existe, recrear
ALTER TABLE solicitudes 
ADD CONSTRAINT fk_solicitudes_centro_costo 
FOREIGN KEY (centro_costo_id) REFERENCES centros_costo(id);
```

---

### Problema 4: Índices faltantes

```sql
-- Verificar índices
SELECT indexname FROM pg_indexes WHERE tablename = 'centros_costo';

-- Recrear si faltan
CREATE UNIQUE INDEX IF NOT EXISTS ix_centros_costo_nombre ON centros_costo(nombre);
CREATE INDEX IF NOT EXISTS ix_centros_costo_tipo ON centros_costo(tipo);
CREATE INDEX IF NOT EXISTS ix_centros_costo_codigo_contable ON centros_costo(codigo_contable);
```

---

## 📊 QUERIES DE MONITOREO

### Monitoreo Básico (cada 4 horas, primeras 24h)

```sql
-- Query 1: Estado general
SELECT 
    (SELECT COUNT(*) FROM centros_costo WHERE deleted_at IS NULL) as total_centros,
    (SELECT COUNT(*) FROM solicitudes WHERE deleted_at IS NULL) as total_solicitudes,
    (SELECT COUNT(*) FROM solicitudes WHERE centro_costo_id = 1) as solicitudes_sin_asignar,
    (SELECT COUNT(*) FROM solicitudes WHERE centro_costo_id IS NULL) as solicitudes_sin_centro;

-- Query 2: Nuevas solicitudes (últimas 24h)
SELECT 
    cc.nombre,
    COUNT(s.id) as nuevas_solicitudes
FROM solicitudes s
JOIN centros_costo cc ON s.centro_costo_id = cc.id
WHERE s.created_at > NOW() - INTERVAL '24 hours'
  AND s.deleted_at IS NULL
GROUP BY cc.nombre
ORDER BY nuevas_solicitudes DESC;

-- Query 3: Performance
EXPLAIN ANALYZE
SELECT s.*, cc.nombre 
FROM solicitudes s
JOIN centros_costo cc ON s.centro_costo_id = cc.id
WHERE s.deleted_at IS NULL
LIMIT 100;
-- Execution Time debe ser < 50ms
```

---

## 📝 CHECKLIST DE VERIFICACIÓN RÁPIDA

Post-deployment, ejecutar este checklist:

```
[ ] alembic current → 90f5f68df0bf
[ ] SELECT COUNT(*) FROM centros_costo → >= 5
[ ] SELECT COUNT(*) FROM solicitudes WHERE centro_costo_id IS NULL → 0
[ ] GET /api/centros-costo → 200 OK
[ ] GET /api/solicitudes/1 → incluye centro_costo expandido
[ ] pytest test_centro_costo_models.py → PASSED
[ ] Backend logs → sin errores de FK constraint
```

---

## 🆘 COMANDOS DE EMERGENCIA

### Rollback de Migración

```powershell
cd c:\Users\gpalmieri\source\sistemika\sak\backend
alembic downgrade b1d5f5c2279f
```

### Limpiar Datos (mantener estructura)

```sql
BEGIN;
DELETE FROM centros_costo WHERE id > 1;
UPDATE solicitudes SET centro_costo_id = 1;
UPDATE solicitud_detalles SET precio = 0, importe = 0;
COMMIT;
```

### Ver Logs de Migración

```sql
SELECT * FROM alembic_version;
```

---

**Última actualización:** 2025-11-13
