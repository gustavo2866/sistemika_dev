"""
Servicio para procesar webhooks de Meta WhatsApp
"""
from datetime import datetime
from typing import Dict, Any, Optional
from uuid import UUID
import logging

from sqlmodel import Session, select
from fastapi import HTTPException

from app.models import CRMMensaje, CRMCelular, CRMContacto, WebhookLog, CRMOportunidad
from app.models.enums import TipoMensaje, CanalMensaje, EstadoMensaje
from app.schemas.metaw_webhook import MetaWWebhookPayload
from app.crud.crm_mensaje_crud import crm_mensaje_crud
from app.crud.crm_contacto_crud import crm_contacto_crud
from app.models.base import current_utc_time

logger = logging.getLogger(__name__)


class MetaWebhookService:
    """Servicio para procesar eventos de webhooks de Meta WhatsApp"""

    def __init__(self, session: Session):
        self.session = session

    def _determinar_tipo_operacion_contacto(self, contacto_id: int) -> Optional[int]:
        """
        Determina el tipo de operación basado en propiedades activas del contacto.
        
        Retorna:
            - 3 (mantenimiento) si el contacto tiene propiedad con tipo_operacion_id=1 (alquiler)
              en estados operativos (3-disponible o 4-alquilada)
            - None en caso contrario
        """
        from app.models.propiedad import Propiedad
        
        # Buscar propiedades en alquiler activas y en estados operativos
        stmt = select(Propiedad).where(
            Propiedad.contacto_id == contacto_id,
            Propiedad.tipo_operacion_id == 1,  # Alquiler
            Propiedad.estado.in_(["3-disponible", "4-alquilada"])  # Estados operativos
        )
        propiedad_alquiler = self.session.exec(stmt).first()
        
        if propiedad_alquiler:
            logger.info(
                f"Contacto {contacto_id} tiene propiedad en alquiler (ID: {propiedad_alquiler.id}) "
                f"→ tipo_operacion=3 (mantenimiento)"
            )
            return 3
        
        return None

    def _ensure_crm_celular(self, meta_celular_id: str, numero_celular: str) -> CRMCelular:
        """
        Asegura que exista el CRMCelular.
        Lo crea automáticamente si no existe.
        """
        # Buscar por meta_celular_id
        stmt = select(CRMCelular).where(CRMCelular.meta_celular_id == meta_celular_id)
        celular = self.session.exec(stmt).first()
        
        if celular:
            return celular

        # No existe, crear automáticamente
        celular = CRMCelular(
            meta_celular_id=meta_celular_id,
            numero_celular=numero_celular,
            alias=f"Canal {numero_celular}",
            activo=True
        )
        self.session.add(celular)
        self.session.commit()
        self.session.refresh(celular)
        logger.info(f"CRMCelular auto-creado: {celular.id} - {numero_celular}")
        return celular

    def _find_or_create_contacto(self, numero_telefono: str, nombre_from_meta: Optional[str] = None) -> CRMContacto:
        """
        Busca o crea un contacto por número de teléfono.
        Busca en el array telefonos del contacto usando operador @> de PostgreSQL.
        """
        from sqlalchemy.dialects.postgresql import JSONB
        from sqlalchemy import cast
        from app.models.user import User
        
        # Buscar contacto existente usando operador @> (contains) de PostgreSQL
        # crm_contactos.telefonos @> '["numero"]'
        stmt = select(CRMContacto).where(
            cast(CRMContacto.telefonos, JSONB).op('@>')(
                cast([numero_telefono], JSONB)
            )
        )
        contacto = self.session.exec(stmt).first()
        
        if contacto:
            return contacto

        # Obtener el primer usuario como responsable por defecto
        usuario_default = self.session.exec(
            select(User).limit(1)
        ).first()
        
        if not usuario_default:
            raise ValueError("No hay usuarios activos para asignar como responsable")

        # Usar el nombre que viene de Meta (from_name) o generar uno por defecto
        nombre_contacto = nombre_from_meta or f"Contacto {numero_telefono}"
        
        # Crear nuevo contacto
        contacto_data = {
            "nombre_completo": nombre_contacto,
            "telefonos": [numero_telefono],
            "responsable_id": usuario_default.id,
        }
        contacto = crm_contacto_crud.create(self.session, contacto_data)
        logger.info(f"Contacto auto-creado: {contacto.id} - {nombre_contacto} ({numero_telefono}), responsable: {usuario_default.id}")
        return contacto

    def process_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Procesa el webhook de meta-w.
        Registra en WebhookLog y procesa el mensaje.
        """
        metaw_payload = MetaWWebhookPayload(**payload)
        msg = metaw_payload.mensaje
        
        log_entry = WebhookLog(
            evento=metaw_payload.event_type,
            payload=payload,
            procesado=False,
            fecha_recepcion=current_utc_time(),
        )
        self.session.add(log_entry)
        
        try:
            # Asegurar que existe el CRMCelular
            celular = self._ensure_crm_celular(
                str(msg.celular.id), 
                msg.celular.phone_number
            )
            
            # Si es mensaje entrante (direccion=in)
            if msg.direccion == "in":
                # Buscar o crear contacto (pasar from_name para usar el nombre de WhatsApp)
                contacto = self._find_or_create_contacto(msg.from_phone, msg.from_name)
                
                # Extraer contenido
                contenido = msg.texto or ""
                adjuntos = []
                
                if msg.media_id:
                    adjuntos.append({
                        "tipo": msg.tipo,
                        "id": msg.media_id,
                        "mime_type": msg.mime_type,
                        "filename": msg.filename,
                        "caption": msg.caption,
                    })
                    if msg.tipo == "image":
                        contenido = msg.caption or "[Imagen recibida]"
                    elif msg.tipo == "document":
                        contenido = f"[Documento: {msg.filename or 'archivo'}]"
                
                # Buscar oportunidad activa del contacto
                stmt_oport = select(CRMOportunidad).where(
                    CRMOportunidad.contacto_id == contacto.id,
                    CRMOportunidad.activo == True
                )
                oportunidad = self.session.exec(stmt_oport).first()
                
                # Si no existe oportunidad activa, crear una nueva en estado 0-prospect
                if not oportunidad:
                    from app.models.user import User
                    from app.models.enums import EstadoOportunidad
                    
                    # Obtener usuario por defecto para responsable
                    usuario_default = self.session.exec(select(User).limit(1)).first()
                    if not usuario_default:
                        raise ValueError("No hay usuarios activos para asignar como responsable")
                    
                    # Determinar tipo_operacion según propiedades del contacto
                    tipo_operacion_id = self._determinar_tipo_operacion_contacto(contacto.id)
                    
                    oportunidad = CRMOportunidad(
                        titulo="Nueva oportunidad desde WhatsApp",
                        contacto_id=contacto.id,
                        tipo_operacion_id=tipo_operacion_id,
                        estado=EstadoOportunidad.PROSPECT.value,
                        responsable_id=usuario_default.id,
                        activo=True
                    )
                    self.session.add(oportunidad)
                    self.session.flush()  # Para obtener el ID
                    logger.info(
                        f"Oportunidad auto-creada: {oportunidad.id} para contacto {contacto.id} "
                        f"en estado {EstadoOportunidad.PROSPECT.value} "
                        f"con tipo_operacion_id={tipo_operacion_id}"
                    )

                # Normalizar meta_timestamp: Meta-w envía en hora Argentina (UTC-3)
                # Necesitamos convertir a UTC para consistencia
                from datetime import UTC
                from zoneinfo import ZoneInfo
                
                fecha_mensaje_utc = msg.meta_timestamp
                if fecha_mensaje_utc.tzinfo is None:
                    # Asumir que es hora Argentina y convertir a UTC
                    argentina_tz = ZoneInfo("America/Argentina/Buenos_Aires")
                    fecha_mensaje_arg = fecha_mensaje_utc.replace(tzinfo=argentina_tz)
                    fecha_mensaje_utc = fecha_mensaje_arg.astimezone(UTC)
                
                mensaje_data = {
                    "tipo": TipoMensaje.ENTRADA.value,
                    "canal": CanalMensaje.WHATSAPP.value,
                    "contacto_id": contacto.id,
                    "contacto_referencia": msg.from_phone,
                    "estado": EstadoMensaje.NUEVO.value,
                    "contenido": contenido,
                    "origen_externo_id": msg.meta_message_id,
                    "adjuntos": adjuntos,
                    "celular_id": celular.id,
                    "fecha_mensaje": fecha_mensaje_utc,
                    "estado_meta": msg.status,
                    "oportunidad_id": oportunidad.id,  # Siempre hay oportunidad ahora
                    "metadata_json": {
                        "from_name": msg.from_name,
                        "metaw_id": str(msg.id),
                    }
                }

                crm_mensaje = crm_mensaje_crud.create(self.session, mensaje_data)
                logger.info(f"Mensaje entrante creado: {crm_mensaje.id} de contacto {contacto.id} con oportunidad {oportunidad.id}")
            
            elif msg.direccion == "out":
                # Es un mensaje saliente, actualizar estado
                stmt = select(CRMMensaje).where(
                    CRMMensaje.origen_externo_id == msg.meta_message_id
                )
                mensaje = self.session.exec(stmt).first()
                
                if mensaje:
                    # Actualizar estado_meta
                    mensaje.estado_meta = msg.status
                    
                    # Actualizar fecha_estado con el timestamp de Meta (normalizado a UTC)
                    from datetime import UTC
                    from zoneinfo import ZoneInfo
                    
                    fecha_estado_utc = msg.meta_timestamp
                    if fecha_estado_utc and fecha_estado_utc.tzinfo is None:
                        # Asumir que es hora Argentina y convertir a UTC
                        argentina_tz = ZoneInfo("America/Argentina/Buenos_Aires")
                        fecha_estado_arg = fecha_estado_utc.replace(tzinfo=argentina_tz)
                        fecha_estado_utc = fecha_estado_arg.astimezone(UTC)
                    
                    if fecha_estado_utc:
                        mensaje.fecha_estado = fecha_estado_utc
                    
                    self.session.add(mensaje)
                    self.session.commit()
                    logger.info(f"Estado actualizado para mensaje {mensaje.id}: {msg.status} a las {mensaje.fecha_estado}")
                else:
                    logger.warning(f"Mensaje saliente no encontrado para meta_message_id: {msg.meta_message_id}")

            # Marcar como procesado
            log_entry.procesado = True
            log_entry.response_status = 200
            self.session.add(log_entry)
            self.session.commit()

            return {"status": "ok", "message": "Webhook procesado exitosamente"}

        except Exception as e:
            logger.error(f"Error procesando webhook: {str(e)}", exc_info=True)
            log_entry.procesado = False
            log_entry.error_message = str(e)
            log_entry.response_status = 500
            self.session.add(log_entry)
            self.session.commit()
            raise
