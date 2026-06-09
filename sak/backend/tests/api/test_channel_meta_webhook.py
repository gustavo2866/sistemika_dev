import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

from sqlmodel import Session, select
import pytest

from agente.v2.core.delivery import SendResult
from agente.v2.core.state import ConversationState
from agente.v2.core.turn_lease import AgentTurnLeaseBusy
from app.models import (
    CRMCelular,
    CRMContacto,
    CRMMensaje,
    CRMOportunidad,
    Nomina,
    OrigenDetalle,
    ParteDiarioDetalle,
    ParteDiarioEstado,
    Proyecto,
    Setting,
    User,
)
from app.models.constructora.pedido import ConstructoraPedido, ConstructoraPedidoDetalle
from app.modules.channels.providers.meta.client import MetaMediaDownload
from app.routers.channel_meta_webhook_router import process_raw_meta_webhook_payload
from app.services.agent_pending_processor import process_pending_agent_messages
from app.services.meta_webhook_service import MetaWebhookService
from app.services.parte_diario_estado_service import seed_parte_diario_estados


def test_channel_meta_webhook_verify_returns_plain_challenge(client, db_session: Session):
    db_session.add(Setting(clave="channels.meta.webhook_verify_token", valor="verify-test"))
    db_session.commit()

    response = client.get(
        "/api/channel-webhooks/meta/",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "verify-test",
            "hub.challenge": "abc123",
        },
    )

    assert response.status_code == 200
    assert response.text == "abc123"


def test_channel_meta_webhook_endpoint_enqueues_inbound_before_background_processing(client, monkeypatch):
    calls: list[tuple[str, object]] = []

    async def fake_process_raw(session, payload, *, enqueue_only=False, **kwargs):
        message_id = payload["entry"][0]["changes"][0]["value"]["messages"][0]["id"]
        calls.append(("enqueue" if enqueue_only else "process", message_id))

    async def fake_process_pending(session, **kwargs):
        calls.append(("pending", kwargs.get("limit")))
        return {"status": "ok"}

    monkeypatch.setattr(
        "app.routers.channel_meta_webhook_router.process_raw_meta_webhook_payload",
        fake_process_raw,
    )
    monkeypatch.setattr(
        "app.routers.channel_meta_webhook_router.process_pending_agent_messages",
        fake_process_pending,
    )

    response = client.post(
        "/api/channel-webhooks/meta/",
        json={
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "id": "1516474752918083",
                    "changes": [
                        {
                            "field": "messages",
                            "value": {
                                "metadata": {
                                    "display_phone_number": "5493816259343",
                                    "phone_number_id": "1046006975257973",
                                },
                                "messages": [
                                    {
                                        "from": "5491156384310",
                                        "id": "wamid.test.inline.inbound",
                                        "timestamp": "1779282000",
                                        "type": "text",
                                        "text": {"body": "Hola"},
                                    }
                                ],
                            },
                        }
                    ],
                }
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Encolado"
    assert calls[0] == ("enqueue", "wamid.test.inline.inbound")


@pytest.mark.asyncio
async def test_channel_meta_webhook_raw_message_creates_crm_message(db_session: Session, monkeypatch):
    monkeypatch.setattr("app.services.meta_webhook_service.should_auto_process", lambda *args, **kwargs: False)
    user = User(nombre="Tester", email="tester-channel-meta@example.com")
    db_session.add(user)
    db_session.flush()
    contacto = CRMContacto(
        nombre_completo="Cliente Test",
        telefonos=["5491156384310"],
        responsable_id=user.id,
    )
    db_session.add(contacto)
    db_session.flush()
    oportunidad = CRMOportunidad(
        titulo="Oportunidad test",
        contacto_id=contacto.id,
        responsable_id=user.id,
        activo=True,
    )
    db_session.add(oportunidad)
    db_session.add(
        Setting(
            clave="channels.meta.phone_number_id",
            valor="1046006975257973",
        )
    )
    db_session.add(
        CRMCelular(
            meta_celular_id="d5b32193-e39d-5d27-9180-01f69e4a3911",
            numero_celular="5493816259343",
            alias="Canal test",
            activo=True,
        )
    )
    db_session.commit()
    monkeypatch.setattr(
        MetaWebhookService,
        "_find_or_create_contacto",
        lambda self, numero_telefono, nombre_from_meta=None: contacto,
    )
    monkeypatch.setattr(
        MetaWebhookService,
        "_resolve_or_create_oportunidad",
        lambda self, contacto_arg: oportunidad,
    )

    await process_raw_meta_webhook_payload(
        db_session,
        {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "id": "1516474752918083",
                    "changes": [
                        {
                            "field": "messages",
                            "value": {
                                "metadata": {
                                    "display_phone_number": "5493816259343",
                                    "phone_number_id": "1046006975257973",
                                },
                                "contacts": [
                                    {
                                        "wa_id": "5491156384310",
                                        "profile": {"name": "Cliente Test"},
                                    }
                                ],
                                "messages": [
                                    {
                                        "from": "5491156384310",
                                        "id": "wamid.test.local.inbound",
                                        "timestamp": "1779282000",
                                        "type": "text",
                                        "text": {"body": "Hola desde test local"},
                                    }
                                ],
                            },
                        }
                    ],
                }
            ],
        },
    )
    mensaje = db_session.exec(
        select(CRMMensaje).where(CRMMensaje.origen_externo_id == "wamid.test.local.inbound")
    ).first()
    assert mensaje is not None
    assert mensaje.contenido == "Hola desde test local"
    assert mensaje.contacto_referencia == "5491156384310"


@pytest.mark.asyncio
async def test_channel_meta_webhook_audio_message_is_transcribed(db_session: Session, monkeypatch):
    monkeypatch.setattr("app.services.meta_webhook_service.should_auto_process", lambda *args, **kwargs: False)
    user = User(nombre="Tester Audio", email="tester-audio-channel@example.com")
    db_session.add(user)
    db_session.flush()
    contacto = CRMContacto(
        nombre_completo="Cliente Audio",
        telefonos=["5491156384310"],
        responsable_id=user.id,
    )
    db_session.add(contacto)
    db_session.flush()
    oportunidad = CRMOportunidad(
        titulo="Oportunidad audio",
        contacto_id=contacto.id,
        responsable_id=user.id,
        activo=True,
    )
    db_session.add(oportunidad)
    db_session.add(Setting(clave="channels.meta.access_token", valor="test-token"))
    db_session.add(
        Setting(
            clave="channels.meta.phone_number_id",
            valor="1046006975257973",
        )
    )
    db_session.add(
        CRMCelular(
            meta_celular_id="d5b32193-e39d-5d27-9180-01f69e4a3911",
            numero_celular="5493816259343",
            alias="Canal test audio",
            activo=True,
        )
    )
    db_session.commit()
    monkeypatch.setattr(
        MetaWebhookService,
        "_find_or_create_contacto",
        lambda self, numero_telefono, nombre_from_meta=None: contacto,
    )
    monkeypatch.setattr(
        MetaWebhookService,
        "_resolve_or_create_oportunidad",
        lambda self, contacto_arg: oportunidad,
    )

    async def fake_download_media(**kwargs):
        assert kwargs["access_token"] == "test-token"
        assert kwargs["media_id"] == "media-audio-1"
        return MetaMediaDownload(
            content=b"fake-audio",
            mime_type="audio/ogg",
            file_size=10,
            sha256="sha-test",
        )

    async def fake_transcribe_bytes(audio_bytes, **kwargs):
        assert audio_bytes == b"fake-audio"
        assert kwargs["filename"] == "media-audio-1.ogg"
        assert kwargs["mime_type"] == "audio/ogg"
        return "necesito 3 placas durlock"

    monkeypatch.setattr(
        "app.services.meta_webhook_service.meta_graph_client.download_media",
        fake_download_media,
    )
    monkeypatch.setattr(
        "app.services.meta_webhook_service.audio_transcription_service.transcribe_bytes",
        fake_transcribe_bytes,
    )

    await process_raw_meta_webhook_payload(
        db_session,
        {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "id": "1516474752918083",
                    "changes": [
                        {
                            "field": "messages",
                            "value": {
                                "metadata": {
                                    "display_phone_number": "5493816259343",
                                    "phone_number_id": "1046006975257973",
                                },
                                "contacts": [
                                    {
                                        "wa_id": "5491156384310",
                                        "profile": {"name": "Cliente Audio"},
                                    }
                                ],
                                "messages": [
                                    {
                                        "from": "5491156384310",
                                        "id": "wamid.test.audio.inbound",
                                        "timestamp": "1779282000",
                                        "type": "audio",
                                        "audio": {
                                            "id": "media-audio-1",
                                            "mime_type": "audio/ogg; codecs=opus",
                                        },
                                    }
                                ],
                            },
                        }
                    ],
                }
            ],
        },
    )

    mensaje = db_session.exec(
        select(CRMMensaje).where(CRMMensaje.origen_externo_id == "wamid.test.audio.inbound")
    ).first()
    assert mensaje is not None
    assert mensaje.contenido == "necesito 3 placas durlock"
    assert mensaje.adjuntos[0]["tipo"] == "audio"
    assert mensaje.adjuntos[0]["transcription_status"] == "ok"
    assert mensaje.adjuntos[0]["transcription"] == "necesito 3 placas durlock"
    assert mensaje.adjuntos[0]["sha256"] == "sha-test"


@pytest.mark.asyncio
async def test_audio_transcription_is_deferred_when_message_is_only_enqueued(db_session: Session, monkeypatch):
    service = MetaWebhookService(db_session, orchestrator=SimpleNamespace())

    async def fail_transcribe(*args, **kwargs):
        raise AssertionError("El webhook no debe transcribir antes de responder")

    monkeypatch.setattr(service, "_transcribe_audio_message", fail_transcribe)

    contenido, adjuntos = await service._normalize_message_content(
        SimpleNamespace(
            texto=None,
            media_id="media-audio-queued",
            tipo="audio",
            mime_type="audio/ogg",
            filename=None,
            caption=None,
        ),
        transcribe_audio=False,
    )

    assert contenido == "[Audio recibido]"
    assert adjuntos == [
        {
            "tipo": "audio",
            "id": "media-audio-queued",
            "mime_type": "audio/ogg",
            "filename": None,
            "caption": None,
        }
    ]


@pytest.mark.asyncio
async def test_worker_prepares_queued_audio_before_agent(db_session: Session, monkeypatch):
    message = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        oportunidad_id=907,
        contenido="[Audio recibido]",
        estado="nuevo",
        origen_externo_id="wamid.test.audio.queued",
        adjuntos=[
            {
                "tipo": "audio",
                "id": "media-audio-queued",
                "mime_type": "audio/ogg",
                "filename": None,
                "caption": None,
            }
        ],
    )
    db_session.add(message)
    db_session.commit()
    db_session.refresh(message)
    service = MetaWebhookService(db_session, orchestrator=SimpleNamespace())

    async def fake_transcribe(msg, celular, adjunto):
        assert msg.media_id == "media-audio-queued"
        adjunto["transcription"] = "mensaje transcripto"
        adjunto["transcription_status"] = "ok"
        return "mensaje transcripto"

    monkeypatch.setattr(service, "_transcribe_audio_message", fake_transcribe)

    await service._prepare_queued_message_content(message)
    db_session.refresh(message)

    assert message.contenido == "mensaje transcripto"
    assert message.adjuntos[0]["transcription_status"] == "ok"


@pytest.mark.asyncio
async def test_failed_audio_transcription_sends_controlled_reply(db_session: Session, monkeypatch):
    monkeypatch.setattr("app.services.meta_webhook_service.should_auto_process", lambda *args, **kwargs: True)
    user = User(nombre="Tester Audio Fail", email="tester-audio-fail@example.com")
    db_session.add(user)
    db_session.flush()
    contacto = CRMContacto(
        nombre_completo="Cliente Audio Fail",
        telefonos=["5491156384310"],
        responsable_id=user.id,
    )
    db_session.add(contacto)
    db_session.flush()
    oportunidad = CRMOportunidad(
        titulo="Oportunidad audio fail",
        contacto_id=contacto.id,
        responsable_id=user.id,
        activo=True,
    )
    db_session.add(oportunidad)
    db_session.flush()
    mensaje = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        contacto_id=contacto.id,
        oportunidad_id=oportunidad.id,
        contenido="[Audio recibido]",
        estado="nuevo",
        contacto_referencia="5491156384310",
        origen_externo_id="wamid.test.audio.failed",
        adjuntos=[
            {
                "tipo": "audio",
                "id": "media-audio-failed",
                "transcription_status": "failed",
                "transcription_error": "boom",
            }
        ],
    )
    db_session.add(mensaje)
    db_session.commit()
    db_session.refresh(mensaje)

    class FailOrchestrator:
        async def process_turn(self, *args, **kwargs):
            raise AssertionError("No debe ejecutar el agente si fallo la transcripcion")

    service = MetaWebhookService(db_session, orchestrator=FailOrchestrator())
    delivery_calls: list[dict[str, object]] = []

    async def fake_deliver_result(*, session, message, result):
        delivery_calls.append({"message_id": message.id, "result": result})
        return SendResult(sent=True, status="sent", outbound_message_id=999)

    monkeypatch.setattr(service._delivery_service, "deliver_result", fake_deliver_result)

    result = await service.process_existing_inbound_message(mensaje, trigger="webhook")
    db_session.refresh(mensaje)

    assert result["type"] == "audio_transcription_failed"
    assert result["respuesta"] == "No pude procesar el audio. Podes mandarme el pedido por escrito?"
    assert delivery_calls[0]["result"]["type"] == "audio_transcription_failed"
    assert mensaje.metadata_json["agent_v2"]["result"]["type"] == "audio_transcription_failed"
    assert mensaje.metadata_json["agent_v2"]["delivery"]["outbound_message_id"] == 999


@pytest.mark.asyncio
async def test_failed_delivery_retries_cached_result_without_reprocessing_agent(
    db_session: Session,
    monkeypatch,
):
    monkeypatch.setattr("app.services.meta_webhook_service.should_auto_process", lambda *args, **kwargs: True)
    user = User(nombre="Tester Delivery Retry", email="tester-delivery-retry@example.com")
    db_session.add(user)
    db_session.flush()
    contacto = CRMContacto(
        nombre_completo="Cliente Delivery Retry",
        telefonos=["5491156384312"],
        responsable_id=user.id,
    )
    db_session.add(contacto)
    db_session.flush()
    oportunidad = CRMOportunidad(
        titulo="Oportunidad delivery retry",
        contacto_id=contacto.id,
        responsable_id=user.id,
        activo=True,
    )
    db_session.add(oportunidad)
    db_session.flush()
    mensaje = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        contacto_id=contacto.id,
        oportunidad_id=oportunidad.id,
        contenido="Hola",
        estado="nuevo",
        contacto_referencia="5491156384312",
        origen_externo_id="wamid.test.delivery.retry",
    )
    db_session.add(mensaje)
    db_session.commit()
    db_session.refresh(mensaje)

    class SingleRunOrchestrator:
        calls = 0

        async def process_turn(self, *args, **kwargs):
            self.calls += 1
            return {"type": "chat_reply", "respuesta": "Respuesta persistida"}

    orchestrator = SingleRunOrchestrator()
    service = MetaWebhookService(db_session, orchestrator=orchestrator)
    deliveries = [
        SendResult(sent=False, status="failed", outbound_message_id=1001),
        SendResult(sent=True, status="sent", outbound_message_id=1002),
    ]

    async def fake_deliver_result(*, session, message, result):
        return deliveries.pop(0)

    monkeypatch.setattr(service._delivery_service, "deliver_result", fake_deliver_result)

    first = await service.process_existing_inbound_message(mensaje, trigger="webhook")
    db_session.refresh(mensaje)
    assert first["cached"] is False
    assert first["delivery"]["status"] == "failed"
    assert orchestrator.calls == 1
    assert "delivery_processed_at" not in mensaje.metadata_json["agent_v2"]
    assert mensaje.metadata_json["agent_v2"]["delivery_attempts"] == 1

    second = await service.process_existing_inbound_message(mensaje, trigger="pending_retry")
    db_session.refresh(mensaje)
    assert second["cached"] is True
    assert second["delivery"]["status"] == "sent"
    assert orchestrator.calls == 1
    assert mensaje.metadata_json["agent_v2"]["delivery_attempts"] == 2
    assert mensaje.metadata_json["agent_v2"]["delivery_processed_at"]


@pytest.mark.asyncio
async def test_recent_pending_delivery_is_not_sent_twice(db_session: Session, monkeypatch):
    monkeypatch.setattr("app.services.meta_webhook_service.should_auto_process", lambda *args, **kwargs: True)
    mensaje = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        oportunidad_id=901,
        contenido="Hola",
        estado="nuevo",
        origen_externo_id="wamid.test.delivery.pending",
        metadata_json={
            "agent_v2": {
                "result": {"type": "chat_reply", "respuesta": "Respuesta persistida"},
                "delivery": {"sent": False, "status": "pending"},
                "delivery_pending_at": datetime.now(UTC).isoformat(),
            }
        },
    )
    db_session.add(mensaje)
    db_session.commit()
    db_session.refresh(mensaje)

    class FailOrchestrator:
        async def process_turn(self, *args, **kwargs):
            raise AssertionError("No debe reprocesar el agente")

    service = MetaWebhookService(db_session, orchestrator=FailOrchestrator())

    async def fail_deliver_result(*args, **kwargs):
        raise AssertionError("No debe reenviar mientras el delivery esta en curso")

    monkeypatch.setattr(service._delivery_service, "deliver_result", fail_deliver_result)

    result = await service.process_existing_inbound_message(mensaje, trigger="pending_retry")

    assert result == {
        "type": "delivery_deferred",
        "skipped": True,
        "retryable": True,
        "reason": "Delivery en curso",
        "message_id": mensaje.id,
        "cached": True,
    }


@pytest.mark.asyncio
async def test_retry_refreshes_stale_message_before_reprocessing(db_session: Session, monkeypatch):
    mensaje = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        oportunidad_id=903,
        contenido="Hola",
        estado="nuevo",
        origen_externo_id="wamid.test.delivery.stale-object",
        metadata_json={},
    )
    db_session.add(mensaje)
    db_session.commit()
    db_session.refresh(mensaje)

    class FailOrchestrator:
        async def process_turn(self, *args, **kwargs):
            raise AssertionError("No debe reprocesar el agente despues del refresh")

    service = MetaWebhookService(db_session, orchestrator=FailOrchestrator())

    def fake_refresh(message):
        message.metadata_json = {
            "agent_v2": {
                "result": {"type": "chat_reply", "respuesta": "Respuesta persistida"},
                "delivery_processed_at": datetime.now(UTC).isoformat(),
            }
        }

    monkeypatch.setattr(db_session, "refresh", fake_refresh)

    result = await service._process_existing_inbound_message_with_lease(
        mensaje,
        trigger="pending_retry",
    )

    assert result["cached"] is True
    assert result["respuesta"] == "Respuesta persistida"


@pytest.mark.asyncio
async def test_stale_pending_delivery_can_be_retried(db_session: Session, monkeypatch):
    monkeypatch.setattr("app.services.meta_webhook_service.should_auto_process", lambda *args, **kwargs: True)
    mensaje = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        oportunidad_id=902,
        contenido="Hola",
        estado="nuevo",
        origen_externo_id="wamid.test.delivery.pending.stale",
        metadata_json={
            "agent_v2": {
                "result": {"type": "chat_reply", "respuesta": "Respuesta persistida"},
                "delivery": {"sent": False, "status": "pending"},
                "delivery_pending_at": (datetime.now(UTC) - timedelta(minutes=5)).isoformat(),
            }
        },
    )
    db_session.add(mensaje)
    db_session.commit()
    db_session.refresh(mensaje)

    class FailOrchestrator:
        async def process_turn(self, *args, **kwargs):
            raise AssertionError("No debe reprocesar el agente")

    service = MetaWebhookService(db_session, orchestrator=FailOrchestrator())
    calls = 0

    async def fake_deliver_result(*args, **kwargs):
        nonlocal calls
        calls += 1
        return SendResult(sent=True, status="sent", outbound_message_id=1003)

    monkeypatch.setattr(service._delivery_service, "deliver_result", fake_deliver_result)

    result = await service.process_existing_inbound_message(mensaje, trigger="pending_retry")

    assert calls == 1
    assert result["cached"] is True
    assert result["delivery"]["status"] == "sent"


@pytest.mark.asyncio
async def test_cached_delivery_is_retried_before_newer_inbound(db_session: Session, monkeypatch):
    monkeypatch.setattr("app.services.meta_webhook_service.should_auto_process", lambda *args, **kwargs: True)
    old_message = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        oportunidad_id=905,
        contenido="Respuesta anterior",
        estado="nuevo",
        origen_externo_id="wamid.test.delivery.old",
        metadata_json={
            "agent_v2": {
                "result": {"type": "chat_reply", "respuesta": "Respuesta obsoleta"},
                "delivery": {"sent": False, "status": "failed"},
                "delivery_last_attempt_at": (datetime.now(UTC) - timedelta(minutes=5)).isoformat(),
            }
        },
    )
    db_session.add(old_message)
    db_session.flush()
    newer_message = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        oportunidad_id=905,
        contenido="Mensaje posterior",
        estado="nuevo",
        origen_externo_id="wamid.test.delivery.newer",
    )
    db_session.add(newer_message)
    db_session.commit()
    db_session.refresh(old_message)
    db_session.refresh(newer_message)

    class FailOrchestrator:
        async def process_turn(self, *args, **kwargs):
            raise AssertionError("No debe reprocesar el agente")

    service = MetaWebhookService(db_session, orchestrator=FailOrchestrator())

    async def fake_deliver_result(*args, **kwargs):
        return SendResult(sent=True, status="sent", outbound_message_id=1004)

    monkeypatch.setattr(service._delivery_service, "deliver_result", fake_deliver_result)

    result = await service.process_existing_inbound_message(old_message, trigger="pending_retry")
    db_session.refresh(old_message)

    agent_meta = old_message.metadata_json["agent_v2"]
    assert result["cached"] is True
    assert result["delivery"]["status"] == "sent"
    assert result["delivery"]["outbound_message_id"] == 1004
    assert agent_meta["delivery"]["status"] == "sent"
    assert agent_meta["delivery_processed_at"]


@pytest.mark.asyncio
async def test_uncached_pending_turn_is_processed_before_newer_inbound(db_session: Session, monkeypatch):
    monkeypatch.setattr("app.services.meta_webhook_service.should_auto_process", lambda *args, **kwargs: True)
    old_message = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        oportunidad_id=906,
        contenido="Mensaje atrasado",
        estado="nuevo",
        origen_externo_id="wamid.test.turn.old",
    )
    db_session.add(old_message)
    db_session.flush()
    newer_message = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        oportunidad_id=906,
        contenido="Mensaje posterior",
        estado="nuevo",
        origen_externo_id="wamid.test.turn.newer",
    )
    db_session.add(newer_message)
    db_session.commit()
    db_session.refresh(old_message)
    db_session.refresh(newer_message)

    class RecordingOrchestrator:
        calls = []

        async def process_turn(self, *args, **kwargs):
            self.calls.append(args[1])
            return {"type": "chat_reply", "respuesta": "Respuesta anterior"}

    orchestrator = RecordingOrchestrator()
    service = MetaWebhookService(db_session, orchestrator=orchestrator)

    async def fake_deliver_result(*args, **kwargs):
        return SendResult(sent=True, status="sent", outbound_message_id=1005)

    monkeypatch.setattr(service._delivery_service, "deliver_result", fake_deliver_result)

    result = await service.process_existing_inbound_message(old_message, trigger="pending_retry")

    assert orchestrator.calls == [old_message.id]
    assert result["type"] == "chat_reply"
    assert result["delivery"]["status"] == "sent"


@pytest.mark.asyncio
async def test_active_turn_lease_defers_message(db_session: Session, monkeypatch):
    monkeypatch.setattr("app.services.meta_webhook_service.should_auto_process", lambda *args, **kwargs: True)
    mensaje = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        oportunidad_id=123,
        contenido="Hola",
        estado="nuevo",
        origen_externo_id="wamid.test.turn.deferred",
    )
    db_session.add(mensaje)
    db_session.commit()
    db_session.refresh(mensaje)

    class FailOrchestrator:
        async def process_turn(self, *args, **kwargs):
            raise AssertionError("No debe ejecutar el agente con un lease activo")

    class BusyLease:
        @staticmethod
        def acquire(*args, **kwargs):
            raise AgentTurnLeaseBusy("busy")

        @staticmethod
        def release(*args, **kwargs):
            raise AssertionError("No debe liberar un lease que no adquirio")

    service = MetaWebhookService(db_session, orchestrator=FailOrchestrator())
    service._turn_lease_service = BusyLease()

    result = await service.process_existing_inbound_message(mensaje, trigger="webhook")

    assert result == {
        "type": "turn_deferred",
        "skipped": True,
        "retryable": True,
        "reason": "Oportunidad con otro turno en curso",
        "message_id": mensaje.id,
    }


@pytest.mark.asyncio
async def test_confirmed_pedido_obra_creates_constructora_pedido(db_session: Session, monkeypatch):
    monkeypatch.setattr("app.services.meta_webhook_service.should_auto_process", lambda *args, **kwargs: True)
    user = User(nombre="Tester Pedido", email="tester-pedido-channel@example.com")
    db_session.add(user)
    db_session.flush()
    contacto = CRMContacto(
        nombre_completo="Cliente Pedido",
        telefonos=["5491156384310"],
        responsable_id=user.id,
    )
    db_session.add(contacto)
    db_session.flush()
    oportunidad = CRMOportunidad(
        titulo="Oportunidad pedido",
        contacto_id=contacto.id,
        responsable_id=user.id,
        activo=True,
    )
    db_session.add(oportunidad)
    db_session.flush()
    mensaje = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        contacto_id=contacto.id,
        oportunidad_id=oportunidad.id,
        contenido="confirmar",
        estado="nuevo",
        contacto_referencia="5491156384310",
        origen_externo_id="wamid.test.pedido.confirmed",
    )
    db_session.add(mensaje)
    db_session.commit()
    db_session.refresh(mensaje)

    class PedidoOrchestrator:
        async def process_turn(self, *args, **kwargs):
            return {
                "type": "pedido_obra_reply",
                "pedido_listo": True,
                "oportunidad_id": oportunidad.id,
                "respuesta": "*PEDIDO CONFIRMADO*",
                "items": [
                    {"item_id": "cemento-1", "descripcion": "cemento", "cantidad": 20, "unidad": "bolsas"},
                    {"item_id": "arena-1", "descripcion": "arena fina", "cantidad": 3, "unidad": "mts"},
                ],
            }

    service = MetaWebhookService(db_session, orchestrator=PedidoOrchestrator())

    async def fake_deliver_result(*, session, message, result):
        return SendResult(sent=True, status="sent", outbound_message_id=1001)

    monkeypatch.setattr(service._delivery_service, "deliver_result", fake_deliver_result)

    result = await service.process_existing_inbound_message(mensaje, trigger="webhook")
    db_session.refresh(mensaje)

    pedido = db_session.exec(
        select(ConstructoraPedido).where(ConstructoraPedido.mensaje_origen_id == mensaje.id)
    ).first()
    assert result["pedido_listo"] is True
    assert pedido is not None
    assert pedido.oportunidad_id == oportunidad.id
    assert pedido.contacto_id == contacto.id
    assert mensaje.metadata_json["agent_v2"]["pedido_obra_id"] == pedido.id

    detalles = db_session.exec(
        select(ConstructoraPedidoDetalle).where(ConstructoraPedidoDetalle.pedido_id == pedido.id)
    ).all()
    assert [(d.descripcion, d.cantidad, d.unidad_medida) for d in detalles] == [
        ("cemento", 20, "bolsas"),
        ("arena fina", 3, "mts"),
    ]


@pytest.mark.asyncio
async def test_confirmed_parte_diario_materializes_before_delivery_and_closes_state(
    db_session: Session,
    monkeypatch,
):
    monkeypatch.setattr("app.services.meta_webhook_service.should_auto_process", lambda *args, **kwargs: True)
    seed_parte_diario_estados(db_session)
    falta = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).first()
    user = User(nombre="Tester Parte", email="tester-parte-channel@example.com")
    db_session.add(user)
    db_session.flush()
    contacto = CRMContacto(
        nombre_completo="Encargado Parte",
        telefonos=["5491156384315"],
        responsable_id=user.id,
    )
    db_session.add(contacto)
    db_session.flush()
    oportunidad = CRMOportunidad(
        titulo="Oportunidad parte",
        contacto_id=contacto.id,
        responsable_id=user.id,
        activo=True,
    )
    db_session.add(oportunidad)
    db_session.flush()
    proyecto = Proyecto(nombre="Obra Parte", oportunidad_id=oportunidad.id, responsable_id=user.id)
    db_session.add(proyecto)
    db_session.flush()
    juan = Nomina(nombre="Juan", apellido="Garcia", dni="parte-channel-1", idproyecto=proyecto.id)
    pedro = Nomina(nombre="Pedro", apellido="Perez", dni="parte-channel-2", idproyecto=proyecto.id)
    db_session.add(juan)
    db_session.add(pedro)
    db_session.flush()
    mensaje = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        contacto_id=contacto.id,
        oportunidad_id=oportunidad.id,
        contenido="CONFIRMAR",
        estado="nuevo",
        contacto_referencia="5491156384315",
        origen_externo_id="wamid.test.parte.confirmed",
    )
    db_session.add(mensaje)
    db_session.commit()
    db_session.refresh(mensaje)

    state = ConversationState(
        oportunidad_id=oportunidad.id,
        active_process="parte_diario",
        process_state={"fecha": "2026-05-30"},
    )

    class StateStore:
        @staticmethod
        def load(*args, **kwargs):
            return state

        @staticmethod
        def save(updated):
            state.active_process = updated.active_process
            state.process_state = updated.process_state

    class ParteOrchestrator:
        state_store = StateStore()

        async def process_turn(self, *args, **kwargs):
            return {
                "type": "parte_diario_reply",
                "parte_listo": True,
                "close_after_materialization": True,
                "oportunidad_id": oportunidad.id,
                "idproyecto": proyecto.id,
                "fecha": "2026-05-30",
                "parte_id_existente": None,
                "pendientes_ambiguos": [],
                "conflictos_novedad": [],
                "novedades": [
                    {
                        "nombre": "Garcia, Juan",
                        "idnomina": juan.id,
                        "idestado": falta.id,
                        "estado_codigo": "FAL",
                        "horas": 0,
                        "fuera_de_proyecto": False,
                    }
                ],
            }

    service = MetaWebhookService(db_session, orchestrator=ParteOrchestrator())
    delivery_observations: list[str | None] = []

    async def fake_deliver_result(*, session, message, result):
        delivery_observations.append(state.active_process)
        return SendResult(sent=True, status="sent", outbound_message_id=1002)

    monkeypatch.setattr(service._delivery_service, "deliver_result", fake_deliver_result)

    result = await service.process_existing_inbound_message(mensaje, trigger="webhook")
    db_session.refresh(mensaje)
    details = db_session.exec(select(ParteDiarioDetalle)).all()

    assert result["parte_listo"] is True
    assert delivery_observations == [None]
    assert state.active_process is None
    assert state.process_state == {}
    assert len(details) == 2
    assert next(item for item in details if item.idnomina == juan.id).origen == OrigenDetalle.AGENTE
    assert next(item for item in details if item.idnomina == pedro.id).origen == OrigenDetalle.DEFAULT
    assert mensaje.metadata_json["agent_v2"]["parte_diario_id"]


def test_pending_processor_retries_inbound_message_without_agent_result(db_session: Session, monkeypatch):
    monkeypatch.setattr("app.services.agent_pending_processor.should_auto_process", lambda *args, **kwargs: True)

    user = User(nombre="Tester Pendientes", email="tester-pending-channel@example.com")
    db_session.add(user)
    db_session.flush()
    contacto = CRMContacto(
        nombre_completo="Cliente Pendientes",
        telefonos=["5491156384310"],
        responsable_id=user.id,
    )
    db_session.add(contacto)
    db_session.flush()
    oportunidad = CRMOportunidad(
        titulo="Oportunidad pendientes",
        contacto_id=contacto.id,
        responsable_id=user.id,
        activo=True,
    )
    db_session.add(oportunidad)
    db_session.flush()
    mensaje = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        contacto_id=contacto.id,
        oportunidad_id=oportunidad.id,
        contenido="Hola pendiente",
        estado="nuevo",
        contacto_referencia="5491156384310",
        origen_externo_id="wamid.test.pending.agent",
        metadata_json={"from_name": "Cliente Pendientes"},
    )
    db_session.add(mensaje)
    db_session.commit()
    db_session.refresh(mensaje)

    calls: list[dict[str, object]] = []

    async def fake_process_existing(self, crm_mensaje, **kwargs):
        calls.append({"message_id": crm_mensaje.id, "trigger": kwargs["trigger"]})
        metadata = dict(crm_mensaje.metadata_json or {})
        metadata["agent_v2"] = {"result": {"type": "chat_reply", "respuesta": "Hola"}}
        crm_mensaje.metadata_json = metadata
        db_session.add(crm_mensaje)
        db_session.commit()
        db_session.refresh(crm_mensaje)
        return metadata["agent_v2"]["result"]

    monkeypatch.setattr(
        MetaWebhookService,
        "process_existing_inbound_message",
        fake_process_existing,
    )

    result = asyncio.run(process_pending_agent_messages(db_session, limit=5))
    db_session.refresh(mensaje)

    assert calls == [{"message_id": mensaje.id, "trigger": "pending_retry"}]
    assert result["processed"] == [{"message_id": mensaje.id, "result_type": "chat_reply"}]
    assert "agent_v2_processing" not in mensaje.metadata_json
    assert mensaje.metadata_json["agent_v2"]["result"]["respuesta"] == "Hola"


def test_pending_processor_skips_already_delivered_message(db_session: Session, monkeypatch):
    monkeypatch.setattr("app.services.agent_pending_processor.should_auto_process", lambda *args, **kwargs: True)

    user = User(nombre="Tester Pendientes Skip", email="tester-pending-skip@example.com")
    db_session.add(user)
    db_session.flush()
    contacto = CRMContacto(
        nombre_completo="Cliente Pendientes Skip",
        telefonos=["5491156384311"],
        responsable_id=user.id,
    )
    db_session.add(contacto)
    db_session.flush()
    oportunidad = CRMOportunidad(
        titulo="Oportunidad pendientes skip",
        contacto_id=contacto.id,
        responsable_id=user.id,
        activo=True,
    )
    db_session.add(oportunidad)
    db_session.flush()
    mensaje = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        contacto_id=contacto.id,
        oportunidad_id=oportunidad.id,
        contenido="Hola procesado",
        estado="nuevo",
        contacto_referencia="5491156384311",
        origen_externo_id="wamid.test.pending.done",
        metadata_json={
            "agent_v2": {
                "result": {"type": "chat_reply"},
                "delivery_processed_at": "2026-06-01T12:00:00+00:00",
            }
        },
    )
    db_session.add(mensaje)
    db_session.commit()
    db_session.refresh(mensaje)

    async def fail_process_existing(*args, **kwargs):
        raise AssertionError("No debe reprocesar mensajes con delivery completado")

    monkeypatch.setattr(
        MetaWebhookService,
        "process_existing_inbound_message",
        fail_process_existing,
    )

    result = asyncio.run(process_pending_agent_messages(db_session, limit=5))

    assert result["processed"] == []
    assert result["skipped"] == []


def test_pending_processor_consumes_same_conversation_in_fifo_order(db_session: Session, monkeypatch):
    monkeypatch.setattr("app.services.agent_pending_processor.should_auto_process", lambda *args, **kwargs: True)
    first = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        oportunidad_id=910,
        contenido="Primero",
        estado="nuevo",
        origen_externo_id="wamid.test.queue.fifo.first",
    )
    second = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        oportunidad_id=910,
        contenido="Segundo",
        estado="nuevo",
        origen_externo_id="wamid.test.queue.fifo.second",
    )
    db_session.add(first)
    db_session.flush()
    db_session.add(second)
    db_session.commit()
    db_session.refresh(first)
    db_session.refresh(second)
    calls: list[int] = []

    async def fake_process_existing(self, message, **kwargs):
        calls.append(int(message.id))
        metadata = dict(message.metadata_json or {})
        metadata["agent_v2"] = {
            "result": {"type": "chat_reply", "respuesta": message.contenido},
            "delivery_processed_at": datetime.now(UTC).isoformat(),
        }
        message.metadata_json = metadata
        db_session.add(message)
        db_session.commit()
        return metadata["agent_v2"]["result"]

    monkeypatch.setattr(MetaWebhookService, "process_existing_inbound_message", fake_process_existing)

    result = asyncio.run(process_pending_agent_messages(db_session, limit=5))

    assert calls == [first.id, second.id]
    assert [item["message_id"] for item in result["processed"]] == [first.id, second.id]


def test_pending_processor_allows_other_conversation_while_head_is_in_backoff(db_session: Session, monkeypatch):
    monkeypatch.setattr("app.services.agent_pending_processor.should_auto_process", lambda *args, **kwargs: True)
    blocked = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        oportunidad_id=911,
        contenido="Bloqueado",
        estado="nuevo",
        origen_externo_id="wamid.test.queue.blocked",
        metadata_json={
            "agent_v2": {
                "result": {"type": "chat_reply", "respuesta": "Pendiente"},
                "delivery_last_attempt_at": datetime.now(UTC).isoformat(),
            }
        },
    )
    same_conversation = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        oportunidad_id=911,
        contenido="No adelantar",
        estado="nuevo",
        origen_externo_id="wamid.test.queue.same-conversation",
    )
    other_conversation = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        oportunidad_id=912,
        contenido="Procesar en paralelo",
        estado="nuevo",
        origen_externo_id="wamid.test.queue.other-conversation",
    )
    db_session.add(blocked)
    db_session.flush()
    db_session.add(same_conversation)
    db_session.flush()
    db_session.add(other_conversation)
    db_session.commit()
    calls: list[int] = []

    async def fake_process_existing(self, message, **kwargs):
        calls.append(int(message.id))
        metadata = dict(message.metadata_json or {})
        metadata["agent_v2"] = {
            "result": {"type": "chat_reply", "respuesta": message.contenido},
            "delivery_processed_at": datetime.now(UTC).isoformat(),
        }
        message.metadata_json = metadata
        db_session.add(message)
        db_session.commit()
        return metadata["agent_v2"]["result"]

    monkeypatch.setattr(MetaWebhookService, "process_existing_inbound_message", fake_process_existing)

    result = asyncio.run(process_pending_agent_messages(db_session, limit=5))

    assert calls == [other_conversation.id]
    assert {"message_id": blocked.id, "reason": "delivery_backoff"} in result["skipped"]
    assert [item["message_id"] for item in result["processed"]] == [other_conversation.id]


def test_pending_processor_skips_recent_delivery_attempt_during_backoff(db_session: Session, monkeypatch):
    monkeypatch.setattr("app.services.agent_pending_processor.should_auto_process", lambda *args, **kwargs: True)
    mensaje = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        oportunidad_id=903,
        contenido="Hola fallido",
        estado="nuevo",
        origen_externo_id="wamid.test.pending.delivery.backoff",
        metadata_json={
            "agent_v2": {
                "result": {"type": "chat_reply", "respuesta": "Hola"},
                "delivery": {"sent": False, "status": "failed"},
                "delivery_last_attempt_at": datetime.now(UTC).isoformat(),
            }
        },
    )
    db_session.add(mensaje)
    db_session.commit()
    db_session.refresh(mensaje)

    async def fail_process_existing(*args, **kwargs):
        raise AssertionError("No debe reenviar durante el backoff automatico")

    monkeypatch.setattr(
        MetaWebhookService,
        "process_existing_inbound_message",
        fail_process_existing,
    )

    result = asyncio.run(process_pending_agent_messages(db_session, limit=5))

    assert result["processed"] == []
    assert {"message_id": mensaje.id, "reason": "delivery_backoff"} in result["skipped"]


def test_failed_meta_status_reopens_source_delivery_with_provider_error(db_session: Session):
    inbound = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        oportunidad_id=904,
        contenido="Hola",
        estado="nuevo",
        origen_externo_id="wamid.test.status.source",
        metadata_json={
            "agent_v2": {
                "result": {"type": "chat_reply", "respuesta": "Hola"},
                "delivery": {
                    "sent": True,
                    "status": "sent",
                    "outbound_message_id": None,
                },
                "delivery_processed_at": datetime.now(UTC).isoformat(),
            }
        },
    )
    db_session.add(inbound)
    db_session.flush()
    outbound = CRMMensaje(
        tipo="salida",
        canal="whatsapp",
        oportunidad_id=904,
        contenido="Hola",
        estado="enviado",
        estado_meta="sent",
        origen_externo_id="wamid.test.status.outbound",
        metadata_json={"source_message_id": inbound.id},
    )
    db_session.add(outbound)
    db_session.flush()
    metadata = dict(inbound.metadata_json or {})
    agent_meta = dict(metadata["agent_v2"])
    agent_meta["outbound_message_id"] = outbound.id
    agent_meta["delivery"]["outbound_message_id"] = outbound.id
    metadata["agent_v2"] = agent_meta
    inbound.metadata_json = metadata
    db_session.add(inbound)
    db_session.commit()

    service = MetaWebhookService(db_session)
    service._handle_outbound_status(
        SimpleNamespace(
            meta_message_id=outbound.origen_externo_id,
            status="failed",
            meta_timestamp=datetime.now(UTC),
            errors=[
                {
                    "code": 131047,
                    "title": "Re-engagement message",
                    "error_data": {
                        "details": "Message failed because the customer reply window expired."
                    },
                }
            ],
        )
    )
    db_session.refresh(inbound)
    db_session.refresh(outbound)

    delivery = inbound.metadata_json["agent_v2"]["delivery"]
    assert outbound.estado_meta == "failed"
    assert outbound.metadata_json["provider_status_errors"][0]["code"] == 131047
    assert delivery["sent"] is False
    assert delivery["status"] == "failed"
    assert delivery["error_message"] == (
        "Meta 131047: Message failed because the customer reply window expired."
    )
    assert "delivery_processed_at" not in inbound.metadata_json["agent_v2"]
