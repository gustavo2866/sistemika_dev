import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

from sqlmodel import select

import app.routers.crm_mensaje_router as crm_mensaje_router_module
from agente.v2.core.orchestrator import AgentTurnOrchestrator
from agente.v2.core.models import (
    DeliveryMode,
    ItemOperation,
    MaterialItem,
    MaterialRequestState,
    NormalTurnDecision,
    ProcessTurnCommand,
    SendResult,
    TurnTrigger,
)
from agente.v2.infrastructure.channels.crm_channel_adapter import CRMOutboundChannelAdapter
from agente.v2.processes.solicitud_materiales.handler import build_v2_dependencies
from app.models import CRMCelular, CRMContacto, CRMMensaje, CRMOportunidad, Proyecto, Setting, User
from app.models.enums import EstadoOportunidad
from app.services.meta_webhook_service import MetaWebhookService


def _seed_context(db_session, *, latest_message: str) -> tuple[int, int]:
    user = User(nombre="Tester V2 Arquitectura", email="tester-v2-architecture@example.com")
    db_session.add(user)
    db_session.flush()

    contacto = CRMContacto(
        nombre_completo="Cliente V2 Arquitectura",
        telefonos=["+5491111111111"],
        email="cliente-v2-architecture@example.com",
        responsable_id=user.id,
    )
    db_session.add(contacto)
    db_session.flush()

    oportunidad = CRMOportunidad(
        titulo="Oportunidad V2 Arquitectura",
        contacto_id=contacto.id,
        responsable_id=user.id,
        estado=EstadoOportunidad.PROSPECT.value,
        activo=True,
    )
    db_session.add(oportunidad)
    db_session.flush()

    proyecto = Proyecto(
        nombre="Proyecto V2 Arquitectura",
        responsable_id=user.id,
        oportunidad_id=oportunidad.id,
    )
    db_session.add(proyecto)
    db_session.flush()

    mensaje = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        contacto_id=contacto.id,
        oportunidad_id=oportunidad.id,
        contenido=latest_message,
        estado="recibido",
        contacto_referencia="+5491111111111",
    )
    db_session.add(mensaje)
    db_session.commit()
    db_session.refresh(mensaje)
    return oportunidad.id, mensaje.id


def _seed_non_project_context(db_session, *, latest_message: str) -> tuple[int, int]:
    user = User(nombre="Tester V2 Sin Proyecto", email="tester-v2-no-project@example.com")
    db_session.add(user)
    db_session.flush()

    contacto = CRMContacto(
        nombre_completo="Cliente V2 Sin Proyecto",
        telefonos=["+5491111111112"],
        email="cliente-v2-no-project@example.com",
        responsable_id=user.id,
    )
    db_session.add(contacto)
    db_session.flush()

    oportunidad = CRMOportunidad(
        titulo="Oportunidad V2 Sin Proyecto",
        contacto_id=contacto.id,
        responsable_id=user.id,
        estado=EstadoOportunidad.PROSPECT.value,
        activo=True,
    )
    db_session.add(oportunidad)
    db_session.flush()

    mensaje = CRMMensaje(
        tipo="entrada",
        canal="whatsapp",
        contacto_id=contacto.id,
        oportunidad_id=oportunidad.id,
        contenido=latest_message,
        estado="recibido",
        contacto_referencia="+5491111111112",
    )
    db_session.add(mensaje)
    db_session.commit()
    db_session.refresh(mensaje)
    return oportunidad.id, mensaje.id


def _persist_ready_request(agent, oportunidad_id: int, ultimo_mensaje_id: int | None = None) -> MaterialRequestState:
    request_state = MaterialRequestState(
        oportunidad_id=oportunidad_id,
        items=[
            MaterialItem(
                descripcion="cemento",
                cantidad=10,
                unidad="bolsa",
                familia="cementicios",
                atributos={"tipo": "portland"},
            )
        ],
    )
    request_state = agent._request_validator.refresh(request_state)
    return agent._request_store.save(request_state, ultimo_mensaje_id)


def test_chat_ai_v2_preview_idempotence_returns_cached_result(client, db_session, monkeypatch, tmp_path):
    context_loader, agent = build_v2_dependencies(requests_root=tmp_path)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_CONTEXT_LOADER", context_loader)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_AGENT", agent)

    oportunidad_id, _ = _seed_context(db_session, latest_message="Hola")
    calls = {"count": 0}

    def fake_normal_turn(context, prompt_families):
        calls["count"] += 1
        return NormalTurnDecision(decision_type="smalltalk", reply_to_user="Hola, en que te ayudo?")

    monkeypatch.setattr(agent._llm_client, "interpret_normal_turn", fake_normal_turn)

    first = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2")
    second = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2")

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["cached"] is False
    assert second.json()["cached"] is True
    assert calls["count"] == 1


def test_chat_ai_v2_auto_send_reuses_cached_preview_without_reprocessing(db_session, monkeypatch, tmp_path):
    context_loader, agent = build_v2_dependencies(requests_root=tmp_path)
    oportunidad_id, message_id = _seed_context(db_session, latest_message="Hola")
    calls = {"count": 0}
    sends = {"count": 0}

    def fake_normal_turn(context, prompt_families):
        calls["count"] += 1
        return NormalTurnDecision(decision_type="smalltalk", reply_to_user="Hola, en que te ayudo?")

    class FakeChannelAdapter:
        async def send_text(self, session, command):
            sends["count"] += 1
            return SendResult(sent=True, status="sent", outbound_message_id=999)

    monkeypatch.setattr(agent._llm_client, "interpret_normal_turn", fake_normal_turn)
    orchestrator = AgentTurnOrchestrator(
        context_loader=context_loader,
        agent=agent,
        channel_adapter=FakeChannelAdapter(),
    )

    preview = asyncio.run(
        orchestrator.process_turn(
            db_session,
            ProcessTurnCommand(
                message_id=message_id,
                trigger=TurnTrigger.MANUAL_BUTTON,
                delivery_mode=DeliveryMode.PREVIEW_ONLY,
            ),
        )
    )
    sent = asyncio.run(
        orchestrator.process_turn(
            db_session,
            ProcessTurnCommand(
                message_id=message_id,
                trigger=TurnTrigger.RETRY,
                delivery_mode=DeliveryMode.AUTO_SEND,
            ),
        )
    )

    assert preview["cached"] is False
    assert sent["cached"] is True
    assert sent["delivery"]["sent"] is True
    assert calls["count"] == 1
    assert sends["count"] == 1

    stored_state = context_loader._state_repository.load(oportunidad_id)
    assert stored_state.last_processed_message_id == message_id
    assert stored_state.last_outbound_message_id == 999


def test_chat_ai_v2_webhook_manual_mode_defers_processing(db_session, monkeypatch, tmp_path):
    context_loader, agent = build_v2_dependencies(requests_root=tmp_path)
    oportunidad_id, message_id = _seed_context(db_session, latest_message="Hola")
    calls = {"count": 0}

    def fake_normal_turn(context, prompt_families):
        calls["count"] += 1
        return NormalTurnDecision(decision_type="smalltalk", reply_to_user="Hola, en que te ayudo?")

    monkeypatch.setattr(agent._llm_client, "interpret_normal_turn", fake_normal_turn)
    orchestrator = AgentTurnOrchestrator(
        context_loader=context_loader,
        agent=agent,
    )

    result = asyncio.run(
        orchestrator.process_turn(
            db_session,
            ProcessTurnCommand(
                message_id=message_id,
                trigger=TurnTrigger.WEBHOOK,
                delivery_mode=DeliveryMode.AUTO_SEND,
                requested_mode="manual",
            ),
        )
    )

    assert result["type"] == "agent_deferred"
    assert result["skipped"] is True
    assert result["agent_mode"] == "manual"
    assert result["delivery"]["sent"] is False
    assert result["delivery"]["status"] == "deferred"
    assert calls["count"] == 0

    stored_state = context_loader._state_repository.load(oportunidad_id)
    assert stored_state.agent_mode == "manual"
    assert stored_state.last_inbound_message_id == message_id
    assert stored_state.last_processed_message_id is None


def test_chat_agent_config_endpoint_returns_default_mode_when_setting_is_missing(client, monkeypatch):
    monkeypatch.delenv("CRM_CHAT_AGENT_MODE", raising=False)

    response = client.get("/crm/chat-agent/config")
    assert response.status_code == 200
    body = response.json()
    assert body["agent_mode"] == "manual"
    assert body["source"] == "default"
    assert body["setting"] is None


def test_chat_agent_config_endpoint_persists_mode_and_orchestrator_uses_setting(
    client,
    db_session,
    monkeypatch,
    tmp_path,
):
    monkeypatch.setenv("CRM_CHAT_AGENT_MODE", "manual")
    context_loader, agent = build_v2_dependencies(requests_root=tmp_path)

    response = client.put("/crm/chat-agent/config", json={"agent_mode": "automatic"})
    assert response.status_code == 200
    body = response.json()
    assert body["agent_mode"] == "automatic"
    assert body["source"] == "setting"
    assert body["setting"]["clave"] == "crm_chat_agent_mode"
    assert body["setting"]["valor"] == "automatic"

    persisted_setting = db_session.exec(
        select(Setting).where(Setting.clave == "crm_chat_agent_mode").limit(1)
    ).first()
    assert persisted_setting is not None
    assert persisted_setting.valor == "automatic"

    _, message_id = _seed_context(db_session, latest_message="Hola")
    calls = {"count": 0}

    def fake_normal_turn(context, prompt_families):
        calls["count"] += 1
        return NormalTurnDecision(decision_type="smalltalk", reply_to_user="Hola, en que te ayudo?")

    monkeypatch.setattr(agent._llm_client, "interpret_normal_turn", fake_normal_turn)
    orchestrator = AgentTurnOrchestrator(
        context_loader=context_loader,
        agent=agent,
    )

    result = asyncio.run(
        orchestrator.process_turn(
            db_session,
            ProcessTurnCommand(
                message_id=message_id,
                trigger=TurnTrigger.WEBHOOK,
                delivery_mode=DeliveryMode.PREVIEW_ONLY,
            ),
        )
    )

    assert result["type"] == "chat_reply"
    assert result["delivery"]["status"] == "preview"
    assert calls["count"] == 1


def test_chat_agent_config_endpoint_rejects_invalid_mode(client):
    response = client.put("/crm/chat-agent/config", json={"agent_mode": "otro"})
    assert response.status_code == 400
    assert "agent_mode invalido" in response.json()["detail"]


def test_chat_ai_v2_webhook_automatic_mode_processes_turn(db_session, monkeypatch, tmp_path):
    context_loader, agent = build_v2_dependencies(requests_root=tmp_path)
    _, message_id = _seed_context(db_session, latest_message="Hola")
    calls = {"count": 0}
    sends = {"count": 0}

    def fake_normal_turn(context, prompt_families):
        calls["count"] += 1
        return NormalTurnDecision(decision_type="smalltalk", reply_to_user="Hola, en que te ayudo?")

    class FakeChannelAdapter:
        async def send_text(self, session, command):
            sends["count"] += 1
            return SendResult(sent=True, status="sent", outbound_message_id=321)

    monkeypatch.setattr(agent._llm_client, "interpret_normal_turn", fake_normal_turn)
    orchestrator = AgentTurnOrchestrator(
        context_loader=context_loader,
        agent=agent,
        channel_adapter=FakeChannelAdapter(),
    )

    result = asyncio.run(
        orchestrator.process_turn(
            db_session,
            ProcessTurnCommand(
                message_id=message_id,
                trigger=TurnTrigger.WEBHOOK,
                delivery_mode=DeliveryMode.AUTO_SEND,
                requested_mode="automatic",
            ),
        )
    )

    assert result["type"] == "chat_reply"
    assert result["delivery"]["sent"] is True
    assert calls["count"] == 1
    assert sends["count"] == 1


def test_chat_ai_v2_manual_button_processes_even_in_manual_mode(db_session, monkeypatch, tmp_path):
    context_loader, agent = build_v2_dependencies(requests_root=tmp_path)
    oportunidad_id, message_id = _seed_context(db_session, latest_message="Hola")
    calls = {"count": 0}

    def fake_normal_turn(context, prompt_families):
        calls["count"] += 1
        return NormalTurnDecision(decision_type="smalltalk", reply_to_user="Hola, en que te ayudo?")

    monkeypatch.setattr(agent._llm_client, "interpret_normal_turn", fake_normal_turn)
    orchestrator = AgentTurnOrchestrator(
        context_loader=context_loader,
        agent=agent,
    )

    result = asyncio.run(
        orchestrator.process_turn(
            db_session,
            ProcessTurnCommand(
                message_id=message_id,
                trigger=TurnTrigger.MANUAL_BUTTON,
                delivery_mode=DeliveryMode.PREVIEW_ONLY,
                requested_mode="manual",
            ),
        )
    )

    assert result["type"] == "chat_reply"
    assert result["delivery"]["status"] == "preview"
    assert calls["count"] == 1

    stored_state = context_loader._state_repository.load(oportunidad_id)
    assert stored_state.agent_mode == "manual"
    assert stored_state.last_processed_message_id == message_id


def test_meta_webhook_service_always_delegates_to_orchestrator(db_session):
    user = User(nombre="Tester Webhook Delegation", email="tester-webhook-delegation@example.com")
    db_session.add(user)
    db_session.flush()

    contacto = CRMContacto(
        nombre_completo="Cliente Webhook Delegation",
        telefonos=["+5491111111199"],
        email="cliente-webhook-delegation@example.com",
        responsable_id=user.id,
    )
    db_session.add(contacto)
    db_session.flush()

    oportunidad = CRMOportunidad(
        titulo="Oportunidad Webhook Delegation",
        contacto_id=contacto.id,
        responsable_id=user.id,
        estado=EstadoOportunidad.PROSPECT.value,
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
        contacto_referencia="+5491111111199",
        origen_externo_id="wamid.test.webhook.agent",
    )
    db_session.add(mensaje)

    celular = CRMCelular(
        meta_celular_id=str(uuid4()),
        numero_celular="+5491111000099",
        alias="Linea webhook test",
        activo=True,
    )
    db_session.add(celular)
    db_session.commit()
    db_session.refresh(celular)
    db_session.refresh(mensaje)

    calls: dict[str, object] = {}

    class FakeOrchestrator:
        async def process_turn(self, session, command):
            calls["count"] = int(calls.get("count", 0)) + 1
            calls["command"] = command
            return {
                "type": "agent_deferred",
                "skipped": True,
                "reason": "modalidad_manual_en_webhook",
                "agent_mode": "manual",
            }

    service = MetaWebhookService(db_session, orchestrator=FakeOrchestrator())
    service._find_existing_inbound_message = lambda external_message_id: mensaje

    msg = SimpleNamespace(
        id=uuid4(),
        meta_message_id="wamid.test.webhook.agent",
        from_phone="+5491111111199",
        from_name="Cliente Webhook Delegation",
        to_phone="+5491111000099",
        direccion="in",
        tipo="text",
        texto="Hola",
        media_id=None,
        caption=None,
        filename=None,
        mime_type=None,
        status="received",
        meta_timestamp=datetime.now(UTC),
        created_at=datetime.now(UTC),
    )

    result = asyncio.run(service._handle_inbound_message(msg, celular))

    assert calls["count"] == 1
    command = calls["command"]
    assert command.trigger == TurnTrigger.WEBHOOK
    assert command.delivery_mode == DeliveryMode.AUTO_SEND
    assert result["agent_result"]["type"] == "agent_deferred"


def test_chat_ai_v2_persists_active_process_and_process_state(client, db_session, monkeypatch, tmp_path):
    context_loader, agent = build_v2_dependencies(requests_root=tmp_path)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_CONTEXT_LOADER", context_loader)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_AGENT", agent)

    oportunidad_id, message_id = _seed_context(db_session, latest_message="Necesito 10 bolsas de cemento")

    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda context, prompt_families: NormalTurnDecision(
            decision_type="request_operation",
            operations=[
                ItemOperation(
                    action="add",
                    descripcion="cemento",
                    familia="cementicios",
                    cantidad=10,
                    unidad="bolsa",
                )
            ],
        ),
    )

    response = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2")
    assert response.status_code == 200

    stored_state = context_loader._state_repository.load(oportunidad_id)
    assert stored_state.active_process == "solicitud_materiales"
    assert stored_state.active_substate == "completa_atributos"
    assert stored_state.last_processed_message_id == message_id
    assert "solicitud_materiales" in stored_state.process_states
    process_state = stored_state.process_states["solicitud_materiales"]
    assert process_state["pending_query"]["attribute_name"] == "tipo"
    assert process_state["last_user_intent"] == "add"


def test_chat_ai_v2_persists_revision_state_when_request_is_ready(client, db_session, monkeypatch, tmp_path):
    context_loader, agent = build_v2_dependencies(requests_root=tmp_path)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_CONTEXT_LOADER", context_loader)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_AGENT", agent)

    oportunidad_id, _ = _seed_context(db_session, latest_message="mostrame la solicitud")
    _persist_ready_request(agent, oportunidad_id)

    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda context, prompt_families: NormalTurnDecision(
            decision_type="request_operation",
            operations=[ItemOperation(action="show_request")],
        ),
    )

    response = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2")
    assert response.status_code == 200
    body = response.json()
    assert body["workflow"]["mode"] == "revision"
    assert body["workflow"]["awaiting_user_decision"] == "continue_or_close"

    stored_state = context_loader._state_repository.load(oportunidad_id)
    assert stored_state.active_substate == "revision"
    process_state = stored_state.process_states["solicitud_materiales"]
    assert process_state["awaiting_user_decision"] == "continue_or_close"
    assert process_state["ready_for_confirmation"] is True
    assert process_state["last_request_action"] == "show"


def test_chat_ai_v2_manual_endpoint_accepts_requested_process_and_mode(client, db_session, monkeypatch, tmp_path):
    context_loader, agent = build_v2_dependencies(requests_root=tmp_path)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_CONTEXT_LOADER", context_loader)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_AGENT", agent)

    oportunidad_id, _ = _seed_context(db_session, latest_message="Hola")
    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda context, prompt_families: NormalTurnDecision(decision_type="smalltalk", reply_to_user="Hola."),
    )

    response = client.post(
        f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2",
        json={
            "requested_process": "solicitud_materiales",
            "requested_mode": "hybrid",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["execution"]["requested_process"] == "solicitud_materiales"
    assert body["execution"]["requested_mode"] == "hybrid"


def test_chat_ai_v2_manual_endpoint_accepts_auto_send(client, db_session, monkeypatch, tmp_path):
    context_loader, agent = build_v2_dependencies(requests_root=tmp_path)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_CONTEXT_LOADER", context_loader)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_AGENT", agent)

    oportunidad_id, _ = _seed_context(db_session, latest_message="Hola")
    sends = {"count": 0}

    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda context, prompt_families: NormalTurnDecision(decision_type="smalltalk", reply_to_user="Hola."),
    )

    async def fake_send_text(self, session, command):
        sends["count"] += 1
        return SendResult(sent=True, status="sent", outbound_message_id=777)

    monkeypatch.setattr(CRMOutboundChannelAdapter, "send_text", fake_send_text)

    response = client.post(
        f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2",
        json={
            "delivery_mode": "auto_send",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["delivery_mode"] == "auto_send"
    assert body["delivery"]["sent"] is True
    assert sends["count"] == 1

    stored_state = context_loader._state_repository.load(oportunidad_id)
    assert stored_state.last_outbound_message_id == 777


def test_chat_ai_v2_auto_send_show_request_sends_summary_for_ready_request(db_session, monkeypatch, tmp_path):
    context_loader, agent = build_v2_dependencies(requests_root=tmp_path)
    _, message_id = _seed_context(db_session, latest_message="mostrar solicitud")
    _persist_ready_request(agent, db_session.get(CRMMensaje, message_id).oportunidad_id, ultimo_mensaje_id=message_id)
    sent_payload: dict[str, str] = {}

    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda context, prompt_families: NormalTurnDecision(
            decision_type="request_operation",
            operations=[ItemOperation(action="show_request")],
        ),
    )

    class FakeChannelAdapter:
        async def send_text(self, session, command):
            sent_payload["contenido"] = command.contenido
            return SendResult(sent=True, status="sent", outbound_message_id=778)

    orchestrator = AgentTurnOrchestrator(
        context_loader=context_loader,
        agent=agent,
        channel_adapter=FakeChannelAdapter(),
    )

    result = asyncio.run(
        orchestrator.process_turn(
            db_session,
            ProcessTurnCommand(
                message_id=message_id,
                trigger=TurnTrigger.MANUAL_BUTTON,
                delivery_mode=DeliveryMode.AUTO_SEND,
            ),
        )
    )

    assert result["type"] == "material_request"
    assert result["request_action"] == "show"
    assert result["delivery"]["sent"] is True
    assert sent_payload["contenido"].startswith("Te detallo la solicitud:")
    assert "10 bolsa cemento" in sent_payload["contenido"]
    assert "tipo: portland" in sent_payload["contenido"]


def test_chat_ai_v2_manual_endpoint_rejects_invalid_delivery_mode(client, db_session, monkeypatch, tmp_path):
    context_loader, agent = build_v2_dependencies(requests_root=tmp_path)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_CONTEXT_LOADER", context_loader)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_AGENT", agent)

    oportunidad_id, _ = _seed_context(db_session, latest_message="Hola")

    response = client.post(
        f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2",
        json={
            "delivery_mode": "invalid_mode",
        },
    )
    assert response.status_code == 400
    assert "delivery_mode invalido" in response.json()["detail"]


def test_chat_ai_v2_audit_includes_actions_and_prompts(client, db_session, monkeypatch, tmp_path):
    context_loader, agent = build_v2_dependencies(requests_root=tmp_path)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_CONTEXT_LOADER", context_loader)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_AGENT", agent)

    oportunidad_id, message_id = _seed_context(db_session, latest_message="Necesito 10 bolsas de cemento")
    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda context, prompt_families: NormalTurnDecision(
            decision_type="request_operation",
            operations=[
                ItemOperation(
                    action="add",
                    descripcion="cemento",
                    familia="cementicios",
                    cantidad=10,
                    unidad="bolsa",
                )
            ],
        ),
    )

    response = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2")
    assert response.status_code == 200
    body = response.json()
    execution = body["execution"]
    assert execution["process_name"] == "solicitud_materiales"
    assert execution["audit"]["debug"]["prompts_used"] == ["normal_turn"]
    assert any(action["type"] == "add_item" for action in execution["audit"]["actions"])

    mensaje = db_session.get(CRMMensaje, message_id)
    assert mensaje is not None
    assert mensaje.metadata_json["agent_v2"]["process_name"] == "solicitud_materiales"


def test_chat_ai_v2_skips_non_project_opportunity(client, db_session, monkeypatch, tmp_path):
    context_loader, agent = build_v2_dependencies(requests_root=tmp_path)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_CONTEXT_LOADER", context_loader)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_AGENT", agent)

    oportunidad_id, message_id = _seed_non_project_context(db_session, latest_message="Necesito 10 bolsas de cemento")

    response = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2")
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "no_process"
    assert body["skipped"] is True
    assert "No hay procesos disponibles" in body["reason"]

    stored_state = context_loader._state_repository.load(oportunidad_id)
    assert stored_state.last_processed_message_id == message_id
    assert stored_state.active_process is None


def test_chat_ai_v2_channel_adapter_forwards_source_message_id(monkeypatch):
    captured_payload: dict[str, object] = {}

    async def fake_send_message(session, payload):
        captured_payload.update(payload)
        return {
            "status": "sent",
            "mensaje_salida": SimpleNamespace(id=321),
            "meta_message_id": "wamid.agent.v2.test",
        }

    monkeypatch.setattr("agente.v2.infrastructure.channels.crm_channel_adapter.crm_mensaje_service.enviar_mensaje", fake_send_message)

    adapter = CRMOutboundChannelAdapter()
    result = asyncio.run(
        adapter.send_text(
            None,
            SimpleNamespace(
                contenido="Perfecto, sigo con la solicitud.",
                contacto_id=10,
                oportunidad_id=20,
                responsable_id=30,
                contacto_referencia="+5491111111111",
                canal="whatsapp",
                metadata={"source_message_id": 99},
            ),
        )
    )

    assert captured_payload["metadata"] == {"source_message_id": 99}
    assert result.outbound_message_id == 321
    assert result.meta_message_id == "wamid.agent.v2.test"
