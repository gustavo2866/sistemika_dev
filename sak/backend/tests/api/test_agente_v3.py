from sqlmodel import Session, select

from app.models import Setting
from app.modules.channels.persistence import ChannelEvent


def _meta_text_payload(*, external_message_id: str = "wamid.test.v3.inbound") -> dict:
    return {
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
                                    "profile": {"name": "Cliente V3"},
                                }
                            ],
                            "messages": [
                                {
                                    "from": "5491156384310",
                                    "id": external_message_id,
                                    "timestamp": "1779282000",
                                    "type": "text",
                                    "text": {"body": "Hola v3"},
                                }
                            ],
                        },
                    }
                ],
            }
        ],
    }


def _set_meta_text(payload: dict, text: str) -> dict:
    payload["entry"][0]["changes"][0]["value"]["messages"][0]["text"]["body"] = text
    return payload


def test_agente_v3_meta_flow_enqueues_and_processes_message(client, db_session: Session, test_engine, monkeypatch):
    monkeypatch.setattr("agente.v3.channel.engine", test_engine)
    sent_calls: list[dict] = []

    async def fake_enviar_mensaje(**kwargs):
        sent_calls.append(kwargs)
        return {
            "status": "sent",
            "meta_message_id": "wamid.test.v3.outbound",
            "provider_message_type": "text",
            "raw_response": {"messages": [{"id": "wamid.test.v3.outbound"}]},
        }

    monkeypatch.setattr("agente.v3.channel.channel_gateway.enviar_mensaje", fake_enviar_mensaje)
    client.post("/api/agente/v3/inbox/reset")
    db_session.add(Setting(clave="channels.meta.phone_number_id", valor="1046006975257973"))
    db_session.commit()

    received = client.post("/api/agente/v3/channel/meta", json=_meta_text_payload())

    assert received.status_code == 200
    assert received.json()["status"] == "ok"
    assert received.json()["enqueued_count"] == 1
    assert received.json()["received_count"] == 1
    assert received.json()["timings_ms"]["total"] >= 0
    channel_event = db_session.exec(
        select(ChannelEvent).where(ChannelEvent.external_message_id == "wamid.test.v3.inbound")
    ).first()
    assert channel_event is not None
    assert channel_event.provider == "meta"
    assert channel_event.channel_type == "whatsapp"
    assert channel_event.direction == "inbound"
    assert channel_event.status == "received"

    status = client.get("/api/agente/v3/inbox/status")

    assert status.status_code == 200
    assert status.json()["pending_count"] == 0
    assert status.json()["processed_count"] == 1
    assert status.json()["last_processed"]["external_message_id"] == "wamid.test.v3.inbound"
    assert status.json()["last_processed"]["conversation_id"] == "meta:1046006975257973:5491156384310"

    context = client.get("/api/agente/v3/context/status")

    assert context.status_code == 200
    assert context.json()["count"] == 1
    assert context.json()["contexts"][0]["conversation_id"] == "meta:1046006975257973:5491156384310"
    assert context.json()["contexts"][0]["active_process"] == "general"
    assert context.json()["contexts"][0]["last_inbound_message_id"] == status.json()["last_processed"]["message_id"]
    assert context.json()["contexts"][0]["last_outbound_message_id"] == status.json()["last_processed"]["outbox"]["message_id"]

    outbox = client.get("/api/agente/v3/outbox/status")

    assert outbox.status_code == 200
    assert outbox.json()["pending_count"] == 0
    assert outbox.json()["sent_count"] == 1
    assert outbox.json()["last_sent"]["status"] == "sent"
    assert outbox.json()["last_sent"]["external_message_id"] == "wamid.test.v3.outbound"
    assert "recibido:" in outbox.json()["last_sent"]["text"]
    assert "sub_proceso: general" in outbox.json()["last_sent"]["text"]
    assert "conversation_id: meta:1046006975257973:5491156384310" in outbox.json()["last_sent"]["text"]
    assert "mensaje_origen: wamid.test.v3.inbound" in outbox.json()["last_sent"]["text"]
    assert "texto_origen: Hola v3" in outbox.json()["last_sent"]["text"]
    assert sent_calls[0]["celular_id"] == "1046006975257973"
    assert sent_calls[0]["telefono_destino"] == "5491156384310"
    assert sent_calls[0]["policy"] == "text_only"


def test_agente_v3_cancelar_cierra_conversacion_activa(client, db_session: Session, test_engine, monkeypatch):
    monkeypatch.setattr("agente.v3.channel.engine", test_engine)

    async def fake_enviar_mensaje(**kwargs):
        return {
            "status": "sent",
            "meta_message_id": f"out.{kwargs['texto'][:8]}",
            "provider_message_type": "text",
            "raw_response": {"messages": [{"id": "out.test"}]},
        }

    monkeypatch.setattr("agente.v3.channel.channel_gateway.enviar_mensaje", fake_enviar_mensaje)
    client.post("/api/agente/v3/inbox/reset")
    db_session.add(Setting(clave="channels.meta.phone_number_id", valor="1046006975257973"))
    db_session.commit()

    first = client.post("/api/agente/v3/channel/meta", json=_meta_text_payload(external_message_id="wamid.test.v3.first"))
    cancel = client.post(
        "/api/agente/v3/channel/meta",
        json=_set_meta_text(_meta_text_payload(external_message_id="wamid.test.v3.cancel"), "cancelar"),
    )

    assert first.status_code == 200
    assert cancel.status_code == 200

    context = client.get("/api/agente/v3/context/status")
    outbox = client.get("/api/agente/v3/outbox/status")

    assert context.json()["contexts"][0]["active_process"] is None
    assert context.json()["contexts"][0]["process_state"] == {}
    assert "Conversacion cancelada" in outbox.json()["last_sent"]["text"]
    assert "sub_proceso: general" in outbox.json()["last_sent"]["text"]


def test_agente_v3_meta_webhook_verify_returns_challenge(client, db_session: Session):
    db_session.add(Setting(clave="channels.meta.webhook_verify_token", valor="verify-v3"))
    db_session.commit()

    response = client.get(
        "/api/agente/v3/channel/meta",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "verify-v3",
            "hub.challenge": "challenge-v3",
        },
    )

    assert response.status_code == 200
    assert response.text == "challenge-v3"
