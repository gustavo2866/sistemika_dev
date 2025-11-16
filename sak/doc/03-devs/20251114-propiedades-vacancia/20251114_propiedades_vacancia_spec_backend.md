# 🔧 ESPECIFICACIÓN TÉCNICA BACKEND - Propiedades con Vacancia

> **Referencia:** 20251114_propiedades_vacancia_req.md  
> **Versión:** 1.0  
> **Fecha:** 2025-11-14

---

## 📋 ÍNDICE

1. [Modelo de Datos](#1-modelo-de-datos)
2. [Migraciones](#2-migraciones)
3. [Datos Seed](#3-datos-seed)
4. [Actualización de Datos Existentes](#4-actualización-de-datos-existentes)
5. [Endpoints y CRUD](#5-endpoints-y-crud)
6. [Casos de Prueba](#6-casos-de-prueba)
7. [Validaciones y Reglas de Negocio](#7-validaciones-y-reglas-de-negocio)
8. [Checklist de Implementación](#8-checklist-de-implementación)

---

## 1. MODELO DE DATOS

### 1.1 Modificaciones a Modelo `Propiedad`

**Archivo:** `backend/app/models/propiedad.py`

#### Campos a AGREGAR:

```python
# Características físicas
ambientes: Optional[int] = Field(
    default=None, 
    description="Cantidad de ambientes de la propiedad",
    ge=0
)

metros_cuadrados: Optional[float] = Field(
    default=None, 
    description="Superficie en metros cuadrados",
    ge=0,
    decimal_places=2
)

# Datos económicos
valor_alquiler: Optional[float] = Field(
    default=None,
    description="Valor mensual del alquiler en pesos",
    ge=0,
    decimal_places=2
)

expensas: Optional[float] = Field(
    default=None,
    description="Valor mensual de expensas en pesos",
    ge=0,
    decimal_places=2
)

# Datos de contrato
fecha_ingreso: Optional[date] = Field(
    default=None,
    description="Fecha original de ingreso de la propiedad al sistema"
)

vencimiento_contrato: Optional[date] = Field(
    default=None,
    description="Fecha de vencimiento del contrato actual (si está alquilada)"
)

# Control de estado
estado_fecha: datetime = Field(
    default_factory=datetime.utcnow,
    description="Fecha y hora del último cambio de estado"
)

estado_comentario: Optional[str] = Field(
    default=None,
    max_length=500,
    description="Comentario sobre el cambio de estado"
)
```

#### Campo a MODIFICAR:

```python
# ANTES:
estado: str = Field(max_length=100, description='Estado actual de la propiedad')

# DESPUÉS:
estado: str = Field(
    default='1-recibida',
    max_length=20,
    description='Estado actual: 1-recibida, 2-en_reparacion, 3-disponible, 4-alquilada, 5-retirada'
)
```

#### Campos a ELIMINAR de DEFAULT_PROPIEDADES:

Actualizar tupla para usar nuevos estados con prefijos numéricos:
- 'activa' → '3-disponible'
- 'mantenimiento' → '2-en_reparacion'
- 'alquilada' → '4-alquilada'
- 'disponible' → '3-disponible'

**IMPORTANTE:** Todas las propiedades deben inicializarse en estado '1-recibida' para crear el primer ciclo de vacancia.

#### Relaciones a AGREGAR:

```python
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .vacancia import Vacancia

# Al final de la clase
vacancias: List['Vacancia'] = Relationship(
    back_populates='propiedad',
    sa_relationship_kwargs={'cascade': 'all, delete-orphan'}
)
```

#### Configuración de API:

```python
__searchable_fields__ = ['nombre', 'tipo', 'propietario', 'estado']
__expanded_list_relations__ = []  # vacancia se consulta por separado
```

---

### 1.2 Nuevo Modelo `Vacancia`

**Archivo:** `backend/app/models/vacancia.py` (CREAR)

```python
from datetime import datetime, date
from typing import Optional, TYPE_CHECKING
from sqlmodel import Field, Relationship
from .base import Base

if TYPE_CHECKING:
    from .propiedad import Propiedad


class Vacancia(Base, table=True):
    """
    Registro de ciclos de vacancia de propiedades.
    Cada registro representa un ciclo completo desde que la propiedad
    queda disponible hasta que vuelve a ser alquilada.
    """
    
    __tablename__ = 'vacancias'
    
    # Relación con Propiedad
    propiedad_id: int = Field(foreign_key='propiedades.id', index=True)
    propiedad: Optional['Propiedad'] = Relationship(back_populates='vacancias')
    
    # Indicadores de ciclo
    ciclo_activo: bool = Field(
        default=True,
        description="Indica si el ciclo de vacancia está actualmente activo"
    )
    
    # Fechas de estados (registro cronológico)
    fecha_recibida: Optional[datetime] = Field(
        default=None,
        description="Fecha en que la propiedad fue recibida (inicio del ciclo)"
    )
    comentario_recibida: Optional[str] = Field(default=None, max_length=500)
    
    fecha_en_reparacion: Optional[datetime] = Field(
        default=None,
        description="Fecha en que comenzó el acondicionamiento"
    )
    comentario_en_reparacion: Optional[str] = Field(default=None, max_length=500)
    
    fecha_disponible: Optional[datetime] = Field(
        default=None,
        description="Fecha en que quedó disponible para alquilar"
    )
    comentario_disponible: Optional[str] = Field(default=None, max_length=500)
    
    fecha_alquilada: Optional[datetime] = Field(
        default=None,
        description="Fecha en que fue alquilada (fin del ciclo)"
    )
    comentario_alquilada: Optional[str] = Field(default=None, max_length=500)
    
    fecha_retirada: Optional[datetime] = Field(
        default=None,
        description="Fecha en que fue retirada del sistema (fin del ciclo)"
    )
    comentario_retirada: Optional[str] = Field(default=None, max_length=500)
    
    # Métricas calculadas (se calculan dinámicamente si ciclo activo)
    dias_reparacion: Optional[int] = Field(
        default=None,
        description="Días en reparación. Si ciclo activo y disponible: hoy - en_reparacion"
    )
    
    dias_disponible: Optional[int] = Field(
        default=None,
        description="Días disponible. Si ciclo activo y disponible: hoy - disponible"
    )
    
    dias_totales: Optional[int] = Field(
        default=None,
        description="Días totales del ciclo. Si ciclo activo: hoy - recibida"
    )
    
    # Configuración de API
    __searchable_fields__ = ['propiedad_id', 'ciclo_activo']
    __expanded_list_relations__ = ['propiedad']  # Siempre expandir propiedad
    
    @property
    def dias_reparacion_calculado(self) -> Optional[int]:
        """Calcula días en reparación considerando si el ciclo está activo."""
        if not self.fecha_en_reparacion:
            return None
        
        fecha_fin = self.fecha_disponible or (datetime.utcnow() if self.ciclo_activo else None)
        if not fecha_fin:
            return None
            
        return (fecha_fin - self.fecha_en_reparacion).days
    
    @property
    def dias_disponible_calculado(self) -> Optional[int]:
        """Calcula días disponible considerando si el ciclo está activo."""
        if not self.fecha_disponible:
            return None
        
        fecha_fin = self.fecha_alquilada or (datetime.utcnow() if self.ciclo_activo else None)
        if not fecha_fin:
            return None
            
        return (fecha_fin - self.fecha_disponible).days
    
    @property
    def dias_totales_calculado(self) -> Optional[int]:
        """Calcula días totales del ciclo considerando si está activo."""
        if not self.fecha_recibida:
            return None
        
        # Si ciclo activo, hasta hoy; si cerrado, hasta fecha de cierre
        if self.ciclo_activo:
            fecha_fin = datetime.utcnow()
        else:
            fecha_fin = self.fecha_alquilada or self.fecha_retirada
        
        if not fecha_fin:
            return None
            
        return (fecha_fin - self.fecha_recibida).days
    
    def __str__(self) -> str:
        estado = "Activo" if self.ciclo_activo else "Cerrado"
        return f"Vacancia(id={self.id}, propiedad_id={self.propiedad_id}, {estado})"
```

---

### 1.3 Enumeración de Estados

**Archivo:** `backend/app/models/enums.py` (CREAR o actualizar)

```python
from enum import Enum

class EstadoPropiedad(str, Enum):
    """Estados posibles de una propiedad con prefijo numérico para secuencia."""
    RECIBIDA = "1-recibida"
    EN_REPARACION = "2-en_reparacion"
    DISPONIBLE = "3-disponible"
    ALQUILADA = "4-alquilada"
    RETIRADA = "5-retirada"

# Transiciones permitidas (usar strings directamente)
TRANSICIONES_ESTADO_PROPIEDAD = {
    "1-recibida": ["2-en_reparacion", "3-disponible", "4-alquilada"],
    "2-en_reparacion": ["3-disponible", "5-retirada"],
    "3-disponible": ["4-alquilada", "5-retirada"],
    "4-alquilada": ["1-recibida", "5-retirada"],
    "5-retirada": []  # Estado final
}
```

---

## 2. MIGRACIONES

### 2.1 Migración Alembic

**Comando generación:**
```bash
cd backend
alembic revision --autogenerate -m "add_vacancia_and_update_propiedades"
```

**Archivo esperado:** `backend/alembic/versions/XXXX_add_vacancia_and_update_propiedades.py`

#### Operaciones esperadas (upgrade):

1. **Agregar columnas a `propiedades`:**
   ```python
   op.add_column('propiedades', sa.Column('ambientes', sa.Integer(), nullable=True))
   op.add_column('propiedades', sa.Column('metros_cuadrados', sa.DECIMAL(15, 2), nullable=True))
   op.add_column('propiedades', sa.Column('valor_alquiler', sa.DECIMAL(15, 2), nullable=True))
   op.add_column('propiedades', sa.Column('expensas', sa.DECIMAL(15, 2), nullable=True))
   op.add_column('propiedades', sa.Column('fecha_ingreso', sa.Date(), nullable=True))
   op.add_column('propiedades', sa.Column('vencimiento_contrato', sa.Date(), nullable=True))
   op.add_column('propiedades', sa.Column('estado_fecha', sa.DateTime(), nullable=False, server_default=sa.text('now()')))
   op.add_column('propiedades', sa.Column('estado_comentario', sa.VARCHAR(500), nullable=True))
   ```

2. **Crear tabla `vacancias`:**
   ```python
   op.create_table(
       'vacancias',
       sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
       sa.Column('created_at', sa.DateTime(), nullable=False),
       sa.Column('updated_at', sa.DateTime(), nullable=False),
       sa.Column('deleted_at', sa.DateTime(), nullable=True),
       sa.Column('version', sa.Integer(), nullable=False),
       sa.Column('propiedad_id', sa.Integer(), nullable=False),
       sa.Column('ciclo_activo', sa.Boolean(), nullable=False),
       sa.Column('fecha_recibida', sa.DateTime(), nullable=True),
       sa.Column('comentario_recibida', sa.VARCHAR(500), nullable=True),
       sa.Column('fecha_en_reparacion', sa.DateTime(), nullable=True),
       sa.Column('comentario_en_reparacion', sa.VARCHAR(500), nullable=True),
       sa.Column('fecha_disponible', sa.DateTime(), nullable=True),
       sa.Column('comentario_disponible', sa.VARCHAR(500), nullable=True),
       sa.Column('fecha_alquilada', sa.DateTime(), nullable=True),
       sa.Column('comentario_alquilada', sa.VARCHAR(500), nullable=True),
       sa.Column('fecha_retirada', sa.DateTime(), nullable=True),
       sa.Column('comentario_retirada', sa.VARCHAR(500), nullable=True),
       sa.Column('dias_reparacion', sa.Integer(), nullable=True),
       sa.Column('dias_disponible', sa.Integer(), nullable=True),
       sa.Column('dias_totales', sa.Integer(), nullable=True),
       sa.ForeignKeyConstraint(['propiedad_id'], ['propiedades.id'], name='fk_vacancias_propiedad'),
       sa.PrimaryKeyConstraint('id')
   )
   ```

3. **Crear índices:**
   ```python
   op.create_index('ix_vacancias_propiedad_id', 'vacancias', ['propiedad_id'])
   op.create_index('ix_vacancias_ciclo_activo', 'vacancias', ['ciclo_activo'])
   op.create_index('ix_vacancias_propiedad_ciclo', 'vacancias', ['propiedad_id', 'ciclo_activo'])
   ```

#### Operaciones de downgrade:

```python
op.drop_index('ix_vacancias_propiedad_ciclo', 'vacancias')
op.drop_index('ix_vacancias_ciclo_activo', 'vacancias')
op.drop_index('ix_vacancias_propiedad_id', 'vacancias')
op.drop_table('vacancias')

op.drop_column('propiedades', 'estado_comentario')
op.drop_column('propiedades', 'estado_fecha')
op.drop_column('propiedades', 'vencimiento_contrato')
op.drop_column('propiedades', 'fecha_ingreso')
op.drop_column('propiedades', 'expensas')
op.drop_column('propiedades', 'valor_alquiler')
op.drop_column('propiedades', 'metros_cuadrados')
op.drop_column('propiedades', 'ambientes')
```

---

## 3. DATOS SEED

### 3.1 Actualizar Propiedades Existentes

**Archivo:** `backend/app/models/propiedad.py`

Actualizar `DEFAULT_PROPIEDADES`:

```python
DEFAULT_PROPIEDADES = (
    (1, 'Casa Central', 'Departamento', 'Inversiones SA', '1-recibida', 3, 85.5, 450000, 120000, '2020-03-15'),
    (2, 'Depósito Norte', 'Galpón', 'Logística SRL', '1-recibida', None, 500.0, 800000, 50000, '2019-06-01'),
    (3, 'Oficina Microcentro', 'Oficina', 'Inmobiliaria SA', '1-recibida', 2, 65.0, 350000, 80000, '2021-11-20'),
    (4, 'Local Comercial 45', 'Local', 'Retail Partners', '1-recibida', 1, 45.0, 280000, 60000, '2022-02-10'),
    (5, 'Terreno Ruta 9', 'Terreno', 'Desarrollos SRL', '1-recibida', None, 1200.0, None, None, '2023-01-05'),
)
```

Campos: `(id, nombre, tipo, propietario, estado, ambientes, m2, valor_alquiler, expensas, fecha_ingreso)`

**NOTA:** Todas las propiedades se inicializan en '1-recibida' para generar un ciclo de vacancia activo para cada una.

### 3.2 Script de Seed para Vacancias

**Archivo:** `backend/scripts/seed_vacancias.py` (CREAR)

```python
"""
Script para poblar tabla vacancias con registros iniciales.
"""
from datetime import datetime, timedelta
from sqlmodel import Session, select
from app.db import engine
from app.models.propiedad import Propiedad
from app.models.vacancia import Vacancia


def seed_vacancias():
    """Crea registros de vacancia para TODAS las propiedades con ciclo activo."""
    
    with Session(engine) as session:
        # Obtener TODAS las propiedades
        propiedades = session.exec(select(Propiedad)).all()
        
        print(f"📊 Creando vacancias para {len(propiedades)} propiedades...")
        
        for prop in propiedades:
            # Verificar si ya tiene vacancia activa
            vacancia_existente = session.exec(
                select(Vacancia).where(
                    Vacancia.propiedad_id == prop.id,
                    Vacancia.ciclo_activo == True
                )
            ).first()
            
            if vacancia_existente:
                print(f"  ⏭️  Propiedad {prop.nombre} ya tiene vacancia activa")
                continue
            
            # Crear vacancia en estado 1-recibida para todas
            now = datetime.utcnow()
            vacancia = Vacancia(
                propiedad_id=prop.id,
                ciclo_activo=True,
                fecha_recibida=prop.estado_fecha or now,
                comentario_recibida=prop.estado_comentario or f"Ciclo inicial de {prop.nombre}"
            )
            
            session.add(vacancia)
            print(f"  ✅ Creada vacancia para {prop.nombre}")
        
        session.commit()
        print(f"\n✅ Seed completado: todas las propiedades tienen ciclo de vacancia activo")


if __name__ == "__main__":
    seed_vacancias()
```

---

## 4. ACTUALIZACIÓN DE DATOS EXISTENTES

### 4.1 Script de Migración de Datos

**Archivo:** `backend/scripts/migrate_propiedades_estados.py` (CREAR)

```python
"""
Script para migrar estados antiguos de propiedades a nuevos estados.
Ejecutar UNA VEZ después de aplicar la migración.
"""
from sqlmodel import Session, select
from app.db import engine
from app.models.propiedad import Propiedad
from datetime import datetime


# Mapeo de estados viejos a nuevos (con prefijos numéricos)
MAPEO_ESTADOS = {
    'activa': '3-disponible',
    'mantenimiento': '2-en_reparacion',
    'alquilada': '4-alquilada',
    'disponible': '3-disponible',
    'inactiva': '5-retirada',
    'baja': '5-retirada',
}


def migrar_estados_propiedades():
    """
    Migra estados antiguos a la nueva nomenclatura con prefijos numéricos.
    TODAS las propiedades se colocan en estado '1-recibida' para iniciar ciclo de vacancia.
    """
    
    with Session(engine) as session:
        propiedades = session.exec(select(Propiedad)).all()
        
        print(f"📊 Migrando {len(propiedades)} propiedades a estado '1-recibida'...")
        
        for prop in propiedades:
            estado_viejo = prop.estado
            # TODAS van a 1-recibida inicialmente
            prop.estado = '1-recibida'
            
            # Establecer estado_fecha si no existe
            if not prop.estado_fecha:
                prop.estado_fecha = datetime.utcnow()
            
            # Agregar comentario sobre migración
            if not prop.estado_comentario:
                prop.estado_comentario = f"Migrado desde '{estado_viejo}' - ciclo inicial"
            
            print(f"  🔄 {prop.nombre}: '{estado_viejo}' → '1-recibida'")
        
        session.commit()
        print(f"\n✅ Migración completada: todas las propiedades en '1-recibida'")
        print(f"   ℹ️  Ejecutar seed_vacancias.py para crear ciclos activos")


if __name__ == "__main__":
    migrar_estados_propiedades()
```

### 4.2 Comando de Ejecución

```bash
# 1. Aplicar migración de base de datos
cd backend
alembic upgrade head

# 2. Migrar estados de propiedades existentes
python scripts/migrate_propiedades_estados.py

# 3. Crear vacancias iniciales
python scripts/seed_vacancias.py
```

---

## 5. ENDPOINTS Y CRUD

### 5.1 Endpoints Existentes (CRUD Genérico)

#### Propiedad Router

**Archivo:** `backend/app/routers/propiedad_router.py` (ya existe)

El CRUD genérico ya provee:

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/propiedades` | Listar propiedades con filtros |
| GET | `/api/propiedades/{id}` | Obtener una propiedad |
| POST | `/api/propiedades` | Crear propiedad |
| PUT | `/api/propiedades/{id}` | Actualizar propiedad |
| DELETE | `/api/propiedades/{id}` | Eliminar (soft delete) |

**Filtros disponibles:**
- `nombre__like`
- `estado__eq`
- `tipo__eq`
- `expand=vacancias` (para incluir vacancias en respuesta)

#### Vacancia Router

**Archivo:** `backend/app/routers/vacancia_router.py` (CREAR)

```python
from app.core.generic_router import create_generic_router
from app.models.vacancia import Vacancia

router = create_generic_router(Vacancia)
```

**Registrar en main.py:**
```python
from app.routers import vacancia_router
app.include_router(vacancia_router.router, prefix="/api/vacancias", tags=["vacancias"])
```

El CRUD genérico proveerá automáticamente:

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/vacancias` | Listar vacancias (siempre expande propiedad) |
| GET | `/api/vacancias/{id}` | Obtener una vacancia |
| POST | `/api/vacancias` | Crear vacancia |
| PUT | `/api/vacancias/{id}` | Actualizar vacancia |
| DELETE | `/api/vacancias/{id}` | Eliminar (soft delete) |

**Filtros disponibles:**
- `propiedad_id__eq`
- `ciclo_activo__eq`
- `expand=propiedad` (por defecto en list)

### 5.2 Endpoints Adicionales Requeridos

#### 5.2.1 Cambio de Estado con Vacancia

**Archivo:** `backend/app/routers/propiedad_router.py`

**AGREGAR endpoint especializado que REUTILIZA métodos CRUD:**

```python
from datetime import datetime
from fastapi import HTTPException, Depends
from sqlmodel import Session
from pydantic import BaseModel
from app.models.enums import EstadoPropiedad, TRANSICIONES_ESTADO_PROPIEDAD
from app.models.vacancia import Vacancia
from app.crud.generic_crud import GenericCRUD  # Reutilizar CRUD existente
from app.db import get_session

# CRUD instances
propiedad_crud = GenericCRUD(Propiedad)
vacancia_crud = GenericCRUD(Vacancia)


class CambiarEstadoRequest(BaseModel):
    """Request para cambiar el estado de una propiedad."""
    nuevo_estado: str
    comentario: Optional[str] = None


@propiedad_router.post("/{id}/cambiar-estado", response_model=dict)
def cambiar_estado_propiedad(
    id: int,
    data: CambiarEstadoRequest,
    session: Session = Depends(get_session)
):
    """
    Cambia el estado de una propiedad y actualiza su vacancia.
    REUTILIZA métodos CRUD genéricos para evitar duplicación.
    
    Reglas:
    - Valida transiciones permitidas
    - Crea o actualiza registro de vacancia
    - Calcula métricas dinámicamente (se usan properties del modelo)
    - Guarda métricas cuando se cierra el ciclo
    """
    # 1. Obtener propiedad usando CRUD
    propiedad = propiedad_crud.get(session, id)
    if not propiedad:
        raise HTTPException(status_code=404, detail="Propiedad no encontrada")
    
    estado_actual = propiedad.estado
    nuevo_estado = data.nuevo_estado
    
    # 2. Validar transición de estado
    estados_validos = TRANSICIONES_ESTADO_PROPIEDAD.get(estado_actual, [])
    if nuevo_estado not in estados_validos:
        raise HTTPException(
            status_code=400,
            detail=f"Transición inválida de '{estado_actual}' a '{nuevo_estado}'. Estados válidos: {', '.join(estados_validos)}"
        )
    
    # 3. Obtener vacancia activa (si existe)
    from sqlmodel import select
    statement = select(Vacancia).where(
        Vacancia.propiedad_id == id,
        Vacancia.ciclo_activo == True,
        Vacancia.deleted_at.is_(None)
    )
    vacancias = session.exec(statement).all()
    vacancia_activa = vacancias[0] if vacancias else None
    
    # 4. Actualizar propiedad usando CRUD
    propiedad_data = {
        "estado": nuevo_estado,
        "estado_fecha": datetime.utcnow(),
        "estado_comentario": data.comentario
    }
    propiedad = propiedad_crud.update(session, id, propiedad_data)
    
    # 5. Actualizar o crear vacancia según nuevo estado
    if nuevo_estado == EstadoPropiedad.RECIBIDA.value:
        # Si viene de ALQUILADA, crear nuevo ciclo
        if estado_actual == EstadoPropiedad.ALQUILADA.value:
            if vacancia_activa:
                # Cerrar ciclo anterior usando CRUD
                vacancia_crud.update(session, vacancia_activa.id, {
                    "ciclo_activo": False,
                    "dias_totales": vacancia_activa.dias_totales_calculado
                })
            # Crear nuevo ciclo usando CRUD
            nueva_vacancia_data = {
                "propiedad_id": id,
                "ciclo_activo": True,
                "fecha_recibida": datetime.utcnow(),
                "comentario_recibida": data.comentario
            }
            vacancia_crud.create(session, nueva_vacancia_data)
    
    elif nuevo_estado == EstadoPropiedad.EN_REPARACION.value:
        if vacancia_activa:
            vacancia_crud.update(session, vacancia_activa.id, {
                "fecha_en_reparacion": datetime.utcnow(),
                "comentario_en_reparacion": data.comentario
            })
    
    elif nuevo_estado == EstadoPropiedad.DISPONIBLE.value:
        if vacancia_activa:
            update_data = {
                "fecha_disponible": datetime.utcnow(),
                "comentario_disponible": data.comentario
            }
            # Guardar dias_reparacion calculados si hay reparación
            if vacancia_activa.fecha_en_reparacion:
                update_data["dias_reparacion"] = vacancia_activa.dias_reparacion_calculado
            vacancia_crud.update(session, vacancia_activa.id, update_data)
    
    elif nuevo_estado == EstadoPropiedad.ALQUILADA.value:
        if vacancia_activa:
            # Cerrar ciclo y guardar métricas calculadas
            update_data = {
                "fecha_alquilada": datetime.utcnow(),
                "comentario_alquilada": data.comentario,
                "ciclo_activo": False,
                "dias_disponible": vacancia_activa.dias_disponible_calculado,
                "dias_totales": vacancia_activa.dias_totales_calculado
            }
            # Guardar dias_reparacion si existe
            if vacancia_activa.fecha_en_reparacion:
                update_data["dias_reparacion"] = vacancia_activa.dias_reparacion_calculado
            vacancia_crud.update(session, vacancia_activa.id, update_data)
    
    elif nuevo_estado == EstadoPropiedad.RETIRADA.value:
        if vacancia_activa:
            # Cerrar ciclo sin alquilar, guardar métricas parciales
            update_data = {
                "fecha_retirada": datetime.utcnow(),
                "comentario_retirada": data.comentario,
                "ciclo_activo": False,
                "dias_totales": vacancia_activa.dias_totales_calculado
            }
            # Guardar métricas parciales si existen
            if vacancia_activa.fecha_en_reparacion:
                update_data["dias_reparacion"] = vacancia_activa.dias_reparacion_calculado
            if vacancia_activa.fecha_disponible:
                update_data["dias_disponible"] = vacancia_activa.dias_disponible_calculado
            vacancia_crud.update(session, vacancia_activa.id, update_data)
    
    return {
        "success": True,
        "message": f"Estado cambiado de '{estado_actual}' a '{nuevo_estado}'",
        "propiedad_id": id,
        "nuevo_estado": nuevo_estado
    }


# IMPORTANTE: Las métricas (dias_*) se calculan mediante @property del modelo
# mientras el ciclo está activo. Al cerrar el ciclo, se guardan en BD.
```

**Ventajas de reutilizar CRUD:**
- ✅ No duplica lógica de validación
- ✅ Aprovecha soft-delete automático
- ✅ Mantiene auditoría (updated_at, version)
- ✅ Código más mantenible

#### 5.2.2 Reportes y Métricas

**EVALUACIÓN:** El reporte de métricas agregadas **PUEDE cubrirse con GET estándar + filtros** del CRUD genérico.

**Opción 1: Usar endpoint GET existente con expansión**

```bash
# Obtener todas las vacancias con propiedad expandida
GET /api/vacancias?expand=propiedad&limit=100

# Filtrar solo ciclos activos
GET /api/vacancias?ciclo_activo__eq=true&expand=propiedad

# Filtrar por propiedad específica
GET /api/vacancias?propiedad_id__eq=3&expand=propiedad
```

**Ventaja:** 
- Frontend calcula métricas agregadas (promedio días, totales, etc.)
- No requiere endpoint adicional
- Más flexible para diferentes visualizaciones

**Opción 2: Endpoint especializado para métricas agregadas**

Solo si se necesitan cálculos complejos en backend (ej: GROUP BY con agregaciones SQL).

**Archivo:** `backend/app/routers/propiedad_router.py`

```python
from sqlalchemy import func
from pydantic import BaseModel

class ReporteVacanciaPropiedad(BaseModel):
    propiedad_id: int
    propiedad_nombre: str
    ciclos_totales: int
    ciclo_actual_activo: bool
    promedio_dias_reparacion: Optional[float]
    promedio_dias_disponible: Optional[float]
    promedio_dias_totales: Optional[float]


@router.get("/reportes/metricas-vacancia", response_model=List[ReporteVacanciaPropiedad])
def reporte_metricas_vacancia(
    session: Session = Depends(get_session),
    solo_activos: bool = False
):
    """
    Genera reporte de métricas de vacancia agregadas por propiedad.
    
    NOTA: Considerar usar GET /api/vacancias estándar + procesamiento en frontend.
    Este endpoint solo es necesario si se requieren agregaciones SQL complejas.
    """
    query = (
        select(
            Propiedad.id,
            Propiedad.nombre,
            func.count(Vacancia.id).label('ciclos_totales'),
            func.bool_or(Vacancia.ciclo_activo).label('ciclo_activo'),
            func.avg(Vacancia.dias_reparacion).label('avg_reparacion'),
            func.avg(Vacancia.dias_disponible).label('avg_disponible'),
            func.avg(Vacancia.dias_totales).label('avg_totales')
        )
        .join(Vacancia, Propiedad.id == Vacancia.propiedad_id)
        .group_by(Propiedad.id, Propiedad.nombre)
    )
    
    if solo_activos:
        query = query.where(Vacancia.ciclo_activo == True)
    
    resultados = session.exec(query).all()
    
    return [
        ReporteVacanciaPropiedad(
            propiedad_id=r[0],
            propiedad_nombre=r[1],
            ciclos_totales=r[2],
            ciclo_actual_activo=r[3],
            promedio_dias_reparacion=round(r[4], 1) if r[4] else None,
            promedio_dias_disponible=round(r[5], 1) if r[5] else None,
            promedio_dias_totales=round(r[6], 1) if r[6] else None
        )
        for r in resultados
    ]
```

**Recomendación:** 
- **FASE 1 (MVP):** Usar solo GET estándar + cálculos en frontend
- **FASE 2:** Agregar endpoint de métricas si el rendimiento lo requiere

### 5.3 Resumen de Endpoints

✅ **CRUD Genérico cubre:**
- Listar, crear, editar, eliminar propiedades y vacancias
- Filtros básicos (`propiedad_id__eq`, `ciclo_activo__eq`, etc.)
- Expansión de relaciones (`expand=propiedad`, `expand=vacancias`)
- **Reportes simples** mediante GET + procesamiento en frontend

❌ **Se requiere 1 endpoint adicional:**
- `POST /api/propiedades/{id}/cambiar-estado` - Cambio de estado con lógica de vacancia (reutiliza CRUD)

⚠️ **Endpoint opcional (evaluar en MVP):**
- `GET /api/propiedades/reportes/metricas-vacancia` - Solo si se necesitan agregaciones SQL complejas

**Decisión de arquitectura:**
- **Métricas en tiempo real:** Usar properties del modelo (`dias_*_calculado`)
- **Reportes agregados:** Preferir GET estándar + cálculos en frontend
- **Reutilizar CRUD:** Endpoint especializado usa `GenericCRUD` para evitar duplicación

---

## 6. CASOS DE PRUEBA

### 6.1 Tests Unitarios - Modelo Propiedad

**Archivo:** `backend/tests/test_models/test_propiedad_vacancia.py` (CREAR)

```python
import pytest
from datetime import date, datetime
from sqlmodel import Session, select
from app.models.propiedad import Propiedad
from app.models.vacancia import Vacancia
from app.models.enums import EstadoPropiedad


def test_crear_propiedad_con_nuevos_campos(session: Session):
    """Verifica que se pueden crear propiedades con los nuevos campos."""
    propiedad = Propiedad(
        nombre="Test Propiedad",
        tipo="Departamento",
        propietario="Test Owner",
        estado="disponible",
        ambientes=2,
        metros_cuadrados=65.5,
        valor_alquiler=300000,
        expensas=80000,
        fecha_ingreso=date(2024, 1, 1)
    )
    session.add(propiedad)
    session.commit()
    
    assert propiedad.id is not None
    assert propiedad.ambientes == 2
    assert propiedad.metros_cuadrados == 65.5
    assert propiedad.valor_alquiler == 300000


def test_relacion_propiedad_vacancia(session: Session):
    """Verifica la relación bidireccional entre Propiedad y Vacancia."""
    propiedad = Propiedad(
        nombre="Test Prop",
        tipo="Local",
        propietario="Owner",
        estado="recibida"
    )
    session.add(propiedad)
    session.commit()
    
    vacancia = Vacancia(
        propiedad_id=propiedad.id,
        ciclo_activo=True,
        fecha_recibida=datetime.utcnow()
    )
    session.add(vacancia)
    session.commit()
    
    # Desde propiedad
    assert len(propiedad.vacancias) == 1
    assert propiedad.vacancias[0].id == vacancia.id
    
    # Desde vacancia
    assert vacancia.propiedad.id == propiedad.id


def test_estado_fecha_auto_actualiza(session: Session):
    """Verifica que estado_fecha se actualiza automáticamente."""
    propiedad = Propiedad(
        nombre="Test",
        tipo="Casa",
        propietario="Owner",
        estado="recibida"
    )
    session.add(propiedad)
    session.commit()
    
    assert propiedad.estado_fecha is not None
    assert isinstance(propiedad.estado_fecha, datetime)


def test_validacion_ambientes_positivos(session: Session):
    """Verifica que ambientes debe ser >= 0."""
    with pytest.raises(Exception):  # ValidationError
        propiedad = Propiedad(
            nombre="Test",
            tipo="Casa",
            propietario="Owner",
            estado="disponible",
            ambientes=-1  # Inválido
        )
        session.add(propiedad)
        session.commit()
```

### 6.2 Tests Unitarios - Modelo Vacancia

```python
def test_crear_vacancia_basica(session: Session):
    """Verifica creación básica de vacancia."""
    propiedad = Propiedad(nombre="Test", tipo="Casa", propietario="Own", estado="recibida")
    session.add(propiedad)
    session.commit()
    
    vacancia = Vacancia(
        propiedad_id=propiedad.id,
        ciclo_activo=True,
        fecha_recibida=datetime.utcnow(),
        comentario_recibida="Inicio de ciclo"
    )
    session.add(vacancia)
    session.commit()
    
    assert vacancia.id is not None
    assert vacancia.ciclo_activo is True
    assert vacancia.fecha_recibida is not None


def test_calcular_metricas_dias(session: Session):
    """Verifica cálculo de métricas de días."""
    from datetime import timedelta
    
    propiedad = Propiedad(nombre="Test", tipo="Casa", propietario="Own", estado="disponible")
    session.add(propiedad)
    session.commit()
    
    now = datetime.utcnow()
    vacancia = Vacancia(
        propiedad_id=propiedad.id,
        ciclo_activo=False,
        fecha_recibida=now - timedelta(days=30),
        fecha_en_reparacion=now - timedelta(days=25),
        fecha_disponible=now - timedelta(days=15),
        fecha_alquilada=now
    )
    
    # Calcular manualmente
    vacancia.dias_reparacion = (vacancia.fecha_disponible - vacancia.fecha_en_reparacion).days
    vacancia.dias_disponible = (vacancia.fecha_alquilada - vacancia.fecha_disponible).days
    vacancia.dias_totales = (vacancia.fecha_alquilada - vacancia.fecha_recibida).days
    
    session.add(vacancia)
    session.commit()
    
    assert vacancia.dias_reparacion == 10
    assert vacancia.dias_disponible == 15
    assert vacancia.dias_totales == 30


def test_multiples_vacancias_por_propiedad(session: Session):
    """Verifica que una propiedad puede tener múltiples ciclos de vacancia."""
    propiedad = Propiedad(nombre="Test", tipo="Casa", propietario="Own", estado="alquilada")
    session.add(propiedad)
    session.commit()
    
    # Primer ciclo (cerrado)
    vacancia1 = Vacancia(
        propiedad_id=propiedad.id,
        ciclo_activo=False,
        fecha_recibida=datetime.utcnow(),
        fecha_alquilada=datetime.utcnow()
    )
    
    # Segundo ciclo (activo)
    vacancia2 = Vacancia(
        propiedad_id=propiedad.id,
        ciclo_activo=True,
        fecha_recibida=datetime.utcnow()
    )
    
    session.add_all([vacancia1, vacancia2])
    session.commit()
    
    vacancias = session.exec(
        select(Vacancia).where(Vacancia.propiedad_id == propiedad.id)
    ).all()
    
    assert len(vacancias) == 2
    assert sum(1 for v in vacancias if v.ciclo_activo) == 1  # Solo uno activo
```

### 6.3 Tests de Integración - Endpoints

**Archivo:** `backend/tests/test_api/test_propiedad_endpoints.py`

```python
def test_crear_propiedad_completa(client):
    """Verifica creación de propiedad con todos los campos."""
    response = client.post("/api/propiedades", json={
        "nombre": "Nueva Propiedad",
        "tipo": "Departamento",
        "propietario": "Test Owner",
        "estado": "disponible",
        "ambientes": 3,
        "metros_cuadrados": 85.5,
        "valor_alquiler": 450000,
        "expensas": 120000,
        "fecha_ingreso": "2024-01-15"
    })
    
    assert response.status_code == 201
    data = response.json()
    assert data["ambientes"] == 3
    assert data["metros_cuadrados"] == 85.5
    assert data["estado"] == "disponible"


def test_cambiar_estado_propiedad_valido(client, propiedad_id):
    """Verifica cambio de estado válido."""
    response = client.post(f"/api/propiedades/{propiedad_id}/cambiar-estado", json={
        "nuevo_estado": "en_reparacion",
        "comentario": "Inicio de reparaciones"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["estado"] == "en_reparacion"
    assert data["estado_comentario"] == "Inicio de reparaciones"


def test_cambiar_estado_propiedad_invalido(client, propiedad_id):
    """Verifica que transiciones inválidas son rechazadas."""
    # Propiedad en estado 'disponible'
    response = client.post(f"/api/propiedades/{propiedad_id}/cambiar-estado", json={
        "nuevo_estado": "en_reparacion",  # Inválido desde 'disponible'
        "comentario": "Intento inválido"
    })
    
    assert response.status_code == 400
    assert "Transición inválida" in response.json()["detail"]


def test_vacancia_creada_al_cambiar_estado(client, propiedad_id, session):
    """Verifica que se crea vacancia al cambiar a 'recibida'."""
    client.post(f"/api/propiedades/{propiedad_id}/cambiar-estado", json={
        "nuevo_estado": "recibida",
        "comentario": "Nueva vacancia"
    })
    
    vacancia = session.exec(
        select(Vacancia).where(
            Vacancia.propiedad_id == propiedad_id,
            Vacancia.ciclo_activo == True
        )
    ).first()
    
    assert vacancia is not None
    assert vacancia.fecha_recibida is not None
    assert vacancia.comentario_recibida == "Nueva vacancia"


def test_vacancia_cerrada_al_alquilar(client, propiedad_id, session):
    """Verifica que vacancia se cierra al alquilar."""
    # Crear vacancia activa
    vacancia = Vacancia(
        propiedad_id=propiedad_id,
        ciclo_activo=True,
        fecha_recibida=datetime.utcnow(),
        fecha_disponible=datetime.utcnow()
    )
    session.add(vacancia)
    session.commit()
    
    # Cambiar a alquilada
    client.post(f"/api/propiedades/{propiedad_id}/cambiar-estado", json={
        "nuevo_estado": "alquilada",
        "comentario": "Alquilada exitosamente",
        "vencimiento_contrato": "2026-01-15"
    })
    
    session.refresh(vacancia)
    assert vacancia.ciclo_activo is False
    assert vacancia.fecha_alquilada is not None
    assert vacancia.dias_totales is not None
```

### 6.4 Tests de Integración - Vacancias

**Archivo:** `backend/tests/test_api/test_vacancia_endpoints.py`

```python
def test_listar_vacancias_expande_propiedad(client):
    """Verifica que vacancias siempre expanden propiedad."""
    response = client.get("/api/vacancias?limit=5")
    
    assert response.status_code == 200
    data = response.json()
    
    if data["items"]:
        vacancia = data["items"][0]
        assert "propiedad" in vacancia
        assert "nombre" in vacancia["propiedad"]


def test_filtrar_vacancias_activas(client):
    """Verifica filtro por ciclo activo."""
    response = client.get("/api/vacancias?ciclo_activo__eq=true")
    
    assert response.status_code == 200
    data = response.json()
    
    for vacancia in data["items"]:
        assert vacancia["ciclo_activo"] is True


def test_reporte_vacancias(client):
    """Verifica endpoint de reportes."""
    response = client.get("/api/propiedades/reportes/vacancias")
    
    assert response.status_code == 200
    data = response.json()
    
    assert isinstance(data, list)
    if data:
        reporte = data[0]
        assert "propiedad_nombre" in reporte
        assert "ciclos_totales" in reporte
        assert "promedio_dias_totales" in reporte
```

### 6.5 Resumen de Cobertura de Tests

| Categoría | Archivo | Tests | Cobertura |
|-----------|---------|-------|-----------|
| Modelo Propiedad | `test_propiedad_vacancia.py` | 4 | Campos nuevos, validaciones |
| Modelo Vacancia | `test_propiedad_vacancia.py` | 3 | Creación, métricas, múltiples ciclos |
| Endpoints Propiedad | `test_propiedad_endpoints.py` | 5 | CRUD + cambio estado |
| Endpoints Vacancia | `test_vacancia_endpoints.py` | 3 | Listar, filtrar, reportes |
| **TOTAL** | | **15** | **~85%** |

---

## 7. VALIDACIONES Y REGLAS DE NEGOCIO

### 7.1 Validaciones a Nivel de Modelo

```python
# En Propiedad
from pydantic import field_validator

@field_validator('ambientes')
def validar_ambientes(cls, v):
    if v is not None and v < 0:
        raise ValueError('Ambientes debe ser >= 0')
    return v

@field_validator('metros_cuadrados')
def validar_metros(cls, v):
    if v is not None and v <= 0:
        raise ValueError('Metros cuadrados debe ser > 0')
    return v

@field_validator('estado')
def validar_estado(cls, v):
    estados_validos = [e.value for e in EstadoPropiedad]
    if v not in estados_validos:
        raise ValueError(f'Estado inválido. Opciones: {estados_validos}')
    return v
```

### 7.2 Reglas de Negocio - Cambio de Estado

**Implementadas en endpoint `cambiar-estado`:**

1. **Transiciones permitidas:**
   - Validar contra `TRANSICIONES_ESTADO_PROPIEDAD`
   - Retornar 400 si transición inválida

2. **Inicio de ciclo de vacancia:**
   - Al pasar a `recibida`: crear nueva vacancia si no hay activa
   - Solo puede haber UNA vacancia activa por propiedad

3. **Actualización de vacancia:**
   - Cada cambio de estado actualiza el campo `fecha_*` correspondiente
   - Guardar comentario en `comentario_*`

4. **Fin de ciclo:**
   - Al pasar a `alquilada` o `retirada`: marcar `ciclo_activo = False`
   - Calcular métricas de días antes de cerrar

5. **Métricas calculadas:**
   - `dias_reparacion` = `fecha_disponible - fecha_en_reparacion`
   - `dias_disponible` = `fecha_alquilada - fecha_disponible`
   - `dias_totales` = `fecha_fin_ciclo - fecha_recibida`

6. **Campos obligatorios según estado:**
   - `alquilada` → requiere `vencimiento_contrato`

### 7.3 Validaciones en Frontend (Futuras)

- Deshabilitar botones de estado según transiciones permitidas
- Validar fechas (vencimiento_contrato > hoy)
- Mostrar advertencia si propiedad lleva muchos días en vacancia
- Calcular métricas en tiempo real al cambiar estado

---

## 8. CHECKLIST DE IMPLEMENTACIÓN

### 8.1 Modelos y Base de Datos

- [ ] Actualizar modelo `Propiedad` con 8 campos nuevos
- [ ] Crear modelo `Vacancia` con 20 campos
- [ ] Crear enum `EstadoPropiedad` y mapeo de transiciones
- [ ] Generar migración Alembic
- [ ] Verificar migración en local
- [ ] Aplicar migración a desarrollo
- [ ] Actualizar `DEFAULT_PROPIEDADES` con nuevos estados
- [ ] Crear script `migrate_propiedades_estados.py`
- [ ] Crear script `seed_vacancias.py`
- [ ] Ejecutar scripts de migración de datos

### 8.2 API y Endpoints

- [ ] Crear router `vacancia_router.py`
- [ ] Registrar router en `main.py`
- [ ] Agregar endpoint `POST /propiedades/{id}/cambiar-estado`
- [ ] Agregar endpoint `GET /propiedades/reportes/vacancias`
- [ ] Implementar lógica de cambio de estado con validaciones
- [ ] Implementar cálculo automático de métricas
- [ ] Configurar `__expanded_list_relations__` en Vacancia

### 8.3 Testing

- [ ] Crear `test_propiedad_vacancia.py` con 7 tests
- [ ] Crear `test_propiedad_endpoints.py` con 5 tests
- [ ] Crear `test_vacancia_endpoints.py` con 3 tests
- [ ] Ejecutar suite completa de tests
- [ ] Verificar cobertura >= 80%

### 8.4 Documentación

- [ ] Actualizar README con nuevos modelos
- [ ] Documentar endpoint `cambiar-estado` en Swagger
- [ ] Documentar transiciones de estado permitidas
- [ ] Crear diagrama de estados (opcional)

### 8.5 Deployment

- [ ] Commit de cambios a branch `feature/vacancia`
- [ ] Pull request con revisión
- [ ] Merge a `dev`
- [ ] Aplicar migración en NEON staging
- [ ] Ejecutar scripts de seed en staging
- [ ] Validar en staging
- [ ] Merge a `master`
- [ ] Aplicar migración en producción
- [ ] Ejecutar scripts de seed en producción

---

## 9. CONSULTAS COMPLEMENTARIAS PARA EL REQUERIMIENTO

### 9.1 Aclaraciones Necesarias

**PREGUNTA 1: Fechas en Vacancia**
> ¿Las fechas de vacancia deben registrar solo la fecha (DATE) o fecha y hora (DATETIME)?
> - **Recomendación:** DATETIME para auditoría precisa
> - **Impacto:** Permite calcular días con decimales si es necesario

**PREGUNTA 2: Múltiples Vacancias Activas**
> ¿Es posible que una propiedad tenga más de un ciclo de vacancia activo simultáneamente?
> - **Recomendación:** NO, solo un ciclo activo por propiedad
> - **Implementación:** Agregar constraint UNIQUE(propiedad_id) WHERE ciclo_activo = TRUE

**PREGUNTA 3: Estados Intermedios**
> ¿Se permiten "saltos" de estado? Ej: ¿De `recibida` directamente a `alquilada` sin pasar por `disponible`?
> - **Recomendación:** SÍ, permitir según `TRANSICIONES_ESTADO_PROPIEDAD`
> - **Razón:** Flexibilidad para casos excepcionales

**PREGUNTA 4: Edición de Vacancias Cerradas**
> ¿Se pueden editar vacancias una vez que `ciclo_activo = False`?
> - **Recomendación:** NO, solo lectura para auditoría
> - **Implementación:** Validar en endpoint PUT

**PREGUNTA 5: Cálculo de Días**
> ¿Incluir fines de semana y feriados en el cálculo de días?
> - **Recomendación:** Inicialmente SÍ (días calendario), luego agregar "días hábiles" si es necesario
> - **Complejidad:** Días hábiles requiere calendario de feriados

### 9.2 Extensiones Futuras Sugeridas

1. **Notificaciones Automáticas:**
   - Alerta si propiedad lleva > X días en estado `disponible`
   - Recordatorio de vencimiento de contrato (30 días antes)

2. **Dashboard de Métricas:**
   - Promedio de días de vacancia por tipo de propiedad
   - Propiedades con mayor rotación
   - Ingresos perdidos por vacancia

3. **Integración con Calendario:**
   - Visualizar vacancia en calendario
   - Bloquear fechas de reparación

4. **Historial de Valores:**
   - Tracking de cambios en `valor_alquiler` y `expensas`
   - Gráfico de evolución de precios

5. **Integración con Facturas:**
   - Vincular gastos de reparación a vacancia específica
   - Calcular ROI de acondicionamiento

### 9.3 Consideraciones de Rendimiento

1. **Índices adicionales recomendados:**
   ```sql
   CREATE INDEX ix_propiedades_estado_fecha ON propiedades(estado, estado_fecha DESC);
   CREATE INDEX ix_vacancias_fechas ON vacancias(fecha_recibida, fecha_alquilada);
   ```

2. **Paginación en reportes:**
   - Limitar resultados a 100 por defecto
   - Agregar parámetros `offset` y `limit`

3. **Cache de métricas:**
   - Considerar caché Redis para dashboard
   - Invalidar al cambiar estado

### 9.4 Validaciones de Negocio Adicionales

1. **Fecha de Ingreso:**
   - No puede ser futura
   - Debe ser <= fecha_recibida de primera vacancia

2. **Vencimiento de Contrato:**
   - Solo válido si estado = `alquilada`
   - Debe ser >= fecha actual (al crear/editar)

3. **Valor Alquiler:**
   - Notificar si es 0 o NULL en estado `alquilada`
   - Validar que sea razonable (ej: < $10M)

4. **Ambientes vs Metros Cuadrados:**
   - Validación lógica: relación m2/ambiente razonable
   - Ejemplo: 1 ambiente → mínimo 20m2

### 9.5 Migración y Retrocompatibilidad

**Estados Actuales en BASE:**
```sql
SELECT DISTINCT estado FROM propiedades;
-- Resultado esperado: activa, mantenimiento, alquilada, disponible, inactiva
```

**Mapeo Sugerido:**
| Estado Actual | Estado Nuevo | Acción |
|---------------|-------------|---------|
| activa | disponible | Migrar automáticamente |
| mantenimiento | en_reparacion | Migrar automáticamente |
| alquilada | alquilada | Mantener |
| disponible | disponible | Mantener |
| inactiva | retirada | Migrar automáticamente |
| baja | retirada | Migrar automáticamente |

**Script de verificación POST-migración:**
```sql
-- Validar que no queden estados antiguos
SELECT id, nombre, estado 
FROM propiedades 
WHERE estado NOT IN ('recibida', 'en_reparacion', 'disponible', 'alquilada', 'retirada');

-- Resultado esperado: 0 filas
```

---

## 10. ANEXOS

### 10.1 Diagrama de Transiciones de Estado

```
                    ┌──────────────┐
                    │ 1-RECIBIDA   │ (inicio ciclo)
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │2-EN_REPARAC. │ │3-DISPONIBLE  │ │ 4-ALQUILADA  │
  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
         │                │                │
         ▼                ▼                │
  ┌──────────────┐ ┌──────────────┐       │
  │3-DISPONIBLE  │ │ 4-ALQUILADA  │◄──────┘
  └──────┬───────┘ └──────┬───────┘       
         │                │ (fin ciclo)    
         │                ▼                
         │         ┌──────────────┐        
         │         │ 1-RECIBIDA   │ (nuevo ciclo)
         │         └──────────────┘        
         │                                 
         └────────┐                        
                  │                        
                  ▼                        
           ┌──────────────┐               
           │ 5-RETIRADA   │ (FINAL)       
           └──────────────┘               
```

**Nota:** Los prefijos numéricos (1-5) indican la secuencia lógica del proceso.

### 10.2 Ejemplo de Payload - Crear Propiedad

```json
{
  "nombre": "Departamento Palermo Soho",
  "tipo": "Departamento",
  "propietario": "Inversiones SA",
  "estado": "1-recibida",
  "ambientes": 2,
  "metros_cuadrados": 65.5,
  "valor_alquiler": 350000,
  "expensas": 80000,
  "fecha_ingreso": "2024-01-15",
  "estado_comentario": "Propiedad recibida - inicio de ciclo"
}
```

### 10.3 Ejemplo de Payload - Cambiar Estado

```json
{
  "nuevo_estado": "4-alquilada",
  "comentario": "Alquilada a Juan Pérez por 24 meses",
  "vencimiento_contrato": "2026-11-14"
}
```

### 10.4 Ejemplo de Respuesta - Listar Vacancias

```json
{
  "items": [
    {
      "id": 1,
      "propiedad_id": 3,
      "ciclo_activo": true,
      "fecha_recibida": "2024-11-01T10:00:00Z",
      "comentario_recibida": "Propiedad recibida - inicio de ciclo",
      "fecha_en_reparacion": "2024-11-02T14:00:00Z",
      "comentario_en_reparacion": "Pintura y arreglos menores",
      "fecha_disponible": "2024-11-15T09:00:00Z",
      "comentario_disponible": "Lista para mostrar",
      "fecha_alquilada": null,
      "comentario_alquilada": null,
      "dias_reparacion": 13,
      "dias_disponible": null,
      "dias_totales": null,
      "propiedad": {
        "id": 3,
        "nombre": "Oficina Microcentro",
        "tipo": "Oficina",
        "estado": "3-disponible",
        "ambientes": 2,
        "metros_cuadrados": 65.0,
        "valor_alquiler": 350000
      },
      "_computed": {
        "dias_disponible_actual": 29,
        "dias_totales_actual": 43,
        "comentario": "Métricas calculadas dinámicamente (ciclo activo hasta hoy)"
      }
    }
  ],
  "total": 1,
  "page": 1,
  "size": 50
}
```

**Nota sobre métricas dinámicas:**
- Si `ciclo_activo = true` y estado permite cálculo, las métricas usan `fecha_actual`
- Las properties `dias_*_calculado` del modelo calculan valores en tiempo real
- Frontend puede usar estos valores para mostrar métricas actualizadas

---

## ✅ CHECKLIST FINAL

Antes de comenzar desarrollo, verificar:

- [x] Requerimiento completamente entendido
- [x] Modelos de datos diseñados
- [x] Migraciones planificadas
- [x] Endpoints identificados (CRUD genérico + 2 adicionales)
- [x] Casos de prueba especificados (15 tests)
- [x] Validaciones y reglas de negocio documentadas
- [x] Consultas complementarias formuladas
- [x] Plan de migración de datos existentes

**LISTO PARA IMPLEMENTAR** 🚀

---

**Documento generado:** 2025-11-14  
**Última actualización:** 2025-11-14  
**Revisión:** v1.0
