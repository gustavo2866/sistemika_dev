from app.models import Setting
from app.modules.channels.providers.meta.webhook import raw_meta_to_metaw_payloads


def test_raw_meta_message_payload_is_normalized(db_session):
    db_session.add(
        Setting(
            clave="channels.meta.accounts.56953906-7099-4d1a-8379-3174d732d21e.phone_number_id",
            valor="1046006975257973",
        )
    )
    db_session.commit()

    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "1516474752918083",
                "changes": [
                    {
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
                                    "id": "wamid.test.inbound",
                                    "timestamp": "1779282000",
                                    "type": "text",
                                    "text": {"body": "Hola"},
                                }
                            ],
                        },
                        "field": "messages",
                    }
                ],
            }
        ],
    }

    result = raw_meta_to_metaw_payloads(db_session, payload)

    assert len(result) == 1
    normalized = result[0]
    assert normalized["event_type"] == "message.received"
    assert normalized["mensaje"]["meta_message_id"] == "wamid.test.inbound"
    assert normalized["mensaje"]["from_phone"] == "5491156384310"
    assert normalized["mensaje"]["from_name"] == "Cliente Test"
    assert normalized["mensaje"]["texto"] == "Hola"
    assert normalized["mensaje"]["celular"]["id"] == "56953906-7099-4d1a-8379-3174d732d21e"


def test_raw_meta_status_payload_is_normalized(db_session):
    db_session.add(
        Setting(
            clave="channels.meta.accounts.56953906-7099-4d1a-8379-3174d732d21e.phone_number_id",
            valor="1046006975257973",
        )
    )
    db_session.commit()

    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "metadata": {
                                "display_phone_number": "5493816259343",
                                "phone_number_id": "1046006975257973",
                            },
                            "statuses": [
                                {
                                    "id": "wamid.test.outbound",
                                    "status": "delivered",
                                    "timestamp": "1779282000",
                                    "recipient_id": "5491156384310",
                                }
                            ],
                        }
                    }
                ]
            }
        ]
    }

    result = raw_meta_to_metaw_payloads(db_session, payload)

    assert len(result) == 1
    normalized = result[0]
    assert normalized["event_type"] == "message.delivered"
    assert normalized["mensaje"]["direccion"] == "out"
    assert normalized["mensaje"]["status"] == "delivered"
    assert normalized["mensaje"]["meta_message_id"] == "wamid.test.outbound"

