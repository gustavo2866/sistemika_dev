# 📋 SPEC - Completar Modelo de Datos Solicitudes

> **Referencia:** [README_BACKEND_PATTERNS.md](../README_BACKEND_PATTERNS_v1.md)  
> **Basado en:** [20251107_bk_solicitudes_req.md](./20251107_bk_solicitudes_req.md)  
> **Fecha:** 2025-11-10  
> **Versión:** 1.0

---

## 📋 METADATA DEL CAMBIO

| Campo | Valor |
|-------|-------|
| **ID del Cambio** | `CHG-2025-001` |
| **Título** | `Refactor modelo Solicitudes - Parametrización de Tipos, Departamentos y Estados` |
| **Tipo** | `[x] Nueva Entidad  [x] Modificar Entidad  [ ] Nuevo Endpoint  [ ] Servicio  [ ] Refactor  [ ] Bugfix` |
| **Prioridad** | `[ ] Crítica  [x] Alta  [ ] Media  [ ] Baja` |
| **Fecha Creación** | `2025-11-09` |
| **Autor** | `Gustavo` |
| **Estimación** | `8 horas` |
| **Estado** | `[x] Planificado  [ ] En Desarrollo  [ ] Testing  [ ] Completado  [ ] Revertido` |

---

## 1. RESUMEN EJECUTIVO

Refactorizar el modelo de Solicitudes para:
1. **Parametrizar Tipos de Solicitud**: Migrar de enum fijo a tabla `tipos_solicitud` con configuración por tipo
2. **Agregar Departamentos**: Nueva tabla `departamentos` con asignación a solicitudes
3. **Agregar Estados**: Campo `estado` en Solicitudes con enum de workflow
4. **Agregar Total**: Campo `total` para almacenar monto total de la solicitud
5. **Defaults configurables**: Tipos de solicitud determinan valores sugeridos de departamento y artículo (modificables por usuario)

**Impacto:** Alto - Cambio estructural que afecta modelo core y requiere migración de datos existentes.

**Nota sobre defaults:** Los campos `departamento_default_id` y `articulo_default_id` en `TipoSolicitud` son valores **sugeridos** que el frontend utiliza al crear solicitudes. El usuario puede modificar estos valores libremente. No se aplican automáticamente en backend.

---

## 2. CAMBIOS EN MODELO DE DATOS

### 2.1 Nueva Entidad: `Departamento`

**Propósito:** Gestionar los departamentos que pueden procesar solicitudes de compra.

```python
# app/models/departamento.py

from typing import TYPE_CHECKING, ClassVar, List, Optional
from sqlmodel import Field, Relationship
from .base import Base

if TYPE_CHECKING:
    from .solicitud import Solicitud
    from .tipo_solicitud import TipoSolicitud

class Departamento(Base, table=True):
    """Departamentos que procesan solicitudes de compra"""
    
    __tablename__ = "departamentos"
    __searchable_fields__: ClassVar[List[str]] = ["nombre", "descripcion"]
    
    nombre: str = Field(
        max_length=100,
        unique=True,
        index=True,
        description="Nombre del departamento (ej: Compras, Administración)"
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Descripción de las responsabilidades del departamento"
    )
    activo: bool = Field(
        default=True,
        description="Indica si el departamento está operativo"
    )
    
    # Relaciones
    solicitudes: List["Solicitud"] = Relationship(back_populates="departamento")
    tipos_solicitud_default: List["TipoSolicitud"] = Relationship(back_populates="departamento_default")
    
    def __str__(self) -> str:
        return f"Departamento(id={self.id}, nombre='{self.nombre}')"
```

**Campos:**
- `nombre`: Único, indexado (Compras, Administración, Cadete, Fletero)
- `descripcion`: Opcional, texto descriptivo
- `activo`: Boolean para soft disable (no usar deleted_at para esto)

---

### 2.2 Nueva Entidad: `TipoSolicitud`

**Propósito:** Parametrizar los tipos de solicitud con configuración asociada.

```python
# app/models/tipo_solicitud.py

from typing import TYPE_CHECKING, ClassVar, List, Optional
from sqlmodel import Field, Relationship
from .base import Base

if TYPE_CHECKING:
    from .solicitud import Solicitud
    from .departamento import Departamento
    from .articulo import Articulo

class TipoSolicitud(Base, table=True):
    """Tipos de solicitud parametrizables (Materiales, Servicios, Insumos, etc.)"""
    
    __tablename__ = "tipos_solicitud"
    __searchable_fields__: ClassVar[List[str]] = ["nombre", "descripcion"]
    __expanded_list_relations__: ClassVar[set[str]] = {"departamento_default", "articulo_default"}
    
    nombre: str = Field(
        max_length=100,
        unique=True,
        index=True,
        description="Nombre del tipo (ej: Materiales, Servicios, Insumos)"
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Descripción del tipo de solicitud"
    )
    tipo_articulo_filter: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Filtro de tipo_articulo para limitar artículos disponibles (ej: Material, Ferreteria)"
    )
    articulo_default_id: Optional[int] = Field(
        default=None,
        foreign_key="articulos.id",
        description="Artículo sugerido por defecto al crear detalles (el usuario puede cambiarlo)"
    )
    departamento_default_id: Optional[int] = Field(
        default=None,
        foreign_key="departamentos.id",
        description="Departamento sugerido por defecto al crear solicitudes (el usuario puede cambiarlo)"
    )
    activo: bool = Field(
        default=True,
        description="Indica si el tipo está disponible para nuevas solicitudes"
    )
    
    # Relaciones
    solicitudes: List["Solicitud"] = Relationship(back_populates="tipo_solicitud")
    departamento_default: Optional["Departamento"] = Relationship(back_populates="tipos_solicitud_default")
    articulo_default: Optional["Articulo"] = Relationship()
    
    def __str__(self) -> str:
        return f"TipoSolicitud(id={self.id}, nombre='{self.nombre}')"
```

**Campos:**
- `nombre`: Único, indexado (Materiales, Servicios, Insumos, Oficina, etc.)
- `tipo_articulo_filter`: Filtra artículos por `articulo.tipo_articulo` (ej: "Material", "Ferreteria")
- `articulo_default_id`: FK opcional a artículo sugerido
- `departamento_default_id`: FK opcional a departamento default
- `activo`: Boolean para deshabilitar tipos sin eliminar historial
- `orden`: Para ordenar en selects del frontend

---

### 2.3 Modificación: `Solicitud`

**Cambios:**
1. Eliminar enum `TipoSolicitud` (migrar a FK)
2. Agregar FK a `tipo_solicitud_id`
3. Agregar FK a `departamento_id`
4. Agregar campo `estado`

```python
# app/models/solicitud.py

from datetime import date
from enum import Enum
from typing import TYPE_CHECKING, ClassVar, List, Optional
from decimal import Decimal
from sqlalchemy import Column, String, DECIMAL
from sqlmodel import Field, Relationship
from .base import Base

if TYPE_CHECKING:
    from .solicitud_detalle import SolicitudDetalle
    from .user import User
    from .tipo_solicitud import TipoSolicitud
    from .departamento import Departamento

class EstadoSolicitud(str, Enum):
    """Estados del workflow de una solicitud"""
    PENDIENTE = "pendiente"
    APROBADO = "aprobado"
    RECHAZADO = "rechazado"
    COMPLETADO = "completado"

class Solicitud(Base, table=True):
    """Modelo principal para solicitudes de compra"""

    __tablename__ = "solicitudes"
    __searchable_fields__: ClassVar[List[str]] = ["comentario"]
    __expanded_list_relations__: ClassVar[set[str]] = {"detalles", "tipo_solicitud", "departamento"}

    # CAMPOS MODIFICADOS/NUEVOS
    tipo_solicitud_id: int = Field(
        foreign_key="tipos_solicitud.id",
        description="Tipo de solicitud (parametrizable)"
    )
    departamento_id: int = Field(
        foreign_key="departamentos.id",
        description="Departamento que procesará la solicitud"
    )
    estado: EstadoSolicitud = Field(
        default=EstadoSolicitud.PENDIENTE,
        sa_column=Column(String(20), nullable=False),
        description="Estado actual de la solicitud"
    )
    total: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(15, 2), nullable=False),
        description="Monto total de la solicitud (suma de detalles)"
    )
    
    # CAMPOS EXISTENTES (sin cambios)
    fecha_necesidad: date = Field(description="Fecha en la que se requiere la solicitud")
    comentario: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Comentario adicional del solicitante"
    )
    solicitante_id: int = Field(
        foreign_key="users.id",
        description="Identificador del usuario solicitante"
    )

    # RELACIONES
    tipo_solicitud: "TipoSolicitud" = Relationship(back_populates="solicitudes")
    departamento: "Departamento" = Relationship(back_populates="solicitudes")
    solicitante: "User" = Relationship(back_populates="solicitudes")
    detalles: List["SolicitudDetalle"] = Relationship(
        back_populates="solicitud",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

    def __str__(self) -> str:
        return f"Solicitud(id={self.id}, tipo={self.tipo_solicitud_id}, estado='{self.estado}')"
```

**Cambios clave:**
- ❌ **ELIMINAR:** Campo `tipo: TipoSolicitud` (enum)
- ❌ **ELIMINAR:** Enum `TipoSolicitud` con valores NORMAL/DIRECTA
- ✅ **AGREGAR:** `tipo_solicitud_id: int` (FK a tabla)
- ✅ **AGREGAR:** `departamento_id: int` (FK a tabla, usuario puede modificarlo)
- ✅ **AGREGAR:** `estado: EstadoSolicitud` (enum de workflow)
- ✅ **AGREGAR:** `total: Decimal` (monto total de la solicitud)
- ✅ **AGREGAR:** Relaciones a `TipoSolicitud` y `Departamento`

**Nota importante:** Tanto `departamento_id` como `articulo_default_id` en detalles son valores **sugeridos por defecto** según el tipo de solicitud, pero el usuario puede modificarlos libremente al crear/editar la solicitud.

**Migración de datos existentes:** Las solicitudes actuales con tipo enum (normal/directa) se migrarán a la nueva estructura. Los tipos "Normal" y "Directa" NO se crearán en el sistema nuevo, solo se necesitan temporalmente durante la migración para mapear datos históricos.

---

### 2.4 Diagrama de Relaciones

```
┌─────────────────────┐
│   Departamento      │
│  ─────────────────  │
│  + nombre           │
│  + descripcion      │
│  + activo           │
└──────────┬──────────┘
           │
           │ 1:N
           │
           ▼
┌─────────────────────┐         ┌─────────────────────┐
│  TipoSolicitud      │         │     Articulo        │
│  ─────────────────  │         │  ─────────────────  │
│  + nombre           │         │  + nombre           │
│  + codigo           │         │  + tipo_articulo    │
│  + tipo_articulo_   │         │  + precio           │
│    filter           │         └─────────────────────┘
│  + articulo_        │                 ▲
│    default_id ──────┼─────────────────┘
│  + departamento_    │
│    default_id ──────┘
│  + activo           │
│  + orden            │
└──────────┬──────────┘
           │
           │ 1:N
           │
           ▼
┌─────────────────────┐         ┌─────────────────────┐
│     Solicitud       │         │        User         │
│  ─────────────────  │         │  ─────────────────  │
│  + tipo_solicitud_id│         │  + nombre           │
│  + departamento_id  │         │  + email            │
│  + estado           │         └─────────────────────┘
│  + fecha_necesidad  │                 ▲
│  + comentario       │                 │
│  + solicitante_id ──┼─────────────────┘
└──────────┬──────────┘
           │
           │ 1:N (cascade delete)
           │
           ▼
┌─────────────────────┐
│  SolicitudDetalle   │
│  ─────────────────  │
│  + solicitud_id     │
│  + articulo_id      │
│  + descripcion      │
│  + cantidad         │
└─────────────────────┘
```

---

## 3. MIGRACIONES

### 3.1 Secuencia de Migraciones

**Orden crítico para evitar pérdida de datos:**

```
1. Crear tabla departamentos
2. Seed departamentos base
3. Crear tabla tipos_solicitud
4. Seed tipos_solicitud base
5. Agregar columnas a solicitudes (tipo_solicitud_id, departamento_id, estado)
6. Migrar datos existentes (tipo enum → tipo_solicitud_id)
7. Eliminar columna tipo (enum) de solicitudes
8. Crear índices y constraints
```

### 3.2 Migración 1: Crear Departamentos

```python
# alembic/versions/XXXX_create_departamentos_table.py
"""create departamentos table

Revision ID: 0020_create_departamentos
Revises: 0019_...
Create Date: 2025-11-10
"""

def upgrade():
    op.create_table(
        'departamentos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('descripcion', sa.String(500), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('nombre')
    )
    op.create_index('ix_departamentos_nombre', 'departamentos', ['nombre'])

def downgrade():
    op.drop_index('ix_departamentos_nombre', 'departamentos')
    op.drop_table('departamentos')
```

### 3.3 Migración 2: Crear Tipos de Solicitud

```python
# alembic/versions/XXXX_create_tipos_solicitud_table.py
"""create tipos_solicitud table

Revision ID: 0021_create_tipos_solicitud
Revises: 0020_create_departamentos
Create Date: 2025-11-10
"""

def upgrade():
    op.create_table(
        'tipos_solicitud',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('descripcion', sa.String(500), nullable=True),
        sa.Column('tipo_articulo_filter', sa.String(100), nullable=True),
        sa.Column('articulo_default_id', sa.Integer(), nullable=True),
        sa.Column('departamento_default_id', sa.Integer(), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('nombre'),
        sa.ForeignKeyConstraint(['articulo_default_id'], ['articulos.id']),
        sa.ForeignKeyConstraint(['departamento_default_id'], ['departamentos.id'])
    )
    op.create_index('ix_tipos_solicitud_nombre', 'tipos_solicitud', ['nombre'])

def downgrade():
    op.drop_index('ix_tipos_solicitud_nombre', 'tipos_solicitud')
    op.drop_table('tipos_solicitud')
```

### 3.4 Migración 3: Modificar Solicitudes

```python
# alembic/versions/XXXX_refactor_solicitudes.py
"""refactor solicitudes - add tipo_solicitud_id, departamento_id, estado

Revision ID: 0022_refactor_solicitudes
Revises: 0021_create_tipos_solicitud
Create Date: 2025-11-10
"""

def upgrade():
    # 1. Agregar nuevas columnas (nullable temporalmente)
    op.add_column('solicitudes', sa.Column('tipo_solicitud_id', sa.Integer(), nullable=True))
    op.add_column('solicitudes', sa.Column('departamento_id', sa.Integer(), nullable=True))
    op.add_column('solicitudes', sa.Column('estado', sa.String(20), nullable=False, server_default='pendiente'))
    op.add_column('solicitudes', sa.Column('total', sa.DECIMAL(15, 2), nullable=False, server_default='0'))
    
    # 2. Asignar tipo_solicitud_id a NULL temporalmente (se asignará manualmente después)
    #    Las solicitudes existentes necesitarán ser reasignadas a uno de los nuevos tipos
    
    # 3. Asignar departamento "Compras" a todas las solicitudes existentes
    op.execute("""
        UPDATE solicitudes s
        SET departamento_id = d.id
        FROM departamentos d
        WHERE d.nombre = 'Compras'
    """)
    
    # 4. Para solicitudes sin tipo_solicitud_id, asignar el primer tipo disponible (temporal)
    #    IMPORTANTE: Revisar manualmente estas solicitudes después de la migración
    op.execute("""
        UPDATE solicitudes s
        SET tipo_solicitud_id = (SELECT id FROM tipos_solicitud ORDER BY id LIMIT 1)
        WHERE tipo_solicitud_id IS NULL
    """)
    
    # 5. Hacer columnas NOT NULL
    op.alter_column('solicitudes', 'tipo_solicitud_id', nullable=False)
    op.alter_column('solicitudes', 'departamento_id', nullable=False)
    
    # 6. Crear foreign keys
    op.create_foreign_key(
        'fk_solicitudes_tipo_solicitud',
        'solicitudes', 'tipos_solicitud',
        ['tipo_solicitud_id'], ['id']
    )
    op.create_foreign_key(
        'fk_solicitudes_departamento',
        'solicitudes', 'departamentos',
        ['departamento_id'], ['id']
    )
    
    # 7. Eliminar columna tipo (enum) antigua
    op.drop_column('solicitudes', 'tipo')

def downgrade():
    # Recrear columna tipo
    op.add_column('solicitudes', sa.Column('tipo', sa.String(20), nullable=True))
    
    # Migrar datos inverso
    op.execute("""
        UPDATE solicitudes s
        SET tipo = CASE ts.codigo
            WHEN 'NOR' THEN 'normal'
            WHEN 'DIR' THEN 'directa'
            ELSE 'normal'
        END
        FROM tipos_solicitud ts
        WHERE s.tipo_solicitud_id = ts.id
    """)
    
    op.alter_column('solicitudes', 'tipo', nullable=False)
    
    # Eliminar nuevas columnas
    op.drop_constraint('fk_solicitudes_departamento', 'solicitudes')
    op.drop_constraint('fk_solicitudes_tipo_solicitud', 'solicitudes')
    op.drop_column('solicitudes', 'total')
    op.drop_column('solicitudes', 'estado')
    op.drop_column('solicitudes', 'departamento_id')
    op.drop_column('solicitudes', 'tipo_solicitud_id')
```

---

## 4. SEED DATA

### 4.1 Seed Departamentos

```python
# scripts/seed_departamentos.py

from sqlmodel import Session
from app.db import engine, init_db
from app.models.departamento import Departamento

DEPARTAMENTOS_BASE = [
    {
        "nombre": "Compras",
        "descripcion": "Departamento de gestión de compras y proveedores",
        "activo": True
    },
    {
        "nombre": "Administración",
        "descripcion": "Departamento administrativo y financiero",
        "activo": True
    },
    {
        "nombre": "Cadete",
        "descripcion": "Servicio de mensajería y trámites locales",
        "activo": True
    },
    {
        "nombre": "Fletero",
        "descripcion": "Transporte y logística de mercadería",
        "activo": True
    },
]

def seed_departamentos():
    with Session(engine) as session:
        for data in DEPARTAMENTOS_BASE:
            # Verificar si existe
            existing = session.query(Departamento).filter_by(nombre=data["nombre"]).first()
            if not existing:
                dept = Departamento(**data)
                session.add(dept)
        
        session.commit()
        print(f"✅ {len(DEPARTAMENTOS_BASE)} departamentos creados/verificados")

if __name__ == "__main__":
    init_db()
    seed_departamentos()
```

### 4.2 Seed Tipos de Solicitud

```python
# scripts/seed_tipos_solicitud.py

from sqlmodel import Session, select
from app.db import engine, init_db
from app.models.tipo_solicitud import TipoSolicitud
from app.models.departamento import Departamento

TIPOS_SOLICITUD_BASE = [
    {
        "nombre": "Materiales de Construcción",
        "descripcion": "Solicitud de materiales para obra (cemento, arena, hierro, etc.)",
        "tipo_articulo_filter": "Material",
        "departamento_nombre": "Compras",
        "activo": True
    },
    {
        "nombre": "Ferretería",
        "descripcion": "Artículos de ferretería (clavos, tornillos, herramientas)",
        "tipo_articulo_filter": "Ferreteria",
        "departamento_nombre": "Compras",
        "activo": True
    },
    {
        "nombre": "Servicios",
        "descripcion": "Contratación de servicios profesionales o técnicos",
        "tipo_articulo_filter": None,
        "departamento_nombre": "Administración",
        "activo": True
    },
    {
        "nombre": "Insumos de Oficina",
        "descripcion": "Papelería, útiles y suministros de oficina",
        "tipo_articulo_filter": None,
        "departamento_nombre": "Administración",
        "activo": True
    },
    {
        "nombre": "Transporte y Logística",
        "descripcion": "Servicios de flete y transporte de mercadería",
        "tipo_articulo_filter": None,
        "departamento_nombre": "Fletero",
        "activo": True
    },
    {
        "nombre": "Mensajería",
        "descripcion": "Trámites, gestiones y mensajería local",
        "tipo_articulo_filter": None,
        "departamento_nombre": "Cadete",
        "activo": True
    },
]

def seed_tipos_solicitud():
    with Session(engine) as session:
        # Cargar departamentos para mapeo
        departamentos = {d.nombre: d.id for d in session.exec(select(Departamento)).all()}
        
        for data in TIPOS_SOLICITUD_BASE:
            # Verificar si existe por nombre
            existing = session.query(TipoSolicitud).filter_by(nombre=data["nombre"]).first()
            if not existing:
                # Mapear departamento_nombre → departamento_default_id
                dept_nombre = data.pop("departamento_nombre")
                data["departamento_default_id"] = departamentos.get(dept_nombre)
                
                tipo = TipoSolicitud(**data)
                session.add(tipo)
        
        session.commit()
        print(f"✅ {len(TIPOS_SOLICITUD_BASE)} tipos de solicitud creados/verificados")

if __name__ == "__main__":
    init_db()
    seed_tipos_solicitud()
```

---

## 5. CAMBIOS EN ENDPOINTS

### 5.1 Nuevos Routers

#### Router: Departamentos

```python
# app/routers/departamento_router.py

from app.models.departamento import Departamento
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

departamento_crud = GenericCRUD(Departamento)

departamento_router = create_generic_router(
    model=Departamento,
    crud=departamento_crud,
    prefix="/departamentos",
    tags=["departamentos"],
)
```

**Endpoints generados:**
- `POST /departamentos` - Crear departamento
- `GET /departamentos` - Listar con filtros
- `GET /departamentos/{id}` - Obtener por ID
- `PUT /departamentos/{id}` - Actualizar
- `DELETE /departamentos/{id}` - Soft delete

#### Router: Tipos de Solicitud

```python
# app/routers/tipo_solicitud_router.py

from app.models.tipo_solicitud import TipoSolicitud
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

tipo_solicitud_crud = GenericCRUD(TipoSolicitud)

tipo_solicitud_router = create_generic_router(
    model=TipoSolicitud,
    crud=tipo_solicitud_crud,
    prefix="/tipos-solicitud",
    tags=["tipos-solicitud"],
)
```

**Endpoints generados:**
- `POST /tipos-solicitud`
- `GET /tipos-solicitud`
- `GET /tipos-solicitud/{id}`
- `PUT /tipos-solicitud/{id}`
- `DELETE /tipos-solicitud/{id}`

**Nota:** Para obtener artículos filtrados por tipo, el frontend puede usar el endpoint general:
```
GET /articulos?filter={"tipo_articulo": "Material"}
```
Donde "Material" es el valor de `TipoSolicitud.tipo_articulo_filter`

### 5.2 Modificación: Router Solicitudes

**Actualizar para usar NestedCRUD y expandir relaciones:**

```python
# app/routers/solicitud_router.py

from app.models.solicitud import Solicitud
from app.models.solicitud_detalle import SolicitudDetalle
from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router

# Cambiar a NestedCRUD (si no lo era ya)
solicitud_crud = NestedCRUD(
    Solicitud,
    nested_relations={
        "detalles": {
            "model": SolicitudDetalle,
            "fk_field": "solicitud_id",
            "allow_delete": True,
        }
    },
)

solicitud_router = create_generic_router(
    model=Solicitud,
    crud=solicitud_crud,
    prefix="/solicitudes",
    tags=["solicitudes"],
)
```

**Endpoints generados:**
- `POST /solicitudes`
- `GET /solicitudes`
- `GET /solicitudes/{id}`
- `PUT /solicitudes/{id}` - Puede usarse para cambiar el estado
- `DELETE /solicitudes/{id}`

**Nota sobre cambio de estado:** El campo `estado` puede actualizarse usando `PUT /solicitudes/{id}` con `{"estado": "aprobado"}`. Las validaciones de transiciones de estado pueden implementarse en el frontend o agregarse como validación en el modelo/CRUD si se requiere.

### 5.3 Registrar en main.py

```python
# app/main.py

from app.routers.departamento_router import departamento_router
from app.routers.tipo_solicitud_router import tipo_solicitud_router
from app.routers.solicitud_router import solicitud_router  # Ya existe

# Registrar nuevos routers
app.include_router(departamento_router)
app.include_router(tipo_solicitud_router)
app.include_router(solicitud_router)  # Re-registrar con cambios
```

---

## 6. CASOS DE PRUEBA

### 6.1 Tests de Modelos

```python
# tests/test_models_solicitudes.py

def test_crear_departamento(session):
    """Test crear departamento válido"""
    dept = Departamento(
        nombre="Compras",
        descripcion="Departamento de compras",
        activo=True
    )
    session.add(dept)
    session.commit()
    session.refresh(dept)
    
    assert dept.id is not None
    assert dept.nombre == "Compras"
    assert dept.activo is True

def test_crear_tipo_solicitud_con_defaults(session):
    """Test crear tipo de solicitud con configuración"""
    # Crear departamento primero
    dept = Departamento(nombre="Compras", activo=True)
    session.add(dept)
    session.commit()
    
    tipo = TipoSolicitud(
        nombre="Materiales",
        tipo_articulo_filter="Material",
        departamento_default_id=dept.id,
        activo=True
    )
    session.add(tipo)
    session.commit()
    session.refresh(tipo)
    
    assert tipo.id is not None
    assert tipo.nombre == "Materiales"
    assert tipo.departamento_default_id == dept.id

def test_crear_solicitud_con_relaciones(session):
    """Test crear solicitud con tipo y departamento"""
    # Setup
    user = User(nombre="Test", email="test@test.com")
    dept = Departamento(nombre="Compras", activo=True)
    tipo = TipoSolicitud(nombre="Normal", activo=True)
    session.add_all([user, dept, tipo])
    session.commit()
    
    # Crear solicitud
    solicitud = Solicitud(
        tipo_solicitud_id=tipo.id,
        departamento_id=dept.id,
        estado=EstadoSolicitud.PENDIENTE,
        fecha_necesidad=date(2025, 12, 1),
        solicitante_id=user.id,
        total=Decimal("0")
    )
    session.add(solicitud)
    session.commit()
    session.refresh(solicitud)
    
    assert solicitud.id is not None
    assert solicitud.tipo_solicitud_id == tipo.id
    assert solicitud.departamento_id == dept.id
    assert solicitud.estado == EstadoSolicitud.PENDIENTE
    assert solicitud.total == Decimal("0")

def test_solicitud_expande_relaciones(session):
    """Test que solicitud expande tipo_solicitud y departamento"""
    # Setup (igual que anterior)...
    
    # Verificar expansión
    assert solicitud.tipo_solicitud.nombre == "Normal"
    assert solicitud.departamento.nombre == "Compras"
```

### 6.2 Tests de CRUD

```python
# tests/test_crud_solicitudes.py

def test_crud_create_departamento(session):
    """Test crear departamento con GenericCRUD"""
    crud = GenericCRUD(Departamento)
    data = {
        "nombre": "Administración",
        "descripcion": "Dept admin",
        "activo": True
    }
    dept = crud.create(session, data)
    
    assert dept.id is not None
    assert dept.nombre == "Administración"

def test_crud_list_tipos_solicitud_activos(session):
    """Test listar solo tipos activos"""
    # Crear tipos
    crud = GenericCRUD(TipoSolicitud)
    crud.create(session, {"nombre": "Normal", "activo": True})
    crud.create(session, {"nombre": "Inactivo", "activo": False})
    
    # Listar con filtro
    tipos, total = crud.list(
        session,
        filters={"activo__eq": True}
    )
    
    assert total == 1
    assert tipos[0].nombre == "Normal"

def test_crud_create_solicitud_con_defaults(session):
    """Test que al crear solicitud se usan defaults de tipo"""
    # Setup: tipo con departamento default
    dept_compras = Departamento(nombre="Compras", activo=True)
    tipo_materiales = TipoSolicitud(
        nombre="Materiales",
        codigo="MAT",
        departamento_default_id=None,  # Se asignará después
        activo=True
    )
    session.add_all([dept_compras, tipo_materiales])
    session.commit()
    
    tipo_materiales.departamento_default_id = dept_compras.id
    session.commit()
    
    user = User(nombre="Test", email="test@test.com")
    session.add(user)
    session.commit()
    
    # Crear solicitud (frontend envía departamento_id del tipo)
    crud = NestedCRUD(Solicitud, nested_relations={})
    data = {
        "tipo_solicitud_id": tipo_materiales.id,
        "departamento_id": tipo_materiales.departamento_default_id,
        "fecha_necesidad": "2025-12-01",
        "solicitante_id": user.id
    }
    solicitud = crud.create(session, data)
    
    assert solicitud.departamento_id == dept_compras.id

def test_crud_filtrar_articulos_por_tipo_solicitud(session):
    """Test que tipo_articulo_filter limita artículos"""
    # Crear artículos de diferentes tipos
    art_material = Articulo(nombre="Cemento", tipo_articulo="Material", precio=100)
    art_ferreteria = Articulo(nombre="Clavo", tipo_articulo="Ferreteria", precio=50)
    session.add_all([art_material, art_ferreteria])
    session.commit()
    
    # Tipo que filtra solo "Material"
    tipo = TipoSolicitud(
        nombre="Materiales",
        codigo="MAT",
        tipo_articulo_filter="Material",
        activo=True
    )
    session.add(tipo)
    session.commit()
    
    # Buscar artículos filtrados
    query = select(Articulo).where(Articulo.tipo_articulo == tipo.tipo_articulo_filter)
    articulos = session.exec(query).all()
    
    assert len(articulos) == 1
    assert articulos[0].nombre == "Cemento"
```

### 6.3 Tests de Endpoints

```python
# tests/test_routers_solicitudes.py

def test_get_departamentos(client):
    """Test GET /departamentos"""
    response = client.get("/departamentos?range=[0,9]")
    
    assert response.status_code == 200
    assert "X-Total-Count" in response.headers
    data = response.json()
    assert isinstance(data, list)

def test_create_tipo_solicitud(client):
    """Test POST /tipos-solicitud"""
    response = client.post("/tipos-solicitud", json={
        "nombre": "Materiales",
        "descripcion": "Materiales de construcción",
        "tipo_articulo_filter": "Material",
        "activo": True
    })
    
    assert response.status_code == 201
    data = response.json()
    assert data["nombre"] == "Materiales"
    assert data["activo"] is True

def test_get_articulos_disponibles_con_filtro_frontend(client, session):
    """Test que frontend puede filtrar artículos usando endpoint general"""
    # Setup
    tipo = TipoSolicitud(
        nombre="Materiales",
        tipo_articulo_filter="Material",
        activo=True
    )
    session.add(tipo)
    session.commit()
    
    art1 = Articulo(nombre="Cemento", tipo_articulo="Material", precio=100)
    art2 = Articulo(nombre="Clavo", tipo_articulo="Ferreteria", precio=50)
    session.add_all([art1, art2])
    session.commit()
    
    # Frontend obtiene el tipo y su filtro
    tipo_response = client.get(f"/tipos-solicitud/{tipo.id}")
    assert tipo_response.status_code == 200
    filtro = tipo_response.json()["tipo_articulo_filter"]
    
    # Frontend usa el filtro en endpoint general de artículos
    response = client.get(f'/articulos?filter={{"tipo_articulo": "{filtro}"}}')
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["nombre"] == "Cemento"

def test_create_solicitud_con_tipo_y_departamento(client, session):
    """Test POST /solicitudes con nuevos campos"""
    # Setup
    user = User(nombre="Test", email="test@test.com")
    dept = Departamento(nombre="Compras", activo=True)
    tipo = TipoSolicitud(nombre="Normal", codigo="NOR", activo=True)
    session.add_all([user, dept, tipo])
    session.commit()
    
    response = client.post("/solicitudes", json={
        "tipo_solicitud_id": tipo.id,
        "departamento_id": dept.id,
        "fecha_necesidad": "2025-12-01",
        "solicitante_id": user.id,
        "comentario": "Test",
        "total": 0
    })
    
    assert response.status_code == 201
    data = response.json()
    assert data["tipo_solicitud_id"] == tipo.id
    assert data["departamento_id"] == dept.id
    assert data["estado"] == "pendiente"
    assert float(data["total"]) == 0.0

def test_cambiar_estado_solicitud(client, session):
    """Test PUT /solicitudes/{id} para cambiar estado"""
    # Setup
    user = User(nombre="Test", email="test@test.com")
    dept = Departamento(nombre="Compras", activo=True)
    tipo = TipoSolicitud(nombre="Normal", codigo="NOR", activo=True)
    session.add_all([user, dept, tipo])
    session.commit()
    
    solicitud = Solicitud(
        tipo_solicitud_id=tipo.id,
        departamento_id=dept.id,
        solicitante_id=user.id,
        fecha_necesidad=date(2025, 12, 1),
        estado=EstadoSolicitud.PENDIENTE
    )
    session.add(solicitud)
    session.commit()
    
    # Cambiar a aprobado usando PUT genérico
    response = client.put(
        f"/solicitudes/{solicitud.id}",
        json={"estado": "aprobado"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["estado"] == "aprobado"

def test_cambiar_estado_workflow(client, session):
    """Test workflow completo de estados usando PUT"""
    # Setup
    user = User(nombre="Test", email="test@test.com")
    dept = Departamento(nombre="Compras", activo=True)
    tipo = TipoSolicitud(nombre="Normal", codigo="NOR", activo=True)
    session.add_all([user, dept, tipo])
    session.commit()
    
    solicitud = Solicitud(
        tipo_solicitud_id=tipo.id,
        departamento_id=dept.id,
        solicitante_id=user.id,
        fecha_necesidad=date(2025, 12, 1),
        estado=EstadoSolicitud.PENDIENTE
    )
    session.add(solicitud)
    session.commit()
    
    # PENDIENTE → APROBADO
    response = client.put(f"/solicitudes/{solicitud.id}", json={"estado": "aprobado"})
    assert response.status_code == 200
    assert response.json()["estado"] == "aprobado"
    
    # APROBADO → COMPLETADO
    response = client.put(f"/solicitudes/{solicitud.id}", json={"estado": "completado"})
    assert response.status_code == 200
    assert response.json()["estado"] == "completado"
```

### 6.4 Tests de Integración

```python
# tests/test_integration_solicitudes.py

def test_flujo_completo_solicitud_materiales(client, session):
    """Test flujo end-to-end: crear tipo, departamento, solicitud, cambiar estado"""
    
    # 1. Crear departamento
    resp_dept = client.post("/departamentos", json={
        "nombre": "Compras",
        "activo": True
    })
    assert resp_dept.status_code == 201
    dept_id = resp_dept.json()["id"]
    
    # 2. Crear tipo de solicitud
    resp_tipo = client.post("/tipos-solicitud", json={
        "nombre": "Materiales",
        "tipo_articulo_filter": "Material",
        "departamento_default_id": dept_id,
        "activo": True
    })
    assert resp_tipo.status_code == 201
    tipo_id = resp_tipo.json()["id"]
    
    # 3. Crear user (asumimos que ya existe)
    user = User(nombre="Test", email="test@test.com")
    session.add(user)
    session.commit()
    
    # 4. Crear solicitud
    resp_solicitud = client.post("/solicitudes", json={
        "tipo_solicitud_id": tipo_id,
        "departamento_id": dept_id,
        "fecha_necesidad": "2025-12-15",
        "solicitante_id": user.id,
        "comentario": "Materiales para proyecto X"
    })
    assert resp_solicitud.status_code == 201
    solicitud_id = resp_solicitud.json()["id"]
    assert resp_solicitud.json()["estado"] == "pendiente"
    
    # 5. Aprobar solicitud usando PUT genérico
    resp_aprobar = client.put(
        f"/solicitudes/{solicitud_id}",
        json={"estado": "aprobado"}
    )
    assert resp_aprobar.status_code == 200
    assert resp_aprobar.json()["estado"] == "aprobado"
    
    # 6. Completar solicitud
    resp_completar = client.put(
        f"/solicitudes/{solicitud_id}",
        json={"estado": "completado"}
    )
    assert resp_completar.status_code == 200
    assert resp_completar.json()["estado"] == "completado"
```

---

## 7. CONSULTAS PENDIENTES Y DEFINICIONES CRÍTICAS

### 7.1 ✅ CONSULTA 1: Validación de Transiciones de Estado

**Pregunta:** ¿Se deben implementar validaciones de transiciones de estado en el backend?

**DECISIÓN: Opción A - Sin validaciones en backend**

- Frontend maneja toda la lógica de workflow
- Más simple, menos código en backend
- Backend solo persiste el valor enviado usando `PUT /solicitudes/{id}`
- Las validaciones de UX se implementan en el frontend antes de enviar el request

**Implementación:** El campo `estado` se actualiza directamente con el endpoint genérico PUT sin validaciones adicionales en backend.

---

### 7.2 ✅ CONSULTA 2: Relación TipoSolicitud - Artículos

**Pregunta:** ¿Cómo se debe implementar el filtro de artículos por tipo de solicitud?

**DECISIÓN: Opción A - Mantener string simple**

- `tipo_articulo_filter` es un string que matchea con `Articulo.tipo_articulo`
- Ejemplo: `tipo_articulo_filter="Material"` filtra artículos donde `tipo_articulo="Material"`
- Filtro en frontend: `GET /articulos?filter={"tipo_articulo": "Material"}`

**Implementación:** Mantener el campo actual sin cambios. Si en el futuro se necesita filtrar por múltiples tipos, se puede reevaluar.

---

### 7.3 ✅ CONSULTA 3: Valores Default en Frontend vs Backend

**DECISIÓN: Aprobado - Defaults manejados por frontend**

Los campos `articulo_default_id` y `departamento_default_id` son **valores sugeridos** que el frontend utiliza:

1. **Frontend obtiene el tipo de solicitud:**
   ```javascript
   GET /tipos-solicitud/3
   // Response: { id: 3, nombre: "Materiales", departamento_default_id: 1, ... }
   ```

2. **Frontend pre-carga valores en formulario** (usuario puede modificarlos):
   ```javascript
   POST /solicitudes
   {
     "tipo_solicitud_id": 3,
     "departamento_id": 1,  // ← Puede ser otro si usuario cambió
     ...
   }
   ```

3. **Backend NO aplica defaults automáticamente** - Solo valida y persiste los valores recibidos explícitamente del frontend.

---

### 7.4 ✅ CONSULTA 4: Migración de Datos Existentes

**DECISIÓN: Mapear todo a departamento "Compras" - No crear tipos Normal/Directa**

**Estrategia de migración:**

1. **NO crear tipos "Normal" ni "Directa"** en el seed de tipos de solicitud
2. **Todas las solicitudes existentes** se mapearán al departamento "Compras"
3. **Tipos históricos** (normal/directa) solo existen durante la migración para el mapeo de datos

**Actualización en migración 0022:**
```python
# Todas las solicitudes existentes van a "Compras"
op.execute("""
    UPDATE solicitudes s
    SET departamento_id = d.id
    FROM departamentos d
    WHERE d.nombre = 'Compras'
""")
```

**Nota:** El seed de tipos de solicitud solo incluirá los 6 tipos de negocio reales (Materiales, Ferretería, Servicios, Insumos de Oficina, Transporte, Mensajería).

---

### 7.5 ✅ CONSULTA 5: Orden de Ejecución de Scripts

**DECISIÓN: Usar el orden propuesto**

**Secuencia de ejecución:**
```bash
1. Aplicar migración 0020 (crear departamentos)
2. Ejecutar seed_departamentos.py
3. Aplicar migración 0021 (crear tipos_solicitud)
4. Ejecutar seed_tipos_solicitud.py
5. Aplicar migración 0022 (modificar solicitudes + migrar datos)
```

**Ventajas:**
- Seeds son scripts independientes y reutilizables
- Fácil de modificar datos base sin tocar migraciones
- Permite ejecutar seeds en diferentes entornos (dev, staging, prod)

**Comando de ejecución:**
```bash
# Aplicar todas las migraciones y seeds en orden
alembic upgrade head
python scripts/seed_departamentos.py
python scripts/seed_tipos_solicitud.py
```

---

### 7.6 ✅ CONSULTA 6: Validación de Soft Delete en Cascada

**DECISIÓN: Opción A - Impedir eliminación si hay solicitudes asociadas**

**Implementación:**
- Si un `Departamento` o `TipoSolicitud` tiene solicitudes asociadas, **rechazar** la eliminación con HTTP 400
- Mantener integridad referencial estricta
- Solicitudes históricas deben mantener sus referencias válidas

**Comportamiento:**
```python
# En el CRUD antes de eliminar
if model.solicitudes:  # Si tiene solicitudes asociadas
    raise HTTPException(
        status_code=400,
        detail="No se puede eliminar. Existen solicitudes asociadas."
    )
```

**Alternativa para deshabilitar:** Usar el campo `activo=False` en lugar de eliminar. Esto permite que las solicitudes históricas mantengan la referencia mientras el tipo/departamento deja de estar disponible para nuevas solicitudes.

---

### 7.7 ✅ CONSULTA 7: Búsqueda General (parámetro `q`)

**DECISIÓN: Aprobada la propuesta**

**Campos buscables por modelo:**
- `Departamento.__searchable_fields__ = ["nombre", "descripcion"]`
- `TipoSolicitud.__searchable_fields__ = ["nombre", "descripcion"]`
- `Solicitud.__searchable_fields__ = ["comentario"]`

**Implementación:** Estos campos se usarán cuando se haga búsqueda general con el parámetro `?q=texto` en los endpoints de lista.

**Ejemplo:**
```
GET /departamentos?q=compras
GET /tipos-solicitud?q=material
GET /solicitudes?q=urgente
```

---

### 7.8 ✅ CONSULTA 8: Endpoint de Estadísticas

**DECISIÓN: No implementar endpoints de estadísticas**

Los endpoints de reporting/estadísticas **NO son necesarios** en esta fase.

**Justificación:**
- Los datos pueden obtenerse usando filtros en endpoints existentes
- Si se requieren en el futuro, se pueden agregar como endpoints personalizados
- Mantiene la implementación más simple

**Alternativa futura (si se necesita):**
```python
# Ejemplos de endpoints que podrían agregarse después
GET /solicitudes/stats/by-estado
GET /solicitudes/stats/by-tipo
GET /solicitudes/stats/by-departamento
```

---

### 7.9 ✅ CONSULTA 9: Validación de Campos Obligatorios

**DECISIÓN: Aprobado el análisis actual**

**Campos y su obligatoriedad:**
- `Solicitud.tipo_solicitud_id`: **Obligatorio** ✅
- `Solicitud.departamento_id`: **Obligatorio** ✅
- `Solicitud.estado`: **Obligatorio** (con default `PENDIENTE`) ✅
- `Solicitud.total`: **Obligatorio** (con default `0`) ✅
- `TipoSolicitud.articulo_default_id`: **Opcional** ✅
- `TipoSolicitud.departamento_default_id`: **Opcional** ✅
- `TipoSolicitud.tipo_articulo_filter`: **Opcional** ✅

**Validaciones automáticas:**
- Los campos obligatorios generarán error HTTP 422 si no se envían
- Los campos con default se inicializarán automáticamente si no se especifican

---

### 7.10 ✅ CONSULTA 10: Cálculo del Campo Total

**DECISIÓN: Opción B - Enviado por frontend**

**Implementación:**
- El frontend calcula la suma de los detalles y la envía en el payload
- Backend persiste el valor recibido sin validaciones adicionales
- Más simple y directo

**Comportamiento:**
```javascript
// Frontend calcula el total
const total = detalles.reduce((sum, d) => sum + (d.cantidad * d.precio_unitario), 0);

// Envía con la solicitud
POST /solicitudes
{
  "tipo_solicitud_id": 1,
  "departamento_id": 1,
  "total": 1500.50,  // ← Calculado por frontend
  "detalles": [...]
}

// Actualización de total
PUT /solicitudes/{id}
{
  "total": 2000.00  // ← Nuevo total calculado por frontend
}
```

**Ventajas:**
- No requiere lógica adicional en backend
- Frontend tiene control total sobre el cálculo
- Más simple de implementar y mantener

**Nota:** Si en el futuro se requiere validación o cálculo automático en backend, se puede agregar sin breaking changes.

---

### 7.11 ✅ CONSULTA 11: Nombres de Endpoints

**DECISIÓN: Aprobada la propuesta con kebab-case**

**Nombres de rutas confirmados:**
- `/departamentos` ✅
- `/tipos-solicitud` ✅ (kebab-case)
- `/solicitudes` ✅

**Convención aplicada:** Usar **kebab-case** para URLs siguiendo las mejores prácticas REST.

**Ejemplos de uso:**
```
GET    /departamentos
POST   /departamentos
GET    /tipos-solicitud
PUT    /tipos-solicitud/{id}
GET    /solicitudes?filter={"estado": "pendiente"}
```

---

## 8. RESUMEN DE CAMBIOS

### 8.1 Archivos a Crear

```
✅ app/models/departamento.py (nuevo)
✅ app/models/tipo_solicitud.py (nuevo - sin campo orden)
✅ app/routers/departamento_router.py (nuevo)
✅ app/routers/tipo_solicitud_router.py (nuevo)
✅ alembic/versions/0020_create_departamentos_table.py (nuevo)
✅ alembic/versions/0021_create_tipos_solicitud_table.py (nuevo - sin campo orden)
✅ alembic/versions/0022_refactor_solicitudes.py (nuevo - agregar total)
✅ scripts/seed_departamentos.py (nuevo)
✅ scripts/seed_tipos_solicitud.py (nuevo - sin campo orden)
✅ tests/test_models_solicitudes.py (nuevo/actualizar)
✅ tests/test_crud_solicitudes.py (nuevo/actualizar)
✅ tests/test_routers_solicitudes.py (nuevo/actualizar)
✅ tests/test_integration_solicitudes.py (nuevo)
```

### 8.2 Archivos a Modificar

```
🔧 app/models/solicitud.py (refactor mayor - agregar total)
🔧 app/routers/solicitud_router.py (actualizar)
🔧 app/main.py (registrar nuevos routers)
```

### 8.3 Cambios Específicos Aplicados

**Basado en feedback del usuario:**

1. ✅ **Departamento default como sugerencia**: `departamento_default_id` funciona igual que `articulo_default_id` - son valores sugeridos por el tipo de solicitud que el usuario puede modificar libremente

2. ✅ **Eliminado campo `orden`**: Removido de `TipoSolicitud` y de todas las migraciones y seeds

3. ✅ **Agregado campo `total`**: 
   - Nuevo campo `Decimal(15,2)` en modelo `Solicitud`
   - Agregado a migración 0022
   - Incluido en tests
   - **Calculado por frontend** y enviado en el payload (Consulta 7.10)

4. ✅ **Sin validaciones de estado en backend**: Frontend maneja el workflow de estados (Consulta 7.1)

5. ✅ **Filtro simple de artículos**: Mantener `tipo_articulo_filter` como string simple (Consulta 7.2)

6. ✅ **Migración simplificada**: No crear tipos Normal/Directa, mapear todo a "Compras" (Consulta 7.4)

7. ✅ **Impedir eliminación con referencias**: No permitir eliminar tipos/departamentos con solicitudes asociadas (Consulta 7.6)

### 8.4 Métricas Estimadas

| Métrica | Valor |
|---------|-------|
| **Modelos nuevos** | 2 (Departamento, TipoSolicitud) |
| **Modelos modificados** | 1 (Solicitud + campo total) |
| **Migraciones** | 3 |
| **Scripts seed** | 2 |
| **Routers nuevos** | 2 |
| **Endpoints nuevos** | 10 (5 departamentos + 5 tipos-solicitud) |
| **Endpoints personalizados** | 0 (todos genéricos) |
| **Tests nuevos** | 20+ |
| **Líneas estimadas** | ~1400 |
| **Tiempo estimado** | 8 horas |
| **Consultas pendientes** | 0 (todas resueltas ✅) |

---

## 9. PRÓXIMOS PASOS

### Fase 1: Resolución de Consultas (1 hora)
- [ ] Revisar y responder consultas críticas (sección 7)
- [ ] Aprobar especificación o solicitar ajustes

### Fase 2: Implementación (4 horas)
- [ ] Crear modelos `Departamento` y `TipoSolicitud`
- [ ] Crear migraciones (orden: 0020, 0021, 0022)
- [ ] Crear scripts seed
- [ ] Modificar modelo `Solicitud`
- [ ] Crear routers nuevos
- [ ] Actualizar router `Solicitud`

### Fase 3: Testing (2 horas)
- [ ] Tests de modelos
- [ ] Tests de CRUD
- [ ] Tests de endpoints
- [ ] Tests de integración

### Fase 4: Verificación (1 hora)
- [ ] Ejecutar migraciones en local
- [ ] Ejecutar seeds
- [ ] Verificar en Swagger
- [ ] Pruebas manuales con curl
- [ ] Verificar base de datos

---

## 10. APROBACIONES

| Rol | Nombre | Fecha | Estado |
|-----|--------|-------|--------|
| **Product Owner** | Gustavo | 2025-11-10 | `[ ] Pendiente  [ ] Aprobado  [ ] Requiere cambios` |
| **Tech Lead** | - | - | `[ ] Pendiente  [ ] Aprobado  [ ] Requiere cambios` |

**Comentarios:**
```
[Espacio para feedback y decisiones sobre consultas pendientes]
```

---

**FIN DE ESPECIFICACIÓN**

*Este documento debe ser aprobado antes de comenzar implementación. Responder consultas críticas en sección 7.*
