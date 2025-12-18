# Plan Detallado de Implementación: Webhook Meta WhatsApp

## 1. Resumen Ejecutivo

Este documento detalla el plan completo de implementación para recibir eventos de Meta WhatsApp API en el backend de SAK, procesarlos correctamente y mantener sincronizado el estado de los mensajes en `crm_mensajes`.

**Objetivo**: Implementar `POST /api/v1/webhooks/meta-w/whatsapp` para procesar eventos: `message.received`, `message.sent`, `message.delivered`, `message.read`, `message.failed`.

---

## 2. Cambios en el Modelo de Datos

### 2.1. Nueva Tabla: `crm_celulares`

**Propósito**: Almacenar los celulares/canales de WhatsApp Business configurados en Meta para la empresa.

**Archivo**: `backend/app/models/crm_celular.py`

```python
from typing import Optional
from sqlmodel import Field, Relationship
from .base import Base

class CRMCelular(Base, table=True):
    __tablename__ = "crm_celulares"
    __searchable_fields__ = ["alias", "numero_celular"]

    meta_celular_id: str = Field(
        max_length=255, 
        unique=True, 
        index=True, 
        nullable=False,
        description="ID del celular en Meta WhatsApp"
    )
    numero_celular: str = Field(
        max_length=50, 
        index=True, 
        nullable=False,
        description="Número de teléfono con formato internacional"
    )
    alias: Optional[str] = Field(
        default=None, 
        max_length=255,
        description="Nombre descriptivo del canal"
    )
    activo: bool = Field(default=True, description="Canal habilitado")
```

**Índices**:
- `meta_celular_id` (UNIQUE)
- `numero_celular`

---

### 2.2. Modificación Tabla: `crm_mensajes`

**Archivo**: `backend/app/models/crm_mensaje.py`

**Campos nuevos a agregar**:

```python
# Campo para almacenar el estado reportado por Meta
estado_meta: Optional[str] = Field(
    default=None, 
    max_length=50, 
    index=True,
    description="Estado del mensaje según Meta (received, sent, delivered, read, failed)"
)

# Campo para relacionar con el celular/canal usado
celular_id: Optional[int] = Field(
    default=None,
    foreign_key="crm_celulares.id",
    index=True,
    description="Celular/canal de WhatsApp usado"
)

# Relación con CRMCelular
celular: Optional["CRMCelular"] = Relationship()
```

**Mapeo de estados Meta → Estados SAK**:

| Estado Meta | Estado SAK (`estado`) | Descripción |
|-------------|----------------------|-------------|
| `received` | `RECIBIDO` | Mensaje entrante recibido |
| `sent` | `ENVIADO` | Mensaje enviado a Meta exitosamente |
| `delivered` | `ENTREGADO` | Mensaje entregado al dispositivo del cliente |
| `read` | `LEIDO` | Cliente leyó el mensaje |
| `failed` | `ERROR_ENVIO` | Error al enviar mensaje |

**Nota**: El campo `estado_meta` almacena el valor literal de Meta, mientras que `estado` usa los enums de `EstadoMensaje`.

---

### 2.3. Modificación Tabla: `settings`

**Nuevas claves de configuración**:

| Clave | Descripción | Ejemplo |
|-------|-------------|---------|
| `meta_w_empresa_id` | ID de empresa en Meta-W para validación (RF-6) | `692d787d-06c4-432e-a94e-cf0686e593eb` |
| `meta_w_auto_create_celular` | Auto-crear celulares desconocidos | `true` |

**Nota**: `meta_w_empresa_id` se usa para validar que los webhooks recibidos desde Meta-W (servicio externo en GCP) pertenecen a la empresa correcta. Este valor debe coincidir con el `empresa_id` que Meta-W envía en los payloads.

**Archivo**: Inserción en `backend/scripts/poblar_settings_meta_w.py`

---

### 2.4. Nueva Tabla: `webhook_logs_recibidos` (opcional)

**Propósito**: Auditoría y debugging de webhooks recibidos.

**Archivo**: `backend/app/models/webhook_log.py`

```python
from datetime import datetime
from typing import Optional
from sqlalchemy import Column, JSON, Text
from sqlmodel import Field
from .base import Base, current_utc_time

class WebhookLog(Base, table=True):
    __tablename__ = "webhook_logs_recibidos"

    evento: str = Field(max_length=50, index=True, nullable=False)
    payload: dict = Field(
        sa_column=Column(JSON, nullable=False),
        description="Payload completo recibido"
    )
    response_status: Optional[int] = Field(default=None, description="HTTP status de respuesta")
    error_message: Optional[str] = Field(
        default=None,
        sa_column=Column(Text),
        description="Mensaje de error si falla procesamiento"
    )
    procesado: bool = Field(default=False, description="Si se procesó exitosamente")
    fecha_recepcion: datetime = Field(
        default_factory=current_utc_time,
        index=True,
        nullable=False
    )
```

---

## 3. Migraciones de Base de Datos

### 3.1. Migración: Crear tabla `crm_celulares`

**Archivo**: `backend/migrations/023_add_crm_celulares.py`

```python
"""
Migración 023: Crear tabla crm_celulares
"""
from alembic import op
import sqlalchemy as sa

revision = '023'
down_revision = '022'

def upgrade():
    op.create_table(
        'crm_celulares',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('meta_celular_id', sa.String(255), nullable=False),
        sa.Column('numero_celular', sa.String(50), nullable=False),
        sa.Column('alias', sa.String(255), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('meta_celular_id')
    )
    op.create_index('ix_crm_celulares_meta_celular_id', 'crm_celulares', ['meta_celular_id'])
    op.create_index('ix_crm_celulares_numero_celular', 'crm_celulares', ['numero_celular'])

def downgrade():
    op.drop_index('ix_crm_celulares_numero_celular', 'crm_celulares')
    op.drop_index('ix_crm_celulares_meta_celular_id', 'crm_celulares')
    op.drop_table('crm_celulares')
```

---

### 3.2. Migración: Agregar campos a `crm_mensajes`

**Archivo**: `backend/migrations/024_add_estado_meta_celular_id.py`

```python
"""
Migración 024: Agregar estado_meta y celular_id a crm_mensajes
"""
from alembic import op
import sqlalchemy as sa

revision = '024'
down_revision = '023'
down_revision = '023'

def upgrade():
    # Agregar estado_meta
    op.add_column(
        'crm_mensajes',
        sa.Column('estado_meta', sa.String(50), nullable=True)
    )
    op.create_index('ix_crm_mensajes_estado_meta', 'crm_mensajes', ['estado_meta'])
    
    # Agregar celular_id
    op.add_column(
        'crm_mensajes',
        sa.Column('celular_id', sa.Integer(), nullable=True)
    )
    op.create_index('ix_crm_mensajes_celular_id', 'crm_mensajes', ['celular_id'])
    op.create_foreign_key(
        'fk_crm_mensajes_celular_id',
        'crm_mensajes', 'crm_celulares',
        ['celular_id'], ['id']
    )

def downgrade():
    op.drop_constraint('fk_crm_mensajes_celular_id', 'crm_mensajes', type_='foreignkey')
    op.drop_index('ix_crm_mensajes_celular_id', 'crm_mensajes')
    op.drop_column('crm_mensajes', 'celular_id')
    
    op.drop_index('ix_crm_mensajes_estado_meta', 'crm_mensajes')
    op.drop_column('crm_mensajes', 'estado_meta')
```

---

### 3.3. Migración: Crear tabla `webhook_logs_recibidos`

**Archivo**: `backend/migrations/025_add_webhook_logs.py`

```python
"""
Migración 025: Crear tabla webhook_logs_recibidos
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '025'
down_revision = '024'
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = '025'
down_revision = '024'

def upgrade():
    op.create_table(
        'webhook_logs_recibidos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('evento', sa.String(50), nullable=False),
        sa.Column('payload', JSON, nullable=False),
        sa.Column('response_status', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('procesado', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('fecha_recepcion', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_webhook_logs_evento', 'webhook_logs_recibidos', ['evento'])
    op.create_index('ix_webhook_logs_fecha', 'webhook_logs_recibidos', ['fecha_recepcion'])

def downgrade():
    op.drop_index('ix_webhook_logs_fecha', 'webhook_logs_recibidos')
    op.drop_index('ix_webhook_logs_evento', 'webhook_logs_recibidos')
    op.drop_table('webhook_logs_recibidos')
```

---

## 4. Scripts de Poblado de Datos

### 4.1. Script: Poblar configuración en `settings`

**Archivo**: `backend/scripts/poblar_settings_meta_w.py`

```python
"""
Poblar configuración de Meta WhatsApp en settings
"""
from sqlmodel import Session, select
from app.db import engine
from app.models.setting import Setting

def poblar_settings():
    with Session(engine) as session:
        settings = [
            {
                "clave": "meta_w_empresa_id",
                "valor": "692d787d-06c4-432e-a94e-cf0686e593eb",
                "descripcion": "ID de empresa en Meta-W para validar webhooks (RF-6)"
            },
            {
                "clave": "meta_w_auto_create_celular",
                "valor": "true",
                "descripcion": "Crear automáticamente celulares desconocidos en crm_celulares"
            }
        ]
        
        for setting_data in settings:
            stmt = select(Setting).where(Setting.clave == setting_data["clave"])
            existing = session.exec(stmt).first()
            
            if not existing:
                setting = Setting(**setting_data)
                session.add(setting)
                print(f"✓ Creada configuración: {setting_data['clave']}")
            else:
                print(f"⊙ Ya existe: {setting_data['clave']}")
        
        session.commit()
        print("\n✓ Configuración de Meta WhatsApp poblada exitosamente")

if __name__ == "__main__":
    poblar_settings()
```

---

### 4.2. Script: Poblar celulares en `crm_celulares`

**Archivo**: `backend/scripts/poblar_crm_celulares.py`

```python
"""
Poblar celulares de WhatsApp Business en crm_celulares
"""
from sqlmodel import Session, select
from app.db import engine
from app.models.crm_celular import CRMCelular

def poblar_celulares():
    with Session(engine) as session:
        celulares = [
            {
                "meta_celular_id": "14b530aa-ff61-44be-af48-957dabde4f28",
                "numero_celular": "+15551676015",
                "alias": "WhatsApp Business - Principal",
                "activo": True
            }
        ]
        
        for cel_data in celulares:
            stmt = select(CRMCelular).where(
                CRMCelular.meta_celular_id == cel_data["meta_celular_id"]
            )
            existing = session.exec(stmt).first()
            
            if not existing:
                celular = CRMCelular(**cel_data)
                session.add(celular)
                print(f"✓ Creado celular: {cel_data['numero_celular']} ({cel_data['alias']})")
            else:
                print(f"⊙ Ya existe: {cel_data['numero_celular']}")
        
        session.commit()
        print("\n✓ Celulares poblados exitosamente")

if __name__ == "__main__":
    poblar_celulares()
```

---

## 5. Desarrollo de Endpoints

### 5.1. Nuevo Router: Webhooks Meta WhatsApp

**Archivo**: `backend/app/routers/meta_webhook_router.py`

**Estructura**:

```python
from fastapi import APIRouter, Request, HTTPException, Header, Depends
from sqlmodel import Session
from typing import Optional
import logging

from app.db import get_session
from app.services.meta_webhook_service import MetaWebhookService
from app.schemas.meta_webhook import (
    WebhookEventPayload,
    WebhookResponse
)

router = APIRouter(prefix="/webhooks/meta-w", tags=["webhooks"])
logger = logging.getLogger(__name__)


@router.post("/whatsapp", response_model=WebhookResponse)
async def recibir_webhook_whatsapp(
    request: Request,
    payload: WebhookEventPayload,
    session: Session = Depends(get_session)
):
    """
    Recibe eventos de Meta WhatsApp API y procesa mensajes.
    
    Eventos soportados:
    - message.received: Mensaje entrante del cliente
    - message.sent: Mensaje enviado exitosamente
    - message.delivered: Mensaje entregado al dispositivo
    - message.read: Mensaje leído por el cliente
    - message.failed: Error al enviar mensaje
    """
    try:
        service = MetaWebhookService(session)
        
        # Procesar evento
        result = await service.process_webhook_event(payload.dict())
        
        return WebhookResponse(status="ok", mensaje_id=result.get("mensaje_id"))
        
    except ValueError as e:
        logger.error(f"Error de validación: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Error procesando webhook: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

**Ruta**: `POST /api/v1/webhooks/meta-w/whatsapp`

**Headers esperados**:
- `Content-Type: application/json`
- `User-Agent: python-httpx/...`

---

### 5.2. Schemas de Request/Response

**Archivo**: `backend/app/schemas/meta_webhook.py`

```python
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class MensajeWebhook(BaseModel):
    """Estructura del mensaje en el payload"""
    id: str
    empresa_id: str
    celular_id: str
    tipo: str
    direccion: str  # 'in' o 'out'
    from_phone: str
    from_name: Optional[str] = None
    to_phone: str
    texto: Optional[str] = None
    status: str
    meta_message_id: Optional[str] = None
    meta_timestamp: Optional[str] = None
    celular: Optional[Dict[str, Any]] = None


class WebhookEventPayload(BaseModel):
    """Payload de evento recibido de Meta"""
    evento: str = Field(..., description="Tipo de evento")
    mensaje_id: str = Field(..., description="ID del mensaje en SAK")
    timestamp: str
    mensaje: Optional[MensajeWebhook] = None
    status: Optional[str] = None
    meta_message_id: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class WebhookResponse(BaseModel):
    """Respuesta del webhook"""
    status: str = "ok"
    mensaje_id: Optional[str] = None
```

---

### 5.3. Servicio: Procesamiento de Webhooks

**Archivo**: `backend/app/services/meta_webhook_service.py`

**Estructura principal**:

```python
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from sqlmodel import Session, select

from app.models import CRMMensaje, CRMContacto, CRMCelular
from app.models.setting import Setting
from app.models.webhook_log import WebhookLog
from app.models.enums import EstadoMensaje

logger = logging.getLogger(__name__)


class MetaWebhookService:
    """Servicio para procesar webhooks de Meta WhatsApp"""
    
    def __init__(self, session: Session):
        self.session = session
    
    async def process_webhook_event(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Procesa un evento de webhook y actualiza crm_mensajes
        """
        evento = payload.get("evento")
        mensaje_id = payload.get("mensaje_id")
        
        # Registrar en logs
        self._log_webhook(payload)
        
        if not evento or not mensaje_id:
            raise ValueError("Faltan campos requeridos: evento y mensaje_id")
        
        # Procesar según tipo de evento
        if evento == "message.received":
            return await self._handle_message_received(payload)
        elif evento == "message.sent":
            return await self._handle_message_sent(payload)
        elif evento == "message.delivered":
            return await self._handle_message_delivered(payload)
        elif evento == "message.read":
            return await self._handle_message_read(payload)
        elif evento == "message.failed":
            return await self._handle_message_failed(payload)
        else:
            raise ValueError(f"Tipo de evento desconocido: {evento}")
    
    async def _handle_message_received(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Procesa mensaje.received - nuevo mensaje entrante"""
        mensaje_data = payload.get("mensaje", {})
        meta_message_id = mensaje_data.get("meta_message_id")
        
        # Verificar si ya existe
        if meta_message_id:
            stmt = select(CRMMensaje).where(
                CRMMensaje.origen_externo_id == meta_message_id
            )
            existing = self.session.exec(stmt).first()
            if existing:
                logger.info(f"Mensaje ya existe: {meta_message_id}")
                return {"mensaje_id": str(existing.id)}
        
        # Obtener o crear celular
        celular = self._ensure_crm_celular(mensaje_data)
        
        # Buscar contacto por teléfono
        from_phone = mensaje_data.get("from_phone")
        contacto = self._find_or_create_contacto(from_phone, mensaje_data.get("from_name"))
        
        # Buscar oportunidad activa del contacto
        oportunidad_id = None
        if contacto and contacto.oportunidades:
            oportunidad_activa = next(
                (op for op in contacto.oportunidades if op.estado not in ["6-perdida", "5-ganada"]),
                None
            )
            if oportunidad_activa:
                oportunidad_id = oportunidad_activa.id
        
        # Crear mensaje
        mensaje = CRMMensaje(
            tipo="entrada",
            canal="whatsapp",
            contacto_id=contacto.id if contacto else None,
            contacto_referencia=from_phone,
            contacto_nombre_propuesto=mensaje_data.get("from_name"),
            estado=EstadoMensaje.RECIBIDO.value,
            estado_meta="received",
            asunto=f"WhatsApp de {mensaje_data.get('from_name') or from_phone}",
            contenido=mensaje_data.get("texto"),
            origen_externo_id=meta_message_id,
            metadata_json=mensaje_data,
            celular_id=celular.id if celular else None,
            oportunidad_id=oportunidad_id,
            fecha_mensaje=datetime.utcnow()
        )
        
        self.session.add(mensaje)
        self.session.commit()
        self.session.refresh(mensaje)
        
        logger.info(f"Mensaje entrante creado: {mensaje.id}")
        return {"mensaje_id": str(mensaje.id)}
    
    async def _handle_message_sent(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Procesa message.sent - mensaje enviado exitosamente"""
        mensaje_id = payload.get("mensaje_id")
        meta_message_id = payload.get("meta_message_id")
        status = payload.get("status", "sent")
        
        mensaje = self._get_mensaje(mensaje_id)
        if not mensaje:
            raise ValueError(f"Mensaje no encontrado: {mensaje_id}")
        
        # Actualizar mensaje
        mensaje.estado = EstadoMensaje.ENVIADO.value
        mensaje.estado_meta = status
        mensaje.origen_externo_id = meta_message_id
        mensaje.set_estado(EstadoMensaje.ENVIADO.value)
        
        self.session.add(mensaje)
        self.session.commit()
        
        logger.info(f"Mensaje {mensaje_id} marcado como ENVIADO")
        return {"mensaje_id": mensaje_id}
    
    async def _handle_message_delivered(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Procesa message.delivered - mensaje entregado"""
        mensaje_id = payload.get("mensaje_id")
        status = payload.get("status", "delivered")
        
        mensaje = self._get_mensaje(mensaje_id)
        if not mensaje:
            raise ValueError(f"Mensaje no encontrado: {mensaje_id}")
        
        # Crear estado ENTREGADO si no existe en enums
        # Por ahora usar ENVIADO
        mensaje.estado_meta = status
        mensaje.set_estado(EstadoMensaje.ENVIADO.value)
        
        # Actualizar metadata con info de entrega
        metadata = mensaje.metadata_json or {}
        metadata["delivered_at"] = payload.get("timestamp")
        mensaje.metadata_json = metadata
        
        self.session.add(mensaje)
        self.session.commit()
        
        logger.info(f"Mensaje {mensaje_id} marcado como ENTREGADO")
        return {"mensaje_id": mensaje_id}
    
    async def _handle_message_read(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Procesa message.read - mensaje leído"""
        mensaje_id = payload.get("mensaje_id")
        status = payload.get("status", "read")
        
        mensaje = self._get_mensaje(mensaje_id)
        if not mensaje:
            raise ValueError(f"Mensaje no encontrado: {mensaje_id}")
        
        # Actualizar estado_meta
        mensaje.estado_meta = status
        
        # Actualizar metadata con info de lectura
        metadata = mensaje.metadata_json or {}
        metadata["read_at"] = payload.get("timestamp")
        mensaje.metadata_json = metadata
        
        self.session.add(mensaje)
        self.session.commit()
        
        logger.info(f"Mensaje {mensaje_id} marcado como LEÍDO")
        return {"mensaje_id": mensaje_id}
    
    async def _handle_message_failed(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Procesa message.failed - error al enviar"""
        mensaje_id = payload.get("mensaje_id")
        error_code = payload.get("error_code")
        error_message = payload.get("error_message")
        status = payload.get("status", "failed")
        
        mensaje = self._get_mensaje(mensaje_id)
        if not mensaje:
            raise ValueError(f"Mensaje no encontrado: {mensaje_id}")
        
        # Actualizar mensaje
        mensaje.estado = EstadoMensaje.ERROR_ENVIO.value
        mensaje.estado_meta = status
        mensaje.set_estado(EstadoMensaje.ERROR_ENVIO.value)
        
        # Guardar error en metadata
        metadata = mensaje.metadata_json or {}
        metadata["error_code"] = error_code
        metadata["error_message"] = error_message
        metadata["failed_at"] = payload.get("timestamp")
        mensaje.metadata_json = metadata
        
        self.session.add(mensaje)
        self.session.commit()
        
        logger.error(f"Mensaje {mensaje_id} falló: {error_code} - {error_message}")
        return {"mensaje_id": mensaje_id}
    
    def _get_mensaje(self, mensaje_id: str) -> Optional[CRMMensaje]:
        """Obtiene un mensaje por ID"""
        stmt = select(CRMMensaje).where(CRMMensaje.id == int(mensaje_id))
        return self.session.exec(stmt).first()
    
    def _ensure_crm_celular(self, mensaje_data: Dict[str, Any]) -> Optional[CRMCelular]:
        """Obtiene o crea el celular en crm_celulares (RF-6: valida empresa_id contra settings)"""
        celular_data = mensaje_data.get("celular", {})
        celular_id = mensaje_data.get("celular_id")
        empresa_id_payload = mensaje_data.get("empresa_id")
        
        if not celular_id:
            return None
        
        # RF-6: Validar empresa_id del payload contra settings
        if empresa_id_payload:
            stmt_setting = select(Setting).where(Setting.clave == "meta_w_empresa_id")
            setting = self.session.exec(stmt_setting).first()
            if setting and setting.valor != empresa_id_payload:
                raise ValueError(
                    f"empresa_id del payload ({empresa_id_payload}) no coincide "
                    f"con el configurado en settings ({setting.valor})"
                )
        
        # Buscar celular existente
        stmt = select(CRMCelular).where(CRMCelular.meta_celular_id == celular_id)
        celular = self.session.exec(stmt).first()
        
        if celular:
            return celular
        
        # Verificar si debe auto-crear
        stmt = select(Setting).where(Setting.clave == "meta_w_auto_create_celular")
        auto_create = self.session.exec(stmt).first()
        
        if not auto_create or auto_create.valor.lower() != "true":
            logger.warning(f"Celular desconocido y auto-creación deshabilitada: {celular_id}")
            return None
        
        # Crear nuevo celular
        celular = CRMCelular(
            meta_celular_id=celular_id,
            numero_celular=celular_data.get("phone_number", ""),
            alias=celular_data.get("alias"),
            activo=True
        )
        self.session.add(celular)
        self.session.commit()
        self.session.refresh(celular)
        
        logger.info(f"Celular creado automáticamente: {celular_id}")
        return celular
    
    def _find_or_create_contacto(
        self, 
        telefono: str, 
        nombre: Optional[str] = None
    ) -> Optional[CRMContacto]:
        """Busca o crea un contacto por teléfono"""
        if not telefono:
            return None
        
        # Normalizar teléfono (quitar espacios, guiones, etc)
        telefono_norm = telefono.replace(" ", "").replace("-", "").replace("+", "")
        
        # Buscar contacto existente
        stmt = select(CRMContacto)
        contactos = self.session.exec(stmt).all()
        
        for contacto in contactos:
            for tel in contacto.telefonos:
                tel_norm = tel.replace(" ", "").replace("-", "").replace("+", "")
                if telefono_norm in tel_norm or tel_norm in telefono_norm:
                    return contacto
        
        # No crear automáticamente, solo retornar None
        # El frontend debería manejar la creación del contacto
        return None
    
    def _log_webhook(self, payload: Dict[str, Any]) -> None:
        """Registra el webhook en logs"""
        try:
            log = WebhookLog(
                evento=payload.get("evento", "unknown"),
                payload=payload,
                procesado=False,
                fecha_recepcion=datetime.utcnow()
            )
            self.session.add(log)
            self.session.commit()
        except Exception as e:
            logger.error(f"Error al registrar webhook log: {str(e)}")
```

---

### 5.4. Integración en `main.py`

**Archivo**: `backend/app/main.py`

Agregar los routers:

```python
from app.routers import meta_webhook_router, crm_celular_router

# Router para webhooks de Meta-W
app.include_router(
    meta_webhook_router.router,
    prefix="/api/v1",
    tags=["webhooks"]
)

# Router CRUD para administración de celulares
app.include_router(
    crm_celular_router.router,
    prefix="/api/v1"
)
```

---

## 6. CRUD y Servicios Auxiliares

### 6.1. CRUD para `CRMCelular`

**Archivo**: `backend/app/crud/crm_celular_crud.py`

```python
from app.core.generic_crud import GenericCRUD
from app.models.crm_celular import CRMCelular

crm_celular_crud = GenericCRUD(CRMCelular)
```

**Nota**: Se usa el CRUD genérico del framework sin extensiones personalizadas.

---

### 6.2. Router para administración de celulares

**Archivo**: `backend/app/routers/crm_celular_router.py`

```python
from fastapi import APIRouter
from app.core.ra_data_router import create_ra_data_router
from app.crud.crm_celular_crud import crm_celular_crud
from app.models.crm_celular import CRMCelular

router = create_ra_data_router(
    model=CRMCelular,
    crud=crm_celular_crud,
    prefix="/crm/celulares",
    tags=["CRM - Celulares"]
)
```

**Endpoints generados automáticamente**:
- `GET /api/v1/crm/celulares` - Listar con paginación y filtros
- `GET /api/v1/crm/celulares/{id}` - Obtener uno
- `POST /api/v1/crm/celulares` - Crear
- `PUT /api/v1/crm/celulares/{id}` - Actualizar
- `DELETE /api/v1/crm/celulares/{id}` - Eliminar (soft delete)

---

## 7. Casos de Prueba

### 7.1. Casos de Prueba Funcionales

#### TC-01: Recibir mensaje entrante nuevo

**Endpoint**: `POST /api/v1/webhooks/meta-w/whatsapp`

**Payload**:
```json
{
  "evento": "message.received",
  "mensaje_id": "test-msg-001",
  "timestamp": "2025-12-18T10:30:00Z",
  "mensaje": {
    "id": "test-msg-001",
    "empresa_id": "692d787d-06c4-432e-a94e-cf0686e593eb",
    "celular_id": "14b530aa-ff61-44be-af48-957dabde4f28",
    "tipo": "text",
    "direccion": "in",
    "from_phone": "5491156384310",
    "from_name": "Juan Pérez",
    "to_phone": "+15551676015",
    "texto": "Hola, necesito información",
    "status": "received",
    "meta_message_id": "wamid.test123",
    "celular": {
      "id": "14b530aa-ff61-44be-af48-957dabde4f28",
      "alias": "WhatsApp Business",
      "phone_number": "+15551676015"
    }
  }
}
```

**Resultado esperado**:
- HTTP 200 OK
- Nuevo registro en `crm_mensajes`:
  - `tipo` = "entrada"
  - `estado` = "recibido"
  - `estado_meta` = "received"
  - `origen_externo_id` = "wamid.test123"
  - `contenido` = "Hola, necesito información"
  - `celular_id` apunta al celular correcto

---

#### TC-02: Actualizar mensaje a ENVIADO

**Prerequisito**: Mensaje existente con `id = 10`

**Payload**:
```json
{
  "evento": "message.sent",
  "mensaje_id": "10",
  "timestamp": "2025-12-18T10:31:00Z",
  "status": "sent",
  "meta_message_id": "wamid.sent456"
}
```

**Resultado esperado**:
- HTTP 200 OK
- Mensaje con `id=10` actualizado:
  - `estado` = "enviado"
  - `estado_meta` = "sent"
  - `origen_externo_id` = "wamid.sent456"
  - `fecha_estado` actualizada

---

#### TC-03: Actualizar mensaje a ENTREGADO

**Payload**:
```json
{
  "evento": "message.delivered",
  "mensaje_id": "10",
  "timestamp": "2025-12-18T10:32:00Z",
  "status": "delivered"
}
```

**Resultado esperado**:
- HTTP 200 OK
- Mensaje actualizado:
  - `estado_meta` = "delivered"
  - `metadata_json` contiene `delivered_at`

---

#### TC-04: Actualizar mensaje a LEÍDO

**Payload**:
```json
{
  "evento": "message.read",
  "mensaje_id": "10",
  "timestamp": "2025-12-18T10:33:00Z",
  "status": "read"
}
```

**Resultado esperado**:
- HTTP 200 OK
- Mensaje actualizado:
  - `estado_meta` = "read"
  - `metadata_json` contiene `read_at`

---

#### TC-05: Manejar error de envío

**Payload**:
```json
{
  "evento": "message.failed",
  "mensaje_id": "11",
  "timestamp": "2025-12-18T10:34:00Z",
  "status": "failed",
  "error_code": "131047",
  "error_message": "More than 24 hours have passed"
}
```

**Resultado esperado**:
- HTTP 200 OK
- Mensaje actualizado:
  - `estado` = "error_envio"
  - `estado_meta` = "failed"
  - `metadata_json` contiene `error_code` y `error_message`

---

#### TC-06: Validar empresa_id incorrecto (RF-6)

**Prerequisito**: Setting `meta_w_empresa_id` = "692d787d-06c4-432e-a94e-cf0686e593eb"

**Payload**:
```json
{
  "evento": "message.received",
  "mensaje_id": "test-wrong-empresa",
  "timestamp": "2025-12-18T10:35:00Z",
  "mensaje": {
    "empresa_id": "wrong-empresa-id-123",
    "celular_id": "14b530aa-ff61-44be-af48-957dabde4f28",
    "meta_message_id": "wamid.test_wrong_empresa",
    "from_phone": "+15559876543",
    "contenido": "Test empresa incorrecta"
  }
}
```

**Resultado esperado**:
- HTTP 400 Bad Request
- Error: "empresa_id del payload no coincide con el configurado en settings"

---

#### TC-07: Payload inválido (falta evento)

**Payload**:
```json
{
  "mensaje_id": "10",
  "timestamp": "2025-12-18T10:30:00Z"
}
```

**Resultado esperado**:
- HTTP 400 Bad Request
- Error: "Faltan campos requeridos"

---

#### TC-08: Mensaje no encontrado

**Payload**:
```json
{
  "evento": "message.sent",
  "mensaje_id": "999999",
  "timestamp": "2025-12-18T10:30:00Z",
  "status": "sent"
}
```

**Resultado esperado**:
- HTTP 400 Bad Request
- Error: "Mensaje no encontrado: 999999"

---

#### TC-09: Celular desconocido con auto-creación habilitada

**Prerequisito**: `meta_w_auto_create_celular` = "true"

**Payload**: mensaje.received con `celular_id` = "nuevo-celular-id"

**Resultado esperado**:
- HTTP 200 OK
- Nuevo registro en `crm_celulares` con `meta_celular_id` = "nuevo-celular-id"
- Mensaje creado correctamente

---

#### TC-10: Duplicado - mensaje con mismo meta_message_id

**Prerequisito**: Mensaje existente con `origen_externo_id` = "wamid.test123"

**Payload**: mensaje.received con `meta_message_id` = "wamid.test123"

**Resultado esperado**:
- HTTP 200 OK
- NO se crea nuevo mensaje
- Se retorna ID del mensaje existente

---

### 7.2. Casos de Prueba de Integración

#### TI-01: Flujo completo de mensaje saliente

1. Crear mensaje de tipo "salida" con estado "pendiente_envio"
2. Simular webhook `message.sent` → verificar `estado` = "enviado"
3. Simular webhook `message.delivered` → verificar `estado_meta` = "delivered"
4. Simular webhook `message.read` → verificar `estado_meta` = "read"

---

#### TI-02: Flujo completo de mensaje entrante

1. Simular webhook `message.received` con contacto nuevo
2. Verificar que se crea mensaje con `contacto_id` = NULL
3. Verificar que `contacto_nombre_propuesto` contiene el nombre del payload
4. Verificar que `contacto_referencia` contiene el teléfono

---

#### TI-03: Relacionar mensaje con oportunidad activa

1. Crear contacto con oportunidad en estado "1-abierta"
2. Simular webhook `message.received` con teléfono del contacto
3. Verificar que mensaje tiene `contacto_id` y `oportunidad_id` correctos

---

### 7.3. Casos de Prueba de Estrés

#### TS-01: Múltiples webhooks simultáneos

- Enviar 100 webhooks en paralelo
- Verificar que todos se procesan correctamente
- Verificar que no hay duplicados

---

#### TS-02: Webhooks con gran payload

- Payload con `texto` de 4000 caracteres
- Verificar que se almacena correctamente

---

### 7.4. Script de Testing

**Archivo**: `backend/tests/test_meta_webhook.py`

```python
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.main import app
from app.db import engine, get_session
from app.models import CRMMensaje, CRMCelular
from app.models.setting import Setting


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def session():
    with Session(engine) as session:
        yield session


def test_webhook_message_received(client, session):
    """TC-01: Recibir mensaje entrante nuevo"""
    payload = {
        "evento": "message.received",
        "mensaje_id": "test-msg-001",
        "timestamp": "2025-12-18T10:30:00Z",
        "mensaje": {
            "id": "test-msg-001",
            "empresa_id": "692d787d-06c4-432e-a94e-cf0686e593eb",
            "celular_id": "14b530aa-ff61-44be-af48-957dabde4f28",
            "tipo": "text",
            "direccion": "in",
            "from_phone": "5491156384310",
            "from_name": "Juan Pérez",
            "to_phone": "+15551676015",
            "texto": "Hola, necesito información",
            "status": "received",
            "meta_message_id": "wamid.test123",
            "celular": {
                "id": "14b530aa-ff61-44be-af48-957dabde4f28",
                "alias": "WhatsApp Business",
                "phone_number": "+15551676015"
            }
        }
    }
    
    response = client.post("/api/v1/webhooks/meta-w/whatsapp", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "mensaje_id" in data


def test_webhook_invalid_empresa_id(client, session):
    """TC-06: Validar empresa_id incorrecto (RF-6)"""
    # Poblar settings con empresa_id correcto
    setting = Setting(
        clave="meta_w_empresa_id",
        valor="692d787d-06c4-432e-a94e-cf0686e593eb",
        descripcion="ID de empresa en Meta-W"
    )
    session.add(setting)
    session.commit()
    
    # Enviar payload con empresa_id incorrecto
    payload = {
        "evento": "message.received",
        "mensaje_id": "test-wrong-empresa",
        "timestamp": "2025-12-18T10:35:00Z",
        "mensaje": {
            "empresa_id": "wrong-empresa-id-123",
            "celular_id": "14b530aa-test-celular",
            "meta_message_id": "wamid.test_wrong_empresa",
            "from_phone": "+15559876543",
            "contenido": "Test empresa incorrecta"
        }
    }
    
    response = client.post("/api/v1/webhooks/meta-w/whatsapp", json=payload)
    assert response.status_code == 400
    assert "empresa_id" in response.json()["detail"].lower()


def test_webhook_missing_fields(client):
    """TC-07: Payload inválido"""
    payload = {
        "mensaje_id": "10",
        "timestamp": "2025-12-18T10:30:00Z"
    }
    
    response = client.post("/api/v1/webhooks/meta-w/whatsapp", json=payload)
    
    assert response.status_code == 400
```

---

## 8. Documentación y Configuración

### 8.1. Actualizar documentación

**Archivo**: `doc/04-meta/INTEGRACION_FRONTEND.md`

Agregar sección:

```markdown
### Webhook Definitivo

**URL Producción**: `https://tu-backend.com/api/v1/webhooks/meta-w/whatsapp`

Este endpoint reemplaza al endpoint de testing `/api/v1/test/webhook`.

#### Configuración en Meta-W

Configurar en el módulo meta-w en GCP:

```python
webhook_url = "https://tu-backend.com/api/v1/webhooks/meta-w/whatsapp"
```

#### Headers enviados por Meta-W

- `Content-Type: application/json`
- `User-Agent: python-httpx/0.26.0`
```

---

### 8.2. Variables de entorno

**Archivo**: `backend/.env` (ejemplo)

```
# Meta WhatsApp Webhook Configuration
META_W_AUTO_CREATE_CELULAR=true
```

**Nota**: La configuración de celulares se maneja directamente en la tabla `crm_celulares`.

---

## 9. Plan de Implementación

### Fase 1: Modelo de Datos (Estimado: 2 horas)

1. ✓ Crear modelo `CRMCelular`
2. ✓ Modificar modelo `CRMMensaje` (agregar campos)
3. ✓ Crear modelo `WebhookLog`
4. ✓ Crear migraciones 023, 024, 025
5. ✓ Ejecutar migraciones en desarrollo

### Fase 2: Scripts de Poblado (Estimado: 1 hora)

6. ✓ Crear script `poblar_settings_meta_w.py`
7. ✓ Crear script `poblar_crm_celulares.py`
8. ✓ Ejecutar scripts

### Fase 3: Servicios y Lógica (Estimado: 4 horas)

9. ✓ Crear schemas `meta_webhook.py`
10. ✓ Crear servicio `MetaWebhookService`
11. ✓ Implementar handlers para cada evento
12. ✓ Implementar validación de empresa_id contra settings (RF-6)
13. ✓ Agregar logging de webhooks

### Fase 4: Router y Endpoints (Estimado: 2 horas)

14. ✓ Crear router `meta_webhook_router.py`
15. ✓ Integrar en `main.py`
16. ✓ Crear CRUD para `CRMCelular`
17. ✓ Crear router para administración de celulares

### Fase 5: Testing (Estimado: 3 horas)

18. ✓ Escribir tests unitarios
19. ✓ Ejecutar casos de prueba TC-01 a TC-10
20. ✓ Ejecutar casos de integración TI-01 a TI-03
21. ✓ Testing manual con payloads reales

### Fase 6: Documentación (Estimado: 1 hora)

22. ✓ Actualizar `INTEGRACION_FRONTEND.md`
23. ✓ Documentar configuración
24. ✓ Crear README de deployment

### Fase 7: Despliegue (Estimado: 2 horas)

25. ✓ Ejecutar migraciones en producción
26. ✓ Ejecutar scripts de poblado en producción
27. ✓ Configurar webhook_url en Meta-W
28. ✓ Validar funcionamiento en producción

---

## 10. Checklist de Verificación Final

### Modelos
- [ ] `CRMCelular` creado y funcional
- [ ] `CRMMensaje` con campos `estado_meta` y `celular_id`
- [ ] `WebhookLog` creado
- [ ] Relaciones correctas entre modelos

### Migraciones
- [ ] Migración 023: `crm_celulares` aplicada
- [ ] Migración 024: campos en `crm_mensajes` aplicada
- [ ] Migración 025: `webhook_logs_recibidos` aplicada
- [ ] Migraciones probadas en dev y staging

### Configuración
- [ ] Settings de Meta-W poblados
- [ ] Celulares iniciales poblados en `crm_celulares`

### Endpoints
- [ ] `POST /api/v1/webhooks/meta-w/whatsapp` funcional
- [ ] Logging de webhooks funcional
- [ ] Respuestas HTTP correctas (200, 400, 500)

### Eventos
- [ ] `message.received` crea mensajes correctamente
- [ ] `message.sent` actualiza estado a ENVIADO
- [ ] `message.delivered` actualiza metadata
- [ ] `message.read` actualiza metadata
- [ ] `message.failed` marca como ERROR_ENVIO

### Testing
- [ ] Tests unitarios pasando
- [ ] Tests de integración pasando
- [ ] Testing manual completado
- [ ] Casos de prueba TC-01 a TC-10 verificados

### Documentación
- [ ] `INTEGRACION_FRONTEND.md` actualizado
- [ ] README con instrucciones de despliegue
- [ ] Ejemplos de payloads documentados

### Producción
- [ ] Migraciones aplicadas en prod
- [ ] Settings configurados en prod
- [ ] Webhook URL configurada en Meta-W
- [ ] Monitoreo de logs configurado
- [ ] Primer mensaje de prueba exitoso

---

## 11. Consideraciones Adicionales

### 11.1. Seguridad

- Implementar rate limiting en el endpoint del webhook
- Considerar IP whitelisting si Meta-W tiene IPs fijas
- Logging de todos los webhooks recibidos para auditoría
- Sanitizar datos de entrada antes de guardar

### 11.2. Performance

- Índices en campos clave (`estado_meta`, `celular_id`, `origen_externo_id`)
- Considerar queue/background jobs para procesamiento si el volumen es alto
- Cache de configuraciones de settings

### 11.3. Monitoreo

- Alertas cuando falla procesamiento de webhooks
- Dashboard con métricas de mensajes por estado
- Logs centralizados para debugging

### 11.4. Rollback

Si es necesario revertir:

```sql
-- Rollback migración 025
DROP TABLE webhook_logs_recibidos;

-- Rollback migración 024
ALTER TABLE crm_mensajes DROP CONSTRAINT fk_crm_mensajes_celular_id;
ALTER TABLE crm_mensajes DROP COLUMN celular_id;
ALTER TABLE crm_mensajes DROP COLUMN estado_meta;

-- Rollback migración 023
DROP TABLE crm_celulares;
```

---

**Última actualización**: 2025-12-18
**Versión**: 1.0
