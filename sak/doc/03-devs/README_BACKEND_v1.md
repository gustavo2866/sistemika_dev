# 📘 SAK Backend - Documentación Técnica v1

## 📋 Metadata del Documento

- **Versión**: 1.0
- **Fecha**: Noviembre 2025
- **Stack**: FastAPI + SQLModel + PostgreSQL
- **Python**: 3.11+
- **Propósito**: Guía técnica para mantener patrones y arquitectura del backend SAK

---

## 🎯 Propósito

Este documento describe la **arquitectura, patrones y convenciones** del backend SAK. Debe ser consultado antes de realizar cambios para asegurar consistencia y mantenibilidad del código.

---

## 📚 Tabla de Contenidos

1. [Arquitectura General](#1-arquitectura-general)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Estructura de Directorios](#3-estructura-de-directorios)
4. [Patrones de Diseño](#4-patrones-de-diseño)
5. [Modelos y Base de Datos](#5-modelos-y-base-de-datos)
6. [Sistema CRUD Genérico](#6-sistema-crud-genérico)
7. [Routers y Endpoints](#7-routers-y-endpoints)
8. [Servicios](#8-servicios)
9. [Gestión de Archivos](#9-gestión-de-archivos)
10. [Migraciones](#10-migraciones)
11. [Testing](#11-testing)
12. [Configuración](#12-configuración)
13. [Convenciones de Código](#13-convenciones-de-código)
14. [Flujos Principales](#14-flujos-principales)
15. [Checklist de Desarrollo](#15-checklist-de-desarrollo)

---

## 1. Arquitectura General

### 1.1 Filosofía

SAK backend sigue una **arquitectura por capas** con separación clara de responsabilidades:

```
┌─────────────────────────────────────────────────────────┐
│                    FastAPI (main.py)                    │
│              CORS, Middleware, Static Files             │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                      Routers Layer                      │
│   Endpoints HTTP, Validación de entrada, Respuestas    │
│        (routers/ + api/ + core/router.py)              │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Business Logic                       │
│    CRUD Genérico (GenericCRUD, NestedCRUD)            │
│    Servicios (services/) para lógica compleja          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Data Access Layer                    │
│         SQLModel + PostgreSQL (db.py, models/)         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                External Services (Opcional)             │
│    Google Cloud Storage, OpenAI, Neon PostgreSQL       │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Principios Clave

1. **DRY (Don't Repeat Yourself)**: CRUD genérico para evitar código repetitivo
2. **Convention over Configuration**: Patrones consistentes en toda la app
3. **Separation of Concerns**: Cada capa tiene una responsabilidad única
4. **Explicit is better than implicit**: Configuración explícita en modelos
5. **React Admin Compatible**: Respuestas y filtros compatibles con ra-data-simple-rest

---

## 2. Stack Tecnológico

### 2.1 Core

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Python** | 3.11+ | Lenguaje base |
| **FastAPI** | Latest | Framework web ASGI |
| **SQLModel** | Latest | ORM (Pydantic + SQLAlchemy) |
| **Uvicorn** | Latest | Servidor ASGI |
| **Psycopg3** | Latest | Driver PostgreSQL |
| **PostgreSQL** | 14+ | Base de datos |

### 2.2 Dependencias Principales

```python
# requirements.txt (simplificado)
fastapi
uvicorn[standard]
sqlmodel
psycopg[binary]
alembic
python-dotenv
aiofiles
google-cloud-storage
openai  # Opcional, para OCR
pytest  # Testing
```

### 2.3 Servicios Externos

- **Neon PostgreSQL**: Base de datos productiva (pooled connection)
- **Google Cloud Storage**: Almacenamiento de facturas/archivos
- **OpenAI API**: OCR de facturas (opcional)

---

## 3. Estructura de Directorios

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                    # Punto de entrada, configuración FastAPI
│   ├── db.py                      # Engine, Session, init_db
│   │
│   ├── api/                       # Endpoints especializados
│   │   ├── auth.py                # Autenticación (futuro)
│   │   ├── upload.py              # Upload de archivos
│   │   ├── factura_processing.py # Procesamiento de facturas
│   │   └── __init__.py
│   │
│   ├── core/                      # Lógica de negocio genérica
│   │   ├── generic_crud.py        # CRUD base reutilizable
│   │   ├── nested_crud.py         # CRUD con relaciones anidadas
│   │   ├── router.py              # Factory de routers genéricos
│   │   ├── ra_data_router.py      # Adaptador ra-data-json-server
│   │   ├── responses.py           # Tipos de respuesta estandarizados
│   │   └── __init__.py
│   │
│   ├── models/                    # Entidades SQLModel
│   │   ├── base.py                # Modelo base con timestamps, soft delete
│   │   ├── user.py                # Usuarios
│   │   ├── solicitud.py           # Solicitudes de compra
│   │   ├── solicitud_detalle.py   # Detalles de solicitud
│   │   ├── factura.py             # Facturas
│   │   ├── articulo.py            # Artículos/productos
│   │   ├── proyecto.py            # Proyectos
│   │   ├── nomina.py              # Nóminas
│   │   └── ...                    # Otros modelos
│   │
│   ├── routers/                   # Routers específicos por entidad
│   │   ├── solicitud_router.py    # Router de solicitudes
│   │   ├── user_router.py         # Router de usuarios
│   │   ├── factura_router.py      # Router de facturas
│   │   └── ...                    # Otros routers
│   │
│   ├── services/                  # Lógica de negocio compleja
│   │   ├── gcs_storage_service.py      # Google Cloud Storage
│   │   ├── pdf_extraction_service.py   # OCR con OpenAI
│   │   ├── factura_processing_service.py
│   │   └── ...
│   │
│   ├── crud/                      # CRUD personalizados (opcional)
│   └── data/                      # Data fixtures, constants
│
├── alembic/                       # Migraciones de base de datos
│   ├── versions/                  # Archivos de migración
│   ├── env.py                     # Configuración Alembic
│   └── script.py.mako             # Template de migración
│
├── scripts/                       # Scripts de utilidad
│   └── seed_sak_backend.py        # Datos de prueba
│
├── tests/                         # Tests unitarios
│   ├── test_models.py
│   ├── test_crud.py
│   └── ...
│
├── uploads/                       # Almacenamiento local (gitignored)
│   ├── images/
│   ├── facturas/
│   └── temp/
│
├── .env                           # Variables de entorno (gitignored)
├── .env copy                      # Template de variables
├── requirements.txt               # Dependencias Python
├── alembic.ini                    # Config Alembic
└── README_BACKEND_v1.md           # Este documento
```

---

## 4. Patrones de Diseño

### 4.1 Generic CRUD Pattern

**Problema**: Evitar código repetitivo para operaciones CRUD estándar.

**Solución**: `GenericCRUD` base que se extiende con `NestedCRUD` para relaciones.

```python
# Patrón estándar para crear un router
from app.models.solicitud import Solicitud
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# 1. Crear instancia CRUD
solicitud_crud = GenericCRUD(Solicitud)

# 2. Crear router usando factory
solicitud_router = create_generic_router(
    model=Solicitud,
    crud=solicitud_crud,
    prefix="/solicitudes",
    tags=["solicitudes"],
)
```

### 4.2 Nested CRUD Pattern

**Problema**: Manejar entidades con relaciones one-to-many (cabecera-detalle).

**Solución**: `NestedCRUD` con configuración declarativa.

```python
# Patrón para entidades con detalles (ej: Solicitud con SolicitudDetalle)
from app.models.solicitud import Solicitud
from app.models.solicitud_detalle import SolicitudDetalle
from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router

solicitud_crud = NestedCRUD(
    Solicitud,
    nested_relations={
        "detalles": {                    # Nombre de la relación en el modelo
            "model": SolicitudDetalle,   # Modelo del detalle
            "fk_field": "solicitud_id",  # Foreign key en el detalle
            "allow_delete": True,        # Permitir eliminar detalles
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

**Comportamiento automático:**
- CREATE: Crea cabecera + detalles en una transacción
- UPDATE: Sincroniza detalles (crea, actualiza, elimina según IDs)
- DELETE: Soft delete de cabecera (cascade a detalles por SQLAlchemy)

### 4.3 Repository Pattern (Implícito)

CRUD classes actúan como repositories:
- Encapsulan acceso a datos
- Mantienen lógica de negocio separada de endpoints
- Reutilizables en diferentes contexts

### 4.4 Factory Pattern

`create_generic_router()` factory crea routers configurados:
- Inyecta dependencias (CRUD, Session)
- Configura respuestas estandarizadas
- Mantiene consistencia entre endpoints

---

## 5. Modelos y Base de Datos

### 5.1 Modelo Base

**Todos los modelos heredan de `Base`**:

```python
# app/models/base.py
from sqlmodel import SQLModel, Field
from datetime import datetime, UTC

class Base(SQLModel):
    # Campos automáticos (STAMP_FIELDS - NO editables por usuario)
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=current_utc_time)
    updated_at: datetime = Field(default_factory=current_utc_time)
    deleted_at: Optional[datetime] = Field(default=None)  # Soft delete
    version: int = Field(default=1)  # Optimistic locking
    
    # Metadata para configuración CRUD
    __searchable_fields__: ClassVar[List[str]] = []  # Campos de búsqueda con "q"
    __expanded_list_relations__: ClassVar[set[str]] = set()  # Relaciones a expandir en list
```

### 5.2 Convenciones de Modelos

#### Metadata Obligatoria

```python
class Solicitud(Base, table=True):
    __tablename__ = "solicitudes"  # Nombre explícito de tabla
    
    # Campos donde buscar con parámetro "q" (búsqueda general)
    __searchable_fields__: ClassVar[List[str]] = ["tipo", "comentario"]
    
    # Relaciones a expandir automáticamente en listados
    __expanded_list_relations__: ClassVar[set[str]] = {"detalles"}
    
    # Campos del modelo...
```

#### Campos Editables

Los campos editables se calculan automáticamente:

```python
# app/models/base.py
STAMP_FIELDS = {"id", "created_at", "updated_at", "deleted_at", "version"}

def campos_editables(model_cls: type[SQLModel]) -> set[str]:
    """Campos editables por el usuario (excluye stamps)"""
    return set(model_cls.model_fields.keys()) - STAMP_FIELDS
```

### 5.3 Tipos de Campos Soportados

```python
from sqlmodel import Field
from datetime import date, datetime
from decimal import Decimal
from enum import Enum

class TipoSolicitud(str, Enum):
    NORMAL = "normal"
    DIRECTA = "directa"

class Solicitud(Base, table=True):
    # String
    comentario: Optional[str] = Field(default=None, max_length=1000)
    
    # Enum (almacenado como string)
    tipo: TipoSolicitud = Field(default=TipoSolicitud.NORMAL)
    
    # Date
    fecha_necesidad: date = Field(...)
    
    # Decimal (para precios, cantidades)
    monto: Decimal = Field(default=Decimal("0"), max_digits=10, decimal_places=2)
    
    # Foreign Key
    solicitante_id: int = Field(foreign_key="users.id")
    
    # Relación
    solicitante: User = Relationship(back_populates="solicitudes")
    
    # One-to-many con cascade
    detalles: List["SolicitudDetalle"] = Relationship(
        back_populates="solicitud",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
```

### 5.4 Soft Delete

Todos los modelos soportan soft delete automáticamente:

```python
# El CRUD maneja esto internamente
crud.delete(session, obj_id)  # Setea deleted_at = datetime.now(UTC)

# Parámetro "deleted" controla visibilidad:
# - "exclude": Solo activos (default)
# - "include": Todos (activos + eliminados)
# - "only": Solo eliminados
```

### 5.5 Relaciones

#### One-to-Many

```python
# Cabecera (Solicitud)
detalles: List["SolicitudDetalle"] = Relationship(
    back_populates="solicitud",
    sa_relationship_kwargs={"cascade": "all, delete-orphan"}
)

# Detalle (SolicitudDetalle)
solicitud_id: int = Field(foreign_key="solicitudes.id")
solicitud: Solicitud = Relationship(back_populates="detalles")
```

#### Many-to-One

```python
# Usuario tiene muchas solicitudes
class Solicitud(Base, table=True):
    solicitante_id: int = Field(foreign_key="users.id")
    solicitante: User = Relationship(back_populates="solicitudes")

class User(Base, table=True):
    solicitudes: List["Solicitud"] = Relationship(back_populates="solicitante")
```

---

## 6. Sistema CRUD Genérico

### 6.1 GenericCRUD

Operaciones estándar para cualquier modelo.

#### Métodos Principales

```python
class GenericCRUD(Generic[M]):
    def create(self, session: Session, data: Dict[str, Any]) -> M:
        """Crea un nuevo registro"""
        
    def get(self, session: Session, obj_id: int, *, deleted: str = "exclude") -> Optional[M]:
        """Obtiene un registro por ID"""
        
    def list(
        self,
        session: Session,
        *,
        page: int = 1,
        per_page: int = 25,
        sort_by: str = "id",
        sort_dir: str = "asc",
        filters: Optional[Dict[str, Any]] = None,
        q: Optional[str] = None,  # Búsqueda general
        deleted: str = "exclude",
    ) -> Tuple[Sequence[M], int]:
        """Lista registros con paginación y filtros"""
        
    def update(self, session: Session, obj_id: int, data: Dict[str, Any]) -> M:
        """Actualiza un registro existente"""
        
    def delete(self, session: Session, obj_id: int) -> M:
        """Soft delete de un registro"""
```

#### Características

**1. Coerción Automática de Tipos**

```python
# El CRUD convierte automáticamente:
"2024-11-10" → date(2024, 11, 10)
"2024-11-10T15:30:00Z" → datetime(2024, 11, 10, 15, 30, 0, tzinfo=UTC)
"123.45" → Decimal("123.45")
"true" → True
"42" → 42 (si el campo es int)
```

**2. Filtrado Avanzado**

```python
# Operadores soportados (FilterOperator):
filters = {
    "nombre__eq": "Juan",           # igualdad exacta
    "precio__gte": 100,             # mayor o igual
    "precio__lte": 500,             # menor o igual
    "fecha__gt": "2024-01-01",      # mayor que
    "categoria__in": ["A", "B"],    # dentro de conjunto
    "activo__is": "null",           # is null / not null
    "nombre__like": "%acero%",      # like (case insensitive)
}
```

**3. Búsqueda General (q)**

```python
# Busca en campos definidos en __searchable_fields__
crud.list(session, q="cocina", ...)

# Genera SQL:
# WHERE nombre ILIKE '%cocina%' OR descripcion ILIKE '%cocina%'
```

**4. Filtrado de Respuestas**

```python
# Solo campos editables + id (oculta timestamps internos)
obj_dict = filtrar_respuesta(obj, context="display")

# Solo campos editables (para formularios de edición)
obj_dict = filtrar_respuesta(obj, context="edit")
```

### 6.2 NestedCRUD

Extiende `GenericCRUD` para manejar relaciones one-to-many.

#### Configuración

```python
crud = NestedCRUD(
    Solicitud,
    nested_relations={
        "detalles": {
            "model": SolicitudDetalle,
            "fk_field": "solicitud_id",
            "allow_delete": True,  # Opcional, default True
        }
    },
)
```

#### Comportamiento en CREATE

```python
payload = {
    "tipo": "normal",
    "fecha_necesidad": "2024-12-01",
    "solicitante_id": 1,
    "detalles": [  # ← Relación anidada
        {"articulo_id": 10, "cantidad": 5},
        {"articulo_id": 20, "cantidad": 3},
    ]
}

obj = crud.create(session, payload)
# Resultado:
# 1. Crea Solicitud (id=1)
# 2. Crea SolicitudDetalle (id=1, solicitud_id=1, articulo_id=10, cantidad=5)
# 3. Crea SolicitudDetalle (id=2, solicitud_id=1, articulo_id=20, cantidad=3)
```

#### Comportamiento en UPDATE

```python
payload = {
    "id": 1,  # Solicitud existente
    "tipo": "directa",  # Modificar campo
    "detalles": [
        {"id": 1, "cantidad": 10},  # ← Actualizar detalle existente
        {"articulo_id": 30, "cantidad": 2},  # ← Crear nuevo detalle
        # Detalle id=2 NO está en el payload → SE ELIMINA
    ]
}

obj = crud.update(session, 1, payload)
# Resultado:
# 1. Actualiza Solicitud.tipo = "directa"
# 2. Actualiza SolicitudDetalle(id=1).cantidad = 10
# 3. Crea SolicitudDetalle(id=3, solicitud_id=1, articulo_id=30, cantidad=2)
# 4. Elimina SolicitudDetalle(id=2) (soft delete)
```

**Lógica de sincronización:**
- **Si detalle tiene `id` y existe**: UPDATE
- **Si detalle tiene `id` pero NO existe**: ERROR
- **Si detalle NO tiene `id`**: CREATE
- **Detalles existentes NO incluidos en payload**: DELETE (si allow_delete=True)

---

## 7. Routers y Endpoints

### 7.1 Factory de Routers

`create_generic_router()` genera endpoints completos automáticamente.

```python
from app.core.router import create_generic_router

router = create_generic_router(
    model=Solicitud,
    crud=solicitud_crud,
    prefix="/solicitudes",  # Prefijo de URL
    tags=["solicitudes"],   # Tag para Swagger
    filter_responses=True,  # Aplicar filtrado de respuestas (default True)
)
```

### 7.2 Endpoints Generados

Para cada router se crean 5 endpoints:

| Método | Ruta | Descripción | Status Code |
|--------|------|-------------|-------------|
| `POST` | `/solicitudes` | Crear | 201 Created |
| `GET` | `/solicitudes` | Listar con paginación | 200 OK |
| `GET` | `/solicitudes/{id}` | Obtener por ID | 200 OK / 404 Not Found |
| `PUT` | `/solicitudes/{id}` | Actualizar | 200 OK / 404 Not Found |
| `DELETE` | `/solicitudes/{id}` | Eliminar (soft delete) | 200 OK / 404 Not Found |

### 7.3 Parámetros de Listado

Compatible con **ra-data-simple-rest** de React Admin:

```http
GET /solicitudes?range=[0,24]&sort=["created_at","DESC"]&filter={"tipo":"normal"}
```

También soporta **ra-data-json-server** (legacy):

```http
GET /solicitudes?_start=0&_end=25&_sort=created_at&_order=DESC&tipo=normal
```

**Parámetros comunes:**

| Parámetro | Tipo | Descripción | Default |
|-----------|------|-------------|---------|
| `range` | JSON | `[start, end]` para paginación | `[0, 24]` |
| `sort` | JSON | `[field, order]` para ordenamiento | `["id", "ASC"]` |
| `filter` | JSON | Objeto con filtros | `{}` |
| `q` | string | Búsqueda general en searchable_fields | - |
| `deleted` | string | `exclude\|include\|only` | `exclude` |

**Headers de respuesta:**

```http
X-Total-Count: 150
Access-Control-Expose-Headers: X-Total-Count
Content-Range: solicitudes 0-24/150
```

### 7.4 Formato de Respuestas

**Lista (GET /resource):**

```json
[
  {
    "id": 1,
    "tipo": "normal",
    "fecha_necesidad": "2024-12-01",
    "solicitante_id": 1,
    "detalles": [
      {"id": 1, "articulo_id": 10, "cantidad": 5},
      {"id": 2, "articulo_id": 20, "cantidad": 3}
    ]
  }
]
```

**Detalle (GET /resource/{id}):**

```json
{
  "id": 1,
  "tipo": "normal",
  "fecha_necesidad": "2024-12-01",
  "solicitante_id": 1,
  "solicitante": {
    "id": 1,
    "nombre": "Juan Pérez",
    "email": "juan@example.com"
  },
  "detalles": [...]
}
```

**Nota:** Los campos `created_at`, `updated_at`, `deleted_at`, `version` NO se incluyen en respuestas por defecto (filtrados automáticamente).

### 7.5 Registrar Routers

```python
# app/main.py
from app.routers.solicitud_router import solicitud_router
from app.routers.user_router import user_router

app.include_router(solicitud_router)
app.include_router(user_router)
# ... más routers
```

**Convención:** Todos los routers se registran con prefijo `/api/v1` implícito (configurado en el router).

---

## 8. Servicios

### 8.1 Propósito

Los servicios encapsulan **lógica de negocio compleja** que no pertenece al CRUD genérico:
- Integración con APIs externas
- Procesamiento de archivos
- Lógica de negocio multi-modelo
- Operaciones que requieren múltiples pasos

### 8.2 Servicios Implementados

#### 8.2.1 GCSStorageService

Gestiona archivos en Google Cloud Storage.

```python
# app/services/gcs_storage_service.py
class GCSStorageService:
    def upload_file(self, file_path: str, filename: str, **kwargs) -> Dict[str, Any]:
        """Sube archivo a GCS y retorna URLs"""
        
    def upload_invoice(self, file_path: str, filename: str, **kwargs) -> Dict[str, Any]:
        """Sube factura específicamente a carpeta facturas/"""
        
    def get_signed_url(self, blob_name: str, ttl: timedelta) -> str:
        """Genera URL firmada con expiración"""
```

**Uso:**

```python
from app.services.gcs_storage_service import GCSStorageService

service = GCSStorageService()
result = service.upload_invoice(
    file_path="/tmp/factura.pdf",
    filename="factura-001.pdf",
)

# result = {
#     "storage_uri": "gs://sak-wcl-bucket/facturas/factura-001.pdf",
#     "download_url": "https://storage.googleapis.com/sak-wcl-bucket/facturas/factura-001.pdf",
#     "blob_name": "facturas/factura-001.pdf",
#     "bucket": "sak-wcl-bucket"
# }
```

#### 8.2.2 PDFExtractionService

OCR de facturas usando OpenAI Vision API.

```python
# app/services/pdf_extraction_service.py
class PDFExtractionService:
    def extract_invoice_data(self, file_path: str) -> Dict[str, Any]:
        """Extrae datos estructurados de PDF de factura"""
```

**Uso:**

```python
from app.services.pdf_extraction_service import PDFExtractionService

service = PDFExtractionService()
data = service.extract_invoice_data("/tmp/factura.pdf")

# data = {
#     "proveedor": "Acme Corp",
#     "numero_factura": "FC-001",
#     "fecha": "2024-11-10",
#     "total": "1500.00",
#     "items": [...]
# }
```

#### 8.2.3 FacturaProcessingService

Lógica de negocio para procesamiento de facturas.

```python
# app/services/factura_processing_service.py
class FacturaProcessingService:
    def process_invoice_upload(
        self,
        session: Session,
        file: UploadFile,
        metadata: Dict[str, Any]
    ) -> Factura:
        """
        Orquesta todo el proceso:
        1. Guardar archivo temporalmente
        2. Subir a GCS
        3. Extraer datos con OCR (si está configurado)
        4. Crear registro de Factura
        5. Limpiar archivos temporales
        """
```

### 8.3 Convenciones de Servicios

1. **Naming**: `{Entity}Service` (ej: `FacturaProcessingService`)
2. **Location**: `app/services/{entity}_service.py`
3. **Responsabilidad única**: Cada servicio maneja UN dominio
4. **Stateless**: Servicios no mantienen estado entre llamadas
5. **Dependency injection**: Reciben Session como parámetro

---

## 9. Gestión de Archivos

### 9.1 Arquitectura de Storage

```
┌─────────────────────────────────────────────────────────┐
│                    Cliente (Frontend)                   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼ POST /api/upload
┌─────────────────────────────────────────────────────────┐
│                  Upload Endpoint (api/upload.py)        │
│              Validación, nombre único, guardar          │
└─────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
    ┌───────────────────┐   ┌──────────────────────┐
    │  Local Storage    │   │  Google Cloud        │
    │  (Development)    │   │  Storage (Prod)      │
    │  /uploads/images/ │   │  gs://bucket/folder/ │
    └───────────────────┘   └──────────────────────┘
```

### 9.2 Upload Local (Development)

```python
# app/api/upload.py
@router.post("/upload")
async def upload_file(file: UploadFile = File(...)) -> Dict[str, str]:
    """
    Sube archivo a storage local
    
    Validaciones:
    - Extensión permitida (.jpg, .jpeg, .png, .gif, .webp)
    - Tamaño máximo 10MB
    
    Retorna:
    - url: Ruta relativa al servidor (/uploads/images/{uuid}.jpg)
    - filename: Nombre único generado
    """
```

**Ejemplo:**

```bash
curl -X POST http://localhost:8000/api/upload \
  -F "file=@factura.pdf"

# Respuesta:
{
  "url": "/uploads/images/550e8400-e29b-41d4-a716-446655440000.pdf",
  "filename": "550e8400-e29b-41d4-a716-446655440000.pdf"
}
```

### 9.3 Upload a GCS (Production)

```python
from app.services.gcs_storage_service import GCSStorageService

# En endpoint especializado
service = GCSStorageService()
result = service.upload_invoice(
    file_path=temp_file_path,
    filename=unique_filename,
    content_type="application/pdf",
)

# Guardar result["download_url"] en la base de datos
```

### 9.4 Servir Archivos Estáticos

```python
# app/main.py
from fastapi.staticfiles import StaticFiles

# Crear directorio si no existe
uploads_dir = "uploads"
os.makedirs(uploads_dir, exist_ok=True)
os.makedirs(f"{uploads_dir}/images", exist_ok=True)
os.makedirs(f"{uploads_dir}/facturas", exist_ok=True)

# Montar ruta estática
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
```

**Acceso:**

```
http://localhost:8000/uploads/images/550e8400-e29b-41d4-a716-446655440000.jpg
```

### 9.5 Validaciones

```python
# Constantes en api/upload.py
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

def validate_file(file: UploadFile) -> None:
    """
    Valida:
    - Que el archivo tenga nombre
    - Extensión permitida
    - Tamaño máximo
    
    Lanza HTTPException si falla validación
    """
```

---

## 10. Migraciones

### 10.1 Alembic Setup

```python
# alembic/env.py
from app.models import Base
target_metadata = Base.metadata

# Lee DATABASE_URL desde .env
db_url = os.getenv("DATABASE_URL")
config.set_main_option("sqlalchemy.url", db_url)
```

### 10.2 Workflow de Migraciones

#### Crear Nueva Migración

```bash
# Auto-generar desde modelos
alembic revision --autogenerate -m "descripción del cambio"

# Ejemplo:
alembic revision --autogenerate -m "add campo telefono to users"
```

#### Aplicar Migraciones

```bash
# Local (apuntando a DATABASE_URL en .env)
alembic upgrade head

# Neon (con URL directa, sin pooler)
alembic upgrade head --url "postgresql://user:pass@host/db?sslmode=require"
```

#### Ver Estado

```bash
# Ver revisión actual
alembic current

# Ver historial
alembic history --verbose | tail -20
```

#### Rollback

```bash
# Retroceder 1 revisión
alembic downgrade -1

# Retroceder a revisión específica
alembic downgrade abc123
```

### 10.3 Estructura de Migración

```python
# alembic/versions/0001_initial_schema.py
"""Initial schema

Revision ID: 0001_initial_schema
Revises: None
Create Date: 2024-11-10 12:00:00
"""
from alembic import op
import sqlalchemy as sa
import sqlmodel

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Crear tablas, columnas, índices, etc.
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        # ...
    )

def downgrade():
    # Revertir cambios
    op.drop_table('users')
```

### 10.4 Migraciones de Datos

Para seed data o transformaciones, crear migración manual:

```bash
alembic revision -m "seed core data"
```

```python
# alembic/versions/0002_seed_core_data.py
def upgrade():
    # Ejecutar SQL directo
    op.execute("""
        INSERT INTO paises (codigo, nombre) VALUES
        ('AR', 'Argentina'),
        ('BR', 'Brasil');
    """)
```

### 10.5 Convenciones

1. **Nombres descriptivos**: `add_telefono_to_users`, `create_facturas_table`
2. **Autogenerate primero**: Revisar el script generado antes de aplicar
3. **Downgrade siempre**: Implementar función `downgrade()` funcional
4. **Testing**: Probar upgrade → downgrade → upgrade en local
5. **Producción**: Usar URL directa (sin pooler) para migraciones

---

## 11. Testing

### 11.1 Estructura

```
tests/
├── __init__.py
├── conftest.py         # Fixtures compartidos
├── test_models.py      # Tests de modelos
├── test_crud.py        # Tests de CRUD genérico
├── test_routers.py     # Tests de endpoints
└── test_services.py    # Tests de servicios
```

### 11.2 Fixtures Comunes

```python
# tests/conftest.py
import pytest
from sqlmodel import Session, create_engine, SQLModel
from app.db import get_session
from app.main import app

@pytest.fixture(name="session")
def session_fixture():
    """Session de base de datos en memoria para tests"""
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

@pytest.fixture
def client(session):
    """Cliente de prueba FastAPI con DB override"""
    def get_session_override():
        return session
    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
```

### 11.3 Tests de Modelos

```python
# tests/test_models.py
def test_crear_solicitud(session):
    """Test crear solicitud con validaciones"""
    solicitud = Solicitud(
        tipo="normal",
        fecha_necesidad=date(2024, 12, 1),
        solicitante_id=1,
    )
    session.add(solicitud)
    session.commit()
    session.refresh(solicitud)
    
    assert solicitud.id is not None
    assert solicitud.tipo == "normal"
    assert solicitud.created_at is not None
```

### 11.4 Tests de CRUD

```python
# tests/test_crud.py
def test_generic_crud_create(session):
    """Test crear con GenericCRUD"""
    crud = GenericCRUD(Solicitud)
    data = {
        "tipo": "normal",
        "fecha_necesidad": "2024-12-01",
        "solicitante_id": 1,
    }
    obj = crud.create(session, data)
    
    assert obj.id is not None
    assert obj.tipo == "normal"

def test_nested_crud_update(session):
    """Test actualizar con detalles anidados"""
    # ... setup ...
    crud = NestedCRUD(Solicitud, nested_relations=...)
    payload = {
        "detalles": [
            {"id": 1, "cantidad": 10},  # Update
            {"articulo_id": 20, "cantidad": 5},  # Create
        ]
    }
    obj = crud.update(session, solicitud_id, payload)
    
    assert len(obj.detalles) == 2
```

### 11.5 Tests de Endpoints

```python
# tests/test_routers.py
def test_create_solicitud(client):
    """Test POST /solicitudes"""
    response = client.post("/solicitudes", json={
        "tipo": "normal",
        "fecha_necesidad": "2024-12-01",
        "solicitante_id": 1,
    })
    
    assert response.status_code == 201
    data = response.json()
    assert data["id"] is not None
    assert data["tipo"] == "normal"

def test_list_solicitudes(client):
    """Test GET /solicitudes con paginación"""
    response = client.get("/solicitudes?range=[0,9]&sort=[\"id\",\"ASC\"]")
    
    assert response.status_code == 200
    assert "X-Total-Count" in response.headers
    data = response.json()
    assert isinstance(data, list)
```

### 11.6 Ejecutar Tests

```bash
# Todos los tests
pytest -v

# Tests específicos
pytest tests/test_crud.py -v

# Con coverage
pytest --cov=app --cov-report=html

# Test específico
pytest tests/test_models.py::test_crear_solicitud -v
```

---

## 12. Configuración

### 12.1 Variables de Entorno

**Archivo:** `.env` (no versionado, crear desde `.env copy`)

```env
# ============================================
# 1. ENTORNO
# ============================================
ENV=dev  # dev | staging | prod

# ============================================
# 2. BASE DE DATOS
# ============================================
# Local
DATABASE_URL=postgresql+psycopg://sak_user:password@localhost:5432/sak

# Neon (producción, pooled)
# DATABASE_URL=postgresql+psycopg://user:pass@host-pooler.neon.tech/db?sslmode=require

SQLALCHEMY_ECHO=1  # 1=log queries, 0=silencioso

# ============================================
# 3. API
# ============================================
CORS_ORIGINS=http://localhost:3000;https://app.vercel.app
MAX_UPLOAD_MB=10
ALLOWED_MIME=image/jpeg,image/png,image/gif,image/webp

# ============================================
# 4. SEGURIDAD
# ============================================
JWT_SECRET=<generar_con_python_secrets>

# ============================================
# 5. OPENAI (OCR de facturas)
# ============================================
OPENAI_API_KEY=sk-proj-...  # Opcional

# ============================================
# 6. STORAGE
# ============================================
STORAGE_ROOT=./storage

# ============================================
# 7. GOOGLE CLOUD STORAGE (Producción)
# ============================================
GCS_PROJECT_ID=sak-wcl
GCS_BUCKET_NAME=sak-wcl-bucket
GCS_INVOICE_FOLDER=facturas
GCS_SIGNED_URL_SECONDS=86400
GOOGLE_APPLICATION_CREDENTIALS=./gcp-credentials.json  # Local only
```

### 12.2 Carga de Configuración

```python
# app/db.py
from dotenv import load_dotenv
import os

load_dotenv()  # Carga .env al inicio

ENV = os.getenv("ENV", "dev")
DATABASE_URL = os.getenv("DATABASE_URL")
SQLALCHEMY_ECHO = os.getenv("SQLALCHEMY_ECHO", "0") == "1"
```

### 12.3 Configuración por Entorno

| Variable | Development | Production |
|----------|-------------|------------|
| `ENV` | `dev` | `prod` |
| `DATABASE_URL` | Local PostgreSQL | Neon pooled URL |
| `SQLALCHEMY_ECHO` | `1` (verbose) | `0` (silent) |
| `CORS_ORIGINS` | `localhost:3000` | URLs de Vercel |
| `GOOGLE_APPLICATION_CREDENTIALS` | `./gcp-credentials.json` | No definir (usa ADC) |
| `ALLOW_CREATE_ALL` | `1` (opcional) | `0` (usar Alembic) |

### 12.4 CORS

```python
# app/main.py
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    # Production: múltiples orígenes separados por ; o ,
    separator = ";" if ";" in cors_origins_env else ","
    allowed_origins = [origin.strip() for origin in cors_origins_env.split(separator)]
else:
    # Development: localhost por defecto
    allowed_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "X-Total-Count"],
)
```

---

## 13. Convenciones de Código

### 13.1 Naming Conventions

#### Archivos

| Tipo | Patrón | Ejemplo |
|------|--------|---------|
| Modelo | `{entity}.py` | `solicitud.py` |
| Router | `{entity}_router.py` | `solicitud_router.py` |
| Servicio | `{entity}_service.py` | `gcs_storage_service.py` |
| CRUD | `{entity}_crud.py` | `custom_solicitud_crud.py` |
| Test | `test_{component}.py` | `test_solicitud_router.py` |

#### Clases

```python
# Modelos: PascalCase, singular
class Solicitud(Base, table=True):
    pass

# Servicios: PascalCase + "Service"
class GCSStorageService:
    pass

# CRUD: Variable, no clase
solicitud_crud = NestedCRUD(...)
```

#### Funciones/Métodos

```python
# snake_case
def create_solicitud(...):
    pass

def get_articulos_by_categoria(...):
    pass
```

#### Variables

```python
# snake_case
solicitud_id = 123
articulos_list = [...]
fecha_necesidad = date.today()
```

#### Constantes

```python
# UPPER_SNAKE_CASE
MAX_FILE_SIZE = 10 * 1024 * 1024
STAMP_FIELDS = {"id", "created_at", ...}
```

### 13.2 Imports

```python
# 1. Standard library
import os
from datetime import datetime, date
from typing import List, Optional, Dict

# 2. Third-party
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import SQLModel, Field, Relationship, Session

# 3. Local
from app.db import get_session
from app.models.base import Base
from app.core.generic_crud import GenericCRUD
```

### 13.3 Type Hints

```python
# Siempre usar type hints en funciones públicas
def create_solicitud(
    session: Session,
    data: Dict[str, Any],
) -> Solicitud:
    """Crea una nueva solicitud"""
    pass

# Opcional en privadas pero recomendado
def _validate_data(data: Dict[str, Any]) -> bool:
    pass
```

### 13.4 Docstrings

```python
def create_generic_router(
    model: Type[SQLModel],
    crud: GenericCRUD,
    prefix: str,
    tags: list[str] | None = None,
) -> APIRouter:
    """
    Factory que crea un router CRUD genérico completo.
    
    Args:
        model: Modelo SQLModel de la entidad
        crud: Instancia de GenericCRUD o NestedCRUD
        prefix: Prefijo de URL (ej: "/solicitudes")
        tags: Tags para Swagger (opcional)
    
    Returns:
        APIRouter configurado con endpoints CRUD
    
    Example:
        >>> crud = GenericCRUD(Solicitud)
        >>> router = create_generic_router(Solicitud, crud, "/solicitudes")
    """
    pass
```

### 13.5 Manejo de Errores

```python
# En CRUD y servicios: Lanzar excepciones claras
if not obj:
    raise ValueError(f"{model.__name__} con id {obj_id} no encontrado")

# En routers: Convertir a HTTPException
try:
    obj = crud.create(session, payload)
except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
except Exception as e:
    raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")
```

---

## 14. Flujos Principales

### 14.1 Flujo: Crear Entidad Simple

```
Cliente → POST /articulos
    ↓
Router (create_generic_router)
    ↓ Validar payload
GenericCRUD.create()
    ↓ Limpiar campos (solo editables)
    ↓ Coercer tipos
    ↓ Crear objeto SQLModel
Session.add() + commit()
    ↓
Respuesta: objeto filtrado (sin timestamps)
```

### 14.2 Flujo: Crear Entidad con Detalles

```
Cliente → POST /solicitudes
  payload: {
    "tipo": "normal",
    "detalles": [...]
  }
    ↓
Router (create_generic_router)
    ↓
NestedCRUD.create()
    ↓ Extraer nested_relations del payload
    ↓ Crear cabecera (Solicitud)
    ↓ Para cada detalle:
    │   ↓ Asignar FK (solicitud_id)
    │   ↓ Crear objeto (SolicitudDetalle)
    │   ↓ Agregar a session
    ↓
Session.commit()
    ↓ Refresh para cargar relaciones
    ↓
Respuesta: objeto completo con detalles expandidos
```

### 14.3 Flujo: Actualizar con Sincronización

```
Cliente → PUT /solicitudes/1
  payload: {
    "tipo": "directa",
    "detalles": [
      {"id": 1, "cantidad": 10},  # Update
      {"articulo_id": 20}          # Create nuevo
      // Detalle id=2 omitido → Delete
    ]
  }
    ↓
NestedCRUD.update()
    ↓ Obtener objeto existente
    ↓ Actualizar campos cabecera
    ↓
_sync_nested_relations()
    ↓ Obtener detalles existentes
    ↓ Para cada detalle en payload:
    │   ↓ ¿Tiene id?
    │   │   ↓ SÍ → Actualizar existente
    │   │   ↓ NO → Crear nuevo
    ↓ Para cada detalle existente NO en payload:
    │   ↓ Soft delete (allow_delete=True)
    ↓
Session.commit()
    ↓
Respuesta: objeto actualizado completo
```

### 14.4 Flujo: Upload y Procesamiento de Factura

```
Cliente → POST /api/factura/upload
    ↓
API (factura_processing.py)
    ↓ Validar archivo (tipo, tamaño)
    ↓ Guardar temporalmente
    ↓
FacturaProcessingService.process()
    ↓
GCSStorageService.upload_invoice()
    ↓ Subir a gs://bucket/facturas/
    ↓ Retornar download_url
    ↓
PDFExtractionService.extract_invoice_data()
    ↓ Convertir PDF a imágenes
    ↓ Llamar OpenAI Vision API
    ↓ Parsear respuesta JSON
    ↓ Retornar datos estructurados
    ↓
Crear Factura en DB
    ↓ Datos extraídos + URL de archivo
    ↓ Crear registro con detalles
    ↓
Limpiar archivos temporales
    ↓
Respuesta: Factura creada con datos
```

### 14.5 Flujo: Listado con Filtros

```
Cliente → GET /solicitudes?range=[0,24]&filter={"tipo":"normal"}
    ↓
Router (list_objects endpoint)
    ↓ Parsear parámetros ra-data
    ↓ Convertir a formato genérico
    ↓
GenericCRUD.list()
    ↓ Construir query base
    ↓ Aplicar filtros WHERE
    ↓ Aplicar búsqueda (q parameter)
    ↓ Aplicar deleted filter
    ↓ Aplicar ordenamiento
    ↓ Aplicar paginación (LIMIT/OFFSET)
    ↓ Ejecutar query + count
    ↓
Filtrar respuestas
    ↓ Para cada objeto: filtrar_respuesta()
    ↓ Ocultar timestamps
    ↓ Expandir relaciones configuradas
    ↓
Respuesta:
    ↓ Body: Array de objetos
    ↓ Headers: X-Total-Count, Content-Range
```

---

## 15. Checklist de Desarrollo

### 15.1 Agregar Nueva Entidad

- [ ] **1. Crear Modelo** (`app/models/{entity}.py`)
  - [ ] Heredar de `Base`
  - [ ] Definir `__tablename__`
  - [ ] Configurar `__searchable_fields__`
  - [ ] Configurar `__expanded_list_relations__` (si aplica)
  - [ ] Definir campos con type hints
  - [ ] Definir relaciones con `Relationship()`

- [ ] **2. Crear Migración**
  ```bash
  alembic revision --autogenerate -m "create {entity} table"
  # Revisar script generado
  alembic upgrade head
  ```

- [ ] **3. Crear CRUD** (si necesita lógica especial)
  - [ ] Usar `GenericCRUD` para entidades simples
  - [ ] Usar `NestedCRUD` para entidades con detalles
  - [ ] Crear CRUD personalizado solo si necesario

- [ ] **4. Crear Router** (`app/routers/{entity}_router.py`)
  ```python
  from app.models.{entity} import {Entity}
  from app.core.generic_crud import GenericCRUD
  from app.core.router import create_generic_router
  
  crud = GenericCRUD({Entity})
  router = create_generic_router({Entity}, crud, "/{entities}", ["{entities}"])
  ```

- [ ] **5. Registrar Router** (`app/main.py`)
  ```python
  from app.routers.{entity}_router import router as {entity}_router
  app.include_router({entity}_router)
  ```

- [ ] **6. Tests**
  - [ ] Test modelo (crear, validaciones)
  - [ ] Test CRUD (create, list, get, update, delete)
  - [ ] Test endpoints (POST, GET, PUT, DELETE)

- [ ] **7. Seed Data** (opcional)
  - [ ] Agregar datos de prueba en `scripts/seed_sak_backend.py`

- [ ] **8. Documentación**
  - [ ] Actualizar docstrings
  - [ ] Agregar ejemplos en Swagger (si necesario)

### 15.2 Modificar Entidad Existente

- [ ] **1. Actualizar Modelo**
  - [ ] Modificar campos en `app/models/{entity}.py`
  - [ ] Actualizar type hints

- [ ] **2. Crear Migración**
  ```bash
  alembic revision --autogenerate -m "add {field} to {entity}"
  alembic upgrade head
  ```

- [ ] **3. Actualizar Tests**
  - [ ] Adaptar tests existentes
  - [ ] Agregar tests para nueva funcionalidad

- [ ] **4. Verificar Impacto**
  - [ ] ¿Afecta a otros modelos relacionados?
  - [ ] ¿Requiere cambios en frontend?
  - [ ] ¿Afecta a servicios existentes?

### 15.3 Agregar Servicio

- [ ] **1. Crear Servicio** (`app/services/{entity}_service.py`)
  - [ ] Naming: `{Entity}Service`
  - [ ] Métodos claros y específicos
  - [ ] Docstrings completas

- [ ] **2. Integrar en Router**
  - [ ] Importar servicio
  - [ ] Usar en endpoint especializado

- [ ] **3. Tests**
  - [ ] Tests unitarios del servicio
  - [ ] Mockear dependencias externas

- [ ] **4. Documentación**
  - [ ] Agregar en sección de Servicios
  - [ ] Ejemplos de uso

### 15.4 Agregar Endpoint Especializado

- [ ] **1. Crear Endpoint** (`app/api/{feature}.py`)
  - [ ] Usar `APIRouter`
  - [ ] Validar entrada con Pydantic
  - [ ] Manejar errores apropiadamente

- [ ] **2. Registrar en main.py**
  ```python
  from app.api.{feature} import router as {feature}_router
  app.include_router({feature}_router, prefix="/api")
  ```

- [ ] **3. Tests**
  - [ ] Test casos exitosos
  - [ ] Test casos de error

### 15.5 Deploy

- [ ] **1. Pre-deploy**
  - [ ] `pytest -v` pasa todos los tests
  - [ ] Migrations aplicadas en local
  - [ ] `.env` actualizado con nuevas variables (si aplica)

- [ ] **2. Deploy Backend (GCP)**
  - [ ] Push a branch `master`
  - [ ] GitHub Actions despliega automáticamente
  - [ ] Verificar logs en Cloud Run
  - [ ] Aplicar migraciones en prod:
    ```bash
    alembic upgrade head --url <NEON_DIRECT_URL>
    ```

- [ ] **3. Verificación**
  - [ ] Health check: `curl https://backend/health`
  - [ ] Swagger: `https://backend/docs`
  - [ ] Test endpoints críticos

- [ ] **4. Frontend**
  - [ ] Actualizar tipos TypeScript (si aplica)
  - [ ] Deploy a Vercel

---

## 📌 Apéndices

### A. Glosario

- **Base**: Modelo SQLModel con campos automáticos (timestamps, soft delete)
- **CRUD**: Create, Read, Update, Delete operations
- **GenericCRUD**: Clase base que implementa CRUD para cualquier modelo
- **NestedCRUD**: CRUD que sincroniza relaciones one-to-many
- **Soft Delete**: Eliminación lógica (setear `deleted_at`) sin borrar físicamente
- **STAMP_FIELDS**: Campos de sistema no editables (`id`, `created_at`, etc.)
- **ra-data**: React Admin data providers (simple-rest, json-server)
- **Coerción**: Conversión automática de tipos (string → date, etc.)
- **Filtrado**: Ocultación de campos internos en respuestas

### B. Referencias

- **FastAPI**: https://fastapi.tiangolo.com/
- **SQLModel**: https://sqlmodel.tiangolo.com/
- **Alembic**: https://alembic.sqlalchemy.org/
- **React Admin**: https://marmelab.com/react-admin/
- **PostgreSQL**: https://www.postgresql.org/docs/

### C. Comandos Útiles

```bash
# Desarrollo
uvicorn app.main:app --reload --port 8000

# Migraciones
alembic revision --autogenerate -m "descripción"
alembic upgrade head
alembic current

# Testing
pytest -v
pytest --cov=app --cov-report=html

# Seed data
python scripts/seed_sak_backend.py

# Verificar imports
python -c "from app.models import *; print('OK')"
```

---

## 📝 Historial de Cambios

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 2024-11-10 | Versión inicial - Documentación completa de arquitectura y patrones |

---

**Fin del documento README_BACKEND_v1.md**

*Este documento debe ser consultado antes de realizar cambios en el backend para mantener consistencia arquitectural.*
