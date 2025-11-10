# 🎯 SAK Backend - Patrones y Convenciones (Versión Resumida)

> **Versión Completa:** [README_BACKEND_v1.md](./README_BACKEND_v1.md)  
> **Propósito:** Referencia rápida para mantener patrones en cambios al backend  
> **Fecha:** Noviembre 2025

---

## 📚 Stack Tecnológico

- **Python 3.11+** | **FastAPI** | **SQLModel** (ORM) | **PostgreSQL** | **Alembic** (migraciones)
- **Psycopg3** (driver) | **Pydantic** (validación) | **Uvicorn** (servidor ASGI)

---

## 🏗️ Arquitectura en Capas

```
FastAPI (main.py) → Routers → CRUD/Services → SQLModel → PostgreSQL
```

**Principios:**
- **DRY**: CRUD genérico para evitar repetición
- **Convention over Configuration**: Patrones consistentes
- **Separation of Concerns**: Cada capa tiene una responsabilidad única

---

## 📁 Estructura de Directorios

```
backend/app/
├── models/          # Entidades SQLModel (heredan de Base)
├── core/            # CRUD genérico, routers factory, respuestas
├── routers/         # Routers específicos por entidad
├── services/        # Lógica de negocio compleja
├── api/             # Endpoints especializados
└── db.py            # Engine, Session, init_db
```

---

## 🎨 PATRÓN 1: Modelo Base

**Todos los modelos heredan de `Base`:**

```python
# app/models/base.py
class Base(SQLModel):
    # CAMPOS AUTOMÁTICOS (NO editables por usuario)
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=current_utc_time)
    updated_at: datetime = Field(default_factory=current_utc_time)
    deleted_at: Optional[datetime] = Field(default=None)  # Soft delete
    version: int = Field(default=1)  # Optimistic locking
    
    # METADATA (ClassVar)
    __searchable_fields__: ClassVar[List[str]] = []  # Campos para búsqueda "q"
    __expanded_list_relations__: ClassVar[set[str]] = set()  # Relaciones a expandir
```

**Convenciones de Modelo:**

```python
class MiEntidad(Base, table=True):
    __tablename__ = "mi_entidad"  # ✅ Obligatorio: nombre explícito
    __searchable_fields__ = ["nombre", "descripcion"]  # ✅ Campos de búsqueda
    __expanded_list_relations__ = {"detalles"}  # ✅ Relaciones a expandir
    
    # Campos con type hints
    nombre: str = Field(max_length=100, index=True)
    activo: bool = Field(default=True)
    
    # Foreign Keys
    categoria_id: Optional[int] = Field(default=None, foreign_key="categorias.id")
    
    # Relaciones
    categoria: Optional[Categoria] = Relationship(back_populates="items")
```

**Tipos de Campos Comunes:**

```python
# String
nombre: str = Field(max_length=255)

# Enum
class TipoEnum(str, Enum):
    VALOR1 = "valor1"
    VALOR2 = "valor2"

tipo: TipoEnum = Field(default=TipoEnum.VALOR1)

# Date/DateTime
fecha: date = Field(...)
timestamp: datetime = Field(default_factory=current_utc_time)

# Decimal (precios, cantidades)
precio: Decimal = Field(sa_column=Column(DECIMAL(15, 2)))

# Boolean
activo: bool = Field(default=True)

# FK + Relación
padre_id: int = Field(foreign_key="padres.id")
padre: Padre = Relationship(back_populates="hijos")
```

**Relaciones One-to-Many:**

```python
# Padre (Solicitud)
detalles: List["SolicitudDetalle"] = Relationship(
    back_populates="solicitud",
    sa_relationship_kwargs={"cascade": "all, delete-orphan"}
)

# Hijo (SolicitudDetalle)
solicitud_id: int = Field(foreign_key="solicitudes.id")
solicitud: Solicitud = Relationship(back_populates="detalles")
```

---

## 🔧 PATRÓN 2: CRUD Genérico

### GenericCRUD (Entidades Simples)

```python
from app.core.generic_crud import GenericCRUD

# Instanciar CRUD
mi_entidad_crud = GenericCRUD(MiEntidad)

# Métodos disponibles:
crud.create(session, data: Dict) → Objeto
crud.get(session, obj_id: int) → Objeto | None
crud.list(session, page, per_page, sort_by, sort_dir, filters, q) → (List, Total)
crud.update(session, obj_id, data: Dict) → Objeto
crud.delete(session, obj_id) → Objeto  # Soft delete
```

**Características:**

1. **Coerción automática de tipos:** `"2024-11-10"` → `date(2024, 11, 10)`
2. **Filtros avanzados:** `nombre__eq`, `precio__gte`, `categoria__in`, etc.
3. **Búsqueda general:** Parámetro `q` busca en `__searchable_fields__`
4. **Soft delete:** Campo `deleted_at`, parámetro `deleted="exclude|include|only"`

### NestedCRUD (Entidades con Detalles)

```python
from app.core.nested_crud import NestedCRUD

# Para modelos con relaciones one-to-many
solicitud_crud = NestedCRUD(
    Solicitud,
    nested_relations={
        "detalles": {  # Nombre de la relación
            "model": SolicitudDetalle,
            "fk_field": "solicitud_id",
            "allow_delete": True,
        }
    },
)
```

**Comportamiento:**

```python
# CREATE: Crea cabecera + detalles en una transacción
payload = {
    "campo": "valor",
    "detalles": [
        {"articulo_id": 10, "cantidad": 5},
        {"articulo_id": 20, "cantidad": 3},
    ]
}

# UPDATE: Sincroniza detalles
payload = {
    "id": 1,
    "detalles": [
        {"id": 1, "cantidad": 10},  # ← UPDATE existente
        {"articulo_id": 30, "cantidad": 2},  # ← CREATE nuevo
        # Detalle id=2 omitido → DELETE (si allow_delete=True)
    ]
}
```

---

## 🚀 PATRÓN 3: Router Factory

```python
# app/routers/mi_entidad_router.py
from app.models.mi_entidad import MiEntidad
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# 1. Crear CRUD
mi_entidad_crud = GenericCRUD(MiEntidad)

# 2. Crear router con factory
mi_entidad_router = create_generic_router(
    model=MiEntidad,
    crud=mi_entidad_crud,
    prefix="/mi-entidad",
    tags=["mi-entidad"],
)

# 3. Agregar endpoints personalizados (opcional)
@mi_entidad_router.get("/custom")
def custom_endpoint():
    pass
```

**Registrar en main.py:**

```python
# app/main.py
from app.routers.mi_entidad_router import mi_entidad_router

app.include_router(mi_entidad_router)
```

**Endpoints generados automáticamente:**

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/mi-entidad` | Crear |
| `GET` | `/mi-entidad` | Listar con paginación/filtros |
| `GET` | `/mi-entidad/{id}` | Obtener por ID |
| `PUT` | `/mi-entidad/{id}` | Actualizar |
| `DELETE` | `/mi-entidad/{id}` | Eliminar (soft delete) |

**Parámetros de listado (React Admin compatible):**

```http
GET /mi-entidad?range=[0,24]&sort=["id","ASC"]&filter={"activo":true}&q=busqueda
```

---

## 🗃️ PATRÓN 4: Migraciones

### Workflow Alembic

```bash
# 1. Crear migración (autogenerar desde modelos)
alembic revision --autogenerate -m "add campo_x to tabla_y"

# 2. Revisar script en alembic/versions/XXXX_*.py

# 3. Aplicar migración
alembic upgrade head

# 4. Verificar estado
alembic current
```

### Script de Migración

```python
# alembic/versions/XXXX_add_campo.py

def upgrade():
    # Agregar columna con default
    op.add_column('tabla', 
        sa.Column('campo', sa.String(50), nullable=False, server_default='valor'))
    
    # Actualizar registros existentes (si es necesario)
    op.execute("UPDATE tabla SET campo = 'nuevo_valor' WHERE condicion")

def downgrade():
    op.drop_column('tabla', 'campo')
```

---

## 🌱 PATRÓN 5: Seed Data

```python
# scripts/seed_mi_entidad.py
from sqlmodel import Session
from app.db import engine, init_db
from app.models.mi_entidad import MiEntidad

def seed_mi_entidad():
    with Session(engine) as session:
        items = [
            MiEntidad(nombre="Item 1", activo=True),
            MiEntidad(nombre="Item 2", activo=True),
        ]
        for item in items:
            session.add(item)
        session.commit()
        print(f"✅ {len(items)} items creados")

if __name__ == "__main__":
    init_db()
    seed_mi_entidad()
```

---

## ⚙️ PATRÓN 6: Servicios

**Usar para lógica de negocio compleja:**

```python
# app/services/mi_entidad_service.py

class MiEntidadService:
    """Servicio para lógica compleja de MiEntidad"""
    
    def procesar_entidad(self, session: Session, entidad_id: int) -> Dict:
        """Lógica que requiere múltiples operaciones"""
        # 1. Obtener entidad
        # 2. Validar reglas de negocio
        # 3. Interactuar con servicios externos
        # 4. Actualizar múltiples modelos
        # 5. Retornar resultado
        pass
```

**Cuándo usar servicios:**
- Integración con APIs externas (GCS, OpenAI)
- Procesamiento de archivos
- Lógica multi-modelo
- Operaciones que requieren múltiples pasos

---

## ✅ CONVENCIONES DE NAMING

| Tipo | Patrón | Ejemplo |
|------|--------|---------|
| **Archivo Modelo** | `{entity}.py` | `solicitud.py` |
| **Clase Modelo** | `PascalCase` singular | `Solicitud` |
| **Tabla** | `snake_case` plural | `solicitudes` |
| **Archivo Router** | `{entity}_router.py` | `solicitud_router.py` |
| **Variable CRUD** | `{entity}_crud` | `solicitud_crud` |
| **Servicio** | `{Entity}Service` | `SolicitudService` |
| **Migración** | `add_{campo}_to_{tabla}` | `add_prioridad_to_solicitudes` |
| **Constantes** | `UPPER_SNAKE_CASE` | `MAX_FILE_SIZE` |

---

## 🧪 PATRÓN 7: Testing

```python
# tests/test_mi_entidad.py

def test_crear_entidad(session):
    """Test crear con CRUD"""
    crud = GenericCRUD(MiEntidad)
    data = {"nombre": "Test", "activo": True}
    obj = crud.create(session, data)
    assert obj.id is not None

def test_endpoint_create(client):
    """Test POST endpoint"""
    response = client.post("/mi-entidad", json={"nombre": "Test"})
    assert response.status_code == 201
    assert response.json()["nombre"] == "Test"
```

---

## 🔐 VALIDACIONES

### En el Modelo (con Field)

```python
class MiEntidad(Base, table=True):
    nombre: str = Field(max_length=100, min_length=3)
    precio: Decimal = Field(gt=0)  # Greater than 0
    email: str = Field(regex=r"^[\w\.-]+@[\w\.-]+\.\w+$")
```

### En CRUD Personalizado

```python
class MiEntidadCRUD(GenericCRUD[MiEntidad]):
    def create(self, session: Session, data: Dict[str, Any]) -> MiEntidad:
        # Validación personalizada
        if data.get("tipo") == "especial" and data.get("precio") < 100:
            raise ValueError("Tipo especial requiere precio >= 100")
        
        return super().create(session, data)
```

---

## 📋 CHECKLIST RÁPIDO

### Agregar Nueva Entidad

- [ ] **Modelo** en `app/models/{entity}.py`
  - [ ] Heredar de `Base`
  - [ ] `__tablename__`, `__searchable_fields__`, `__expanded_list_relations__`
  - [ ] Type hints en todos los campos
  - [ ] Relaciones con `Relationship()`

- [ ] **Migración**
  ```bash
  alembic revision --autogenerate -m "create {entity} table"
  alembic upgrade head
  ```

- [ ] **CRUD** (instanciar `GenericCRUD` o `NestedCRUD`)

- [ ] **Router** en `app/routers/{entity}_router.py`
  ```python
  crud = GenericCRUD(Entity)
  router = create_generic_router(Entity, crud, "/{entities}", ["{entities}"])
  ```

- [ ] **Registrar** en `app/main.py`
  ```python
  app.include_router(entity_router)
  ```

- [ ] **Seed Data** (opcional) en `scripts/seed_{entity}.py`

- [ ] **Tests**
  - [ ] Test modelo
  - [ ] Test CRUD
  - [ ] Test endpoints

### Modificar Entidad Existente

- [ ] **Modificar modelo** en `app/models/{entity}.py`
- [ ] **Crear migración**
  ```bash
  alembic revision --autogenerate -m "add {campo} to {tabla}"
  ```
- [ ] **Revisar script** en `alembic/versions/`
- [ ] **Aplicar migración**: `alembic upgrade head`
- [ ] **Actualizar tests**
- [ ] **Verificar impacto** en otros modelos/servicios

---

## 🚨 ERRORES COMUNES A EVITAR

1. ❌ **No heredar de Base** → Los campos automáticos no se crean
2. ❌ **Olvidar `__tablename__`** → Nombre de tabla incorrecto
3. ❌ **No usar `server_default` en columnas NOT NULL** → Falla migración con datos existentes
4. ❌ **No implementar `downgrade()`** → No se puede revertir migración
5. ❌ **Usar pooled URL para migraciones** → Usar URL directa de Neon
6. ❌ **No expandir relaciones** → Frontend no recibe datos anidados
7. ❌ **Editar campos STAMP** → `created_at`, `updated_at`, etc. son automáticos
8. ❌ **No usar NestedCRUD para one-to-many** → Sincronización manual de detalles

---

## 📖 OPERADORES DE FILTRO

| Operador | Ejemplo | SQL Equivalente |
|----------|---------|-----------------|
| `__eq` | `nombre__eq=Juan` | `nombre = 'Juan'` |
| `__in` | `tipo__in=A,B,C` | `tipo IN ('A','B','C')` |
| `__gte` | `precio__gte=100` | `precio >= 100` |
| `__gt` | `precio__gt=100` | `precio > 100` |
| `__lte` | `precio__lte=500` | `precio <= 500` |
| `__lt` | `precio__lt=500` | `precio < 500` |
| `__is` | `activo__is=null` | `activo IS NULL` |
| `__like` | `nombre__like=%juan%` | `nombre ILIKE '%juan%'` |

---

## 🔗 REFERENCIAS

- **Documentación Completa:** [README_BACKEND_v1.md](./README_BACKEND_v1.md)
- **FastAPI:** https://fastapi.tiangolo.com/
- **SQLModel:** https://sqlmodel.tiangolo.com/
- **Alembic:** https://alembic.sqlalchemy.org/

---

**FIN - Referencia Rápida de Patrones Backend SAK**

*Consultar README_BACKEND_v1.md para detalles completos de arquitectura, flujos y ejemplos extendidos.*
