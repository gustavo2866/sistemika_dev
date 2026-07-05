from app.models import Setting
from app.modules.channels.providers.meta.webhook import raw_meta_to_channel_payloads


def test_raw_meta_message_payload_is_normalized(db_session):
    db_session.add(
        Setting(
            clave="channels.meta.phone_number_id",
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

    result = raw_meta_to_channel_payloads(db_session, payload)

    assert len(result) == 1
    normalized = result[0]
    assert normalized["event_type"] == "message.received"
    assert normalized["mensaje"]["meta_message_id"] == "wamid.test.inbound"
    assert normalized["mensaje"]["from_phone"] == "5491156384310"
    assert normalized["mensaje"]["from_name"] == "Cliente Test"
    assert normalized["mensaje"]["texto"] == "Hola"
    assert normalized["mensaje"]["celular"]["id"] == "d5b32193-e39d-5d27-9180-01f69e4a3911"


def test_raw_meta_audio_payload_is_normalized(db_session):
    db_session.add(
        Setting(
            clave="channels.meta.phone_number_id",
            valor="1046006975257973",
        )
    )
    db_session.commit()

    result = raw_meta_to_channel_payloads(
        db_session,
        {
            "entry": [
                {
                    "changes": [
                        {
                            "value": {
                                "metadata": {
                                    "display_phone_number": "5493816259343",
                                    "phone_number_id": "1046006975257973",
                                },
                                "messages": [
                                    {
                                        "from": "5491156384310",
                                        "id": "wamid.test.audio",
                                        "timestamp": "1779282000",
                                        "type": "audio",
                                        "audio": {
                                            "id": "media-audio-1",
                                            "mime_type": "audio/ogg; codecs=opus",
                                        },
                                    }
                                ],
                            }
                        }
                    ]
                }
            ]
        },
    )

    assert len(result) == 1
    normalized = result[0]["mensaje"]
    assert normalized["tipo"] == "audio"
    assert normalized["texto"] is None
    assert normalized["media_id"] == "media-audio-1"
    assert normalized["mime_type"] == "audio/ogg; codecs=opus"


def test_raw_meta_interactive_list_reply_is_normalized(db_session):
    db_session.add(
        Setting(
            clave="channels.meta.phone_number_id",
            valor="1046006975257973",
        )
    )
    db_session.commit()

    result = raw_meta_to_channel_payloads(
        db_session,
        {
            "entry": [
                {
                    "changes": [
                        {
                            "value": {
                                "metadata": {
                                    "display_phone_number": "5493816259343",
                                    "phone_number_id": "1046006975257973",
                                },
                                "messages": [
                                    {
                                        "from": "5491156384310",
                                        "id": "wamid.test.interactive",
                                        "timestamp": "1779282000",
                                        "type": "interactive",
                                        "interactive": {
                                            "type": "list_reply",
                                            "list_reply": {
                                                "id": "parte_fecha:2026-06-28",
                                                "title": "28/06/2026 dom",
                                                "description": "sin cargar",
                                            },
                                        },
                                    }
                                ],
                            }
                        }
                    ]
                }
            ]
        },
    )

    assert len(result) == 1
    normalized = result[0]["mensaje"]
    assert normalized["tipo"] == "interactive"
    assert normalized["texto"] == "parte_fecha:2026-06-28"


def test_raw_meta_status_payload_is_normalized(db_session):
    db_session.add(
        Setting(
            clave="channels.meta.phone_number_id",
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
                                    "status": "failed",
                                    "timestamp": "1779282000",
                                    "recipient_id": "5491156384310",
                                    "errors": [
                                        {
                                            "code": 131047,
                                            "title": "Re-engagement message",
                                        }
                                    ],
                                }
                            ],
                        }
                    }
                ]
            }
        ]
    }

    result = raw_meta_to_channel_payloads(db_session, payload)

    assert len(result) == 1
    normalized = result[0]
    assert normalized["event_type"] == "message.failed"
    assert normalized["mensaje"]["direccion"] == "out"
    assert normalized["mensaje"]["from_phone"] == "5493816259343"
    assert normalized["mensaje"]["to_phone"] == "5491156384310"
    assert normalized["mensaje"]["status"] == "failed"
    assert normalized["mensaje"]["meta_message_id"] == "wamid.test.outbound"
    assert normalized["mensaje"]["errors"][0]["code"] == 131047

