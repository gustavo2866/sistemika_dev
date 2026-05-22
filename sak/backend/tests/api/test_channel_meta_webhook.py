import asyncio

from sqlmodel import Session, select
import pytest

from agente.v2.core.delivery import SendResult
from app.models import CRMCelular, CRMContacto, CRMMensaje, CRMOportunidad, Setting, User
from app.modules.channels.providers.meta.client import MetaMediaDownload
from app.routers.channel_meta_webhook_router import process_raw_meta_webhook_payload
from app.services.agent_pending_processor import process_pending_agent_messages
from app.services.meta_webhook_service import MetaWebhookService


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


def test_channel_meta_webhook_endpoint_processes_inbound_inline(client, monkeypatch):
    calls: list[tuple[str, object]] = []

    async def fake_process_raw(session, payload):
        message_id = payload["entry"][0]["changes"][0]["value"]["messages"][0]["id"]
        calls.append(("process", message_id))

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
    assert response.json()["message"] == "Procesado"
    assert calls[0] == ("process", "wamid.test.inline.inbound")


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


def test_pending_processor_skips_already_processed_message(db_session: Session, monkeypatch):
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
        metadata_json={"agent_v2": {"result": {"type": "chat_reply"}}},
    )
    db_session.add(mensaje)
    db_session.commit()
    db_session.refresh(mensaje)

    async def fail_process_existing(*args, **kwargs):
        raise AssertionError("No debe reprocesar mensajes con agent_v2.result")

    monkeypatch.setattr(
        MetaWebhookService,
        "process_existing_inbound_message",
        fail_process_existing,
    )

    result = asyncio.run(process_pending_agent_messages(db_session, limit=5))

    assert result["processed"] == []
    assert {"message_id": mensaje.id, "reason": "already_processed"} in result["skipped"]
