# Guía de Implementación Segura - Solicitudes Refactor
**Fecha:** 2025-11-10  
**Spec:** 20251107_bk_solicitudes_spec.md  
**Estimado:** 8 horas  
**Estado:** 🔄 Pendiente

---

## 📋 Índice
1. [Pre-requisitos](#1-pre-requisitos)
2. [Backup y Seguridad](#2-backup-y-seguridad)
3. [Fase 1: Models](#3-fase-1-models)
4. [Fase 2: Migrations](#4-fase-2-migrations)
5. [Fase 3: CRUD y Routers](#5-fase-3-crud-y-routers)
6. [Fase 4: Testing](#6-fase-4-testing)
7. [Fase 5: Verificación](#7-fase-5-verificación)
8. [Rollback Plan](#8-rollback-plan)
9. [Deploy a Producción](#9-deploy-a-producción)
10. [Checklist Final](#10-checklist-final)

---

## 1. Pre-requisitos

### 1.1 Verificar Estado Actual
```powershell
# Terminal: backend/
cd c:\Users\gpalmieri\source\sistemika\sak\backend

# Verificar base de datos local conectada
python -c "from app.db import engine; print('DB OK')"

# Verificar última migración aplicada
$env:PYTHONPATH = "."
alembic current

# Verificar que no hay migraciones pendientes
alembic check
```

**✅ Checkpoint:** Base de datos accesible y migraciones sincronizadas.

### 1.2 Preparar Branch de Trabajo
```powershell
# Terminal: root/
cd c:\Users\gpalmieri\source\sistemika\sak

# Crear branch para la implementación
git checkout -b feature/solicitudes-refactor
git push -u origin feature/solicitudes-refactor

# Verificar branch activo
git branch --show-current
```

**✅ Checkpoint:** Branch `feature/solicitudes-refactor` creado y activo.

---

## 2. Backup y Seguridad

### 2.1 Backup de Base de Datos Local

**Opción A - Dump PostgreSQL completo:**
```powershell
# Usar pg_dump para backup completo
$backupFile = "backup_pre_solicitudes_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
$dbUrl = $env:DATABASE_URL  # O leer de .env

# Extraer componentes de DATABASE_URL
# postgresql://usuario:password@host:puerto/database
# Ajustar según tu configuración

pg_dump -h localhost -U tu_usuario -d sak_local -f ".\backups\$backupFile"

# Comprimir backup
Compress-Archive -Path ".\backups\$backupFile" -DestinationPath ".\backups\$backupFile.zip"
```

**Opción B - Snapshot de tabla específica:**
```powershell
# Backup solo de tabla solicitudes
$backupFile = "backup_solicitudes_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
pg_dump -h localhost -U tu_usuario -d sak_local -t solicitudes -f ".\backups\$backupFile"
```

**✅ Checkpoint:** Backup creado en `backend/backups/backup_pre_solicitudes_YYYYMMDD_HHmmss.sql.zip`

### 2.2 Script de Restauración
```powershell
# Crear script restore.ps1 en backend/backups/
@"
# Restore Database from Backup
param(
    [string]`$BackupFile
)

if (-not `$BackupFile) {
    Write-Host "Usage: .\restore.ps1 -BackupFile 'backup_file.sql'"
    exit 1
}

Write-Host "⚠️  Restaurando base de datos desde: `$BackupFile"
Write-Host "Esto SOBRESCRIBIRÁ los datos actuales. Presiona CTRL+C para cancelar."
Start-Sleep -Seconds 5

# Descomprimir si es .zip
if (`$BackupFile -like "*.zip") {
    Expand-Archive -Path `$BackupFile -DestinationPath ".\temp" -Force
    `$BackupFile = Get-ChildItem ".\temp\*.sql" | Select-Object -First 1 -ExpandProperty FullName
}

# Restaurar
psql -h localhost -U tu_usuario -d sak_local -f `$BackupFile

Write-Host "✅ Restauración completada"
"@ | Out-File -FilePath ".\backups\restore.ps1" -Encoding UTF8
```

**✅ Checkpoint:** Script de restauración listo en `backend/backups/restore.ps1`

---

## 3. Fase 1: Models
**Duración estimada:** 1.5 horas

### 3.1 Crear Modelo Departamento
```powershell
# Crear archivo: backend/app/models/departamento.py
```

**Contenido:**
```python
from typing import Optional
from sqlmodel import Field
from app.models.base import BaseModel

class DepartamentoBase(BaseModel):
    """Modelo base para Departamento"""
    nombre: str = Field(max_length=100, unique=True, index=True)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    activo: bool = Field(default=True)

class Departamento(DepartamentoBase, table=True):
    """Modelo de tabla Departamento"""
    __tablename__ = "departamentos"
    
    id: Optional[int] = Field(default=None, primary_key=True)

class DepartamentoCreate(DepartamentoBase):
    """Schema para crear Departamento"""
    pass

class DepartamentoUpdate(BaseModel):
    """Schema para actualizar Departamento"""
    nombre: Optional[str] = Field(default=None, max_length=100)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    activo: Optional[bool] = None

class DepartamentoRead(DepartamentoBase):
    """Schema para leer Departamento"""
    id: int
```

**Registrar en `backend/app/models/__init__.py`:**
```python
from .departamento import (
    Departamento,
    DepartamentoCreate,
    DepartamentoUpdate,
    DepartamentoRead
)
```

**✅ Checkpoint:** Modelo Departamento creado y exportado.

### 3.2 Crear Modelo TipoSolicitud
```powershell
# Crear archivo: backend/app/models/tipo_solicitud.py
```

**Contenido:**
```python
from typing import Optional
from sqlmodel import Field
from app.models.base import BaseModel

class TipoSolicitudBase(BaseModel):
    """Modelo base para TipoSolicitud"""
    nombre: str = Field(max_length=100, unique=True, index=True)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    tipo_articulo_filter: Optional[str] = Field(default=None, max_length=50)
    articulo_default_id: Optional[int] = Field(default=None, foreign_key="articulos.id")
    departamento_default_id: Optional[int] = Field(default=None, foreign_key="departamentos.id")
    activo: bool = Field(default=True)

class TipoSolicitud(TipoSolicitudBase, table=True):
    """Modelo de tabla TipoSolicitud"""
    __tablename__ = "tipos_solicitud"
    
    id: Optional[int] = Field(default=None, primary_key=True)

class TipoSolicitudCreate(TipoSolicitudBase):
    """Schema para crear TipoSolicitud"""
    pass

class TipoSolicitudUpdate(BaseModel):
    """Schema para actualizar TipoSolicitud"""
    nombre: Optional[str] = Field(default=None, max_length=100)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    tipo_articulo_filter: Optional[str] = Field(default=None, max_length=50)
    articulo_default_id: Optional[int] = None
    departamento_default_id: Optional[int] = None
    activo: Optional[bool] = None

class TipoSolicitudRead(TipoSolicitudBase):
    """Schema para leer TipoSolicitud"""
    id: int
```

**Registrar en `backend/app/models/__init__.py`:**
```python
from .tipo_solicitud import (
    TipoSolicitud,
    TipoSolicitudCreate,
    TipoSolicitudUpdate,
    TipoSolicitudRead
)
```

**✅ Checkpoint:** Modelo TipoSolicitud creado y exportado.

### 3.3 Modificar Modelo Solicitud
```powershell
# Editar archivo: backend/app/models/solicitud.py
```

**Cambios a aplicar:**
1. Importar `Decimal` y `EstadoSolicitud` enum
2. Agregar campos nuevos
3. Eliminar campo `tipo` enum antiguo

**Enum EstadoSolicitud (crear si no existe):**
```python
from enum import Enum

class EstadoSolicitud(str, Enum):
    PENDIENTE = "pendiente"
    APROBADA = "aprobada"
    RECHAZADA = "rechazada"
    EN_PROCESO = "en_proceso"
    FINALIZADA = "finalizada"
```

**Campos a agregar en SolicitudBase:**
```python
from decimal import Decimal

tipo_solicitud_id: int = Field(foreign_key="tipos_solicitud.id")
departamento_id: int = Field(foreign_key="departamentos.id")
estado: EstadoSolicitud = Field(default=EstadoSolicitud.PENDIENTE)
total: Decimal = Field(default=Decimal("0"), max_digits=15, decimal_places=2)
```

**Campo a eliminar:**
```python
# ELIMINAR:
# tipo: str = Field(...)  # enum anterior
```

**✅ Checkpoint:** Modelo Solicitud modificado con nuevos campos.

### 3.4 Verificación de Models
```powershell
# Verificar sintaxis Python
python -m py_compile app/models/departamento.py
python -m py_compile app/models/tipo_solicitud.py
python -m py_compile app/models/solicitud.py

# Verificar imports
python -c "from app.models import Departamento, TipoSolicitud, Solicitud; print('✅ Models OK')"
```

**✅ Checkpoint:** Todos los modelos compilan sin errores.

---

## 4. Fase 2: Migrations
**Duración estimada:** 2 horas

### 4.1 Generar Migración Automática
```powershell
# Terminal: backend/
$env:PYTHONPATH = "."

# Generar migración detectando cambios
alembic revision --autogenerate -m "add_departamentos_tipos_solicitud_refactor"
```

**⚠️ IMPORTANTE:** Alembic generará UNA migración con TODOS los cambios. Necesitamos dividirla en 3 migraciones separadas.

### 4.2 Dividir en 3 Migraciones

**Paso 1: Renombrar migración generada**
```powershell
# La migración generada estará en: backend/alembic/versions/XXXX_add_departamentos_tipos_solicitud_refactor.py
# Renombrarla a: 0020_create_departamentos.py
```

**Paso 2: Editar 0020 - Solo Departamentos**
Mantener solo:
```python
def upgrade():
    op.create_table(
        'departamentos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('descripcion', sa.String(500), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('nombre')
    )
    op.create_index('ix_departamentos_nombre', 'departamentos', ['nombre'])

def downgrade():
    op.drop_index('ix_departamentos_nombre')
    op.drop_table('departamentos')
```

**Paso 3: Crear 0021 manualmente - TiposSolicitud**
```powershell
alembic revision -m "create_tipos_solicitud"
```

Contenido según spec (sección 3.2).

**Paso 4: Crear 0022 manualmente - Modificar Solicitudes**
```powershell
alembic revision -m "refactor_solicitudes_add_tipo_departamento"
```

Contenido según spec (sección 3.3) - versión actualizada sin Normal/Directa.

**✅ Checkpoint:** 3 migraciones creadas (0020, 0021, 0022).

### 4.3 Aplicar Migraciones en Local

**Dry-run primero:**
```powershell
# Ver SQL que se ejecutará SIN aplicarlo
alembic upgrade head --sql > migration_preview.sql

# Revisar migration_preview.sql
code migration_preview.sql
```

**Aplicar migración 0020:**
```powershell
alembic upgrade +1
alembic current  # Verificar que estamos en 0020

# Verificar tabla creada
python -c "from sqlalchemy import inspect; from app.db import engine; print(inspect(engine).get_table_names())"
```

**✅ Checkpoint:** Migración 0020 aplicada, tabla `departamentos` existe.

**Seed Departamentos:**
```powershell
# Crear script: backend/scripts/seed_departamentos.py
```

**Contenido:**
```python
from sqlmodel import Session, select
from app.db import engine
from app.models import Departamento

def seed_departamentos():
    with Session(engine) as session:
        # Verificar si ya existen
        existing = session.exec(select(Departamento)).first()
        if existing:
            print("⚠️  Departamentos ya existen. Skipping seed.")
            return
        
        departamentos = [
            Departamento(nombre="Compras", descripcion="Solicitudes de compra de materiales y servicios", activo=True),
            Departamento(nombre="Administración", descripcion="Solicitudes administrativas generales", activo=True),
            Departamento(nombre="Cadete", descripcion="Solicitudes de mensajería interna", activo=True),
            Departamento(nombre="Fletero", descripcion="Solicitudes de transporte y logística", activo=True),
        ]
        
        for dept in departamentos:
            session.add(dept)
        
        session.commit()
        print("✅ 4 departamentos creados")

if __name__ == "__main__":
    seed_departamentos()
```

**Ejecutar seed:**
```powershell
python scripts/seed_departamentos.py
```

**✅ Checkpoint:** 4 departamentos en base de datos.

**Aplicar migración 0021:**
```powershell
alembic upgrade +1
alembic current  # Verificar que estamos en 0021
```

**✅ Checkpoint:** Migración 0021 aplicada, tabla `tipos_solicitud` existe.

**Seed TiposSolicitud:**
```powershell
# Crear script: backend/scripts/seed_tipos_solicitud.py
```

**Contenido según spec sección 4.2** (6 tipos, NO Normal/Directa).

**Ejecutar seed:**
```powershell
python scripts/seed_tipos_solicitud.py
```

**✅ Checkpoint:** 6 tipos de solicitud en base de datos.

**Aplicar migración 0022:**
```powershell
# ⚠️ CRÍTICO: Esta migración modifica tabla solicitudes existente
# Verificar que hay backup antes de proceder

alembic upgrade +1
alembic current  # Verificar que estamos en 0022
```

**Verificar migración exitosa:**
```powershell
# Verificar columnas nuevas en solicitudes
python -c "from sqlalchemy import inspect; from app.db import engine; cols = [c['name'] for c in inspect(engine).get_columns('solicitudes')]; print(cols)"

# Debe incluir: tipo_solicitud_id, departamento_id, estado, total
# NO debe incluir: tipo (eliminado)
```

**✅ Checkpoint:** Migración 0022 aplicada, solicitudes refactorizado.

### 4.4 Verificación Post-Migración
```powershell
# Contar registros
python -c "from sqlmodel import Session, select; from app.db import engine; from app.models import Departamento, TipoSolicitud, Solicitud; session = Session(engine); print(f'Departamentos: {len(session.exec(select(Departamento)).all())}'); print(f'Tipos: {len(session.exec(select(TipoSolicitud)).all())}'); print(f'Solicitudes: {len(session.exec(select(Solicitud)).all())}')"
```

**✅ Checkpoint:** Datos migrados correctamente.

---

## 5. Fase 3: CRUD y Routers
**Duración estimada:** 2 horas

### 5.1 CRUD Departamento
```powershell
# Crear archivo: backend/app/crud/departamento.py
```

**Contenido:**
```python
from app.crud.base import GenericCRUD
from app.models import Departamento, DepartamentoCreate, DepartamentoUpdate

departamento_crud = GenericCRUD[Departamento, DepartamentoCreate, DepartamentoUpdate](
    model=Departamento,
    searchable_fields=["nombre", "descripcion"]
)
```

**Registrar en `backend/app/crud/__init__.py`:**
```python
from .departamento import departamento_crud
```

**✅ Checkpoint:** CRUD Departamento creado.

### 5.2 CRUD TipoSolicitud (con validación de borrado)
```powershell
# Crear archivo: backend/app/crud/tipo_solicitud.py
```

**Contenido:**
```python
from typing import Optional
from sqlmodel import Session, select
from fastapi import HTTPException
from app.crud.base import GenericCRUD
from app.models import TipoSolicitud, TipoSolicitudCreate, TipoSolicitudUpdate, Solicitud

class TipoSolicitudCRUD(GenericCRUD[TipoSolicitud, TipoSolicitudCreate, TipoSolicitudUpdate]):
    def delete(self, db: Session, id: int) -> Optional[TipoSolicitud]:
        # Verificar si hay solicitudes con este tipo
        statement = select(Solicitud).where(Solicitud.tipo_solicitud_id == id)
        solicitudes = db.exec(statement).first()
        
        if solicitudes:
            raise HTTPException(
                status_code=400,
                detail="No se puede eliminar el tipo de solicitud porque tiene solicitudes asociadas"
            )
        
        return super().delete(db, id)

tipo_solicitud_crud = TipoSolicitudCRUD(
    model=TipoSolicitud,
    searchable_fields=["nombre", "descripcion", "tipo_articulo_filter"]
)
```

**Registrar en `backend/app/crud/__init__.py`:**
```python
from .tipo_solicitud import tipo_solicitud_crud
```

**✅ Checkpoint:** CRUD TipoSolicitud creado con validación.

### 5.3 Router Departamentos
```powershell
# Crear archivo: backend/app/routers/departamentos.py
```

**Contenido:**
```python
from app.routers.generic import create_generic_router
from app.models import DepartamentoRead, DepartamentoCreate, DepartamentoUpdate
from app.crud import departamento_crud

router = create_generic_router(
    crud=departamento_crud,
    response_model=DepartamentoRead,
    create_model=DepartamentoCreate,
    update_model=DepartamentoUpdate,
    prefix="/departamentos",
    tags=["departamentos"]
)
```

**Registrar en `backend/app/main.py`:**
```python
from app.routers import departamentos

app.include_router(departamentos.router)
```

**✅ Checkpoint:** Router departamentos registrado.

### 5.4 Router TiposSolicitud
```powershell
# Crear archivo: backend/app/routers/tipos_solicitud.py
```

**Contenido:**
```python
from app.routers.generic import create_generic_router
from app.models import TipoSolicitudRead, TipoSolicitudCreate, TipoSolicitudUpdate
from app.crud import tipo_solicitud_crud

router = create_generic_router(
    crud=tipo_solicitud_crud,
    response_model=TipoSolicitudRead,
    create_model=TipoSolicitudCreate,
    update_model=TipoSolicitudUpdate,
    prefix="/tipos-solicitud",
    tags=["tipos-solicitud"]
)
```

**Registrar en `backend/app/main.py`:**
```python
from app.routers import tipos_solicitud

app.include_router(tipos_solicitud.router)
```

**✅ Checkpoint:** Router tipos-solicitud registrado.

### 5.5 Actualizar Router Solicitudes
```powershell
# Editar archivo: backend/app/routers/solicitudes.py
```

**Cambios:**
- Verificar que usa NestedCRUD
- Eliminar endpoint custom `/cambiar-estado` (si existe)
- Verificar que PUT `/solicitudes/{id}` maneja campo `estado`

**✅ Checkpoint:** Router solicitudes actualizado.

### 5.6 Verificar API Running
```powershell
# Terminal: backend/
uvicorn app.main:app --reload --port 8000

# En otro terminal:
curl http://localhost:8000/docs
# Debe abrir Swagger UI
```

**Verificar endpoints en Swagger:**
- ✅ GET/POST/PUT/DELETE `/departamentos`
- ✅ GET/POST/PUT/DELETE `/tipos-solicitud`
- ✅ GET/POST/PUT/DELETE `/solicitudes`
- ❌ NO debe existir `/solicitudes/{id}/cambiar-estado`

**✅ Checkpoint:** API corriendo con nuevos endpoints.

---

## 6. Fase 4: Testing
**Duración estimada:** 2 horas

### 6.1 Tests de Modelos
```powershell
# Crear: backend/tests/models/test_departamento.py
# Crear: backend/tests/models/test_tipo_solicitud.py
# Actualizar: backend/tests/models/test_solicitud.py
```

**Ejecutar:**
```powershell
pytest tests/models/ -v
```

**✅ Checkpoint:** Tests de modelos pasan.

### 6.2 Tests de CRUD
```powershell
# Crear: backend/tests/crud/test_departamento_crud.py
# Crear: backend/tests/crud/test_tipo_solicitud_crud.py
```

**Tests críticos:**
- Crear departamento
- Listar departamentos
- Actualizar departamento
- NO eliminar departamento con solicitudes asociadas (debe fallar con 400)
- Eliminar departamento sin solicitudes (debe exitir)

**Ejecutar:**
```powershell
pytest tests/crud/ -v
```

**✅ Checkpoint:** Tests de CRUD pasan.

### 6.3 Tests de Endpoints
```powershell
# Crear: backend/tests/routers/test_departamentos_router.py
# Crear: backend/tests/routers/test_tipos_solicitud_router.py
# Actualizar: backend/tests/routers/test_solicitudes_router.py
```

**Tests según spec sección 6:**
- T-DEPT-01: CRUD departamentos
- T-TIPO-01: CRUD tipos solicitud
- T-TIPO-02: Validación borrado con referencias
- T-SOL-01: Crear solicitud con tipo y departamento
- T-SOL-02: Cambiar estado via PUT
- T-SOL-03: Listado con filtros
- T-INT-01: Workflow completo

**Ejecutar:**
```powershell
pytest tests/routers/ -v
```

**✅ Checkpoint:** Tests de endpoints pasan.

### 6.4 Test Suite Completo
```powershell
# Ejecutar TODOS los tests
pytest -v --cov=app --cov-report=html

# Ver reporte de cobertura
start htmlcov/index.html
```

**Cobertura esperada:** >80% en archivos nuevos/modificados.

**✅ Checkpoint:** Suite completa de tests pasa.

---

## 7. Fase 5: Verificación
**Duración estimada:** 0.5 horas

### 7.1 Testing Manual en Swagger

**Departamentos:**
1. GET `/departamentos` → Debe retornar 4 departamentos
2. POST `/departamentos` → Crear "Test Dept"
3. PUT `/departamentos/{id}` → Actualizar descripción
4. DELETE `/departamentos/{id}` → Eliminar "Test Dept"

**Tipos Solicitud:**
1. GET `/tipos-solicitud` → Debe retornar 6 tipos
2. POST `/tipos-solicitud` → Crear "Test Tipo"
3. GET `/tipos-solicitud?search=Materiales` → Filtrar por búsqueda
4. DELETE `/tipos-solicitud/{id}` → Eliminar "Test Tipo"

**Solicitudes:**
1. GET `/solicitudes` → Listar solicitudes (deben tener tipo_solicitud_id y departamento_id)
2. POST `/solicitudes` → Crear nueva con tipo=1, departamento=1, estado=pendiente, total=100.50
3. PUT `/solicitudes/{id}` → Cambiar estado a "aprobada"
4. GET `/solicitudes/{id}` → Verificar estado actualizado

**✅ Checkpoint:** Todos los endpoints funcionan correctamente en Swagger.

### 7.2 Verificación de Datos

```powershell
# Script de verificación
python -c @"
from sqlmodel import Session, select
from app.db import engine
from app.models import Departamento, TipoSolicitud, Solicitud

with Session(engine) as session:
    print('=== VERIFICACIÓN DE DATOS ===')
    
    # Departamentos
    depts = session.exec(select(Departamento)).all()
    print(f'\n✅ Departamentos: {len(depts)}')
    for d in depts:
        print(f'  - {d.nombre}')
    
    # Tipos
    tipos = session.exec(select(TipoSolicitud)).all()
    print(f'\n✅ Tipos Solicitud: {len(tipos)}')
    for t in tipos:
        print(f'  - {t.nombre}')
    
    # Solicitudes
    solic = session.exec(select(Solicitud)).all()
    print(f'\n✅ Solicitudes: {len(solic)}')
    
    # Verificar integridad referencial
    for s in solic:
        assert s.tipo_solicitud_id is not None, f'Solicitud {s.id} sin tipo'
        assert s.departamento_id is not None, f'Solicitud {s.id} sin departamento'
    
    print('\n✅ Integridad referencial OK')
    print('=== VERIFICACIÓN COMPLETADA ===')
"@
```

**✅ Checkpoint:** Todos los datos migrados correctamente.

### 7.3 Commit y Push
```powershell
git add .
git commit -m "feat(backend): implement solicitudes refactor - models, migrations, routers, tests"
git push origin feature/solicitudes-refactor
```

**✅ Checkpoint:** Código commiteado y pusheado.

---

## 8. Rollback Plan

### 8.1 Rollback Parcial (Solo Migraciones)

Si algo falla durante las migraciones:

```powershell
# Revertir a migración anterior
alembic downgrade -1  # Retroceder 1 migración

# O revertir todas las nuevas migraciones
alembic downgrade <hash_migracion_anterior_a_0020>

# Verificar estado
alembic current
```

### 8.2 Rollback Completo (Restaurar Backup)

Si necesitas volver al estado original:

```powershell
cd backend\backups

# Restaurar desde backup
.\restore.ps1 -BackupFile "backup_pre_solicitudes_YYYYMMDD_HHmmss.sql.zip"

# Verificar datos restaurados
python -c "from sqlmodel import Session, select; from app.db import engine; from app.models import Solicitud; session = Session(engine); print(f'Solicitudes: {len(session.exec(select(Solicitud)).all())}')"
```

### 8.3 Rollback de Código

```powershell
# Volver a branch master
git checkout master

# Eliminar branch de feature (si es necesario)
git branch -D feature/solicitudes-refactor
git push origin --delete feature/solicitudes-refactor
```

**✅ Checkpoint:** Plan de rollback documentado y probado.

---

## 9. Deploy a Producción

**⚠️ NO EJECUTAR HASTA QUE FRONTEND ESTÉ LISTO Y PROBADO EN LOCAL**

---

## 9.1 Pre-Deploy Checklist Completo

### Validaciones Técnicas
- [ ] **Todos los tests pasan en local** (`pytest -v` sin errores)
- [ ] **Frontend probado contra backend local** (flujo completo E2E)
- [ ] **Branch actualizado con master** (`git merge master` sin conflictos)
- [ ] **Code review completado** (si aplica)
- [ ] **Scripts de migración validados** (downgrade probado en local)
- [ ] **Scripts de seed validados** (idempotentes, no duplican datos)
- [ ] **Variables de entorno verificadas** (DATABASE_URL_PRODUCTION disponible)

### Validaciones de Negocio
- [ ] **Stakeholders informados** del deploy
- [ ] **Frontend production build probado** (`npm run build` exitoso)
- [ ] **Ventana de mantenimiento agendada** (si es necesaria)
- [ ] **Plan de comunicación preparado** (notificar usuarios si aplica)
- [ ] **Rollback plan aprobado** y listo para ejecutar

### Preparación de Datos
- [ ] **Mapeo de solicitudes existentes verificado** (todas irán a "Compras")
- [ ] **Datos de producción analizados** (contar solicitudes actuales)
- [ ] **Inconsistencias de datos resueltas** (si existen)

**✅ Checkpoint:** Todos los items del checklist completados antes de proceder.

---

## 9.2 Backup de Producción (CRÍTICO)

### 9.2.1 Identificar Base de Datos de Producción

```powershell
# Verificar conexión a producción
# Ajustar según tu provider: Neon, Railway, Supabase, etc.

# Opción 1: Leer de .env.production
Get-Content .env.production | Select-String "DATABASE_URL"

# Opción 2: Variable de entorno
$env:DATABASE_URL_PRODUCTION

# Opción 3: Secrets de Railway/Fly.io
railway variables get DATABASE_URL
# O: fly secrets list
```

**⚠️ IMPORTANTE:** Verifica que estás conectado a la base de datos CORRECTA antes de continuar.

### 9.2.2 Crear Backup Completo

**Opción A - Backup desde Local (Recomendado):**
```powershell
# Desde tu máquina local con pg_dump
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupFile = "backup_prod_pre_solicitudes_$timestamp.sql"

# Conectar a DB de producción y hacer dump
# Ejemplo para Neon:
pg_dump "postgresql://user:pass@host.neon.tech/database?sslmode=require" -f ".\backups\$backupFile"

# Ejemplo genérico:
$prodDbUrl = $env:DATABASE_URL_PRODUCTION
pg_dump $prodDbUrl -f ".\backups\$backupFile"

# Verificar tamaño del backup
Get-Item ".\backups\$backupFile" | Select-Object Name, Length

# Comprimir
Compress-Archive -Path ".\backups\$backupFile" -DestinationPath ".\backups\$backupFile.zip"

# Eliminar .sql sin comprimir (opcional)
Remove-Item ".\backups\$backupFile"
```

**Opción B - Backup desde Provider (Alternativo):**
```powershell
# Neon: Usar interfaz web para crear snapshot
# Railway: railway run pg_dump ...
# Supabase: Usar dashboard para backup

# Verificar que backup existe en el dashboard del provider
```

**Verificación del Backup:**
```powershell
# Probar restaurar en DB temporal local
# 1. Crear DB temporal
createdb sak_test_restore

# 2. Restaurar backup
psql -d sak_test_restore -f ".\backups\$backupFile"

# 3. Verificar datos
psql -d sak_test_restore -c "SELECT COUNT(*) FROM solicitudes;"

# 4. Eliminar DB temporal
dropdb sak_test_restore
```

**✅ Checkpoint:** Backup de producción creado, comprimido, verificado y almacenado en `backend/backups/backup_prod_pre_solicitudes_YYYYMMDD_HHmmss.sql.zip`

### 9.2.3 Almacenar Backup en Lugar Seguro

```powershell
# Opción 1: Copiar a Google Drive / OneDrive
Copy-Item ".\backups\backup_prod_*.zip" -Destination "C:\Users\gpalmieri\OneDrive\Backups\SAK\"

# Opción 2: Subir a Google Cloud Storage (si tienes configurado)
gsutil cp ".\backups\backup_prod_*.zip" gs://sak-backups/production/

# Opción 3: Copiar a múltiples ubicaciones
$backupFile = Get-Item ".\backups\backup_prod_*.zip" | Select-Object -First 1
Copy-Item $backupFile -Destination "D:\Backups\"
Copy-Item $backupFile -Destination "\\network-drive\backups\"
```

**✅ Checkpoint:** Backup almacenado en al menos 2 ubicaciones diferentes.

---

## 9.3 Deploy de Backend a Producción

### 9.3.1 Merge a Master

```powershell
# Asegurarse de que estamos al día
git checkout feature/solicitudes-refactor
git pull origin feature/solicitudes-refactor

# Actualizar con master
git checkout master
git pull origin master

# Merge (puede requerir resolver conflictos)
git merge feature/solicitudes-refactor

# Si hay conflictos, resolverlos y:
# git add .
# git commit -m "Merge feature/solicitudes-refactor into master"

# Push a master
git push origin master
```

**✅ Checkpoint:** Código mergeado a master sin conflictos.

### 9.3.2 Aplicar Migraciones en Producción

**⚠️ ATENCIÓN:** Este es el paso más crítico. Proceder con cuidado.

**Opción A - Conexión Directa a DB de Producción:**
```powershell
# Terminal: backend/
cd c:\Users\gpalmieri\source\sistemika\sak\backend

# Configurar conexión a producción
$env:DATABASE_URL = $env:DATABASE_URL_PRODUCTION

# Verificar estado actual de migraciones
alembic current
# Ejemplo output: "0019_previous_migration (head)"

# PASO 1: Aplicar migración 0020 (departamentos)
alembic upgrade +1

# Verificar que tabla existe
python -c "from sqlalchemy import inspect; from app.db import engine; print('departamentos' in inspect(engine).get_table_names())"
# Debe imprimir: True

# PASO 2: Ejecutar seed de departamentos
python scripts/seed_departamentos.py

# Verificar datos
python -c "from sqlmodel import Session, select; from app.db import engine; from app.models import Departamento; session = Session(engine); depts = session.exec(select(Departamento)).all(); print(f'Departamentos: {len(depts)}'); [print(f'  - {d.nombre}') for d in depts]"
# Debe mostrar: Compras, Administración, Cadete, Fletero

# PASO 3: Aplicar migración 0021 (tipos_solicitud)
alembic upgrade +1

# Verificar tabla
python -c "from sqlalchemy import inspect; from app.db import engine; print('tipos_solicitud' in inspect(engine).get_table_names())"

# PASO 4: Ejecutar seed de tipos
python scripts/seed_tipos_solicitud.py

# Verificar datos
python -c "from sqlmodel import Session, select; from app.db import engine; from app.models import TipoSolicitud; session = Session(engine); tipos = session.exec(select(TipoSolicitud)).all(); print(f'Tipos: {len(tipos)}'); [print(f'  - {t.nombre}') for d in tipos]"
# Debe mostrar 6 tipos: Materiales, Ferretería, Servicios, Insumos de Oficina, Transporte, Mensajería

# PASO 5: Aplicar migración 0022 (refactor solicitudes) ⚠️ CRÍTICO
# Esta migración modifica tabla solicitudes existente
alembic upgrade +1

# Verificar columnas nuevas
python -c "from sqlalchemy import inspect; from app.db import engine; cols = [c['name'] for c in inspect(engine).get_columns('solicitudes')]; print('tipo_solicitud_id' in cols and 'departamento_id' in cols and 'estado' in cols and 'total' in cols and 'tipo' not in cols)"
# Debe imprimir: True

# Verificar integridad de datos
python -c "from sqlmodel import Session, select; from app.db import engine; from app.models import Solicitud; session = Session(engine); sols = session.exec(select(Solicitud)).all(); print(f'Solicitudes: {len(sols)}'); invalidas = [s for s in sols if not s.tipo_solicitud_id or not s.departamento_id]; print(f'Solicitudes sin tipo/dept: {len(invalidas)}')"
# Debe mostrar: 0 solicitudes inválidas

# Verificar estado final
alembic current
# Debe mostrar: "0022_refactor_solicitudes_add_tipo_departamento (head)"
```

**Opción B - Ejecución Remota en Servidor:**
```powershell
# Si tu backend corre en Railway/Fly.io/Heroku

# Railway:
railway run alembic upgrade head
railway run python scripts/seed_departamentos.py
railway run python scripts/seed_tipos_solicitud.py

# Fly.io:
fly ssh console
cd /app
alembic upgrade head
python scripts/seed_departamentos.py
python scripts/seed_tipos_solicitud.py
exit

# Heroku:
heroku run alembic upgrade head -a sak-backend
heroku run python scripts/seed_departamentos.py -a sak-backend
heroku run python scripts/seed_tipos_solicitud.py -a sak-backend
```

**✅ Checkpoint:** Migraciones aplicadas exitosamente en producción, datos seed cargados.

### 9.3.3 Deploy de Código Backend

**Opción A - Deploy Automático (Git Push):**
```powershell
# Si tienes CI/CD configurado (Railway, Vercel, Fly.io)
git push origin master
# El deploy se ejecutará automáticamente

# Monitorear logs durante deploy
railway logs  # O fly logs, heroku logs, etc.
```

**Opción B - Deploy Manual:**
```powershell
# Railway:
railway up

# Fly.io:
fly deploy

# Heroku:
git push heroku master
```

**Monitorear Deploy:**
```powershell
# Esperar a que el deploy termine
# Verificar que el servicio está corriendo

# Railway:
railway status

# Fly.io:
fly status

# Heroku:
heroku ps -a sak-backend
```

**✅ Checkpoint:** Backend deployado exitosamente en producción.

### 9.3.4 Verificar API de Producción

```powershell
# Verificar que API responde
curl https://tu-backend-production.com/health
# O abrir en navegador

# Verificar Swagger docs
start https://tu-backend-production.com/docs

# Probar endpoints nuevos en Swagger:
# 1. GET /departamentos → Debe retornar 4 departamentos
# 2. GET /tipos-solicitud → Debe retornar 6 tipos
# 3. GET /solicitudes → Debe retornar solicitudes con nuevos campos
# 4. GET /solicitudes/{id} → Verificar que tiene tipo_solicitud_id, departamento_id, estado, total
```

**✅ Checkpoint:** API de producción funcional y respondiendo correctamente.

---

## 9.4 Deploy de Frontend a Producción

### 9.4.1 Actualizar Variables de Entorno

```powershell
# Terminal: frontend/
cd c:\Users\gpalmieri\source\sistemika\sak\frontend

# Verificar que .env.production apunta a backend de producción
Get-Content .env.production | Select-String "NEXT_PUBLIC_API_URL"
# Debe mostrar: NEXT_PUBLIC_API_URL=https://tu-backend-production.com

# Si no existe o es incorrecto, actualizar:
@"
NEXT_PUBLIC_API_URL=https://tu-backend-production.com
"@ | Out-File -FilePath .env.production -Encoding UTF8
```

### 9.4.2 Build de Producción Local

```powershell
# Limpiar build anterior
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

# Instalar dependencias (si hay cambios)
npm install

# Build de producción
npm run build

# Verificar que build es exitoso
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build exitoso"
} else {
    Write-Host "❌ Build falló. Revisar errores."
    exit 1
}
```

**✅ Checkpoint:** Build de producción exitoso sin errores.

### 9.4.3 Deploy a Vercel

**Opción A - Deploy Automático (Git Push):**
```powershell
# Si tienes Vercel conectado a tu repositorio
git push origin master
# Vercel detectará el push y deployará automáticamente

# Monitorear en dashboard de Vercel:
start https://vercel.com/tu-cuenta/sak-frontend
```

**Opción B - Deploy Manual:**
```powershell
# Instalar Vercel CLI (si no está instalado)
npm i -g vercel

# Login
vercel login

# Deploy a producción
vercel --prod

# Esperar a que termine
# Vercel mostrará la URL de producción
```

**✅ Checkpoint:** Frontend deployado exitosamente en producción.

### 9.4.4 Verificar Frontend de Producción

```powershell
# Abrir frontend de producción
start https://tu-frontend-production.vercel.app

# Verificar manualmente:
# 1. Navegar a /solicitudes
# 2. Crear nueva solicitud → Debe mostrar campos nuevos (tipo, departamento)
# 3. Ver solicitud existente → Debe mostrar tipo_solicitud_id y departamento_id
# 4. Editar solicitud → Cambiar estado debe funcionar
# 5. Verificar que no hay errores en Console del navegador (F12)
```

**✅ Checkpoint:** Frontend de producción funcional y sin errores.

---

## 9.5 Verificación Post-Deploy Completa

### 9.5.1 Pruebas de Integración E2E en Producción

```powershell
# Crear solicitud completa y verificar flujo

# 1. Abrir frontend de producción
# 2. Ir a /solicitudes
# 3. Crear nueva solicitud:
#    - Seleccionar tipo: "Materiales"
#    - Seleccionar departamento: "Compras"
#    - Agregar detalles (artículos)
#    - Estado: "Pendiente"
#    - Guardar

# 4. Verificar que se creó correctamente

# 5. Editar solicitud:
#    - Cambiar estado a "Aprobada"
#    - Guardar

# 6. Verificar cambio persistido

# 7. Listar solicitudes y aplicar filtros
#    - Filtrar por departamento
#    - Filtrar por tipo
#    - Filtrar por estado
```

### 9.5.2 Verificar Datos Migrados

```powershell
# Conectar a DB de producción
$env:DATABASE_URL = $env:DATABASE_URL_PRODUCTION

# Script de verificación completa
python -c @"
from sqlmodel import Session, select
from app.db import engine
from app.models import Departamento, TipoSolicitud, Solicitud

print('=== VERIFICACIÓN POST-DEPLOY PRODUCCIÓN ===\n')

with Session(engine) as session:
    # Departamentos
    depts = session.exec(select(Departamento)).all()
    print(f'✅ Departamentos: {len(depts)}')
    for d in depts:
        print(f'  - {d.nombre} (activo: {d.activo})')
    
    # Tipos
    tipos = session.exec(select(TipoSolicitud)).all()
    print(f'\n✅ Tipos Solicitud: {len(tipos)}')
    for t in tipos:
        print(f'  - {t.nombre} (activo: {t.activo})')
    
    # Solicitudes
    sols = session.exec(select(Solicitud)).all()
    print(f'\n✅ Solicitudes: {len(sols)}')
    
    # Verificar integridad
    invalidas = []
    for s in sols:
        if not s.tipo_solicitud_id or not s.departamento_id:
            invalidas.append(s.id)
    
    if invalidas:
        print(f'\n❌ Solicitudes sin tipo/dept: {len(invalidas)}')
        print(f'   IDs: {invalidas}')
        print('   ⚠️ ACCIÓN REQUERIDA: Revisar manualmente')
    else:
        print(f'\n✅ Todas las solicitudes tienen tipo y departamento')
    
    # Distribución por departamento
    from collections import Counter
    dept_dist = Counter(s.departamento_id for s in sols)
    print(f'\n📊 Distribución por departamento:')
    for dept_id, count in dept_dist.items():
        dept = session.get(Departamento, dept_id)
        print(f'  - {dept.nombre}: {count} solicitudes')
    
    # Distribución por estado
    estado_dist = Counter(s.estado for s in sols)
    print(f'\n📊 Distribución por estado:')
    for estado, count in estado_dist.items():
        print(f'  - {estado}: {count} solicitudes')

print('\n=== VERIFICACIÓN COMPLETADA ===')
"@
```

**✅ Checkpoint:** Todos los datos verificados y sin inconsistencias.

### 9.5.3 Monitoreo de Logs

```powershell
# Monitorear logs de backend por errores
railway logs --tail 100  # O fly logs, heroku logs

# Buscar errores relacionados con solicitudes
railway logs | Select-String -Pattern "solicitud|tipo_solicitud|departamento" -Context 2

# Verificar que no hay errores 500 o 400 inusuales
```

### 9.5.4 Monitoreo de Performance

```powershell
# Verificar tiempos de respuesta
Measure-Command { curl https://tu-backend-production.com/solicitudes }
# Debe ser < 2 segundos

# Verificar carga de frontend
start https://pagespeed.web.dev/
# Analizar: https://tu-frontend-production.vercel.app
```

**✅ Checkpoint:** Performance dentro de rangos aceptables.

---

## 9.6 Comunicación y Documentación

### 9.6.1 Notificar a Stakeholders

```text
Asunto: Deploy Exitoso - Refactor de Solicitudes

Hola equipo,

Se ha completado exitosamente el deploy del refactor de Solicitudes a producción.

✅ Cambios implementados:
- Nueva tabla: Departamentos (Compras, Administración, Cadete, Fletero)
- Nueva tabla: Tipos de Solicitud (6 tipos parametrizables)
- Solicitudes ahora tienen tipo, departamento, estado y total
- Nuevos filtros disponibles en frontend

📊 Datos migrados:
- X solicitudes existentes migradas al departamento "Compras"
- 0 solicitudes perdidas o corruptas
- Todos los detalles preservados

🔗 Enlaces:
- Frontend: https://tu-frontend-production.vercel.app
- API Docs: https://tu-backend-production.com/docs

⚠️ Notas importantes:
- Todas las solicitudes existentes fueron asignadas al departamento "Compras"
- Se recomienda revisar y reasignar tipos de solicitud según corresponda
- Nuevos campos disponibles al crear solicitudes

Cualquier problema, reportar inmediatamente.

Saludos,
[Tu nombre]
```

### 9.6.2 Actualizar Documentación

```powershell
# Marcar implementación como completa
code doc\03-devs\20251107_bk_solicitudes\IMPLEMENTATION_GUIDE.md

# Actualizar línea de estado:
# **Estado:** ✅ Completado (2025-11-10)

# Agregar sección de deploy history
```

**✅ Checkpoint:** Stakeholders notificados y documentación actualizada.

---

## 9.7 Plan de Rollback en Producción (Si algo sale mal)

### 9.7.1 Rollback de Frontend (Rápido)

```powershell
# Vercel: Revertir a deployment anterior desde dashboard
# O usar CLI:
vercel rollback https://tu-frontend-production.vercel.app

# Verificar que frontend volvió a versión anterior
start https://tu-frontend-production.vercel.app
```

**⏱️ Tiempo estimado:** 1-2 minutos

### 9.7.2 Rollback de Backend (Moderado)

```powershell
# Opción A - Revertir deploy de código
git revert HEAD
git push origin master
# Esperar a que re-deploye automáticamente

# Opción B - Revertir a commit anterior
git reset --hard HEAD~1
git push -f origin master
```

**⏱️ Tiempo estimado:** 5-10 minutos

### 9.7.3 Rollback de Migraciones (Crítico)

```powershell
# Conectar a DB de producción
$env:DATABASE_URL = $env:DATABASE_URL_PRODUCTION

# Revertir migración 0022 (solicitudes)
alembic downgrade -1

# Revertir migración 0021 (tipos_solicitud)
alembic downgrade -1

# Revertir migración 0020 (departamentos)
alembic downgrade -1

# Verificar estado
alembic current
```

**⚠️ PROBLEMA:** Si ya hay datos nuevos creados con el nuevo schema, el rollback puede fallar.

### 9.7.4 Restauración Completa desde Backup (Último Recurso)

```powershell
# ⚠️⚠️⚠️ ESTO SOBRESCRIBIRÁ TODOS LOS DATOS POSTERIORES AL BACKUP ⚠️⚠️⚠️

# 1. Descomprimir backup
Expand-Archive -Path ".\backups\backup_prod_pre_solicitudes_YYYYMMDD_HHmmss.sql.zip" -DestinationPath ".\backups\temp"

# 2. Conectar a DB de producción
$prodDbUrl = $env:DATABASE_URL_PRODUCTION

# 3. Restaurar (ESTO BORRA TODO Y RESTAURA)
# ADVERTENCIA: Todos los cambios después del backup se perderán
psql $prodDbUrl -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql $prodDbUrl -f ".\backups\temp\backup_prod_pre_solicitudes_YYYYMMDD_HHmmss.sql"

# 4. Verificar datos restaurados
python -c "from sqlmodel import Session, select; from app.db import engine; from app.models import Solicitud; session = Session(engine); print(f'Solicitudes: {len(session.exec(select(Solicitud)).all())}')"
```

**⏱️ Tiempo estimado:** 15-30 minutos (dependiendo del tamaño de la DB)

**✅ Checkpoint:** Plan de rollback documentado y listo para ejecutar si es necesario.

---

## 9.8 Limpieza Post-Deploy

```powershell
# Una vez que todo esté estable (1-2 días después):

# 1. Eliminar branch de feature
git branch -d feature/solicitudes-refactor
git push origin --delete feature/solicitudes-refactor

# 2. Archivar backups antiguos
Move-Item ".\backups\backup_prod_pre_solicitudes_*.zip" -Destination ".\backups\archive\"

# 3. Limpiar archivos temporales
Remove-Item -Recurse -Force .\backups\temp -ErrorAction SilentlyContinue
```

**✅ Checkpoint:** Limpieza completada.

---

## 10. Checklist Final

### Pre-Implementación
- [ ] Spec aprobado por stakeholders
- [ ] Branch `feature/solicitudes-refactor` creado
- [ ] Backup de base de datos local creado
- [ ] Script de restore probado

### Fase 1: Models
- [ ] Modelo Departamento creado
- [ ] Modelo TipoSolicitud creado (sin codigo, sin orden)
- [ ] Modelo Solicitud modificado (sin tipo enum)
- [ ] Todos los modelos compilan sin errores

### Fase 2: Migrations
- [ ] Migración 0020 creada y aplicada (departamentos)
- [ ] Seed de departamentos ejecutado (4 registros)
- [ ] Migración 0021 creada y aplicada (tipos_solicitud)
- [ ] Seed de tipos ejecutado (6 registros, NO Normal/Directa)
- [ ] Migración 0022 creada y aplicada (solicitudes refactor)
- [ ] Datos migrados correctamente

### Fase 3: CRUD y Routers
- [ ] CRUD Departamento creado
- [ ] CRUD TipoSolicitud creado con validación de borrado
- [ ] Router departamentos registrado
- [ ] Router tipos-solicitud registrado
- [ ] Router solicitudes actualizado (sin custom endpoints)
- [ ] API corriendo y Swagger funcional

### Fase 4: Testing
- [ ] Tests de modelos creados y pasan
- [ ] Tests de CRUD creados y pasan
- [ ] Tests de endpoints creados y pasan (20+ tests según spec)
- [ ] Test suite completo pasa (>80% cobertura)

### Fase 5: Verificación
- [ ] Testing manual en Swagger exitoso
- [ ] Verificación de datos OK
- [ ] Código commiteado y pusheado

### Rollback
- [ ] Rollback de migraciones probado
- [ ] Rollback desde backup probado
- [ ] Plan de rollback documentado

### Producción (Cuando frontend esté listo)
- [ ] Pre-deploy checklist completo
- [ ] Backup de producción creado
- [ ] Migraciones aplicadas en producción
- [ ] Seeds ejecutados en producción
- [ ] Código deployado
- [ ] Verificación post-deploy exitosa

---

## � RESUMEN EJECUTIVO - Deploy a Producción

### Proceso en 5 Pasos (Una vez que local está probado)

#### **PASO 1: Backup (15 min)**
```powershell
# Crear backup completo de DB de producción
pg_dump $env:DATABASE_URL_PRODUCTION -f ".\backups\backup_prod_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
Compress-Archive -Path ".\backups\backup_prod_*.sql" -DestinationPath ".\backups\backup_prod.zip"

# Copiar a ubicación segura
Copy-Item ".\backups\backup_prod.zip" -Destination "C:\Users\gpalmieri\OneDrive\Backups\SAK\"
```
✅ **Validación:** Backup verificado y en 2+ ubicaciones

---

#### **PASO 2: Merge y Migraciones Backend (30 min)**
```powershell
# Merge a master
git checkout master
git merge feature/solicitudes-refactor
git push origin master

# Aplicar migraciones en producción
$env:DATABASE_URL = $env:DATABASE_URL_PRODUCTION

alembic upgrade +1  # 0020: departamentos
python scripts/seed_departamentos.py

alembic upgrade +1  # 0021: tipos_solicitud  
python scripts/seed_tipos_solicitud.py

alembic upgrade +1  # 0022: refactor solicitudes ⚠️ CRÍTICO
```
✅ **Validación:** 3 migraciones aplicadas, seeds ejecutados, `alembic current` = 0022

---

#### **PASO 3: Deploy Backend (10 min)**
```powershell
# Deploy automático (Railway/Fly.io/Heroku)
git push origin master  # Ya está pusheado del paso anterior

# Monitorear logs
railway logs  # O fly logs, heroku logs

# Verificar que API responde
curl https://tu-backend-production.com/docs
```
✅ **Validación:** Swagger funcional, endpoints nuevos responden

---

#### **PASO 4: Deploy Frontend (15 min)**
```powershell
cd frontend

# Build local
npm run build

# Deploy a Vercel
vercel --prod

# O push si es automático
git push origin master  # Si Vercel auto-deploys
```
✅ **Validación:** Frontend accesible, sin errores en console

---

#### **PASO 5: Verificación E2E (20 min)**
- [ ] Crear solicitud nueva con tipo + departamento
- [ ] Editar solicitud existente y cambiar estado
- [ ] Verificar filtros funcionan
- [ ] Verificar datos migrados (todas las solicitudes tienen tipo/dept)
- [ ] Monitorear logs por 30 minutos

✅ **Validación:** Flujo completo funciona sin errores

---

### Tiempos Estimados

| Fase | Tiempo | Criticidad |
|------|--------|-----------|
| Backup | 15 min | 🔴 CRÍTICO |
| Migraciones | 30 min | 🔴 CRÍTICO |
| Deploy Backend | 10 min | 🟡 MODERADO |
| Deploy Frontend | 15 min | 🟡 MODERADO |
| Verificación | 20 min | 🟢 BAJO |
| **TOTAL** | **~90 min** | |

---

### Plan de Rollback Rápido (Si algo sale mal)

#### Problema en Frontend (2 min)
```powershell
vercel rollback https://tu-frontend-production.vercel.app
```

#### Problema en Backend - Solo Código (5 min)
```powershell
git revert HEAD
git push origin master
```

#### Problema en Backend - Migraciones (15 min)
```powershell
$env:DATABASE_URL = $env:DATABASE_URL_PRODUCTION
alembic downgrade -1  # Revertir cada migración
alembic downgrade -1
alembic downgrade -1
```

#### Problema Grave - Restaurar Todo (30 min)
```powershell
# Restaurar desde backup
psql $env:DATABASE_URL_PRODUCTION -f ".\backups\backup_prod.sql"

# Revertir código
git revert HEAD
git push origin master

# Rollback de frontend
vercel rollback https://tu-frontend-production.vercel.app
```

---

### Checklist Pre-Deploy Final

#### Técnico
- [ ] ✅ Todos los tests pasan (`pytest -v`)
- [ ] ✅ Frontend probado contra backend local (E2E completo)
- [ ] ✅ Build de producción exitoso (`npm run build`)
- [ ] ✅ Backup de producción creado y verificado
- [ ] ✅ Scripts de migración probados en local
- [ ] ✅ Variables de entorno verificadas (`.env.production`)

#### Organizacional
- [ ] ✅ Stakeholders notificados del deploy
- [ ] ✅ Ventana de mantenimiento agendada (si aplica)
- [ ] ✅ Plan de rollback revisado y listo
- [ ] ✅ Equipo disponible para monitorear post-deploy

#### Datos
- [ ] ✅ Análisis de solicitudes existentes completado
- [ ] ✅ Mapeo a "Compras" confirmado como correcto
- [ ] ✅ Sin inconsistencias en datos de producción

---

### Contactos de Emergencia

| Rol | Contacto | Disponibilidad |
|-----|----------|----------------|
| Dev Lead | Gustavo Palmieri | 24/7 |
| DevOps | [Nombre] | [Horario] |
| DBA | [Nombre] | [Horario] |

---

### Post-Deploy: Primeras 24 Horas

#### Primeras 2 horas (Monitoreo Activo)
- [ ] Revisar logs cada 15 minutos
- [ ] Verificar errores en Sentry/Logger
- [ ] Responder a reportes de usuarios inmediatamente

#### Primeras 24 horas (Monitoreo Pasivo)
- [ ] Revisar métricas de performance
- [ ] Analizar patrones de uso
- [ ] Recopilar feedback de usuarios

#### Después de 48 horas (Estabilización)
- [ ] Confirmar que no hay rollbacks necesarios
- [ ] Eliminar branch de feature
- [ ] Archivar backups
- [ ] Documentar lecciones aprendidas

---

## �📝 Notas y Observaciones

### Decisiones de Diseño Confirmadas
- ✅ NO código, NO orden en TipoSolicitud
- ✅ NO tipos Normal/Directa en seed
- ✅ Todos los endpoints usan CRUD genérico
- ✅ Estado se cambia via PUT genérico
- ✅ Total calculado por frontend y enviado en payload
- ✅ Sin validaciones de transición de estado en backend
- ✅ URLs en kebab-case (/tipos-solicitud)

### Riesgos Identificados
- ⚠️ Migración 0022 modifica tabla solicitudes existente
- ⚠️ Requiere revisión manual de solicitudes migradas
- ⚠️ Breaking change: frontend debe actualizarse antes de deploy a producción

### Dependencias
- Backend debe deployarse DESPUÉS de probar con frontend local
- Frontend debe adaptarse a nuevos campos antes de deploy a producción
- Ventana de mantenimiento recomendada para deploy de producción

---

## 🔗 Referencias
- **Spec:** `doc/03-devs/20251107_bk_solicitudes/20251107_bk_solicitudes_spec.md`
- **Patterns:** `doc/03-devs/README_BACKEND_PATTERNS.md`
- **Backups:** `backend/backups/`
- **Tests:** `backend/tests/`
- **Branch:** `feature/solicitudes-refactor`

---

**Última actualización:** 2025-11-10  
**Responsable:** Gustavo Palmieri  
**Revisión:** Pendiente
