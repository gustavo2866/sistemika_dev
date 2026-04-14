"""
Servicio para procesar webhooks de Meta WhatsApp
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from sqlalchemy import func
from sqlmodel import Session, select

from agente.v2.core.orchestrator import AgentTurnOrchestrator
from agente.v2.core.delivery import TurnDeliveryService
from agente.v2.core.runtime import should_auto_process
from agente.v2.processes.solicitud_materiales.handler import build_v2_dependencies
from app.crud.crm_contacto_crud import crm_contacto_crud
from app.crud.crm_mensaje_crud import crm_mensaje_crud
from app.models import CRMCelular, CRMContacto, CRMMensaje, CRMOportunidad, WebhookLog
from app.models.base import current_utc_time
from app.models.enums import CanalMensaje, EstadoMensaje, TipoMensaje
from app.schemas.metaw_webhook import MetaWWebhookPayload

logger = logging.getLogger(__name__)


class MetaWebhookService:
    """Servicio para procesar eventos de webhooks de Meta WhatsApp."""

    def __init__(
        self,
        session: Session,
        *,
        orchestrator: AgentTurnOrchestrator | None = None,
    ) -> None:
        self.session = session
        if orchestrator is None:
            state_store, agent = build_v2_dependencies(session=session)
            orchestrator = AgentTurnOrchestrator(
                processes=[agent],
                state_store=state_store,
            )
        self._orchestrator = orchestrator
        self._delivery_service = TurnDeliveryService()

    def _determinar_tipo_operacion_contacto(self, contacto_id: int) -> Optional[int]:
        """
        Determina el tipo de operación basado en propiedades activas del contacto.

        Retorna:
            - 3 (mantenimiento) si el contacto tiene propiedad con tipo_operacion_id=1 (alquiler)
              en estados operativos (3-disponible o 4-alquilada)
            - None en caso contrario
        """
        from app.models.propiedad import Propiedad, PropiedadesStatus

        stmt = (
            select(Propiedad)
            .join(PropiedadesStatus, Propiedad.propiedad_status_id == PropiedadesStatus.id, isouter=True)
            .where(
                Propiedad.contacto_id == contacto_id,
                Propiedad.tipo_operacion_id == 1,
                func.lower(PropiedadesStatus.nombre).op("~")("disponible|realizada|alquilada"),
            )
        )
        propiedad_alquiler = self.session.exec(stmt).first()

        if propiedad_alquiler:
            logger.info(
                "Contacto %s tiene propiedad en alquiler (ID: %s) -> tipo_operacion=3 (mantenimiento)",
                contacto_id,
                propiedad_alquiler.id,
            )
            return 3

        return None

    def _ensure_crm_celular(self, meta_celular_id: str, numero_celular: str) -> CRMCelular:
        """
        Asegura que exista el CRMCelular.
        Busca por meta_celular_id primero, luego por numero_celular para evitar duplicados.
        """
        celular = self.session.exec(
            select(CRMCelular).where(CRMCelular.meta_celular_id == meta_celular_id)
        ).first()
        if celular:
            return celular

        celular_existente = self.session.exec(
            select(CRMCelular).where(CRMCelular.numero_celular == numero_celular)
        ).first()
        if celular_existente:
            celular_existente.meta_celular_id = meta_celular_id
            self.session.add(celular_existente)
            self.session.commit()
            self.session.refresh(celular_existente)
            logger.info(
                "CRMCelular actualizado: %s - nuevo meta_id: %s",
                celular_existente.id,
                meta_celular_id,
            )
            return celular_existente

        celular = CRMCelular(
            meta_celular_id=meta_celular_id,
            numero_celular=numero_celular,
            alias=f"Canal {numero_celular}",
            activo=True,
        )
        self.session.add(celular)
        self.session.commit()
        self.session.refresh(celular)
        logger.info("CRMCelular auto-creado: %s - %s", celular.id, numero_celular)
        return celular

    def _find_or_create_contacto(
        self,
        numero_telefono: str,
        nombre_from_meta: Optional[str] = None,
    ) -> CRMContacto:
        """
        Busca o crea un contacto por número de teléfono.
        Busca en el array telefonos del contacto usando operador @> de PostgreSQL.
        """
        from sqlalchemy import cast
        from sqlalchemy.dialects.postgresql import JSONB
        from app.models.user import User

        stmt = select(CRMContacto).where(
            cast(CRMContacto.telefonos, JSONB).op("@>")(cast([numero_telefono], JSONB))
        )
        contacto = self.session.exec(stmt).first()
        if contacto:
            return contacto

        usuario_default = self.session.exec(select(User).limit(1)).first()
        if not usuario_default:
            raise ValueError("No hay usuarios activos para asignar como responsable")

        nombre_contacto = nombre_from_meta or f"Contacto {numero_telefono}"
        contacto = crm_contacto_crud.create(
            self.session,
            {
                "nombre_completo": nombre_contacto,
                "telefonos": [numero_telefono],
                "responsable_id": usuario_default.id,
            },
        )
        logger.info(
            "Contacto auto-creado: %s - %s (%s), responsable: %s",
            contacto.id,
            nombre_contacto,
            numero_telefono,
            usuario_default.id,
        )
        return contacto

    def _find_existing_inbound_message(self, external_message_id: str) -> CRMMensaje | None:
        return self.session.exec(
            select(CRMMensaje)
            .where(CRMMensaje.deleted_at.is_(None))
            .where(CRMMensaje.tipo == TipoMensaje.ENTRADA.value)
            .where(CRMMensaje.origen_externo_id == external_message_id)
            .limit(1)
        ).first()

    def _normalize_message_content(self, msg: Any) -> tuple[str, list[dict[str, Any]]]:
        contenido = msg.texto or ""
        adjuntos: list[dict[str, Any]] = []

        if msg.media_id:
            adjuntos.append(
                {
                    "tipo": msg.tipo,
                    "id": msg.media_id,
                    "mime_type": msg.mime_type,
                    "filename": msg.filename,
                    "caption": msg.caption,
                }
            )
            if msg.tipo == "image":
                contenido = msg.caption or "[Imagen recibida]"
            elif msg.tipo == "document":
                contenido = f"[Documento: {msg.filename or 'archivo'}]"

        return contenido, adjuntos

    def _resolve_or_create_oportunidad(self, contacto: CRMContacto) -> CRMOportunidad:
        oportunidad = self.session.exec(
            select(CRMOportunidad).where(
                CRMOportunidad.contacto_id == contacto.id,
                CRMOportunidad.activo == True,  # noqa: E712
            )
        ).first()
        if oportunidad:
            return oportunidad

        from app.models.enums import EstadoOportunidad
        from app.models.user import User

        usuario_default = self.session.exec(select(User).limit(1)).first()
        if not usuario_default:
            raise ValueError("No hay usuarios activos para asignar como responsable")

        tipo_operacion_id = self._determinar_tipo_operacion_contacto(contacto.id)
        oportunidad = CRMOportunidad(
            titulo="Nueva oportunidad desde WhatsApp",
            contacto_id=contacto.id,
            tipo_operacion_id=tipo_operacion_id,
            estado=EstadoOportunidad.PROSPECT.value,
            responsable_id=usuario_default.id,
            activo=True,
        )
        self.session.add(oportunidad)
        self.session.flush()
        logger.info(
            "Oportunidad auto-creada: %s para contacto %s en estado %s con tipo_operacion_id=%s",
            oportunidad.id,
            contacto.id,
            oportunidad.estado,
            tipo_operacion_id,
        )
        return oportunidad

    @staticmethod
    def _normalize_timestamp_to_utc(raw_timestamp):
        from datetime import UTC
        from zoneinfo import ZoneInfo

        timestamp_utc = raw_timestamp
        if timestamp_utc and timestamp_utc.tzinfo is None:
            argentina_tz = ZoneInfo("America/Argentina/Buenos_Aires")
            timestamp_arg = timestamp_utc.replace(tzinfo=argentina_tz)
            timestamp_utc = timestamp_arg.astimezone(UTC)
        return timestamp_utc

    async def _handle_inbound_message(self, msg: Any, celular: CRMCelular) -> dict[str, Any]:
        crm_mensaje = self._find_existing_inbound_message(msg.meta_message_id)
        if crm_mensaje:
            logger.info(
                "Mensaje entrante duplicado detectado para meta_message_id=%s",
                msg.meta_message_id,
            )
        else:
            contacto = self._find_or_create_contacto(msg.from_phone, msg.from_name)
            oportunidad = self._resolve_or_create_oportunidad(contacto)
            contenido, adjuntos = self._normalize_message_content(msg)
            fecha_mensaje_utc = self._normalize_timestamp_to_utc(msg.meta_timestamp)

            crm_mensaje = crm_mensaje_crud.create(
                self.session,
                {
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
                    "oportunidad_id": oportunidad.id,
                    "metadata_json": {
                        "from_name": msg.from_name,
                        "metaw_id": str(msg.id),
                    },
                },
            )
            self.session.commit()
            self.session.refresh(crm_mensaje)
            logger.info(
                "Mensaje entrante creado: %s de contacto %s con oportunidad %s",
                crm_mensaje.id,
                contacto.id,
                oportunidad.id,
            )

        auto_process_result = None
        if should_auto_process(session=self.session):
            auto_process_result = await self._orchestrator.process_turn(
                self.session,
                crm_mensaje.id,
                "webhook",
            )
            delivery = await self._delivery_service.deliver_result(
                session=self.session,
                message=crm_mensaje,
                result=auto_process_result,
            )
            self._delivery_service.mark_inbound_as_processed(self.session, crm_mensaje)
            auto_process_result = {
                **auto_process_result,
                "delivery": delivery.to_dict(),
            }
            metadata = dict(crm_mensaje.metadata_json or {})
            agent_meta = dict(metadata.get("agent_v2") or {})
            agent_meta["delivery"] = delivery.to_dict()
            if delivery.outbound_message_id is not None:
                agent_meta["outbound_message_id"] = delivery.outbound_message_id
            metadata["agent_v2"] = agent_meta
            crm_mensaje.metadata_json = metadata
            self.session.add(crm_mensaje)
            self.session.commit()
            self.session.refresh(crm_mensaje)

        payload = {
            "status": "ok",
            "message": "Webhook procesado exitosamente",
            "mensaje_id": crm_mensaje.id,
            "oportunidad_id": crm_mensaje.oportunidad_id,
            "agent_result": auto_process_result,
        }
        return payload

    def _handle_outbound_status(self, msg: Any) -> None:
        mensaje = self.session.exec(
            select(CRMMensaje).where(CRMMensaje.origen_externo_id == msg.meta_message_id)
        ).first()
        if not mensaje:
            logger.warning("Mensaje saliente no encontrado para meta_message_id: %s", msg.meta_message_id)
            return

        mensaje.estado_meta = msg.status
        fecha_estado_utc = self._normalize_timestamp_to_utc(msg.meta_timestamp)
        if fecha_estado_utc:
            mensaje.fecha_estado = fecha_estado_utc
        self.session.add(mensaje)
        self.session.commit()
        logger.info(
            "Estado actualizado para mensaje %s: %s a las %s",
            mensaje.id,
            msg.status,
            mensaje.fecha_estado,
        )

    async def process_webhook(self, payload: dict[str, Any]) -> dict[str, Any]:
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
            celular = self._ensure_crm_celular(
                str(msg.celular.id),
                msg.celular.phone_number,
            )

            if msg.direccion == "in":
                result = await self._handle_inbound_message(msg, celular)
            else:
                self._handle_outbound_status(msg)
                result = {"status": "ok", "message": "Webhook procesado exitosamente"}

            log_entry.procesado = True
            log_entry.response_status = 200
            self.session.add(log_entry)
            self.session.commit()
            return result

        except Exception as exc:
            logger.error("Error procesando webhook: %s", str(exc), exc_info=True)
            log_entry.procesado = False
            log_entry.error_message = str(exc)
            log_entry.response_status = 500
            self.session.add(log_entry)
            self.session.commit()
            raise
