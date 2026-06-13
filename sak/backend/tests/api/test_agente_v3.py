from sqlmodel import Session, select

from app.models import CRMContacto, CRMMensaje, CRMOportunidad, Proyecto, Setting, User
from app.models.constructora.pedido import ConstructoraPedido, ConstructoraPedidoDetalle
from app.modules.channels.persistence import ChannelEvent
from agente.v3.subprocesses.pedido_obra.interpreter import PedidoObraOperation


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


def _seed_obra(
    db_session: Session,
    *,
    telefono: str = "5491156384310",
    nombre: str = "La Rioja",
) -> Proyecto:
    user = User(nombre=f"Tester {nombre}", email=f"tester-{nombre.lower().replace(' ', '-')}-v3@example.com")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    contacto = CRMContacto(
        nombre_completo=f"Encargado {nombre}",
        telefonos=[telefono],
        responsable_id=user.id,
    )
    db_session.add(contacto)
    db_session.commit()
    db_session.refresh(contacto)
    oportunidad = CRMOportunidad(
        titulo=f"Oportunidad {nombre}",
        contacto_id=contacto.id,
        responsable_id=user.id,
        activo=True,
    )
    db_session.add(oportunidad)
    db_session.commit()
    db_session.refresh(oportunidad)
    proyecto = Proyecto(
        nombre=nombre,
        oportunidad_id=oportunidad.id,
        responsable_id=user.id,
    )
    db_session.add(proyecto)
    db_session.commit()
    db_session.refresh(proyecto)
    return proyecto


def test_agente_v3_meta_flow_enqueues_and_processes_message(client, db_session: Session, test_engine, monkeypatch):
    monkeypatch.setattr("app.modules.channels.v3.meta_channel.engine", test_engine)
    sent_calls: list[dict] = []

    async def fake_enviar_mensaje(**kwargs):
        sent_calls.append(kwargs)
        return {
            "status": "sent",
            "meta_message_id": "wamid.test.v3.outbound",
            "provider_message_type": "text",
            "raw_response": {"messages": [{"id": "wamid.test.v3.outbound"}]},
        }

    monkeypatch.setattr("app.modules.channels.v3.meta_channel.channel_gateway.enviar_mensaje", fake_enviar_mensaje)
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


def test_agente_v3_queue_smoke_aisla_contexto_default(client, db_session: Session, test_engine, monkeypatch):
    monkeypatch.setattr("app.modules.channels.v3.meta_channel.engine", test_engine)

    async def fake_enviar_mensaje(**kwargs):
        return {
            "status": "sent",
            "meta_message_id": "wamid.test.v3.queue.outbound",
            "provider_message_type": "text",
            "raw_response": {"messages": [{"id": "wamid.test.v3.queue.outbound"}]},
        }

    monkeypatch.setattr("app.modules.channels.v3.meta_channel.channel_gateway.enviar_mensaje", fake_enviar_mensaje)
    client.post("/api/agente/v3/inbox/reset")
    client.post("/api/agente/v3/inbox/reset", params={"queue": "smoke"})
    db_session.add(Setting(clave="channels.meta.phone_number_id", valor="1046006975257973"))
    db_session.commit()

    received = client.post(
        "/api/agente/v3/channel/meta",
        params={"queue": "smoke"},
        json=_set_meta_text(_meta_text_payload(external_message_id="wamid.test.v3.queue.smoke"), "Hola v3"),
    )

    assert received.status_code == 200
    assert client.get("/api/agente/v3/context/status").json()["count"] == 0
    smoke_context = client.get("/api/agente/v3/context/status", params={"queue": "smoke"}).json()
    assert smoke_context["queue"] == "smoke"
    assert smoke_context["count"] == 1
    assert smoke_context["contexts"][0]["conversation_id"] == "meta:1046006975257973:5491156384310"


def test_agente_v3_rechaza_queue_invalida(client, db_session: Session):
    response = client.get("/api/agente/v3/context/status", params={"queue": "test"})

    assert response.status_code == 400


def test_agente_v3_cancelar_cierra_conversacion_activa(client, db_session: Session, test_engine, monkeypatch):
    monkeypatch.setattr("app.modules.channels.v3.meta_channel.engine", test_engine)

    async def fake_enviar_mensaje(**kwargs):
        return {
            "status": "sent",
            "meta_message_id": f"out.{kwargs['texto'][:8]}",
            "provider_message_type": "text",
            "raw_response": {"messages": [{"id": "out.test"}]},
        }

    monkeypatch.setattr("app.modules.channels.v3.meta_channel.channel_gateway.enviar_mensaje", fake_enviar_mensaje)
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


def test_agente_v3_pedido_obra_carga_cierra_y_confirma(client, db_session: Session, test_engine, monkeypatch):
    monkeypatch.setattr("app.modules.channels.v3.meta_channel.engine", test_engine)
    monkeypatch.setattr("agente.v3.subprocesses.pedido_obra.handler.engine", test_engine)

    async def fake_enviar_mensaje(**kwargs):
        return {
            "status": "sent",
            "meta_message_id": f"out.{kwargs['texto'][:8]}",
            "provider_message_type": "text",
            "raw_response": {"messages": [{"id": "out.test"}]},
        }

    async def fake_interpret_carga(self, message, state):
        return [PedidoObraOperation(type="insert", descripcion="cemento", cantidad=10, unidad="bolsas")], 1

    monkeypatch.setattr("app.modules.channels.v3.meta_channel.channel_gateway.enviar_mensaje", fake_enviar_mensaje)
    monkeypatch.setattr(
        "agente.v3.subprocesses.pedido_obra.llm_client.PedidoObraCargaLLMClient.interpret_carga",
        fake_interpret_carga,
    )
    client.post("/api/agente/v3/inbox/reset")
    proyecto = _seed_obra(db_session)
    db_session.add(Setting(clave="channels.meta.phone_number_id", valor="1046006975257973"))
    db_session.commit()

    carga = client.post(
        "/api/agente/v3/channel/meta",
        json=_set_meta_text(
            _meta_text_payload(external_message_id="wamid.test.v3.pedido.carga"),
            "pedido de obra: 10 bolsas cemento",
        ),
    )
    fin = client.post(
        "/api/agente/v3/channel/meta",
        json=_set_meta_text(_meta_text_payload(external_message_id="wamid.test.v3.pedido.fin"), "FIN"),
    )
    confirmar = client.post(
        "/api/agente/v3/channel/meta",
        json=_set_meta_text(
            _meta_text_payload(external_message_id="wamid.test.v3.pedido.confirmar"),
            "1",
        ),
    )

    assert carga.status_code == 200
    assert fin.status_code == 200
    assert confirmar.status_code == 200

    context = client.get("/api/agente/v3/context/status")
    outbox = client.get("/api/agente/v3/outbox/status")

    assert context.json()["contexts"][0]["active_process"] is None
    assert context.json()["contexts"][0]["process_state"] == {}
    assert "*PEDIDO CONFIRMADO*" in outbox.json()["last_sent"]["text"]
    assert "Pedido #" in outbox.json()["last_sent"]["text"]
    assert "*Materiales*" in outbox.json()["last_sent"]["text"]
    assert "10 bolsas cemento" in outbox.json()["last_sent"]["text"]

    mensaje_confirmacion = db_session.exec(
        select(CRMMensaje).where(CRMMensaje.origen_externo_id == "wamid.test.v3.pedido.confirmar")
    ).first()
    assert mensaje_confirmacion is not None
    agent_v3 = mensaje_confirmacion.metadata_json["agent_v3"]
    assert agent_v3["conversation_id"] == "meta:1046006975257973:5491156384310"
    assert agent_v3["external_message_id"] == "wamid.test.v3.pedido.confirmar"
    assert agent_v3["result"]["pedido_listo"] is True
    assert agent_v3["result"]["items"][0]["descripcion"] == "cemento"
    assert agent_v3["channel_event_id"] is not None

    channel_event = db_session.get(ChannelEvent, agent_v3["channel_event_id"])
    assert channel_event is not None
    assert channel_event.external_message_id == "wamid.test.v3.pedido.confirmar"
    assert channel_event.normalized_payload["conversation_id"] == "meta:1046006975257973:5491156384310"

    pedido = db_session.exec(
        select(ConstructoraPedido).where(ConstructoraPedido.mensaje_origen_id == mensaje_confirmacion.id)
    ).first()
    assert pedido is not None
    assert pedido.oportunidad_id == proyecto.oportunidad_id
    assert pedido.contacto_id == mensaje_confirmacion.contacto_id
    assert pedido.metadata_json["agent_source"] == "agent_v3"
    assert mensaje_confirmacion.metadata_json["agent_v3"]["pedido_obra_id"] == pedido.id

    detalles = db_session.exec(
        select(ConstructoraPedidoDetalle).where(ConstructoraPedidoDetalle.pedido_id == pedido.id)
    ).all()
    assert len(detalles) == 1
    assert detalles[0].descripcion == "cemento"
    assert detalles[0].unidad_medida == "bolsas"

    nuevo = client.post(
        "/api/agente/v3/channel/meta",
        json=_set_meta_text(
            _meta_text_payload(external_message_id="wamid.test.v3.pedido.nuevo"),
            "pedido de obra: necesito 10 bolsas cemento",
        ),
    )

    assert nuevo.status_code == 200
    context = client.get("/api/agente/v3/context/status")
    state = context.json()["contexts"][0]["process_state"]
    assert context.json()["contexts"][0]["active_process"] == "pedidoObra"
    assert state["etapa"] == "carga"
    assert len(state["items"]) == 1
    assert state["items"][0]["descripcion"] == "cemento"


def test_agente_v3_pedido_obra_valida_cantidad_faltante(client, db_session: Session, test_engine, monkeypatch):
    monkeypatch.setattr("app.modules.channels.v3.meta_channel.engine", test_engine)
    monkeypatch.setattr("agente.v3.subprocesses.pedido_obra.handler.engine", test_engine)

    async def fake_enviar_mensaje(**kwargs):
        return {
            "status": "sent",
            "meta_message_id": f"out.{kwargs['texto'][:8]}",
            "provider_message_type": "text",
            "raw_response": {"messages": [{"id": "out.test"}]},
        }

    async def fake_interpret_carga(self, message, state):
        return [PedidoObraOperation(type="insert", descripcion="arena", cantidad=None, unidad=None)], 1

    monkeypatch.setattr("app.modules.channels.v3.meta_channel.channel_gateway.enviar_mensaje", fake_enviar_mensaje)
    monkeypatch.setattr(
        "agente.v3.subprocesses.pedido_obra.llm_client.PedidoObraCargaLLMClient.interpret_carga",
        fake_interpret_carga,
    )
    client.post("/api/agente/v3/inbox/reset")
    _seed_obra(db_session)
    db_session.add(Setting(clave="channels.meta.phone_number_id", valor="1046006975257973"))
    db_session.commit()

    carga = client.post(
        "/api/agente/v3/channel/meta",
        json=_set_meta_text(_meta_text_payload(external_message_id="wamid.test.v3.validacion.carga"), "pedido de obra: arena"),
    )
    fin = client.post(
        "/api/agente/v3/channel/meta",
        json=_set_meta_text(_meta_text_payload(external_message_id="wamid.test.v3.validacion.fin"), "FIN"),
    )

    assert carga.status_code == 200
    assert fin.status_code == 200

    context = client.get("/api/agente/v3/context/status")
    outbox = client.get("/api/agente/v3/outbox/status")

    assert context.json()["contexts"][0]["active_process"] == "pedidoObra"
    assert context.json()["contexts"][0]["process_state"]["etapa"] == "validacion"
    assert context.json()["contexts"][0]["process_state"]["pendientes_validacion"][0]["type"] == "cantidad_faltante"
    assert "Indica cantidad de arena." in outbox.json()["last_sent"]["text"]

    cantidad = client.post(
        "/api/agente/v3/channel/meta",
        json=_set_meta_text(_meta_text_payload(external_message_id="wamid.test.v3.validacion.cantidad"), "3mts"),
    )
    confirmar = client.post(
        "/api/agente/v3/channel/meta",
        json=_set_meta_text(_meta_text_payload(external_message_id="wamid.test.v3.validacion.confirmar"), "1"),
    )

    assert cantidad.status_code == 200
    assert confirmar.status_code == 200

    context = client.get("/api/agente/v3/context/status")
    outbox = client.get("/api/agente/v3/outbox/status")

    assert context.json()["contexts"][0]["active_process"] is None
    assert context.json()["contexts"][0]["process_state"] == {}
    assert "*PEDIDO CONFIRMADO*" in outbox.json()["last_sent"]["text"]
    assert "3 mts arena" in outbox.json()["last_sent"]["text"]


def test_agente_v3_pedido_obra_cierre_permite_modificar_y_mostrar(client, db_session: Session, test_engine, monkeypatch):
    monkeypatch.setattr("app.modules.channels.v3.meta_channel.engine", test_engine)
    monkeypatch.setattr("agente.v3.subprocesses.pedido_obra.handler.engine", test_engine)

    async def fake_enviar_mensaje(**kwargs):
        return {
            "status": "sent",
            "meta_message_id": f"out.{kwargs['texto'][:8]}",
            "provider_message_type": "text",
            "raw_response": {"messages": [{"id": "out.test"}]},
        }

    async def fake_interpret_carga(self, message, state):
        return [
            PedidoObraOperation(type="insert", descripcion="puertas", cantidad=3, unidad=None),
            PedidoObraOperation(type="insert", descripcion="baños", cantidad=4, unidad=None),
            PedidoObraOperation(type="insert", descripcion="arena fina", cantidad=3, unidad=None),
        ], 1

    async def fake_interpret_cierre(self, message, state):
        if "duchas" in message:
            return [PedidoObraOperation(type="insert", descripcion="duchas", cantidad=3, unidad=None)], 1
        return [PedidoObraOperation(type="show")], 1

    monkeypatch.setattr("app.modules.channels.v3.meta_channel.channel_gateway.enviar_mensaje", fake_enviar_mensaje)
    monkeypatch.setattr(
        "agente.v3.subprocesses.pedido_obra.llm_client.PedidoObraCargaLLMClient.interpret_carga",
        fake_interpret_carga,
    )
    monkeypatch.setattr(
        "agente.v3.subprocesses.pedido_obra.llm_client.PedidoObraCargaLLMClient.interpret_cierre",
        fake_interpret_cierre,
    )
    client.post("/api/agente/v3/inbox/reset")
    _seed_obra(db_session)
    db_session.add(Setting(clave="channels.meta.phone_number_id", valor="1046006975257973"))
    db_session.commit()

    client.post(
        "/api/agente/v3/channel/meta",
        json=_set_meta_text(_meta_text_payload(external_message_id="wamid.test.v3.cierre.carga"), "pedido de obra"),
    )
    client.post(
        "/api/agente/v3/channel/meta",
        json=_set_meta_text(_meta_text_payload(external_message_id="wamid.test.v3.cierre.fin"), "FIN"),
    )
    agrega = client.post(
        "/api/agente/v3/channel/meta",
        json=_set_meta_text(_meta_text_payload(external_message_id="wamid.test.v3.cierre.agrega"), "agrega 3 duchas"),
    )
    muestra = client.post(
        "/api/agente/v3/channel/meta",
        json=_set_meta_text(_meta_text_payload(external_message_id="wamid.test.v3.cierre.mostrar"), "mostrar pedido"),
    )

    assert agrega.status_code == 200
    assert muestra.status_code == 200

    context = client.get("/api/agente/v3/context/status")
    outbox = client.get("/api/agente/v3/outbox/status")

    assert context.json()["contexts"][0]["active_process"] == "pedidoObra"
    assert context.json()["contexts"][0]["process_state"]["etapa"] == "cierre"
    assert any(item["descripcion"] == "duchas" for item in context.json()["contexts"][0]["process_state"]["items"])
    assert "Pedido validado" in outbox.json()["last_sent"]["text"]
    assert "3 duchas" in outbox.json()["last_sent"]["text"]
    assert "Opciones: 1:CONFIRMAR 2:VOLVER 3:SALIR." in outbox.json()["last_sent"]["text"]


def test_agente_v3_pedido_obra_pide_obra_si_hay_multiples_asociadas(
    client,
    db_session: Session,
    test_engine,
    monkeypatch,
):
    monkeypatch.setattr("app.modules.channels.v3.meta_channel.engine", test_engine)
    monkeypatch.setattr("agente.v3.subprocesses.pedido_obra.handler.engine", test_engine)

    async def fake_enviar_mensaje(**kwargs):
        return {
            "status": "sent",
            "meta_message_id": f"out.{kwargs['texto'][:8]}",
            "provider_message_type": "text",
            "raw_response": {"messages": [{"id": "out.test"}]},
        }

    monkeypatch.setattr("app.modules.channels.v3.meta_channel.channel_gateway.enviar_mensaje", fake_enviar_mensaje)
    client.post("/api/agente/v3/inbox/reset")
    _seed_obra(db_session, nombre="La Rioja")
    _seed_obra(db_session, nombre="Axion Avenida")
    db_session.add(Setting(clave="channels.meta.phone_number_id", valor="1046006975257973"))
    db_session.commit()

    inicio = client.post(
        "/api/agente/v3/channel/meta",
        json=_set_meta_text(
            _meta_text_payload(external_message_id="wamid.test.v3.obra.multiple.inicio"),
            "pedido de obra: 10 bolsas cemento",
        ),
    )

    assert inicio.status_code == 200

    context = client.get("/api/agente/v3/context/status")
    outbox = client.get("/api/agente/v3/outbox/status")

    assert context.json()["contexts"][0]["active_process"] == "pedidoObra"
    assert context.json()["contexts"][0]["process_state"]["etapa"] == "inicial"
    assert "1: La Rioja" in outbox.json()["last_sent"]["text"]
    assert "2: Axion Avenida" in outbox.json()["last_sent"]["text"]

    seleccion = client.post(
        "/api/agente/v3/channel/meta",
        json=_set_meta_text(_meta_text_payload(external_message_id="wamid.test.v3.obra.multiple.sel"), "2"),
    )

    assert seleccion.status_code == 200

    context = client.get("/api/agente/v3/context/status")
    outbox = client.get("/api/agente/v3/outbox/status")

    assert context.json()["contexts"][0]["process_state"]["etapa"] == "carga"
    assert context.json()["contexts"][0]["process_state"]["proyecto_id"] is not None
    assert "Obra seleccionada" in outbox.json()["last_sent"]["text"]


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
