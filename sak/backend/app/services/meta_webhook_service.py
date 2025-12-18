"""
Servicio para procesar webhooks de Meta WhatsApp
"""
from datetime import datetime
from typing import Dict, Any, Optional
from uuid import UUID
import logging

from sqlmodel import Session, select
from fastapi import HTTPException

from app.models import CRMMensaje, CRMCelular, CRMContacto, WebhookLog, Setting
from app.models.enums import TipoMensaje, CanalMensaje, EstadoMensaje
from app.schemas.meta_webhook import (
    WebhookEventPayload,
    MensajeWebhook,
    StatusWebhook,
)
from app.crud.crm_mensaje_crud import crm_mensaje_crud
from app.crud.crm_contacto_crud import crm_contacto_crud
from app.models.base import current_utc_time

logger = logging.getLogger(__name__)


class MetaWebhookService:
    """Servicio para procesar eventos de webhooks de Meta WhatsApp"""

    def __init__(self, session: Session):
        self.session = session

    def _get_setting_value(self, clave: str) -> Optional[str]:
        """Obtiene un valor de la tabla settings"""
        stmt = select(Setting).where(Setting.clave == clave)
        setting = self.session.exec(stmt).first()
        return setting.valor if setting else None

    def _validate_empresa_id(self, empresa_id: str) -> None:
        """Valida que el empresa_id coincida con el configurado"""
        meta_empresa_id = self._get_setting_value("meta_w_empresa_id")
        if not meta_empresa_id:
            raise HTTPException(
                status_code=500,
                detail="meta_w_empresa_id no configurado en settings"
            )
        if empresa_id != meta_empresa_id:
            raise HTTPException(
                status_code=403,
                detail=f"empresa_id no coincide. Esperado: {meta_empresa_id}, Recibido: {empresa_id}"
            )

    def _ensure_crm_celular(self, meta_celular_id: str, numero_celular: str) -> CRMCelular:
        """
        Asegura que exista el CRMCelular.
        Si meta_w_auto_create_celular=true, lo crea automáticamente.
        """
        # Buscar por meta_celular_id
        stmt = select(CRMCelular).where(CRMCelular.meta_celular_id == meta_celular_id)
        celular = self.session.exec(stmt).first()
        
        if celular:
            return celular

        # No existe, verificar si auto-crear
        auto_create = self._get_setting_value("meta_w_auto_create_celular")
        if auto_create != "true":
            raise HTTPException(
                status_code=404,
                detail=f"CRMCelular con meta_celular_id={meta_celular_id} no encontrado y auto_create deshabilitado"
            )

        # Crear automáticamente
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

    def _find_or_create_contacto(self, numero_telefono: str) -> CRMContacto:
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

        # Crear nuevo contacto
        contacto_data = {
            "nombre_completo": f"Contacto {numero_telefono}",
            "telefonos": [numero_telefono],
            "responsable_id": usuario_default.id,
        }
        contacto = crm_contacto_crud.create(self.session, contacto_data)
        logger.info(f"Contacto auto-creado: {contacto.id} - {numero_telefono}, responsable: {usuario_default.id}")
        return contacto

    def _handle_message_received(self, value: Dict[str, Any], celular: CRMCelular) -> None:
        """Procesa mensaje entrante (message.received)"""
        messages = value.get("messages", [])
        contacts = value.get("contacts", [])

        for msg_data in messages:
            mensaje = MensajeWebhook(**msg_data)
            
            # Buscar o crear contacto
            contacto = self._find_or_create_contacto(mensaje.from_)

            # Extraer contenido según tipo
            contenido = None
            adjuntos = []
            
            if mensaje.type == "text" and mensaje.text:
                contenido = mensaje.text.get("body", "")
            elif mensaje.type == "image" and mensaje.image:
                adjuntos.append({
                    "tipo": "image",
                    "id": mensaje.image.get("id"),
                    "mime_type": mensaje.image.get("mime_type"),
                    "caption": mensaje.image.get("caption"),
                })
                contenido = mensaje.image.get("caption", "[Imagen recibida]")
            elif mensaje.type == "document" and mensaje.document:
                adjuntos.append({
                    "tipo": "document",
                    "id": mensaje.document.get("id"),
                    "mime_type": mensaje.document.get("mime_type"),
                    "filename": mensaje.document.get("filename"),
                })
                contenido = f"[Documento: {mensaje.document.get('filename', 'archivo')}]"

            # Crear CRMMensaje
            mensaje_data = {
                "tipo": TipoMensaje.ENTRADA.value,
                "canal": CanalMensaje.WHATSAPP.value,
                "contacto_id": contacto.id,
                "contacto_referencia": mensaje.from_,
                "estado": EstadoMensaje.NUEVO.value,
                "contenido": contenido,
                "origen_externo_id": mensaje.id,
                "adjuntos": adjuntos,
                "celular_id": celular.id,
                "fecha_mensaje": datetime.fromisoformat(mensaje.timestamp.replace("Z", "+00:00")),
            }

            # Si tiene context, es respuesta a un mensaje anterior
            if mensaje.context:
                # El context.id puede contener el mensaje_id (UUID) de SAK
                mensaje_data["metadata_json"] = {
                    "context": mensaje.context,
                }

            crm_mensaje = crm_mensaje_crud.create(self.session, mensaje_data)
            logger.info(f"Mensaje entrante creado: {crm_mensaje.id} de contacto {contacto.id}")

    def _handle_message_status(self, value: Dict[str, Any], celular: CRMCelular) -> None:
        """Procesa cambio de estado de mensaje (sent, delivered, read, failed)"""
        statuses = value.get("statuses", [])

        for status_data in statuses:
            status = StatusWebhook(**status_data)
            
            # Buscar el mensaje por origen_externo_id (que contiene el ID de Meta)
            stmt = select(CRMMensaje).where(
                CRMMensaje.origen_externo_id == status.id
            )
            mensaje = self.session.exec(stmt).first()

            if not mensaje:
                logger.warning(f"Mensaje no encontrado para status update: {status.id}")
                continue

            # Actualizar estado_meta
            mensaje.estado_meta = status.status
            
            # Si falló, agregar error al metadata
            if status.status == "failed" and status.errors:
                if not mensaje.metadata_json:
                    mensaje.metadata_json = {}
                mensaje.metadata_json["meta_errors"] = status.errors

            self.session.add(mensaje)
            self.session.commit()
            logger.info(f"Estado actualizado para mensaje {mensaje.id}: {status.status}")

    def process_webhook(self, payload: WebhookEventPayload) -> Dict[str, Any]:
        """
        Procesa el webhook completo de Meta WhatsApp.
        Registra en WebhookLog y delega a handlers específicos.
        """
        log_entry = WebhookLog(
            evento="webhook_received",
            payload=payload.model_dump(),
            procesado=False,
            fecha_recepcion=current_utc_time(),
        )
        self.session.add(log_entry)
        
        try:
            for entry in payload.entry:
                # Validar empresa_id
                self._validate_empresa_id(entry.id)

                for change in entry.changes:
                    value = change.get("value", {})
                    field = change.get("field")

                    # Obtener metadata del celular
                    metadata = value.get("metadata", {})
                    phone_number_id = metadata.get("phone_number_id")
                    display_phone_number = metadata.get("display_phone_number", "")

                    if not phone_number_id:
                        logger.warning("Webhook sin phone_number_id en metadata")
                        continue

                    # Asegurar que existe el CRMCelular
                    celular = self._ensure_crm_celular(phone_number_id, display_phone_number)

                    # Procesar según el tipo de cambio
                    if field == "messages":
                        if "messages" in value:
                            self._handle_message_received(value, celular)
                        if "statuses" in value:
                            self._handle_message_status(value, celular)

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
