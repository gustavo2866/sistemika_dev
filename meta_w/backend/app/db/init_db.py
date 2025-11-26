"""
Database initialization and seed data based on Meta official examples.
"""
from datetime import datetime, timedelta
from typing import Optional

from sqlmodel import SQLModel, Session, select

from app.db.session import engine
from app.models import (
    Celular,
    Contacto,
    Conversacion,
    Empresa,
    LogIntegracion,
    Mensaje,
    PlantillaMeta,
    WebhookEvento,
)

META_ACCESS_TOKEN_SAMPLE = (
    "EAAQ5VhZB8sb4BQCfpXxusmQDrTigbm5R8LrSsRDepFtCOH9Q4dNuyF7vY9nAiG9cnP0ynpI4ZCjPDgleLkZBPl5CoVe97hS6jZA8zu1"
    "Aimv31TGzXxArwHz4o5lEeSzLK2LaPegfhZBWzZAiH0HAmUFduOoSZAkvzWQHFWAqOEwiJe7PSEytcUIseLT7xnGyImSi6sCEDZC5ofhO"
    "2z1KbcuoaI9zQMKC16jcA0HojMs8DCQ7tIO42PdPFLruFYhcILHHM5DDp7F2lrJaVglfp0jS"
)
HELLO_WORLD_TEMPLATE = {
    "name": "hello_world",
    "language": {"code": "en_US"},
    "components": [
        {
            "type": "BODY",
            "text": "Hello {{1}}, welcome to WhatsApp Cloud API!",
        }
    ],
}
PHONE_NUMBER_E164 = "+15551676015"
PHONE_NUMBER_ID = "891207920743299"
CONTACT_NUMBER = "+541156384310"


def _get_or_create(session: Session, model, defaults: Optional[dict] = None, **filters):
    statement = select(model)
    for field, value in filters.items():
        statement = statement.where(getattr(model, field) == value)
    instance = session.exec(statement).first()
    if instance:
        return instance
    data = defaults or {}
    data.update(filters)
    instance = model(**data)
    session.add(instance)
    session.commit()
    session.refresh(instance)
    return instance


def init_db():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        empresa = _get_or_create(
            session,
            Empresa,
            defaults={
                "estado": "activa",
                "webhook_secret": "sandbox-secret",
                "meta_app_id": "238947515083716",
                "meta_access_token": META_ACCESS_TOKEN_SAMPLE,
                "meta_webhook_verify_token": "sandbox_verify_token",
            },
            nombre="Sandbox Meta Demo",
        )

        celular = _get_or_create(
            session,
            Celular,
            defaults={
                "alias": "Meta Test Number",
                "phone_number": PHONE_NUMBER_E164,
                "waba_id": "114815674123456",
                "estado": "activo",
                "limite_mensual": 10000,
            },
            empresa_id=empresa.id,
            meta_phone_number_id=PHONE_NUMBER_ID,
        )

        contacto = _get_or_create(
            session,
            Contacto,
            defaults={
                "nombre": "Hello World Contact",
                "pais": "AR",
                "extra_data": {
                    "source": "meta-docs",
                    "notes": "Contacto usado en el ejemplo oficial hello_world.",
                },
            },
            empresa_id=empresa.id,
            telefono=CONTACT_NUMBER,
        )

        conversacion = _get_or_create(
            session,
            Conversacion,
            defaults={
                "canal": "whatsapp",
                "estado": "activa",
                "contexto_meta": {
                    "conversation_id": "f7f26c90b947c1a4145633bf9b0a3a92",
                    "category": "utility",
                    "expiration": (datetime.utcnow() + timedelta(hours=18)).isoformat(),
                },
            },
            empresa_id=empresa.id,
            contacto_id=contacto.id,
            celular_id=celular.id,
        )

        mensaje = _get_or_create(
            session,
            Mensaje,
            defaults={
                "empresa_id": empresa.id,
                "celular_id": celular.id,
                "contacto_id": contacto.id,
                "direccion": "out",
                "tipo": "template",
                "contenido": {
                    "messaging_product": "whatsapp",
                    "to": CONTACT_NUMBER,
                    "template": HELLO_WORLD_TEMPLATE,
                },
                "status": "sent",
                "meta_payload": {
                    "messaging_product": "whatsapp",
                    "contacts": [{"input": CONTACT_NUMBER, "wa_id": "541156384310"}],
                    "messages": [
                        {
                            "id": "wamid.HBgMNTQxMTU2Mzg0MzEwFQIAEhggQTY2RDI1QkI0NzczQkU4NTk4QQA=",
                            "message_status": "sent",
                        }
                    ],
                },
                "sent_at": datetime.utcnow(),
            },
            conversacion_id=conversacion.id,
            meta_message_id="wamid.HBgMNTQxMTU2Mzg0MzEwFQIAEhggQTY2RDI1QkI0NzczQkU4NTk4QQA=",
        )

        _get_or_create(
            session,
            WebhookEvento,
            defaults={
                "empresa_id": empresa.id,
                "tipo_evento": "message-status",
                "raw_payload": {
                    "object": "whatsapp_business_account",
                    "entry": [
                        {
                            "id": "WHATSAPP-BUSINESS-ACCOUNT-ID",
                            "changes": [
                                {
                                    "value": {
                                        "messaging_product": "whatsapp",
                                        "statuses": [
                                            {
                                                "id": mensaje.meta_message_id,
                                                "status": "delivered",
                                                "timestamp": int(datetime.utcnow().timestamp()),
                                            }
                                        ],
                                    },
                                    "field": "messages",
                                }
                            ],
                        }
                    ],
                },
                "procesado": True,
                "processed_at": datetime.utcnow(),
            },
            empresa_id=empresa.id,
            meta_entry_id="WHATSAPP-BUSINESS-ACCOUNT-ID",
        )

        _get_or_create(
            session,
            PlantillaMeta,
            defaults={
                "empresa_id": empresa.id,
                "categoria": "utility",
                "idioma": "en_US",
                "estado_meta": "APPROVED",
                "variables": {"placeholders": 1},
                "ultima_revision": datetime.utcnow(),
            },
            empresa_id=empresa.id,
            nombre="hello_world",
        )

        _get_or_create(
            session,
            LogIntegracion,
            defaults={
                "empresa_id": empresa.id,
                "celular_id": celular.id,
                "scope": "send",
                "intent": "hello_world_template",
                "request_payload": {
                    "url": f"https://graph.facebook.com/v22.0/{PHONE_NUMBER_ID}/messages",
                    "body": {
                        "messaging_product": "whatsapp",
                        "to": CONTACT_NUMBER,
                        "type": "template",
                        "template": HELLO_WORLD_TEMPLATE,
                    },
                    "headers": {
                        "Authorization": f"Bearer {META_ACCESS_TOKEN_SAMPLE[:12]}...{META_ACCESS_TOKEN_SAMPLE[-6:]}",
                        "Content-Type": "application/json",
                    },
                },
                "response_payload": {
                    "status": 200,
                    "body": {
                        "messaging_product": "whatsapp",
                        "contacts": [{"input": CONTACT_NUMBER, "wa_id": "541156384310"}],
                        "messages": [{"id": mensaje.meta_message_id}],
                    },
                },
                "status_code": 200,
                "resultado": "ok",
            },
            empresa_id=empresa.id,
            intent="hello_world_template",
        )
        session.commit()


if __name__ == "__main__":
    init_db()
