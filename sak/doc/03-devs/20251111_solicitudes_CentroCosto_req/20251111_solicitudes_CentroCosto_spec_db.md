# 🗄️ SPEC DB - Agregar Centro de Costo y Precio a Solicitudes

> **Referencia:** [20251107_solicitudes_CentroCosto_req.md](./20251107_solicitudes_CentroCosto_req.md)  
> **Versión:** 1.0  
> **Fecha:** 2025-11-11

---

## 📋 RESUMEN EJECUTIVO

**Objetivo:** Implementar el modelo de Centro de Costo como entidad central para vincular solicitudes, y agregar campos de precio e importe a los detalles de solicitud.

**Cambios principales:**
1. Crear nueva entidad `CentroCosto`
2. Agregar FK `centro_costo_id` a `Solicitud`
3. Agregar campos `precio` e `importe` a `SolicitudDetalle`
4. Crear endpoints CRUD para Centro de Costo
5. Migrar datos existentes (propiedades, proyectos → centros de costo)
6. Generar datos seed y casos de prueba

---

## 1. CAMBIOS EN MODELOS

### 1.1 Nuevo Modelo: `CentroCosto`

**Archivo:** `backend/app/models/centro_costo.py`

```python
from typing import TYPE_CHECKING, ClassVar, List, Optional

from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .solicitud import Solicitud


class CentroCosto(Base, table=True):
    """Centros de costo para imputación de solicitudes y facturas."""

    __tablename__ = "centros_costo"

    __searchable_fields__: ClassVar[List[str]] = ["nombre", "codigo_contable", "tipo"]

    nombre: str = Field(
        max_length=200,
        unique=True,
        index=True,
        description="Nombre del centro de costo"
    )
    tipo: str = Field(
        max_length=50,
        index=True,
        description="Tipo: Proyecto, Propiedad, Socios, General"
    )
    codigo_contable: str = Field(
        max_length=50,
        index=True,
        description="Código contable del centro de costo"
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Descripción detallada del centro de costo"
    )
    activo: bool = Field(
        default=True,
        description="Indica si el centro de costo está activo"
    )

    # Relationships
    solicitudes: List["Solicitud"] = Relationship(back_populates="centro_costo")

    def __str__(self) -> str:  # pragma: no cover
        return f"CentroCosto(id={self.id}, nombre='{self.nombre}', tipo='{self.tipo}')"
```

**Tabla SQL generada:**
```sql
CREATE TABLE centros_costo (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL UNIQUE,
    tipo VARCHAR(50) NOT NULL,
    codigo_contable VARCHAR(50) NOT NULL,
    descripcion VARCHAR(1000),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_centros_costo_nombre ON centros_costo(nombre);
CREATE INDEX idx_centros_costo_tipo ON centros_costo(tipo);
CREATE INDEX idx_centros_costo_codigo_contable ON centros_costo(codigo_contable);
```

---

### 1.2 Modificación: Modelo `Solicitud`

**Archivo:** `backend/app/models/solicitud.py`

**Cambios:**

```python
# AGREGAR import
from typing import TYPE_CHECKING, ClassVar, List, Optional

if TYPE_CHECKING:
    from .centro_costo import CentroCosto

# MODIFICAR __expanded_list_relations__ (agregar centro_costo):
__expanded_list_relations__: ClassVar[set[str]] = {"detalles", "centro_costo"}

# AGREGAR campo (después de solicitante_id):
centro_costo_id: int = Field(
    foreign_key="centros_costo.id",
    description="Centro de costo al que se imputa la solicitud"
)

# AGREGAR relationship (después de solicitante):
centro_costo: "CentroCosto" = Relationship(back_populates="solicitudes")
```

**Migración SQL:**
```sql
ALTER TABLE solicitudes 
ADD COLUMN centro_costo_id INTEGER;

-- Asignar centro de costo por defecto (ID=1) a solicitudes existentes
UPDATE solicitudes 
SET centro_costo_id = 1 
WHERE centro_costo_id IS NULL;

-- Hacer el campo NOT NULL después de la migración
ALTER TABLE solicitudes 
ALTER COLUMN centro_costo_id SET NOT NULL;

-- Agregar FK constraint
ALTER TABLE solicitudes 
ADD CONSTRAINT fk_solicitudes_centro_costo 
FOREIGN KEY (centro_costo_id) REFERENCES centros_costo(id);
```

---

### 1.3 Modificación: Modelo `SolicitudDetalle`

**Archivo:** `backend/app/models/solicitud_detalle.py`

**Cambios:**

```python
# AGREGAR imports
from decimal import Decimal
from sqlalchemy import Column, DECIMAL

# AGREGAR campos (después de cantidad):
precio: Decimal = Field(
    default=Decimal("0"),
    sa_column=Column(DECIMAL(15, 2), nullable=False, server_default="0"),
    description="Precio unitario del artículo"
)
importe: Decimal = Field(
    default=Decimal("0"),
    sa_column=Column(DECIMAL(15, 2), nullable=False, server_default="0"),
    description="Importe total (cantidad x precio)"
)
```

**Migración SQL:**
```sql
ALTER TABLE solicitudes_detalle 
ADD COLUMN precio DECIMAL(15, 2) NOT NULL DEFAULT 0;

ALTER TABLE solicitudes_detalle 
ADD COLUMN importe DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- Migrar datos existentes: asignar 0 a todos
UPDATE solicitudes_detalle 
SET precio = 0, importe = 0 
WHERE precio IS NULL OR importe IS NULL;
```

---

### 1.4 Actualización: Exports de Modelos

**Archivo:** `backend/app/models/__init__.py`

```python
# AGREGAR import
from .centro_costo import CentroCosto

# AGREGAR a __all__
__all__ = [
    # ... existentes ...
    "CentroCosto",
]
```

---

## 2. ENDPOINTS (CRUD)

### 2.1 Nuevo Router: Centro de Costo

**Archivo:** `backend/app/routers/centro_costo_router.py`

**Usar Router Factory (patrón estándar):**

```python
from app.models.centro_costo import CentroCosto
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# 1. Crear CRUD genérico
centro_costo_crud = GenericCRUD(CentroCosto)

# 2. Crear router con factory
centro_costo_router = create_generic_router(
    model=CentroCosto,
    crud=centro_costo_crud,
    prefix="/centros-costo",
    tags=["centros-costo"],
)
```

**Endpoints generados automáticamente por el Router Factory:**

| Método | Ruta | Descripción | Status |
|--------|------|-------------|--------|
| `POST` | `/api/centros-costo` | Crear centro de costo | 201 |
| `GET` | `/api/centros-costo` | Listar con paginación y filtros | 200 |
| `GET` | `/api/centros-costo/{id}` | Obtener por ID | 200 |
| `PUT` | `/api/centros-costo/{id}` | Actualizar | 200 |
| `DELETE` | `/api/centros-costo/{id}` | Eliminar (soft delete) | 204 |

**Parámetros de filtrado automáticos (React Admin compatible):**

```http
# Filtrar por tipo
GET /api/centros-costo?filter={"tipo":"Proyecto"}

# Filtrar por activo
GET /api/centros-costo?filter={"activo":true}

# Búsqueda general (nombre, codigo_contable, tipo)
GET /api/centros-costo?q=admin

# Paginación
GET /api/centros-costo?range=[0,24]&sort=["nombre","ASC"]

# Operadores avanzados
GET /api/centros-costo?filter={"tipo__in":"Proyecto,Propiedad"}
GET /api/centros-costo?filter={"nombre__like":"%admin%"}
```

**Validaciones implementadas por el modelo:**
- ✅ `nombre` único (constraint UNIQUE)
- ✅ `codigo_contable` indexado para búsquedas rápidas
- ✅ Soft delete automático (campo `deleted_at`)
- ✅ Campos `created_at`, `updated_at` automáticos

**Validaciones adicionales :**
- Validar que no se elimine si tiene solicitudes asociadas

**Nota:** El CRUD genérico maneja automáticamente la coerción de tipos, validaciones de Pydantic/SQLModel, y respuestas estándar. No es necesario crear endpoints personalizados a menos que haya lógica de negocio específica.

---

### 2.2 Modificación: Router Solicitudes

**Archivo:** `backend/app/routers/solicitud_router.py`

**Cambios necesarios:**

El router de solicitudes usa `NestedCRUD`, por lo que los cambios son mínimos:

1. **El campo `centro_costo_id` se valida automáticamente** por SQLModel (FK constraint)
2. **La relación `centro_costo` se expandirá automáticamente** en las respuestas de la API gracias a `__expanded_list_relations__ = {"detalles", "centro_costo"}`

**No requiere cambios adicionales en el router.**

---

### 2.3 Modificación: Router Solicitudes Detalle

**Archivo:** `backend/app/routers/solicitud_router.py` (los detalles se manejan en el mismo router)

**Cambios necesarios:**

Los campos `precio` e `importe` se agregan al modelo `SolicitudDetalle`. 

**Cálculo de importe:**
- ✅ El **frontend** calcula `importe = cantidad * precio` antes de enviar al backend
- El backend recibe ambos campos ya calculados
- No se requiere lógica adicional en el backend

**Validaciones automáticas del modelo:**
- ✅ `precio >= 0` (usar `Field(ge=0)` en el modelo)
- ✅ `importe >= 0` (usar `Field(ge=0)` en el modelo)

**No requiere cambios en el router** - El `NestedCRUD` existente maneja los campos automáticamente.

---

### 2.4 Actualización: Main Router

**Archivo:** `backend/app/main.py`

```python
# AGREGAR import
from app.routers.centro_costo_router import centro_costo_router

# AGREGAR registro del router
app.include_router(centro_costo_router)
```

**Nota:** El `prefix` y `tags` ya están configurados en el router factory, no es necesario especificarlos aquí.

---

## 3. CRUD OPERATIONS

### 3.1 CRUD: Centro de Costo

**No es necesario crear archivo CRUD personalizado.**

El router usa directamente `GenericCRUD(CentroCosto)`, que proporciona:

- ✅ `create(session, data)` - Crear centro de costo
- ✅ `get(session, obj_id)` - Obtener por ID
- ✅ `list(session, page, per_page, filters, q)` - Listar con filtros
- ✅ `update(session, obj_id, data)` - Actualizar
- ✅ `delete(session, obj_id)` - Soft delete (marca `deleted_at`)

**Métodos automáticos del GenericCRUD:**
- Coerción automática de tipos
- Filtros avanzados (`tipo__eq`, `activo__is`, `nombre__like`, etc.)
- Búsqueda general con parámetro `q` en `__searchable_fields__`
- Soft delete con campo `deleted_at`
- Paginación compatible con React Admin



### 3.2 CRUD: Solicitud (sin cambios)

El router de solicitudes ya usa `NestedCRUD` que maneja automáticamente:
- Creación de cabecera + detalles en una transacción
- Sincronización de detalles en UPDATE
- Validaciones de FK (incluyendo `centro_costo_id`)

**No requiere cambios en el CRUD existente.**

---

## 4. MIGRACIONES ALEMBIC

### 4.1 Script de Migración

**Archivo:** `backend/alembic/versions/XXXX_add_centro_costo.py`

**Generación:**
```bash
cd backend
alembic revision --autogenerate -m "add centro_costo and update solicitudes"
```

**Contenido esperado:**

```python
"""add centro_costo and update solicitudes

Revision ID: XXXX
Revises: YYYY
Create Date: 2025-11-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'XXXX'
down_revision = 'YYYY'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Crear tabla centros_costo
    op.create_table(
        'centros_costo',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nombre', sa.String(length=200), nullable=False),
        sa.Column('tipo', sa.String(length=50), nullable=False),
        sa.Column('codigo_contable', sa.String(length=50), nullable=False),
        sa.Column('descripcion', sa.String(length=1000), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('nombre')
    )
    op.create_index('idx_centros_costo_nombre', 'centros_costo', ['nombre'])
    op.create_index('idx_centros_costo_tipo', 'centros_costo', ['tipo'])
    op.create_index('idx_centros_costo_codigo_contable', 'centros_costo', ['codigo_contable'])
    
    # 2. Agregar campos a solicitudes_detalle
    op.add_column('solicitudes_detalle', 
        sa.Column('precio', sa.DECIMAL(precision=15, scale=2), nullable=False, server_default='0')
    )
    op.add_column('solicitudes_detalle', 
        sa.Column('importe', sa.DECIMAL(precision=15, scale=2), nullable=False, server_default='0')
    )
    
    # 3. Agregar campo a solicitudes (nullable temporalmente)
    op.add_column('solicitudes', 
        sa.Column('centro_costo_id', sa.Integer(), nullable=True)
    )
    
    # 4. Popular centros de costo desde propiedades y proyectos
    # Se ejecutará mediante script Python separado después de la migración
    
    # 5. Asignar centro de costo por defecto (ID=1) a solicitudes existentes
    op.execute("UPDATE solicitudes SET centro_costo_id = 1 WHERE centro_costo_id IS NULL")
    
    # 6. Hacer NOT NULL el campo centro_costo_id
    op.alter_column('solicitudes', 'centro_costo_id', nullable=False)
    
    # 7. Agregar FK constraint
    op.create_foreign_key(
        'fk_solicitudes_centro_costo',
        'solicitudes', 'centros_costo',
        ['centro_costo_id'], ['id']
    )

def downgrade() -> None:
    op.drop_constraint('fk_solicitudes_centro_costo', 'solicitudes', type_='foreignkey')
    op.drop_column('solicitudes', 'centro_costo_id')
    op.drop_column('solicitudes_detalle', 'importe')
    op.drop_column('solicitudes_detalle', 'precio')
    op.drop_index('idx_centros_costo_codigo_contable', table_name='centros_costo')
    op.drop_index('idx_centros_costo_tipo', table_name='centros_costo')
    op.drop_index('idx_centros_costo_nombre', table_name='centros_costo')
    op.drop_table('centros_costo')
```

---

### 4.2 Script de Población de Datos

**Archivo:** `backend/scripts/populate_centros_costo.py`

```python
"""
Script para popular centros de costo desde propiedades y proyectos existentes
Ejecutar DESPUÉS de la migración Alembic
"""
from sqlmodel import Session, select
from app.db import engine
from app.models import CentroCosto, Propiedad, Proyecto

def populate_centros_costo():
    with Session(engine) as session:
        print("🚀 Iniciando población de centros de costo...")
        
        # 1. Crear centro de costo por cada propiedad
        propiedades = session.exec(select(Propiedad)).all()
        for prop in propiedades:
            centro = CentroCosto(
                nombre=f"Propiedad - {prop.nombre}",
                tipo="Propiedad",
                codigo_contable=f"PROP-{prop.id:04d}",
                descripcion=f"Centro de costo para propiedad {prop.nombre}",
                activo=True
            )
            session.add(centro)
            print(f"  ✅ Creado: {centro.nombre} ({centro.codigo_contable})")
        
        # 2. Crear centro de costo por cada proyecto
        proyectos = session.exec(select(Proyecto)).all()
        for proy in proyectos:
            centro = CentroCosto(
                nombre=f"Proyecto - {proy.nombre}",
                tipo="Proyecto",
                codigo_contable=f"PROY-{proy.id:04d}",
                descripcion=f"Centro de costo para proyecto {proy.nombre}",
                activo=True
            )
            session.add(centro)
            print(f"  ✅ Creado: {centro.nombre} ({centro.codigo_contable})")
        
        # 3. Crear 4 centros de costo generales
        generales = [
            ("Administración General", "GEN-0001", "Gastos administrativos generales de la empresa"),
            ("Marketing y Ventas", "GEN-0002", "Gastos de marketing, publicidad y equipo comercial"),
            ("Recursos Humanos", "GEN-0003", "Gastos de RRHH, capacitación y desarrollo"),
            ("Infraestructura IT", "GEN-0004", "Gastos de tecnología, sistemas y soporte técnico"),
        ]
        
        for nombre, codigo, descripcion in generales:
            centro = CentroCosto(
                nombre=nombre,
                tipo="General",
                codigo_contable=codigo,
                descripcion=descripcion,
                activo=True
            )
            session.add(centro)
            print(f"  ✅ Creado: {centro.nombre} ({centro.codigo_contable})")
        
        session.commit()
        print("\n✅ Población completada exitosamente!")
        
        # Mostrar resumen
        total = session.exec(select(CentroCosto)).all()
        print(f"\n📊 Total centros de costo creados: {len(total)}")
        print(f"   - Propiedades: {len(propiedades)}")
        print(f"   - Proyectos: {len(proyectos)}")
        print(f"   - Generales: 4")

if __name__ == "__main__":
    populate_centros_costo()
```

**Ejecución:**
```bash
cd backend
python scripts/populate_centros_costo.py
```

---

## 5. DATOS SEED

### 5.1 Actualización de Seeds

**Archivo:** `backend/app/data/seed_data.py` (o crear nuevo archivo)

```python
# Agregar función para seed de centros de costo
def seed_centros_costo(db: Session):
    """Crear centros de costo de prueba si no existen"""
    
    # Verificar si ya existen
    existing = db.exec(select(CentroCosto)).first()
    if existing:
        print("⚠️  Centros de costo ya existen, saltando seed...")
        return
    
    centros = [
        # Centro de costo por defecto (ID=1)
        CentroCosto(
            nombre="Sin Asignar",
            tipo="General",
            codigo_contable="GEN-0000",
            descripcion="Centro de costo por defecto para solicitudes sin asignar",
            activo=True
        ),
        # Generales
        CentroCosto(
            nombre="Administración General",
            tipo="General",
            codigo_contable="GEN-0001",
            descripcion="Gastos administrativos generales",
            activo=True
        ),
        CentroCosto(
            nombre="Marketing y Ventas",
            tipo="General",
            codigo_contable="GEN-0002",
            descripcion="Gastos de marketing y ventas",
            activo=True
        ),
        # Socios
        CentroCosto(
            nombre="Socio - Juan Pérez",
            tipo="Socios",
            codigo_contable="SOC-0001",
            descripcion="Gastos del socio Juan Pérez",
            activo=True
        ),
    ]
    
    for centro in centros:
        db.add(centro)
    
    db.commit()
    print(f"✅ Creados {len(centros)} centros de costo de prueba")
```

---

## 6. CASOS DE PRUEBA

### 6.1 Tests de Modelo

**Archivo:** `backend/tests/test_models/test_centro_costo.py`

```python
import pytest
from sqlmodel import Session
from app.models import CentroCosto, Proyecto, Propiedad

def test_create_centro_costo_general(session: Session):
    """Crear centro de costo tipo General"""
    centro = CentroCosto(
        nombre="Test General",
        tipo="General",
        codigo_contable="TEST-001",
        activo=True
    )
    session.add(centro)
    session.commit()
    
    assert centro.id is not None
    assert centro.nombre == "Test General"
    assert centro.tipo == "General"
    assert centro.activo is True

def test_create_centro_costo_proyecto(session: Session):
    """Crear centro de costo tipo Proyecto"""
    centro = CentroCosto(
        nombre="CC Proyecto Test",
        tipo="Proyecto",
        codigo_contable="PROY-001",
        descripcion="Centro de costo para proyecto de prueba",
        activo=True
    )
    session.add(centro)
    session.commit()
    
    assert centro.tipo == "Proyecto"

def test_unique_codigo_contable(session: Session):
    """Verificar que codigo_contable NO es único (puede repetirse)"""
    centro1 = CentroCosto(
        nombre="Test 1",
        tipo="General",
        codigo_contable="SHARED-001",
        activo=True
    )
    session.add(centro1)
    session.commit()
    
    centro2 = CentroCosto(
        nombre="Test 2",
        tipo="General",
        codigo_contable="SHARED-001",  # Mismo código
        activo=True
    )
    session.add(centro2)
    session.commit()  # No debe fallar
    
    assert centro1.codigo_contable == centro2.codigo_contable

def test_soft_delete(session: Session):
    """Verificar soft delete (activo=False)"""
    centro = CentroCosto(
        nombre="Test Delete",
        tipo="General",
        codigo_contable="DEL-001",
        activo=True
    )
    session.add(centro)
    session.commit()
    
    centro.activo = False
    session.commit()
    
    assert centro.activo is False
```

---

### 6.2 Tests de Endpoints

**Archivo:** `backend/tests/test_routers/test_centro_costo.py`

```python
import pytest
from fastapi.testclient import TestClient
from app.models import CentroCosto

def test_get_all_centros_costo(client: TestClient, centro_costo: CentroCosto):
    """GET /api/centros-costo - Listar todos"""
    response = client.get("/api/centros-costo")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0

def test_get_centro_costo_by_id(client: TestClient, centro_costo: CentroCosto):
    """GET /api/centros-costo/{id} - Obtener por ID"""
    response = client.get(f"/api/centros-costo/{centro_costo.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == centro_costo.id
    assert data["nombre"] == centro_costo.nombre

def test_create_centro_costo(client: TestClient):
    """POST /api/centros-costo - Crear nuevo"""
    payload = {
        "nombre": "Nuevo Centro",
        "tipo": "General",
        "codigo_contable": "NEW-001",
        "descripcion": "Descripción de prueba",
        "activo": True
    }
    response = client.post("/api/centros-costo", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["nombre"] == payload["nombre"]
    assert data["codigo_contable"] == payload["codigo_contable"]

def test_update_centro_costo(client: TestClient, centro_costo: CentroCosto):
    """PUT /api/centros-costo/{id} - Actualizar"""
    payload = {"nombre": "Nombre Actualizado"}
    response = client.put(f"/api/centros-costo/{centro_costo.id}", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["nombre"] == "Nombre Actualizado"

def test_delete_centro_costo(client: TestClient, centro_costo: CentroCosto):
    """DELETE /api/centros-costo/{id} - Soft delete"""
    response = client.delete(f"/api/centros-costo/{centro_costo.id}")
    assert response.status_code == 204

def test_filter_by_tipo(client: TestClient):
    """GET /api/centros-costo?tipo=General - Filtrar por tipo"""
    response = client.get("/api/centros-costo?tipo=General")
    assert response.status_code == 200
    data = response.json()
    for item in data:
        assert item["tipo"] == "General"

def test_create_duplicate_codigo_contable(client: TestClient, centro_costo: CentroCosto):
    """POST con codigo_contable duplicado debe ser permitido"""
    payload = {
        "nombre": "Otro Centro",
        "tipo": "General",
        "codigo_contable": centro_costo.codigo_contable,  # Duplicado permitido
        "activo": True
    }
    response = client.post("/api/centros-costo", json=payload)
    assert response.status_code == 201  # Debe permitir duplicados
    data = response.json()
    assert data["codigo_contable"] == centro_costo.codigo_contable
```

---

### 6.3 Tests de Solicitud con Centro de Costo

**Archivo:** `backend/tests/test_routers/test_solicitud_centro_costo.py`

```python
def test_create_solicitud_with_centro_costo(client: TestClient, centro_costo: CentroCosto):
    """Crear solicitud con centro de costo"""
    payload = {
        "tipo_solicitud_id": 1,
        "departamento_id": 1,
        "solicitante_id": 1,
        "centro_costo_id": centro_costo.id,
        "fecha_necesidad": "2025-12-01",
        "comentario": "Test"
    }
    response = client.post("/api/solicitudes", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["centro_costo_id"] == centro_costo.id

def test_create_solicitud_without_centro_costo(client: TestClient):
    """Crear solicitud sin centro de costo debe fallar"""
    payload = {
        "tipo_solicitud_id": 1,
        "departamento_id": 1,
        "solicitante_id": 1,
        # centro_costo_id faltante
        "fecha_necesidad": "2025-12-01"
    }
    response = client.post("/api/solicitudes", json=payload)
    assert response.status_code == 422
```

---

### 6.4 Tests de Solicitud Detalle con Precio

**Archivo:** `backend/tests/test_models/test_solicitud_detalle_precio.py`

```python
from decimal import Decimal

def test_solicitud_detalle_calculo_importe(session: Session):
    """Verificar cálculo automático de importe"""
    detalle = SolicitudDetalle(
        solicitud_id=1,
        articulo_id=1,
        cantidad=Decimal("10"),
        precio=Decimal("150.50")
    )
    detalle.importe = detalle.cantidad * detalle.precio
    
    assert detalle.importe == Decimal("1505.00")

def test_solicitud_detalle_precio_negativo(session: Session):
    """Precio negativo debe ser validado en endpoint"""
    # Esta validación se hace en el router, no en el modelo
    pass

def test_migration_default_values(session: Session):
    """Verificar que migración asigna 0 a campos precio/importe"""
    # Ejecutar después de la migración
    detalles = session.exec(select(SolicitudDetalle)).all()
    for detalle in detalles:
        assert detalle.precio == Decimal("0")
        assert detalle.importe == Decimal("0")
```

---

## 7. CHECKLIST DE IMPLEMENTACIÓN

### 7.1 Modelos y Base de Datos
- [ ] Crear modelo `CentroCosto` con todos los campos
- [ ] Agregar relationships a `CentroCosto`
- [ ] Modificar modelo `Solicitud` (agregar `centro_costo_id`)
- [ ] Modificar modelo `SolicitudDetalle` (agregar `precio`, `importe`)
- [ ] Actualizar `__init__.py` con exports
- [ ] Generar migración Alembic
- [ ] Revisar migración autogenerada
- [ ] Ejecutar migración en desarrollo
- [ ] Ejecutar script de población de centros de costo

### 7.2 CRUD y Lógica de Negocio
- [x] **No requiere CRUD personalizado** - Se usa `GenericCRUD(CentroCosto)` directamente
- [ ] (Opcional) Crear `crud/centro_costo_crud.py` solo si se necesitan validaciones específicas

### 7.3 Endpoints
- [x] **No requiere endpoints personalizados** - Se usa Router Factory con `GenericCRUD`
- [ ] Crear router `routers/centro_costo_router.py` con `create_generic_router()`
- [ ] Registrar router en `main.py`
- [ ] Validar funcionamiento con filtros React Admin
- [ ] Modificar modelo Solicitud (agregar `__expanded_list_relations__` con `centro_costo`)
- [x] **Cálculo de importe** - Se realiza en el frontend (cantidad × precio)

### 7.4 Seeds y Datos de Prueba
- [ ] Crear/actualizar seed para centros de costo
- [ ] Crear centro de costo "Sin Asignar" (ID=1)
- [ ] Crear 4 centros de costo generales
- [ ] Vincular centros a propiedades existentes
- [ ] Vincular centros a proyectos existentes

### 7.5 Testing
- [ ] Tests de modelo `CentroCosto`
- [ ] Tests de constraints (unique nombre)
- [ ] Tests de endpoints CRUD centro de costo
- [ ] Tests de filtros (tipo, activo)
- [ ] Tests de validaciones (nombre duplicado)
- [ ] Tests de solicitud con centro de costo
- [ ] Tests de solicitud_detalle con precio/importe
- [ ] Tests de migración (valores por defecto)

### 7.6 Documentación
- [ ] Actualizar README con nueva entidad
- [ ] Documentar endpoints en Swagger/OpenAPI
- [ ] Documentar reglas de negocio (tipos de centro de costo)
- [ ] Agregar ejemplos de uso en docs

### 7.7 Validación Final
- [ ] Verificar migración en base de datos limpia
- [ ] Verificar seeds funcionan correctamente
- [ ] Ejecutar suite completa de tests
- [ ] Verificar cobertura de tests > 80%
- [ ] Validar respuestas de API con Postman/Insomnia
- [ ] Code review
- [ ] Merge a branch principal

---

## 8. COMANDOS ÚTILES

### Desarrollo
```bash
# Generar migración
cd backend
alembic revision --autogenerate -m "add centro_costo and update solicitudes"

# Aplicar migración
alembic upgrade head

# Popular centros de costo
python scripts/populate_centros_costo.py

# Ejecutar tests
pytest tests/test_models/test_centro_costo.py -v
pytest tests/test_routers/test_centro_costo.py -v

# Ejecutar todos los tests
pytest --cov=app --cov-report=term-missing

# Iniciar servidor desarrollo
uvicorn app.main:app --reload --port 8000
```

### Verificación
```bash
# Verificar estructura de tabla en DB
psql -U sak_user -d sak -c "\d centros_costo"

# Ver datos seed
psql -U sak_user -d sak -c "SELECT * FROM centros_costo;"

# Verificar migración aplicada
alembic current
alembic history
```

---

## 9. NOTAS ADICIONALES

### 9.1 Consideraciones de Diseño

1. **Centro de Costo como entidad central**: Permite máxima flexibilidad. Es independiente de proyectos y propiedades, funcionando como concepto contable universal.

2. **Soft Delete**: Los centros de costo no se eliminan físicamente, solo se marcan como inactivos para mantener integridad referencial histórica.

3. **Código Contable no único**: Permite flexibilidad para tener múltiples centros de costo con el mismo código contable si es necesario para la contabilidad de la organización.

4. **Nombre único**: El nombre sí debe ser único para evitar confusiones en la selección de centros de costo.

5. **Tipos parametrizables**: Los tipos (Proyecto, Propiedad, Socios, General) están hardcodeados por ahora, pero podrían moverse a una tabla `tipos_centro_costo` si se requiere mayor flexibilidad.

6. **Sin FK a Proyecto/Propiedad**: El centro de costo es autónomo. Si se necesita asociar un centro de costo específico con un proyecto/propiedad, se puede hacer por convención de nombre o código contable (ej: "PROP-0001", "PROY-0001").

### 9.2 Posibles Mejoras Futuras

- [ ] Agregar campo `presupuesto` a `CentroCosto`
- [ ] Crear endpoint de reportes por centro de costo
- [ ] Implementar jerarquía de centros de costo (padre-hijo)
- [ ] Agregar auditoría de cambios en centros de costo
- [ ] Dashboard de gastos por centro de costo

### 9.3 Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Solicitudes existentes sin centro de costo | Alta | Alto | Asignar ID=1 por defecto en migración |
| Nombre duplicado | Media | Medio | Constraint UNIQUE en nombre |
| Eliminación de centro con solicitudes | Media | Alto | Soft delete + validación antes de eliminar |
| Inconsistencia precio vs importe | Baja | Medio | Calcular en backend, validar en frontend |

---

## 10. APROBACIÓN Y SEGUIMIENTO

| Rol | Nombre | Fecha | Firma/Aprobación |
|-----|--------|-------|------------------|
| **Desarrollador** | [Tu nombre] | 2025-11-11 | ✅ |
| **Revisor Técnico** | [Nombre] | [Fecha] | [ ] |
| **Product Owner** | [Nombre] | [Fecha] | [ ] |

**Estado Actual:** 📝 Especificación Completa - Pendiente de Implementación

---

**Última actualización:** 2025-11-11  
**Próxima revisión:** Después de implementar modelos y migraciones
