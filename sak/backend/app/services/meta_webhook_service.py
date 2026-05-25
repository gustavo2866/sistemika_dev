"""
Servicio para procesar webhooks de Meta WhatsApp
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Optional

from sqlalchemy import func
from sqlmodel import Session, select

from app.db import engine
from agente.v2.core.orchestrator import AgentTurnOrchestrator
from agente.v2.core.delivery import TurnDeliveryService
from agente.v2.core.runtime import should_auto_process
from agente.v2.processes.pedido_obra.handler import build_pedido_obra_dependencies
from app.modules.channels.config import meta_account_resolver
from app.modules.channels.gateway import channel_gateway
from app.modules.channels.providers.meta.client import meta_graph_client
from app.modules.channels.types import ChannelEventData
from app.crud.crm_contacto_crud import crm_contacto_crud
from app.crud.crm_mensaje_crud import crm_mensaje_crud
from app.models import CRMCelular, CRMContacto, CRMMensaje, CRMOportunidad, WebhookLog
from app.models.base import current_utc_time
from app.models.enums import CanalMensaje, EstadoMensaje, TipoMensaje
from app.schemas.channel_webhook import ChannelWebhookPayload
from app.services.constructora_pedido_service import constructora_pedido_service
from app.services.audio_transcription_service import audio_transcription_service

logger = logging.getLogger(__name__)
_typing_indicator_tasks: set[asyncio.Task[None]] = set()


def _audio_filename(media_id: str, mime_type: str | None) -> str:
    extension = "ogg"
    normalized = (mime_type or "").split(";")[0].strip().lower()
    if normalized == "audio/mpeg":
        extension = "mp3"
    elif normalized in {"audio/mp4", "audio/m4a"}:
        extension = "m4a"
    elif normalized == "audio/wav":
        extension = "wav"
    elif normalized == "audio/webm":
        extension = "webm"
    return f"{media_id}.{extension}"


def _has_failed_audio_transcription(message: CRMMensaje) -> bool:
    for adjunto in message.adjuntos or []:
        if not isinstance(adjunto, dict):
            continue
        if adjunto.get("tipo") == "audio" and adjunto.get("transcription_status") == "failed":
            return True
    return False


def _audio_transcription_failed_result(message_id: int) -> dict[str, Any]:
    return {
        "type": "audio_transcription_failed",
        "message_id": message_id,
        "skipped": True,
        "respuesta": "No pude procesar el audio. Podes mandarme el pedido por escrito?",
    }


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
            state_store, agent = build_pedido_obra_dependencies(session=session)
            orchestrator = AgentTurnOrchestrator(
                processes=[agent],
                state_store=state_store,
                history_limit=0,
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
        t0 = time.perf_counter()
        celular = self.session.exec(
            select(CRMCelular).where(CRMCelular.meta_celular_id == meta_celular_id)
        ).first()
        if celular:
            logger.info(
                "Webhook timing ensure_celular meta_id=%s found_by_meta=%sms",
                meta_celular_id,
                round((time.perf_counter() - t0) * 1000),
            )
            return celular

        t_by_number = time.perf_counter()
        celular_existente = self.session.exec(
            select(CRMCelular).where(CRMCelular.numero_celular == numero_celular)
        ).first()
        if celular_existente:
            celular_existente.meta_celular_id = meta_celular_id
            self.session.add(celular_existente)
            t_commit = time.perf_counter()
            self.session.commit()
            self.session.refresh(celular_existente)
            logger.info(
                "CRMCelular actualizado: %s - nuevo meta_id: %s timing by_meta=%sms by_number=%sms commit_refresh=%sms total=%sms",
                celular_existente.id,
                meta_celular_id,
                round((t_by_number - t0) * 1000),
                round((t_commit - t_by_number) * 1000),
                round((time.perf_counter() - t_commit) * 1000),
                round((time.perf_counter() - t0) * 1000),
            )
            return celular_existente

        celular = CRMCelular(
            meta_celular_id=meta_celular_id,
            numero_celular=numero_celular,
            alias=f"Canal {numero_celular}",
            activo=True,
        )
        self.session.add(celular)
        t_commit = time.perf_counter()
        self.session.commit()
        self.session.refresh(celular)
        logger.info(
            "CRMCelular auto-creado: %s - %s timing by_meta=%sms by_number=%sms commit_refresh=%sms total=%sms",
            celular.id,
            numero_celular,
            round((t_by_number - t0) * 1000),
            round((t_commit - t_by_number) * 1000),
            round((time.perf_counter() - t_commit) * 1000),
            round((time.perf_counter() - t0) * 1000),
        )
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

        t0 = time.perf_counter()
        stmt = select(CRMContacto).where(
            cast(CRMContacto.telefonos, JSONB).op("@>")(cast([numero_telefono], JSONB))
        )
        contacto = self.session.exec(stmt).first()
        t_lookup = time.perf_counter()
        if contacto:
            logger.info(
                "Webhook timing contacto telefono=%s lookup=%sms found_id=%s",
                numero_telefono,
                round((t_lookup - t0) * 1000),
                contacto.id,
            )
            return contacto

        usuario_default = self.session.exec(select(User).limit(1)).first()
        t_user = time.perf_counter()
        if not usuario_default:
            raise ValueError("No hay usuarios activos para asignar como responsable")

        nombre_contacto = nombre_from_meta or f"Contacto {numero_telefono}"

        from sqlmodel import select as sqlmodel_select
        from app.models.crm.catalogos import CRMTipoContacto
        tipo_inmobiliaria = self.session.exec(
            sqlmodel_select(CRMTipoContacto).where(CRMTipoContacto.nombre == "Inmobiliaria")
        ).first()
        t_tipo = time.perf_counter()

        contacto = crm_contacto_crud.create(
            self.session,
            {
                "nombre_completo": nombre_contacto,
                "telefonos": [numero_telefono],
                "responsable_id": usuario_default.id,
                "tipo_id": tipo_inmobiliaria.id if tipo_inmobiliaria else None,
            },
        )
        logger.info(
            "Contacto auto-creado: %s - %s (%s), responsable: %s timing lookup=%sms user=%sms tipo=%sms create=%sms total=%sms",
            contacto.id,
            nombre_contacto,
            numero_telefono,
            usuario_default.id,
            round((t_lookup - t0) * 1000),
            round((t_user - t_lookup) * 1000),
            round((t_tipo - t_user) * 1000),
            round((time.perf_counter() - t_tipo) * 1000),
            round((time.perf_counter() - t0) * 1000),
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

    async def _normalize_message_content(
        self,
        msg: Any,
        celular: CRMCelular | None = None,
    ) -> tuple[str, list[dict[str, Any]]]:
        contenido = msg.texto or ""
        adjuntos: list[dict[str, Any]] = []

        if msg.media_id:
            adjunto = {
                "tipo": msg.tipo,
                "id": msg.media_id,
                "mime_type": msg.mime_type,
                "filename": msg.filename,
                "caption": msg.caption,
            }
            adjuntos.append(adjunto)
            if msg.tipo == "image":
                contenido = msg.caption or "[Imagen recibida]"
            elif msg.tipo == "document":
                contenido = f"[Documento: {msg.filename or 'archivo'}]"
            elif msg.tipo == "audio":
                contenido = await self._transcribe_audio_message(msg, celular, adjunto)

        return contenido, adjuntos

    async def _transcribe_audio_message(
        self,
        msg: Any,
        celular: CRMCelular | None,
        adjunto: dict[str, Any],
    ) -> str:
        try:
            if not celular or not celular.meta_celular_id:
                raise ValueError("No hay cuenta Meta asociada al audio")
            account_config = meta_account_resolver.resolve(self.session, str(celular.meta_celular_id))
            download = await meta_graph_client.download_media(
                access_token=account_config.access_token,
                media_id=msg.media_id,
            )
            mime_type = download.mime_type or msg.mime_type
            filename = msg.filename or _audio_filename(str(msg.media_id), mime_type)
            transcription = await audio_transcription_service.transcribe_bytes(
                download.content,
                filename=filename,
                mime_type=mime_type,
            )
            adjunto.update(
                {
                    "transcription": transcription,
                    "transcription_status": "ok",
                    "download_mime_type": download.mime_type,
                    "file_size": download.file_size,
                    "sha256": download.sha256,
                }
            )
            return transcription or "[Audio recibido]"
        except Exception as exc:
            logger.warning(
                "No se pudo transcribir audio meta_message_id=%s media_id=%s",
                getattr(msg, "meta_message_id", None),
                getattr(msg, "media_id", None),
                exc_info=True,
            )
            adjunto["transcription_status"] = "failed"
            adjunto["transcription_error"] = str(exc)
            return "[Audio recibido]"

    def _resolve_or_create_oportunidad(self, contacto: CRMContacto) -> CRMOportunidad:
        t0 = time.perf_counter()
        oportunidad = self.session.exec(
            select(CRMOportunidad).where(
                CRMOportunidad.contacto_id == contacto.id,
                CRMOportunidad.activo == True,  # noqa: E712
            )
        ).first()
        t_lookup = time.perf_counter()
        if oportunidad:
            logger.info(
                "Webhook timing oportunidad contacto_id=%s lookup=%sms found_id=%s",
                contacto.id,
                round((t_lookup - t0) * 1000),
                oportunidad.id,
            )
            return oportunidad

        from app.models.enums import EstadoOportunidad
        from app.models.user import User

        usuario_default = self.session.exec(select(User).limit(1)).first()
        t_user = time.perf_counter()
        if not usuario_default:
            raise ValueError("No hay usuarios activos para asignar como responsable")

        tipo_operacion_id = self._determinar_tipo_operacion_contacto(contacto.id)
        t_tipo_operacion = time.perf_counter()
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
            "Oportunidad auto-creada: %s para contacto %s en estado %s con tipo_operacion_id=%s timing lookup=%sms user=%sms tipo_operacion=%sms flush=%sms total=%sms",
            oportunidad.id,
            contacto.id,
            oportunidad.estado,
            tipo_operacion_id,
            round((t_lookup - t0) * 1000),
            round((t_user - t_lookup) * 1000),
            round((t_tipo_operacion - t_user) * 1000),
            round((time.perf_counter() - t_tipo_operacion) * 1000),
            round((time.perf_counter() - t0) * 1000),
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

    def _schedule_agent_typing_indicator(self, msg: Any, celular: CRMCelular) -> None:
        if not msg.meta_message_id:
            return
        task = asyncio.create_task(
            self._show_agent_typing_indicator(
                account_ref=str(celular.meta_celular_id),
                external_message_id=msg.meta_message_id,
                contact_address=msg.from_phone,
                business_address=celular.numero_celular or msg.to_phone,
            )
        )
        _typing_indicator_tasks.add(task)
        task.add_done_callback(_typing_indicator_tasks.discard)

    @staticmethod
    async def _show_agent_typing_indicator(
        *,
        account_ref: str,
        external_message_id: str,
        contact_address: str | None,
        business_address: str | None,
    ) -> None:
        try:
            with Session(engine) as session:
                await channel_gateway.show_typing(
                    session,
                    provider="meta",
                    channel_type="whatsapp",
                    account_ref=account_ref,
                    external_message_id=external_message_id,
                    contact_address=contact_address,
                    business_address=business_address,
                )
        except Exception:
            logger.warning(
                "No se pudo mostrar typing indicator para meta_message_id=%s",
                external_message_id,
                exc_info=True,
            )

    async def _handle_inbound_message(
        self,
        msg: Any,
        celular: CRMCelular,
        *,
        schedule_typing: bool = True,
    ) -> dict[str, Any]:
        t0 = time.perf_counter()
        t_lookup_start = time.perf_counter()
        crm_mensaje = self._find_existing_inbound_message(msg.meta_message_id)
        t_lookup_done = time.perf_counter()
        t_contact_done = t_lookup_done
        t_oportunidad_done = t_lookup_done
        t_content_done = t_lookup_done
        t_crud_create_done = t_lookup_done
        t_extra_commit_done = t_lookup_done
        t_refresh_done = t_lookup_done
        if crm_mensaje:
            logger.info(
                "Mensaje entrante duplicado detectado para meta_message_id=%s",
                msg.meta_message_id,
            )
        else:
            contacto = self._find_or_create_contacto(msg.from_phone, msg.from_name)
            t_contact_done = time.perf_counter()
            oportunidad = self._resolve_or_create_oportunidad(contacto)
            t_oportunidad_done = time.perf_counter()
            contenido, adjuntos = await self._normalize_message_content(msg, celular)
            fecha_mensaje_utc = self._normalize_timestamp_to_utc(msg.meta_timestamp)
            t_content_done = time.perf_counter()

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
                        "channel_message_id": str(msg.id),
                    },
                },
            )
            t_crud_create_done = time.perf_counter()
            self.session.commit()
            t_extra_commit_done = time.perf_counter()
            self.session.refresh(crm_mensaje)
            t_refresh_done = time.perf_counter()
            logger.info(
                "Mensaje entrante creado: %s de contacto %s con oportunidad %s",
                crm_mensaje.id,
                contacto.id,
                oportunidad.id,
            )
        t_message_ready = time.perf_counter()
        pre_agent_timing = {
            "find_existing_ms": round((t_lookup_done - t_lookup_start) * 1000),
            "contacto_ms": round((t_contact_done - t_lookup_done) * 1000),
            "oportunidad_ms": round((t_oportunidad_done - t_contact_done) * 1000),
            "normalize_ms": round((t_content_done - t_oportunidad_done) * 1000),
            "crm_create_crud_ms": round((t_crud_create_done - t_content_done) * 1000),
            "extra_commit_ms": round((t_extra_commit_done - t_crud_create_done) * 1000),
            "refresh_ms": round((t_refresh_done - t_extra_commit_done) * 1000),
            "message_ready_ms": round((t_message_ready - t0) * 1000),
        }
        logger.info(
            "Webhook inbound pre-agent timing meta_message_id=%s find_existing=%sms contacto=%sms oportunidad=%sms normalize=%sms crm_create_crud=%sms extra_commit=%sms refresh=%sms ready=%sms",
            msg.meta_message_id,
            pre_agent_timing["find_existing_ms"],
            pre_agent_timing["contacto_ms"],
            pre_agent_timing["oportunidad_ms"],
            pre_agent_timing["normalize_ms"],
            pre_agent_timing["crm_create_crud_ms"],
            pre_agent_timing["extra_commit_ms"],
            pre_agent_timing["refresh_ms"],
            pre_agent_timing["message_ready_ms"],
        )

        auto_process_result = await self.process_existing_inbound_message(
            crm_mensaje,
            trigger="webhook",
            schedule_typing=schedule_typing,
            typing_source=msg,
            celular=celular,
            started_at=t0,
            message_ready_ms=round((t_message_ready - t0) * 1000),
            pre_agent_timing=pre_agent_timing,
        )

        payload = {
            "status": "ok",
            "message": "Webhook procesado exitosamente",
            "mensaje_id": crm_mensaje.id,
            "oportunidad_id": crm_mensaje.oportunidad_id,
            "agent_result": auto_process_result,
            "_timing": {
                "message_ready_ms": round((t_message_ready - t0) * 1000),
                "total_ms": round((time.perf_counter() - t0) * 1000),
            },
        }
        return payload

    async def process_existing_inbound_message(
        self,
        crm_mensaje: CRMMensaje,
        *,
        trigger: str = "webhook_retry",
        schedule_typing: bool = False,
        typing_source: Any | None = None,
        celular: CRMCelular | None = None,
        started_at: float | None = None,
        message_ready_ms: int | None = None,
        pre_agent_timing: dict[str, int] | None = None,
    ) -> dict[str, Any] | None:
        """
        Procesa con agente un mensaje entrante ya persistido.

        Es idempotente: si el mensaje ya tiene resultado o ya fue marcado como
        entregado, no vuelve a enviar respuesta al canal.
        """
        metadata = dict(crm_mensaje.metadata_json or {})
        agent_meta = dict(metadata.get("agent_v2") or {})
        cached_result = agent_meta.get("result")
        if isinstance(cached_result, dict):
            self._ensure_constructora_pedido_from_agent_result(crm_mensaje, cached_result)
            return {**cached_result, "message_id": crm_mensaje.id, "cached": True}
        if agent_meta.get("delivery_processed_at"):
            return {
                "type": "already_delivered",
                "skipped": True,
                "message_id": crm_mensaje.id,
                "cached": True,
            }

        if not should_auto_process(session=self.session):
            return None

        if schedule_typing and typing_source is not None and celular is not None:
            self._schedule_agent_typing_indicator(typing_source, celular)

        t0 = started_at or time.perf_counter()
        t_agent_start = time.perf_counter()
        if _has_failed_audio_transcription(crm_mensaje):
            auto_process_result = _audio_transcription_failed_result(int(crm_mensaje.id))
        else:
            auto_process_result = await self._orchestrator.process_turn(
                self.session,
                crm_mensaje.id,
                trigger,
            )
        t_agent_done = time.perf_counter()
        delivery = await self._delivery_service.deliver_result(
            session=self.session,
            message=crm_mensaje,
            result=auto_process_result,
        )
        t_delivery_done = time.perf_counter()
        self._delivery_service.mark_inbound_as_processed(self.session, crm_mensaje)
        auto_process_result = {
            **auto_process_result,
            "delivery": delivery.to_dict(),
            "_timing": {
                "message_ready_ms": message_ready_ms if message_ready_ms is not None else 0,
                "pre_agent": pre_agent_timing or {},
                "agent_ms": round((t_agent_done - t_agent_start) * 1000),
                "delivery_ms": round((t_delivery_done - t_agent_done) * 1000),
                "total_before_metadata_ms": round((t_delivery_done - t0) * 1000),
            },
        }

        metadata = dict(crm_mensaje.metadata_json or {})
        agent_meta = dict(metadata.get("agent_v2") or {})
        agent_meta["result"] = auto_process_result
        agent_meta["delivery"] = delivery.to_dict()
        if delivery.outbound_message_id is not None:
            agent_meta["outbound_message_id"] = delivery.outbound_message_id
        metadata["agent_v2"] = agent_meta
        crm_mensaje.metadata_json = metadata
        self.session.add(crm_mensaje)
        self.session.commit()
        self.session.refresh(crm_mensaje)
        self._ensure_constructora_pedido_from_agent_result(crm_mensaje, auto_process_result)
        return auto_process_result

    def _ensure_constructora_pedido_from_agent_result(
        self,
        crm_mensaje: CRMMensaje,
        result: dict[str, Any],
    ) -> None:
        if result.get("type") != "pedido_obra_reply" or not result.get("pedido_listo"):
            return

        metadata = dict(crm_mensaje.metadata_json or {})
        agent_meta = dict(metadata.get("agent_v2") or {})
        if agent_meta.get("pedido_obra_id"):
            return

        try:
            pedido = constructora_pedido_service.create_from_agent_message(
                self.session,
                int(crm_mensaje.id),
            )
            logger.info(
                "Pedido de obra creado desde agente mensaje_id=%s pedido_id=%s",
                crm_mensaje.id,
                pedido.id,
            )
            self.session.refresh(crm_mensaje)
        except Exception:
            self.session.rollback()
            logger.exception(
                "No se pudo crear pedido de obra desde agente mensaje_id=%s",
                crm_mensaje.id,
            )

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
        Procesa un payload normalizado del modulo channel.
        Registra en WebhookLog y procesa el mensaje.
        """
        t_parse_start = time.perf_counter()
        channel_payload = ChannelWebhookPayload(**payload)
        msg = channel_payload.mensaje
        t0 = t_parse_start
        t_parse_done = time.perf_counter()

        log_entry = WebhookLog(
            evento=channel_payload.event_type,
            payload=payload,
            procesado=False,
            fecha_recepcion=current_utc_time(),
        )
        self.session.add(log_entry)
        t_log_added = time.perf_counter()

        try:
            auto_process = msg.direccion == "in" and should_auto_process(session=self.session)
            t_mode_done = time.perf_counter()
            if auto_process:
                task = asyncio.create_task(
                    self._show_agent_typing_indicator(
                        account_ref=str(msg.celular.id),
                        external_message_id=msg.meta_message_id,
                        contact_address=msg.from_phone,
                        business_address=msg.to_phone or msg.celular.phone_number,
                    )
                )
                _typing_indicator_tasks.add(task)
                task.add_done_callback(_typing_indicator_tasks.discard)
            t_typing_scheduled = time.perf_counter()

            event_direction = "inbound" if msg.direccion == "in" else "status"
            channel_gateway.record_event(
                self.session,
                ChannelEventData(
                    provider="meta",
                    channel_type="whatsapp",
                    account_ref=str(msg.celular.id),
                    direction=event_direction,
                    from_address=msg.from_phone,
                    to_address=msg.to_phone,
                    external_message_id=msg.meta_message_id,
                    status=msg.status,
                    occurred_at=self._normalize_timestamp_to_utc(msg.meta_timestamp),
                    raw_payload=payload,
                    normalized_payload=msg.model_dump(mode="json"),
                ),
            )
            t_record_event_done = time.perf_counter()

            celular = self._ensure_crm_celular(
                str(msg.celular.id),
                msg.celular.phone_number,
            )
            t_celular_done = time.perf_counter()

            if msg.direccion == "in":
                result = await self._handle_inbound_message(msg, celular, schedule_typing=not auto_process)
            else:
                self._handle_outbound_status(msg)
                result = {"status": "ok", "message": "Webhook procesado exitosamente"}
            t_message_done = time.perf_counter()

            log_entry.procesado = True
            log_entry.response_status = 200
            self.session.add(log_entry)
            self.session.commit()
            t_commit_done = time.perf_counter()
            logger.info(
                "Webhook process timing meta_message_id=%s direction=%s parse=%sms log_add=%sms mode=%sms typing_schedule=%sms record_event=%sms ensure_celular=%sms message_handler=%sms final_commit=%sms total=%sms",
                msg.meta_message_id,
                msg.direccion,
                round((t_parse_done - t_parse_start) * 1000),
                round((t_log_added - t_parse_done) * 1000),
                round((t_mode_done - t_log_added) * 1000),
                round((t_typing_scheduled - t_mode_done) * 1000),
                round((t_record_event_done - t_typing_scheduled) * 1000),
                round((t_celular_done - t_record_event_done) * 1000),
                round((t_message_done - t_celular_done) * 1000),
                round((t_commit_done - t_message_done) * 1000),
                round((t_commit_done - t0) * 1000),
            )
            return result

        except Exception as exc:
            logger.error("Error procesando webhook: %s", str(exc), exc_info=True)
            log_entry.procesado = False
            log_entry.error_message = str(exc)
            log_entry.response_status = 500
            self.session.add(log_entry)
            self.session.commit()
            raise
