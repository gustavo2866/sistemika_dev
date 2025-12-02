# Especificación Técnica Backend - Refactorización Eventos CRM

**Fecha:** 1 de Diciembre, 2025  
**Sistema:** SAK (Sistemika) - Backend  
**Tipo:** Especificación Técnica

---

## Tabla de Contenidos

1. [Cambios en el Modelo de Datos](#cambios-en-el-modelo-de-datos)
2. [Migración de Base de Datos](#migración-de-base-de-datos)
3. [Actualización del Modelo SQLModel](#actualización-del-modelo-sqlmodel)
4. [Actualización de Enums](#actualización-de-enums)
5. [Actualización de CRUD](#actualización-de-crud)
6. [Endpoints Personalizados](#endpoints-personalizados)
7. [Validaciones](#validaciones)
8. [Impactos en Otros Módulos](#impactos-en-otros-módulos)

---

## Cambios en el Modelo de Datos

### Estado Actual: `crm_eventos`

```python
# backend/app/models/crm_evento.py (ACTUAL)
class CRMEvento(Base, table=True):
    __tablename__ = "crm_eventos"
    
    # Campos a ELIMINAR ❌
    contacto_id: int = Field(foreign_key="crm_contactos.id", index=True)
    tipo_id: int = Field(foreign_key="crm_tipos_evento.id")
    motivo_id: int = Field(foreign_key="crm_motivos_evento.id")
    origen_lead_id: Optional[int] = Field(default=None, foreign_key="crm_origenes_lead.id")
    proximo_paso: Optional[str] = Field(default=None, max_length=500)
    fecha_compromiso: Optional[date] = Field(default=None)
    estado_evento: str = Field(default=EstadoEvento.PENDIENTE.value, max_length=20, index=True)
    
    # Campos a MANTENER ✅
    fecha_evento: datetime = Field(description="Fecha del evento", index=True)
    descripcion: str = Field(max_length=2000)  # ⚠️ Cambiar a opcional
    asignado_a_id: int = Field(foreign_key="users.id")
    oportunidad_id: Optional[int] = Field(default=None, foreign_key="crm_oportunidades.id", index=True)  # ⚠️ Cambiar a obligatorio
    
    # Relaciones a ELIMINAR ❌
    contacto: Optional["CRMContacto"] = Relationship(back_populates="eventos")
    tipo: Optional["CRMTipoEvento"] = Relationship(back_populates="eventos")
    motivo: Optional["CRMMotivoEvento"] = Relationship(back_populates="eventos")
    origen_lead: Optional["CRMOrigenLead"] = Relationship(back_populates="eventos")
    
    # Relaciones a MANTENER ✅
    asignado_a: Optional["User"] = Relationship()
    oportunidad: Optional["CRMOportunidad"] = Relationship(back_populates="eventos")
```

### Estado Objetivo: `crm_eventos`

```python
# backend/app/models/crm_evento.py (NUEVO)
class CRMEvento(Base, table=True):
    __tablename__ = "crm_eventos"
    __searchable_fields__ = ["titulo", "descripcion", "resultado"]
    __expanded_list_relations__ = {"asignado_a", "oportunidad"}
    
    # Campos NUEVOS ✨
    titulo: str = Field(max_length=255, description="Título/resumen breve del evento")
    tipo_evento: str = Field(max_length=20, description="Tipo de evento", index=True)
    resultado: Optional[str] = Field(default=None, max_length=5000, description="Resultado al cerrar evento")
    
    # Campos MODIFICADOS 🔄
    oportunidad_id: int = Field(foreign_key="crm_oportunidades.id", index=True)  # Ahora obligatorio
    descripcion: Optional[str] = Field(default=None, max_length=2000)  # Ahora opcional
    estado: str = Field(default=EstadoEvento.PENDIENTE.value, max_length=20, index=True)  # Renombrado
    
    # Campos EXISTENTES (sin cambios) ✅
    fecha_evento: datetime = Field(description="Fecha del evento", index=True)
    asignado_a_id: int = Field(foreign_key="users.id")
    
    # Relaciones MODIFICADAS 🔄
    oportunidad: "CRMOportunidad" = Relationship(back_populates="eventos")  # Ya no opcional
    asignado_a: Optional["User"] = Relationship()
```

### Resumen de Cambios

| Acción | Campo Actual | Campo Nuevo | Tipo |
|--------|--------------|-------------|------|
| ❌ Eliminar | `contacto_id` | - | FK int |
| ❌ Eliminar | `tipo_id` | - | FK int |
| ❌ Eliminar | `motivo_id` | - | FK int |
| ❌ Eliminar | `origen_lead_id` | - | FK int (opcional) |
| ❌ Eliminar | `proximo_paso` | - | string(500) opcional |
| ❌ Eliminar | `fecha_compromiso` | - | date opcional |
| ✨ Agregar | - | `titulo` | string(255) obligatorio |
| ✨ Agregar | - | `tipo_evento` | string(20) obligatorio |
| ✨ Agregar | - | `resultado` | text opcional |
| 🔄 Renombrar | `estado_evento` | `estado` | string(20) |
| 🔄 Modificar | `descripcion` | `descripcion` | obligatorio → opcional |
| 🔄 Modificar | `oportunidad_id` | `oportunidad_id` | opcional → obligatorio |

---

## Migración de Base de Datos

### Archivo: `backend/migrations/022_refactor_crm_eventos.py`

```python
"""Refactorización del modelo de eventos CRM

Revision ID: 022_refactor_crm_eventos
Revises: 021_add_fecha_mensaje_to_crm_mensajes
Create Date: 2025-12-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "022_refactor_crm_eventos"
down_revision = "021_add_fecha_mensaje_to_crm_mensajes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Migración de crm_eventos a nueva estructura simplificada
    """
    
    # ===== PASO 1: Agregar nuevas columnas (temporalmente opcionales) =====
    
    print("Paso 1: Agregando nuevas columnas...")
    
    op.add_column(
        'crm_eventos',
        sa.Column('titulo', sa.String(255), nullable=True)
    )
    
    op.add_column(
        'crm_eventos',
        sa.Column('tipo_evento', sa.String(20), nullable=True)
    )
    
    op.add_column(
        'crm_eventos',
        sa.Column('resultado', sa.Text(), nullable=True)
    )
    
    # ===== PASO 2: Migrar datos existentes =====
    
    print("Paso 2: Migrando datos existentes...")
    
    # 2.1 Generar título desde descripción o tipo+motivo
    op.execute("""
        UPDATE crm_eventos e
        SET titulo = CASE
            -- Si tiene descripción, usar los primeros 250 caracteres
            WHEN e.descripcion IS NOT NULL AND LENGTH(e.descripcion) > 0 
                THEN LEFT(e.descripcion, 250)
            -- Si no, generar desde tipo + motivo
            ELSE CONCAT(
                COALESCE((SELECT nombre FROM crm_tipos_evento WHERE id = e.tipo_id), 'Evento'),
                ' - ',
                COALESCE((SELECT nombre FROM crm_motivos_evento WHERE id = e.motivo_id), 'General')
            )
        END
        WHERE titulo IS NULL
    """)
    
    # 2.2 Mapear tipo_id a tipo_evento (enum simplificado)
    op.execute("""
        UPDATE crm_eventos e
        SET tipo_evento = CASE
            WHEN (SELECT codigo FROM crm_tipos_evento WHERE id = e.tipo_id) ILIKE '%LLAMADA%' THEN 'llamada'
            WHEN (SELECT codigo FROM crm_tipos_evento WHERE id = e.tipo_id) ILIKE '%REUNION%' THEN 'reunion'
            WHEN (SELECT codigo FROM crm_tipos_evento WHERE id = e.tipo_id) ILIKE '%VISITA%' THEN 'visita'
            WHEN (SELECT codigo FROM crm_tipos_evento WHERE id = e.tipo_id) ILIKE '%EMAIL%' THEN 'email'
            WHEN (SELECT codigo FROM crm_tipos_evento WHERE id = e.tipo_id) ILIKE '%WHATSAPP%' THEN 'whatsapp'
            ELSE 'nota'
        END
        WHERE tipo_evento IS NULL
    """)
    
    # 2.3 Renombrar columna estado_evento a estado
    op.alter_column('crm_eventos', 'estado_evento', new_column_name='estado')
    
    # 2.4 Actualizar valores de estado: 'hecho' → '2-realizado', 'pendiente' → '1-pendiente'
    op.execute("""
        UPDATE crm_eventos 
        SET estado = CASE
            WHEN estado = 'hecho' THEN '2-realizado'
            WHEN estado = 'pendiente' THEN '1-pendiente'
            ELSE estado
        END
    """)
    
    # 2.5 Hacer descripcion opcional (eliminar restricción NOT NULL si existe)
    op.alter_column('crm_eventos', 'descripcion', nullable=True)
    
    # 2.6 Eliminar eventos sin oportunidad (no deberían existir en la nueva estructura)
    # Primero, intentar asignarles oportunidad desde contacto si es posible
    op.execute("""
        UPDATE crm_eventos e
        SET oportunidad_id = (
            SELECT o.id 
            FROM crm_oportunidades o 
            WHERE o.contacto_id = e.contacto_id 
            AND o.activo = true
            ORDER BY o.created_at DESC 
            LIMIT 1
        )
        WHERE e.oportunidad_id IS NULL 
        AND e.contacto_id IS NOT NULL
    """)
    
    # Marcar como eliminados los eventos que aún no tienen oportunidad
    op.execute("""
        UPDATE crm_eventos
        SET deleted_at = NOW()
        WHERE oportunidad_id IS NULL
        AND deleted_at IS NULL
    """)
    
    # ===== PASO 3: Hacer obligatorias las nuevas columnas =====
    
    print("Paso 3: Aplicando restricciones...")
    
    op.alter_column('crm_eventos', 'titulo', nullable=False)
    op.alter_column('crm_eventos', 'tipo_evento', nullable=False)
    op.alter_column('crm_eventos', 'oportunidad_id', nullable=False)
    
    # ===== PASO 4: Eliminar columnas y constraints obsoletos =====
    
    print("Paso 4: Eliminando columnas y constraints obsoletos...")
    
    # Eliminar foreign keys
    op.drop_constraint('crm_eventos_contacto_id_fkey', 'crm_eventos', type_='foreignkey')
    op.drop_constraint('crm_eventos_tipo_id_fkey', 'crm_eventos', type_='foreignkey')
    op.drop_constraint('crm_eventos_motivo_id_fkey', 'crm_eventos', type_='foreignkey')
    
    # Verificar si existe constraint de origen_lead antes de eliminar
    try:
        op.drop_constraint('crm_eventos_origen_lead_id_fkey', 'crm_eventos', type_='foreignkey')
    except:
        pass  # No existe o ya fue eliminado
    
    # Eliminar índices asociados a las columnas que se van a borrar
    try:
        op.drop_index('ix_crm_eventos_contacto_id', table_name='crm_eventos')
    except:
        pass
    
    # Eliminar columnas obsoletas
    op.drop_column('crm_eventos', 'contacto_id')
    op.drop_column('crm_eventos', 'tipo_id')
    op.drop_column('crm_eventos', 'motivo_id')
    op.drop_column('crm_eventos', 'origen_lead_id')
    op.drop_column('crm_eventos', 'proximo_paso')
    op.drop_column('crm_eventos', 'fecha_compromiso')
    
    # ===== PASO 5: Crear nuevos índices =====
    
    print("Paso 5: Creando índices optimizados...")
    
    op.create_index('ix_crm_eventos_tipo_evento', 'crm_eventos', ['tipo_evento'])
    op.create_index('ix_crm_eventos_estado', 'crm_eventos', ['estado'])
    
    print("Migración completada exitosamente!")


def downgrade() -> None:
    """
    Reversión de cambios (solo esquema, datos no recuperables)
    """
    
    print("ADVERTENCIA: El downgrade solo restaura el esquema, no los datos originales")
    
    # Eliminar índices nuevos
    op.drop_index('ix_crm_eventos_tipo_evento', table_name='crm_eventos')
    op.drop_index('ix_crm_eventos_estado', table_name='crm_eventos')
    
    # Restaurar columnas antiguas (vacías)
    op.add_column('crm_eventos', sa.Column('contacto_id', sa.Integer(), nullable=True))
    op.add_column('crm_eventos', sa.Column('tipo_id', sa.Integer(), nullable=True))
    op.add_column('crm_eventos', sa.Column('motivo_id', sa.Integer(), nullable=True))
    op.add_column('crm_eventos', sa.Column('origen_lead_id', sa.Integer(), nullable=True))
    op.add_column('crm_eventos', sa.Column('proximo_paso', sa.String(500), nullable=True))
    op.add_column('crm_eventos', sa.Column('fecha_compromiso', sa.Date(), nullable=True))
    
    # Renombrar estado a estado_evento
    op.alter_column('crm_eventos', 'estado', new_column_name='estado_evento')
    
    # Eliminar columnas nuevas
    op.drop_column('crm_eventos', 'titulo')
    op.drop_column('crm_eventos', 'tipo_evento')
    op.drop_column('crm_eventos', 'resultado')
    
    # Restaurar foreign keys (sin datos)
    op.create_foreign_key('crm_eventos_contacto_id_fkey', 'crm_eventos', 'crm_contactos', ['contacto_id'], ['id'])
    op.create_foreign_key('crm_eventos_tipo_id_fkey', 'crm_eventos', 'crm_tipos_evento', ['tipo_id'], ['id'])
    op.create_foreign_key('crm_eventos_motivo_id_fkey', 'crm_eventos', 'crm_motivos_evento', ['motivo_id'], ['id'])
    
    op.alter_column('crm_eventos', 'descripcion', nullable=False)
    op.alter_column('crm_eventos', 'oportunidad_id', nullable=True)
```

### Script de Validación Post-Migración

Crear archivo: `backend/scripts/validate_eventos_migration.py`

```python
"""
Script de validación post-migración de eventos
Verifica integridad de datos después de la migración 022
"""
from sqlmodel import Session, select, func
from app.db import engine
from app.models import CRMEvento

def validate_migration():
    """Valida que la migración se ejecutó correctamente"""
    
    with Session(engine) as session:
        print("=" * 60)
        print("VALIDACIÓN POST-MIGRACIÓN: crm_eventos")
        print("=" * 60)
        
        # 1. Verificar que todos los eventos tienen título
        eventos_sin_titulo = session.exec(
            select(func.count(CRMEvento.id))
            .where(CRMEvento.titulo.is_(None))
            .where(CRMEvento.deleted_at.is_(None))
        ).one()
        
        print(f"\n✓ Eventos sin título: {eventos_sin_titulo}")
        assert eventos_sin_titulo == 0, "ERROR: Existen eventos sin título"
        
        # 2. Verificar que todos tienen tipo_evento válido
        tipos_validos = ['llamada', 'reunion', 'visita', 'email', 'whatsapp', 'nota']
        eventos_tipo_invalido = session.exec(
            select(func.count(CRMEvento.id))
            .where(~CRMEvento.tipo_evento.in_(tipos_validos))
            .where(CRMEvento.deleted_at.is_(None))
        ).one()
        
        print(f"✓ Eventos con tipo inválido: {eventos_tipo_invalido}")
        assert eventos_tipo_invalido == 0, "ERROR: Existen eventos con tipo inválido"
        
        # 3. Verificar que todos tienen oportunidad_id
        eventos_sin_oportunidad = session.exec(
            select(func.count(CRMEvento.id))
            .where(CRMEvento.oportunidad_id.is_(None))
            .where(CRMEvento.deleted_at.is_(None))
        ).one()
        
        print(f"✓ Eventos sin oportunidad: {eventos_sin_oportunidad}")
        assert eventos_sin_oportunidad == 0, "ERROR: Existen eventos sin oportunidad"
        
        # 4. Verificar distribución de tipos
        print("\n" + "=" * 60)
        print("DISTRIBUCIÓN DE TIPOS DE EVENTO")
        print("=" * 60)
        
        tipos_dist = session.exec(
            select(CRMEvento.tipo_evento, func.count(CRMEvento.id).label('total'))
            .where(CRMEvento.deleted_at.is_(None))
            .group_by(CRMEvento.tipo_evento)
            .order_by(func.count(CRMEvento.id).desc())
        ).all()
        
        for tipo, count in tipos_dist:
            print(f"  {tipo:15} : {count:6} eventos")
        
        # 5. Verificar distribución de estados
        print("\n" + "=" * 60)
        print("DISTRIBUCIÓN DE ESTADOS")
        print("=" * 60)
        
        estados_dist = session.exec(
            select(CRMEvento.estado, func.count(CRMEvento.id).label('total'))
            .where(CRMEvento.deleted_at.is_(None))
            .group_by(CRMEvento.estado)
            .order_by(func.count(CRMEvento.id).desc())
        ).all()
        
        for estado, count in estados_dist:
            print(f"  {estado:15} : {count:6} eventos")
        
        # 6. Total de eventos
        total_eventos = session.exec(
            select(func.count(CRMEvento.id))
            .where(CRMEvento.deleted_at.is_(None))
        ).one()
        
        print("\n" + "=" * 60)
        print(f"TOTAL DE EVENTOS ACTIVOS: {total_eventos}")
        print("=" * 60)
        print("\n✅ VALIDACIÓN EXITOSA - Todos los checks pasaron")


if __name__ == "__main__":
    validate_migration()
```

---

## Actualización del Modelo SQLModel

### Archivo: `backend/app/models/crm_evento.py`

```python
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlmodel import Field, Relationship

from .base import Base
from .enums import EstadoEvento, TipoEvento

if TYPE_CHECKING:
    from .crm_oportunidad import CRMOportunidad
    from .user import User


class CRMEvento(Base, table=True):
    """
    Eventos/Actividades del CRM vinculados a oportunidades.
    
    Representa cualquier interacción con el cliente: llamadas, visitas,
    reuniones, emails, mensajes, notas, etc.
    """
    __tablename__ = "crm_eventos"
    __searchable_fields__ = ["titulo", "descripcion", "resultado"]
    __expanded_list_relations__ = {"asignado_a", "oportunidad"}
    
    # Campos obligatorios
    oportunidad_id: int = Field(
        foreign_key="crm_oportunidades.id", 
        index=True,
        description="Oportunidad a la que pertenece el evento"
    )
    titulo: str = Field(
        max_length=255, 
        description="Título/resumen breve del evento"
    )
    tipo_evento: str = Field(
        max_length=20, 
        description="Tipo de evento: llamada, reunion, visita, email, whatsapp, nota",
        index=True
    )
    fecha_evento: datetime = Field(
        description="Fecha y hora del evento (programada o realizada)",
        index=True
    )
    estado: str = Field(
        default=EstadoEvento.PENDIENTE.value,
        max_length=20,
        description="Estado: 1-pendiente, 2-realizado, 3-cancelado, 4-reagendar",
        index=True
    )
    asignado_a_id: int = Field(
        foreign_key="users.id",
        description="Usuario asignado/responsable del evento"
    )
    
    # Campos opcionales
    descripcion: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Descripción ampliada del evento"
    )
    resultado: Optional[str] = Field(
        default=None,
        max_length=5000,
        description="Resultado del evento (obligatorio al cerrar)"
    )
    
    # Relaciones
    oportunidad: "CRMOportunidad" = Relationship(back_populates="eventos")
    asignado_a: Optional["User"] = Relationship()
    
    def __repr__(self) -> str:
        return f"<CRMEvento {self.id}: {self.titulo} ({self.estado})>"
    
    def to_dict_extended(self) -> dict:
        """Serialización extendida con datos relacionados"""
        base_dict = self.model_dump()
        
        # Agregar datos de relaciones si están cargadas
        if self.oportunidad:
            base_dict["oportunidad"] = {
                "id": self.oportunidad.id,
                "estado": self.oportunidad.estado,
                "contacto_id": self.oportunidad.contacto_id,
            }
        
        if self.asignado_a:
            base_dict["asignado_a"] = {
                "id": self.asignado_a.id,
                "nombre": self.asignado_a.nombre,
                "email": self.asignado_a.email,
            }
        
        return base_dict
```

---

## Actualización de Enums

### Archivo: `backend/app/models/enums.py`

```python
# MODIFICAR enum existente EstadoEvento

class EstadoEvento(str, Enum):
    """Estados de eventos con prefijo numérico para secuencia."""
    PENDIENTE = "1-pendiente"      # Evento programado
    REALIZADO = "2-realizado"      # Evento completado
    CANCELADO = "3-cancelado"      # Evento cancelado
    REAGENDAR = "4-reagendar"      # Requiere reprogramación


# AGREGAR nuevo enum TipoEvento

class TipoEvento(str, Enum):
    """Tipos de eventos del CRM."""
    LLAMADA = "llamada"
    REUNION = "reunion"
    VISITA = "visita"
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    NOTA = "nota"


# AGREGAR validaciones de transición de estado

TRANSICIONES_ESTADO_EVENTO = {
    EstadoEvento.PENDIENTE.value: [
        EstadoEvento.REALIZADO.value,
        EstadoEvento.CANCELADO.value,
        EstadoEvento.REAGENDAR.value,
    ],
    EstadoEvento.REALIZADO.value: [],  # Estado final, no permite cambios
    EstadoEvento.CANCELADO.value: [],  # Estado final
    EstadoEvento.REAGENDAR.value: [],  # Estado final (se crea nuevo evento)
}
```

---

## Actualización de CRUD

### Archivo: `backend/app/crud/crm_evento_crud.py`

**Estado actual:**
```python
from app.core.generic_crud import GenericCRUD
from app.models import CRMEvento

crm_evento_crud = GenericCRUD(CRMEvento)
```

**Estado objetivo (CON validaciones adicionales):**

```python
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from sqlmodel import Session, select
from app.core.generic_crud import GenericCRUD
from app.models import CRMEvento, CRMOportunidad
from app.models.enums import EstadoEvento, TipoEvento, TRANSICIONES_ESTADO_EVENTO


class CRMEventoCRUD(GenericCRUD):
    """CRUD extendido para eventos con validaciones de negocio"""
    
    def create(self, session: Session, obj_data: Dict[str, Any]) -> CRMEvento:
        """
        Crea un evento con validaciones adicionales
        """
        # Validar que la oportunidad existe y está activa
        if "oportunidad_id" in obj_data:
            oportunidad = session.get(CRMOportunidad, obj_data["oportunidad_id"])
            if not oportunidad:
                raise ValueError(f"Oportunidad {obj_data['oportunidad_id']} no encontrada")
            if not oportunidad.activo:
                raise ValueError("No se pueden crear eventos en oportunidades inactivas")
        
        # Validar tipo_evento
        if "tipo_evento" in obj_data:
            tipo = obj_data["tipo_evento"]
            tipos_validos = [t.value for t in TipoEvento]
            if tipo not in tipos_validos:
                raise ValueError(f"Tipo de evento inválido: {tipo}. Valores válidos: {tipos_validos}")
        
        # Validar estado
        if "estado" in obj_data:
            estado = obj_data["estado"]
            estados_validos = [e.value for e in EstadoEvento]
            if estado not in estados_validos:
                raise ValueError(f"Estado inválido: {estado}. Valores válidos: {estados_validos}")
            
            # Si no es pendiente, resultado es obligatorio
            if estado != EstadoEvento.PENDIENTE.value:
                if not obj_data.get("resultado"):
                    raise ValueError("El campo 'resultado' es obligatorio cuando el estado no es 'pendiente'")
        
        # Validar fecha_evento (no puede ser muy antigua)
        if "fecha_evento" in obj_data:
            fecha = obj_data["fecha_evento"]
            if isinstance(fecha, str):
                fecha = datetime.fromisoformat(fecha.replace('Z', '+00:00'))
            if fecha < datetime.now() - timedelta(days=365):
                raise ValueError("La fecha del evento no puede ser más de 1 año en el pasado")
        
        return super().create(session, obj_data)
    
    def update(self, session: Session, id: int, obj_data: Dict[str, Any]) -> Optional[CRMEvento]:
        """
        Actualiza un evento con validaciones de transición de estado
        """
        evento = self.get(session, id)
        if not evento:
            return None
        
        # Validar cambio de estado
        if "estado" in obj_data and obj_data["estado"] != evento.estado:
            nuevo_estado = obj_data["estado"]
            estado_actual = evento.estado
            
            # Verificar transición válida
            transiciones_permitidas = TRANSICIONES_ESTADO_EVENTO.get(estado_actual, [])
            if nuevo_estado not in transiciones_permitidas:
                raise ValueError(
                    f"Transición de estado inválida: {estado_actual} → {nuevo_estado}. "
                    f"Transiciones permitidas: {transiciones_permitidas}"
                )
            
            # Si cambia a estado cerrado, resultado es obligatorio
            if nuevo_estado in [EstadoEvento.REALIZADO.value, EstadoEvento.CANCELADO.value, EstadoEvento.REAGENDAR.value]:
                if not obj_data.get("resultado") and not evento.resultado:
                    raise ValueError(f"El campo 'resultado' es obligatorio para cambiar a estado '{nuevo_estado}'")
        
        # No permitir cambio de oportunidad_id
        if "oportunidad_id" in obj_data and obj_data["oportunidad_id"] != evento.oportunidad_id:
            raise ValueError("No se puede cambiar la oportunidad de un evento existente")
        
        return super().update(session, id, obj_data)
    
    def cerrar_evento(
        self, 
        session: Session, 
        evento_id: int, 
        estado: str, 
        resultado: str
    ) -> CRMEvento:
        """
        Cierra un evento con resultado obligatorio
        
        Args:
            evento_id: ID del evento a cerrar
            estado: Estado final (realizado, cancelado, reagendar)
            resultado: Descripción del resultado (min 10 caracteres)
        
        Returns:
            Evento actualizado
        
        Raises:
            ValueError: Si el evento no existe, no está pendiente, o resultado es inválido
        """
        evento = self.get(session, evento_id)
        if not evento:
            raise ValueError(f"Evento {evento_id} no encontrado")
        
        if evento.estado != EstadoEvento.PENDIENTE.value:
            raise ValueError(f"Solo se pueden cerrar eventos pendientes. Estado actual: {evento.estado}")
        
        estados_cerrado = [EstadoEvento.REALIZADO.value, EstadoEvento.CANCELADO.value, EstadoEvento.REAGENDAR.value]
        if estado not in estados_cerrado:
            raise ValueError(f"Estado inválido para cerrar. Valores permitidos: {estados_cerrado}")
        
        if not resultado or len(resultado.strip()) < 10:
            raise ValueError("El resultado debe tener al menos 10 caracteres")
        
        return self.update(session, evento_id, {
            "estado": estado,
            "resultado": resultado.strip()
        })
    
    def reagendar_evento(
        self,
        session: Session,
        evento_id: int,
        motivo_reagenda: str,
        nueva_fecha: datetime,
        nuevo_titulo: Optional[str] = None,
        nueva_descripcion: Optional[str] = None,
    ) -> Dict[str, CRMEvento]:
        """
        Reagenda un evento: cierra el actual y crea uno nuevo
        
        Args:
            evento_id: ID del evento a reagendar
            motivo_reagenda: Motivo de la reagenda
            nueva_fecha: Nueva fecha para el evento
            nuevo_titulo: Título del nuevo evento (opcional, usa el actual si no se proporciona)
            nueva_descripcion: Descripción del nuevo evento (opcional)
        
        Returns:
            Dict con 'evento_cerrado' y 'evento_nuevo'
        """
        evento_original = self.get(session, evento_id)
        if not evento_original:
            raise ValueError(f"Evento {evento_id} no encontrado")
        
        # Cerrar evento original
        evento_cerrado = self.cerrar_evento(
            session,
            evento_id,
            EstadoEvento.REAGENDAR.value,
            motivo_reagenda
        )
        
        # Crear nuevo evento
        nuevo_evento_data = {
            "oportunidad_id": evento_original.oportunidad_id,
            "titulo": nuevo_titulo or f"{evento_original.titulo} - REAGENDADO",
            "tipo_evento": evento_original.tipo_evento,
            "fecha_evento": nueva_fecha,
            "descripcion": nueva_descripcion or evento_original.descripcion,
            "asignado_a_id": evento_original.asignado_a_id,
            "estado": EstadoEvento.PENDIENTE.value,
        }
        
        evento_nuevo = self.create(session, nuevo_evento_data)
        
        return {
            "evento_cerrado": evento_cerrado,
            "evento_nuevo": evento_nuevo
        }
    
    def get_eventos_pendientes_usuario(
        self,
        session: Session,
        user_id: int,
        proximos_dias: int = 7,
        incluir_vencidos: bool = True
    ) -> Dict[str, Any]:
        """
        Obtiene eventos pendientes de un usuario
        
        Args:
            user_id: ID del usuario
            proximos_dias: Eventos en los próximos N días
            incluir_vencidos: Si incluir eventos vencidos
        
        Returns:
            Dict con estadísticas y lista de eventos
        """
        now = datetime.now()
        fecha_limite = now + timedelta(days=proximos_dias)
        
        # Query base
        stmt = (
            select(CRMEvento)
            .where(CRMEvento.asignado_a_id == user_id)
            .where(CRMEvento.estado == EstadoEvento.PENDIENTE.value)
            .where(CRMEvento.deleted_at.is_(None))
        )
        
        if not incluir_vencidos:
            stmt = stmt.where(CRMEvento.fecha_evento >= now)
        
        stmt = stmt.where(CRMEvento.fecha_evento <= fecha_limite)
        stmt = stmt.order_by(CRMEvento.fecha_evento)
        
        eventos = session.exec(stmt).all()
        
        # Calcular estadísticas
        vencidos = [e for e in eventos if e.fecha_evento < now]
        hoy = [e for e in eventos if e.fecha_evento.date() == now.date()]
        proximos = [e for e in eventos if e.fecha_evento >= now and e.fecha_evento.date() != now.date()]
        
        return {
            "user_id": user_id,
            "total_pendientes": len(eventos),
            "vencidos": len(vencidos),
            "hoy": len(hoy),
            "proximos": len(proximos),
            "eventos": [
                {
                    **e.model_dump(),
                    "dias_vencido": (now - e.fecha_evento).days if e.fecha_evento < now else 0
                }
                for e in eventos
            ]
        }


# Instancia del CRUD
crm_evento_crud = CRMEventoCRUD(CRMEvento)
```

---

## Endpoints Personalizados

### Archivo: `backend/app/routers/crm/crm_evento_router.py`

**Estado actual:**
```python
from app.core.router import create_generic_router
from app.crud.crm_evento_crud import crm_evento_crud
from app.models import CRMEvento

crm_evento_router = create_generic_router(
    model=CRMEvento,
    crud=crm_evento_crud,
    prefix="/crm/eventos",
    tags=["crm-eventos"],
)
```

**Estado objetivo (CON endpoints custom):**

```python
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlmodel import Session, select, func
from app.core.router import create_generic_router
from app.crud.crm_evento_crud import crm_evento_crud
from app.models import CRMEvento, CRMOportunidad
from app.models.enums import EstadoEvento, TipoEvento
from app.db import get_session


# Router genérico CRUD base
crm_evento_router = create_generic_router(
    model=CRMEvento,
    crud=crm_evento_crud,
    prefix="/crm/eventos",
    tags=["crm-eventos"],
)


# ===== ENDPOINTS PERSONALIZADOS =====

@crm_evento_router.post("/{evento_id}/cerrar")
def cerrar_evento(
    evento_id: int,
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    """
    Cierra un evento pendiente con resultado obligatorio
    
    Body esperado:
    {
        "estado": "2-realizado" | "3-cancelado" | "4-reagendar",
        "resultado": "Descripción del resultado (min 10 caracteres)"
    }
    """
    try:
        estado = payload.get("estado")
        resultado = payload.get("resultado")
        
        if not estado or not resultado:
            raise ValueError("Los campos 'estado' y 'resultado' son obligatorios")
        
        evento = crm_evento_crud.cerrar_evento(session, evento_id, estado, resultado)
        session.commit()
        session.refresh(evento)
        
        return evento
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@crm_evento_router.post("/{evento_id}/reagendar")
def reagendar_evento(
    evento_id: int,
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    """
    Reagenda un evento: cierra el actual y crea uno nuevo
    
    Body esperado:
    {
        "motivo_reagenda": "Motivo de la reagenda",
        "nueva_fecha": "2025-12-20T10:00:00",
        "nuevo_titulo": "Título opcional",
        "nueva_descripcion": "Descripción opcional"
    }
    """
    try:
        motivo = payload.get("motivo_reagenda")
        nueva_fecha_str = payload.get("nueva_fecha")
        
        if not motivo or not nueva_fecha_str:
            raise ValueError("Los campos 'motivo_reagenda' y 'nueva_fecha' son obligatorios")
        
        nueva_fecha = datetime.fromisoformat(nueva_fecha_str.replace('Z', '+00:00'))
        
        resultado = crm_evento_crud.reagendar_evento(
            session,
            evento_id,
            motivo,
            nueva_fecha,
            payload.get("nuevo_titulo"),
            payload.get("nueva_descripcion"),
        )
        
        session.commit()
        
        return resultado
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@crm_evento_router.get("/pendientes/usuario/{user_id}")
def get_eventos_pendientes_usuario(
    user_id: int,
    proximos_dias: int = Query(7, ge=1, le=365, description="Eventos en los próximos N días"),
    incluir_vencidos: bool = Query(True, description="Incluir eventos vencidos"),
    session: Session = Depends(get_session),
):
    """
    Obtiene eventos pendientes de un usuario con estadísticas
    """
    try:
        resultado = crm_evento_crud.get_eventos_pendientes_usuario(
            session,
            user_id,
            proximos_dias,
            incluir_vencidos
        )
        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@crm_evento_router.get("/estadisticas")
def get_estadisticas_eventos(
    fecha_desde: Optional[str] = Query(None, description="Fecha inicio YYYY-MM-DD"),
    fecha_hasta: Optional[str] = Query(None, description="Fecha fin YYYY-MM-DD"),
    session: Session = Depends(get_session),
):
    """
    Obtiene estadísticas agregadas de eventos
    """
    try:
        stmt = (
            select(CRMEvento)
            .where(CRMEvento.deleted_at.is_(None))
        )
        
        if fecha_desde:
            stmt = stmt.where(CRMEvento.fecha_evento >= datetime.fromisoformat(fecha_desde))
        if fecha_hasta:
            stmt = stmt.where(CRMEvento.fecha_evento <= datetime.fromisoformat(fecha_hasta))
        
        eventos = session.exec(stmt).all()
        
        # Calcular estadísticas
        total = len(eventos)
        pendientes = len([e for e in eventos if e.estado == EstadoEvento.PENDIENTE.value])
        realizados = len([e for e in eventos if e.estado == EstadoEvento.REALIZADO.value])
        cancelados = len([e for e in eventos if e.estado == EstadoEvento.CANCELADO.value])
        reagendados = len([e for e in eventos if e.estado == EstadoEvento.REAGENDAR.value])
        
        # Por tipo
        por_tipo = {}
        for evento in eventos:
            tipo = evento.tipo_evento
            if tipo not in por_tipo:
                por_tipo[tipo] = {"total": 0, "realizados": 0}
            por_tipo[tipo]["total"] += 1
            if evento.estado == EstadoEvento.REALIZADO.value:
                por_tipo[tipo]["realizados"] += 1
        
        tasa_cumplimiento = realizados / total if total > 0 else 0
        
        return {
            "periodo": {
                "desde": fecha_desde,
                "hasta": fecha_hasta
            },
            "totales": {
                "total": total,
                "pendientes": pendientes,
                "realizados": realizados,
                "cancelados": cancelados,
                "reagendados": reagendados
            },
            "por_tipo": [
                {"tipo": tipo, **stats}
                for tipo, stats in por_tipo.items()
            ],
            "tasa_cumplimiento": round(tasa_cumplimiento, 3)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### Endpoint en Oportunidades

**Archivo: `backend/app/routers/crm/crm_oportunidad_router.py`**

Agregar endpoint:

```python
@crm_oportunidad_router.get("/{oportunidad_id}/eventos")
def get_eventos_oportunidad(
    oportunidad_id: int,
    incluir_cerrados: bool = Query(True, description="Incluir eventos cerrados"),
    tipo_evento: Optional[str] = Query(None, description="Filtrar por tipo"),
    session: Session = Depends(get_session),
):
    """
    Obtiene todos los eventos de una oportunidad (timeline)
    """
    oportunidad = session.get(CRMOportunidad, oportunidad_id)
    if not oportunidad:
        raise HTTPException(status_code=404, detail="Oportunidad no encontrada")
    
    stmt = (
        select(CRMEvento)
        .where(CRMEvento.oportunidad_id == oportunidad_id)
        .where(CRMEvento.deleted_at.is_(None))
    )
    
    if not incluir_cerrados:
        stmt = stmt.where(CRMEvento.estado == EstadoEvento.PENDIENTE.value)
    
    if tipo_evento:
        stmt = stmt.where(CRMEvento.tipo_evento == tipo_evento)
    
    stmt = stmt.order_by(CRMEvento.fecha_evento.desc())
    
    eventos = session.exec(stmt).all()
    
    return {
        "oportunidad_id": oportunidad_id,
        "total": len(eventos),
        "eventos": eventos
    }
```

### Endpoint en Mensajes

**Archivo: `backend/app/routers/crm_mensaje_router.py`**

Agregar endpoint:

```python
@crm_mensaje_router.post("/{mensaje_id}/crear-evento")
def crear_evento_desde_mensaje(
    mensaje_id: int,
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    """
    Crea un evento a partir de un mensaje vinculado a una oportunidad
    
    Body esperado:
    {
        "titulo": "Responder consulta",
        "tipo_evento": "whatsapp",
        "fecha_evento": "2025-12-02T10:00:00",
        "descripcion": "...",
        "asignado_a_id": 1
    }
    """
    from app.models import CRMMensaje
    from app.crud.crm_evento_crud import crm_evento_crud
    
    mensaje = session.get(CRMMensaje, mensaje_id)
    if not mensaje:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    if not mensaje.oportunidad_id:
        raise HTTPException(
            status_code=400,
            detail="El mensaje debe estar vinculado a una oportunidad antes de crear un evento"
        )
    
    # Agregar oportunidad_id desde el mensaje
    evento_data = {**payload, "oportunidad_id": mensaje.oportunidad_id}
    
    try:
        evento = crm_evento_crud.create(session, evento_data)
        session.commit()
        session.refresh(evento)
        return evento
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

---

## Validaciones

### Validaciones a Nivel de Modelo

Ya incluidas en el modelo SQLModel (ver sección anterior)

### Validaciones a Nivel de CRUD

Ya incluidas en `CRMEventoCRUD` (ver sección anterior):

- ✅ Validar oportunidad existe y está activa
- ✅ Validar tipo_evento válido
- ✅ Validar estado válido
- ✅ Validar transiciones de estado
- ✅ Validar resultado obligatorio al cerrar
- ✅ Validar fecha_evento no muy antigua
- ✅ No permitir cambiar oportunidad_id

---

## Impactos en Otros Módulos

### 1. Modelo CRMContacto

**Archivo: `backend/app/models/crm_contacto.py`**

**Cambio:** Eliminar relación con eventos

```python
# ANTES:
eventos: List["CRMEvento"] = Relationship(back_populates="contacto")

# DESPUÉS:
# Eliminar esta relación - Los eventos ya no se relacionan directamente con contactos
```

### 2. Modelo CRMOportunidad

**Archivo: `backend/app/models/crm_oportunidad.py`**

**Sin cambios** - La relación con eventos ya existe y es correcta

```python
eventos: List["CRMEvento"] = Relationship(back_populates="oportunidad")
```

### 3. Catálogos CRM

**Archivos afectados:**
- `backend/app/models/crm_catalogos.py` - Eliminar relaciones en CRMTipoEvento, CRMMotivoEvento, CRMOrigenLead
- `backend/app/routers/crm/crm_catalogos_router.py` - Mantener solo como referencia legacy

**CRMTipoEvento y CRMMotivoEvento:**
- Ya NO se usan en la nueva estructura
- Se pueden mantener por compatibilidad legacy pero sin relación activa con eventos
- Considerar deprecation en futuro

```python
# En crm_catalogos.py

class CRMTipoEvento(Base, table=True):
    __tablename__ = "crm_tipos_evento"
    
    # ... campos existentes ...
    
    # ELIMINAR esta relación:
    # eventos: List["CRMEvento"] = Relationship(back_populates="tipo")


class CRMMotivoEvento(Base, table=True):
    __tablename__ = "crm_motivos_evento"
    
    # ... campos existentes ...
    
    # ELIMINAR esta relación:
    # eventos: List["CRMEvento"] = Relationship(back_populates="motivo")


class CRMOrigenLead(Base, table=True):
    __tablename__ = "crm_origenes_lead"
    
    # ... campos existentes ...
    
    # ELIMINAR esta relación:
    # eventos: List["CRMEvento"] = Relationship(back_populates="origen_lead")
```

### 4. Endpoint de Actividades (Mensajes)

**Archivo: `backend/app/routers/crm_mensaje_router.py`**

**Endpoint: `/crm/mensajes/buscar-actividades`**

**Cambio:** Actualizar query de eventos para usar nueva estructura

```python
# ANTES:
stmt_eventos = (
    select(CRMEvento)
    .where(CRMEvento.contacto_id == contacto_id)  # ❌ Ya no existe
    .where(CRMEvento.deleted_at.is_(None))
    .order_by(CRMEvento.fecha_evento.desc())
)

# DESPUÉS:
# Obtener eventos via oportunidad solamente
stmt_eventos = (
    select(CRMEvento)
    .where(CRMEvento.oportunidad_id == oportunidad_id)
    .where(CRMEvento.deleted_at.is_(None))
    .order_by(CRMEvento.fecha_evento.desc())
)

# Y actualizar el mapeo de actividades:
for evento in eventos:
    actividades.append({
        "tipo": "evento",
        "id": evento.id,
        "fecha": evento.fecha_evento,
        "descripcion": evento.titulo,  # ✨ Ahora usa titulo en lugar de descripcion
        "tipo_evento": evento.tipo_evento,  # ✨ Ahora es string directo
        "estado": evento.estado,  # ✨ Renombrado
        # "tipo_id": evento.tipo_id,  # ❌ Ya no existe
        # "motivo_id": evento.motivo_id,  # ❌ Ya no existe
    })
```

---

## Checklist de Implementación

### Pre-requisitos
- [ ] Backup de base de datos producción
- [ ] Backup de tabla `crm_eventos`
- [ ] Verificar que no hay migraciones pendientes

### Migración
- [ ] Crear migración `022_refactor_crm_eventos.py`
- [ ] Ejecutar en ambiente de desarrollo
- [ ] Validar con script `validate_eventos_migration.py`
- [ ] Ejecutar en staging
- [ ] Validar en staging
- [ ] Ejecutar en producción

### Código Backend
- [ ] Actualizar `backend/app/models/enums.py`
- [ ] Actualizar `backend/app/models/crm_evento.py`
- [ ] Actualizar `backend/app/crud/crm_evento_crud.py`
- [ ] Actualizar `backend/app/routers/crm/crm_evento_router.py`
- [ ] Actualizar `backend/app/routers/crm/crm_oportunidad_router.py`
- [ ] Actualizar `backend/app/routers/crm_mensaje_router.py`
- [ ] Actualizar `backend/app/models/crm_contacto.py`
- [ ] Actualizar `backend/app/models/crm_catalogos.py`

### Testing
- [ ] Tests unitarios del modelo
- [ ] Tests unitarios del CRUD
- [ ] Tests de endpoints CRUD básicos
- [ ] Tests de endpoints personalizados
- [ ] Tests de validaciones
- [ ] Tests de integración con oportunidades
- [ ] Tests de integración con mensajes

### Documentación
- [ ] Actualizar documentación de API
- [ ] Actualizar esquema de base de datos
- [ ] Documentar breaking changes

---

## Consideraciones Adicionales

### Rendimiento
- Los nuevos índices en `tipo_evento` y `estado` mejorarán las queries de filtrado
- Eliminación de joins innecesarios (tipo, motivo, origen_lead) mejorará performance

### Seguridad
- Validar permisos de usuario sobre la oportunidad al crear/modificar eventos
- Auditar cambios de estado en logs

### Monitoreo
- Alertas si eventos sin oportunidad_id (no deberían existir)
- Métricas de eventos cerrados sin resultado
- Monitoreo de tasa de cumplimiento por usuario/tipo

---

**Fin del documento**
