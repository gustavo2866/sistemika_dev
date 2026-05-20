from sqlmodel import Session, select
import pytest

from app.models import CRMCelular, CRMContacto, CRMMensaje, CRMOportunidad, Setting, User
from app.routers.channel_meta_webhook_router import process_raw_meta_webhook_payload
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
            clave="channels.meta.accounts.56953906-7099-4d1a-8379-3174d732d21e.phone_number_id",
            valor="1046006975257973",
        )
    )
    db_session.add(
        CRMCelular(
            meta_celular_id="56953906-7099-4d1a-8379-3174d732d21e",
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
