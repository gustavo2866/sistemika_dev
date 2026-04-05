import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import openai
import pytest
from httpx import Request
from sqlmodel import select

import app.routers.crm_mensaje_router as crm_mensaje_router_module
from agente.v2.core.orchestrator import AgentTurnOrchestrator
from agente.v2.core.process import ProcessRegistry
from agente.v2.core.delivery import SendResult
from agente.v2.processes.solicitud_materiales.models import (
    ItemOperation,
    MaterialItem,
    MaterialRequestState,
    NormalTurnDecision,
    PendingTurnDecision,
)
from agente.v2.infrastructure.channels.crm_channel_adapter import CRMOutboundChannelAdapter
from agente.v2.processes.solicitud_materiales.handler import build_v2_dependencies
from agente.v2.processes.solicitud_materiales.llm_client import OpenAIConversationAgentClientV2
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


def test_openai_conversation_agent_client_strips_api_key_from_env(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-key\r\n")

    client = OpenAIConversationAgentClientV2()

    assert client.api_key == "sk-test-key"


def test_openai_conversation_agent_client_maps_connection_errors(monkeypatch, tmp_path):
    prompt_path = tmp_path / "prompt.txt"
    prompt_path.write_text("Responde en JSON", encoding="utf-8")

    class FakeResponses:
        @staticmethod
        def create(**kwargs):
            raise openai.APIConnectionError(request=Request("POST", "https://api.openai.com/v1/responses"))

    class FakeClient:
        responses = FakeResponses()

    client = OpenAIConversationAgentClientV2(api_key="sk-test-key")
    client._client = FakeClient()

    with pytest.raises(ValueError, match="No se pudo conectar a OpenAI"):
        client._run_json_prompt(prompt_path, {"ping": True})


def test_chat_ai_v2_preview_idempotence_returns_cached_result(client, db_session, monkeypatch, tmp_path):
    state_store, agent = build_v2_dependencies(requests_root=tmp_path)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_STATE_STORE", state_store)
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


def test_chat_ai_v2_cached_result_reuses_previous_execution_without_reprocessing(db_session, monkeypatch, tmp_path):
    state_store, agent = build_v2_dependencies(requests_root=tmp_path)
    _, message_id = _seed_context(db_session, latest_message="Hola")
    calls = {"count": 0}

    def fake_normal_turn(context, prompt_families):
        calls["count"] += 1
        return NormalTurnDecision(decision_type="smalltalk", reply_to_user="Hola, en que te ayudo?")

    monkeypatch.setattr(agent._llm_client, "interpret_normal_turn", fake_normal_turn)
    orchestrator = AgentTurnOrchestrator(
        processes=[agent],
        state_store=state_store,
    )

    first = asyncio.run(
        orchestrator.process_turn(db_session, message_id, "manual_button")
    )
    second = asyncio.run(
        orchestrator.process_turn(db_session, message_id, "manual_button")
    )

    assert first["cached"] is False
    assert second["cached"] is True
    assert calls["count"] == 1


def test_chat_agent_config_endpoint_returns_default_mode_when_setting_is_missing(client, monkeypatch):
    monkeypatch.delenv("CRM_CHAT_AGENT_MODE", raising=False)

    response = client.get("/crm/chat-agent/config")
    assert response.status_code == 200
    body = response.json()
    assert body["agent_mode"] == "manual"
    assert body["source"] == "default"
    assert body["setting"] is None


def test_chat_agent_config_endpoint_persists_mode_and_webhook_uses_setting(
    client,
    db_session,
    monkeypatch,
    tmp_path,
):
    monkeypatch.setenv("CRM_CHAT_AGENT_MODE", "manual")
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


def test_chat_agent_config_endpoint_rejects_invalid_mode(client):
    response = client.put("/crm/chat-agent/config", json={"agent_mode": "otro"})
    assert response.status_code == 400
    assert "agent_mode invalido" in response.json()["detail"]


def test_chat_ai_v2_webhook_mode_processes_turn_when_orchestrator_is_called(db_session, monkeypatch, tmp_path):
    state_store, agent = build_v2_dependencies(requests_root=tmp_path)
    _, message_id = _seed_context(db_session, latest_message="Hola")
    calls = {"count": 0}

    def fake_normal_turn(context, prompt_families):
        calls["count"] += 1
        return NormalTurnDecision(decision_type="smalltalk", reply_to_user="Hola, en que te ayudo?")

    monkeypatch.setattr(agent._llm_client, "interpret_normal_turn", fake_normal_turn)
    orchestrator = AgentTurnOrchestrator(
        processes=[agent],
        state_store=state_store,
    )

    result = asyncio.run(
        orchestrator.process_turn(db_session, message_id, "webhook")
    )

    assert result["type"] == "chat_reply"
    assert calls["count"] == 1


def test_chat_ai_v2_manual_button_processes_turn(db_session, monkeypatch, tmp_path):
    state_store, agent = build_v2_dependencies(requests_root=tmp_path)
    _, message_id = _seed_context(db_session, latest_message="Hola")
    calls = {"count": 0}

    def fake_normal_turn(context, prompt_families):
        calls["count"] += 1
        return NormalTurnDecision(decision_type="smalltalk", reply_to_user="Hola, en que te ayudo?")

    monkeypatch.setattr(agent._llm_client, "interpret_normal_turn", fake_normal_turn)
    orchestrator = AgentTurnOrchestrator(
        processes=[agent],
        state_store=state_store,
    )

    result = asyncio.run(
        orchestrator.process_turn(db_session, message_id, "manual_button")
    )

    assert result["type"] == "chat_reply"
    assert calls["count"] == 1


def test_meta_webhook_service_skips_orchestrator_when_webhook_processing_is_manual(db_session, monkeypatch):
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

    calls: dict[str, object] = {"count": 0}

    class FakeOrchestrator:
        async def process_turn(self, session, message_id, trigger):
            calls["count"] = int(calls.get("count", 0)) + 1
            calls["message_id"] = message_id
            calls["trigger"] = trigger
            return {"type": "chat_reply", "respuesta": "Hola"}

    service = MetaWebhookService(db_session, orchestrator=FakeOrchestrator())
    service._find_existing_inbound_message = lambda external_message_id: mensaje
    monkeypatch.setattr("app.services.meta_webhook_service.should_auto_process", lambda *args, **kwargs: False)

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

    assert calls["count"] == 0
    assert result["agent_result"] is None


def test_meta_webhook_service_processes_and_sends_when_webhook_processing_is_automatic(db_session, monkeypatch):
    user = User(nombre="Tester Webhook Automatico", email="tester-webhook-automatic@example.com")
    db_session.add(user)
    db_session.flush()

    contacto = CRMContacto(
        nombre_completo="Cliente Webhook Automatico",
        telefonos=["+5491111111188"],
        email="cliente-webhook-automatic@example.com",
        responsable_id=user.id,
    )
    db_session.add(contacto)
    db_session.flush()

    oportunidad = CRMOportunidad(
        titulo="Oportunidad Webhook Automatico",
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
        contacto_referencia="+5491111111188",
        origen_externo_id="wamid.test.webhook.agent.auto",
    )
    db_session.add(mensaje)

    celular = CRMCelular(
        meta_celular_id=str(uuid4()),
        numero_celular="+5491111000088",
        alias="Linea webhook test auto",
        activo=True,
    )
    db_session.add(celular)
    db_session.commit()
    db_session.refresh(celular)
    db_session.refresh(mensaje)

    calls: dict[str, object] = {"count": 0}

    class FakeOrchestrator:
        async def process_turn(self, session, message_id, trigger):
            calls["count"] = int(calls.get("count", 0)) + 1
            calls["message_id"] = message_id
            calls["trigger"] = trigger
            return {"type": "chat_reply", "respuesta": "Hola, en que te ayudo?"}

    service = MetaWebhookService(db_session, orchestrator=FakeOrchestrator())
    service._find_existing_inbound_message = lambda external_message_id: mensaje
    monkeypatch.setattr("app.services.meta_webhook_service.should_auto_process", lambda *args, **kwargs: True)

    async def fake_deliver_result(*, session, message, result):
        assert result["respuesta"] == "Hola, en que te ayudo?"
        return SendResult(sent=True, status="sent", outbound_message_id=321)

    monkeypatch.setattr(service._delivery_service, "deliver_result", fake_deliver_result)

    msg = SimpleNamespace(
        id=uuid4(),
        meta_message_id="wamid.test.webhook.agent.auto",
        from_phone="+5491111111188",
        from_name="Cliente Webhook Automatico",
        to_phone="+5491111000088",
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
    assert calls["trigger"] == "webhook"
    assert result["agent_result"]["delivery"]["sent"] is True


def test_chat_ai_v2_persists_active_process_and_process_state(client, db_session, monkeypatch, tmp_path):
    state_store, agent = build_v2_dependencies(requests_root=tmp_path)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_STATE_STORE", state_store)
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

    stored_state = state_store.load(oportunidad_id)
    assert stored_state.active_process == "solicitud_materiales"
    assert stored_state.last_message_id == message_id
    process_state = stored_state.process_state
    assert process_state["pending_query"]["attribute_name"] == "tipo"
    assert process_state["last_user_intent"] == "add"


def test_chat_ai_v2_persists_revision_state_when_request_is_ready(client, db_session, monkeypatch, tmp_path):
    state_store, agent = build_v2_dependencies(requests_root=tmp_path)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_STATE_STORE", state_store)
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

    stored_state = state_store.load(oportunidad_id)
    process_state = stored_state.process_state
    assert process_state["awaiting_user_decision"] == "continue_or_close"
    assert process_state["ready_for_confirmation"] is True
    assert process_state["last_request_action"] == "show"


def test_chat_ai_v2_manual_endpoint_accepts_explicit_message_id(client, db_session, monkeypatch, tmp_path):
    state_store, agent = build_v2_dependencies(requests_root=tmp_path)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_STATE_STORE", state_store)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_AGENT", agent)

    oportunidad_id, message_id = _seed_context(db_session, latest_message="Hola")
    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda context, prompt_families: NormalTurnDecision(decision_type="smalltalk", reply_to_user="Hola."),
    )

    response = client.post(
        f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2",
        json={
            "message_id": message_id,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["message_id"] == message_id


def test_chat_ai_v2_diagnostic_endpoint_returns_execution_details(client, db_session, monkeypatch, tmp_path):
    state_store, agent = build_v2_dependencies(requests_root=tmp_path)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_STATE_STORE", state_store)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_AGENT", agent)

    oportunidad_id, message_id = _seed_context(db_session, latest_message="Hola")
    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda context, prompt_families: NormalTurnDecision(decision_type="smalltalk", reply_to_user="Hola."),
    )

    process_response = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2")
    assert process_response.status_code == 200

    diagnostic_response = client.get(f"/crm/mensajes/acciones/chat/{oportunidad_id}/diagnostico-v2")
    assert diagnostic_response.status_code == 200
    body = diagnostic_response.json()
    assert body["message_id"] == message_id
    assert body["context"]["is_project_opportunity"] is True
    assert body["process_resolution"]["activation"]["process_name"] == "solicitud_materiales"
    assert body["turn_execution"]["response_payload"]["type"] == "chat_reply"
    assert body["summary"]["has_execution_record"] is True


def test_chat_ai_v2_diagnostic_endpoint_reports_no_process_for_non_project(client, db_session, monkeypatch, tmp_path):
    state_store, agent = build_v2_dependencies(requests_root=tmp_path)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_STATE_STORE", state_store)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_AGENT", agent)

    oportunidad_id, _ = _seed_non_project_context(db_session, latest_message="Necesito 10 bolsas de cemento")

    process_response = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2")
    assert process_response.status_code == 200

    diagnostic_response = client.get(f"/crm/mensajes/acciones/chat/{oportunidad_id}/diagnostico-v2")
    assert diagnostic_response.status_code == 200
    body = diagnostic_response.json()
    assert body["context"]["is_project_opportunity"] is False
    assert body["process_resolution"]["activation"] is None
    assert "No hay procesos disponibles" in body["process_resolution"]["error"]
    assert body["turn_execution"]["response_payload"]["type"] == "no_process"
    assert body["summary"]["has_execution_record"] is True


def test_chat_ai_v2_audit_includes_actions_and_prompts(client, db_session, monkeypatch, tmp_path):
    state_store, agent = build_v2_dependencies(requests_root=tmp_path)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_STATE_STORE", state_store)
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
    assert body["process_name"] == "solicitud_materiales"
    assert body["cached"] is False

    mensaje = db_session.get(CRMMensaje, message_id)
    assert mensaje is not None
    assert mensaje.metadata_json["agent_v2"]["process_name"] == "solicitud_materiales"


def test_chat_ai_v2_skips_non_project_opportunity(client, db_session, monkeypatch, tmp_path):
    state_store, agent = build_v2_dependencies(requests_root=tmp_path)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_STATE_STORE", state_store)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_AGENT", agent)

    oportunidad_id, message_id = _seed_non_project_context(db_session, latest_message="Necesito 10 bolsas de cemento")

    response = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2")
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "no_process"
    assert body["skipped"] is True
    assert "No hay procesos disponibles" in body["reason"]

    stored_state = state_store.load(oportunidad_id)
    assert stored_state.last_message_id == message_id
    assert stored_state.active_process is None


def test_process_registry_returns_explicit_no_match_resolution(db_session, tmp_path):
    state_store, agent = build_v2_dependencies(requests_root=tmp_path)
    oportunidad_id, message_id = _seed_non_project_context(db_session, latest_message="Necesito 10 bolsas de cemento")
    orchestrator = AgentTurnOrchestrator(processes=[agent], state_store=state_store)
    context = orchestrator.build_context(db_session, message_id, trigger="webhook")

    resolved = orchestrator.registry.resolve(context)

    assert resolved is None


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


def test_independent_message_during_pending_query_does_not_crash(db_session, monkeypatch, tmp_path):
    """Regression: ProcessHandoff(target=) causaba crash; campo correcto es target_process."""
    state_store, agent = build_v2_dependencies(requests_root=tmp_path)
    oportunidad_id, message_id = _seed_context(db_session, latest_message="hola como estas?")

    # Solicitud con consulta pendiente (cemento sin tipo)
    request_state = MaterialRequestState(
        oportunidad_id=oportunidad_id,
        items=[
            MaterialItem(
                descripcion="cemento",
                cantidad=10,
                unidad="bolsa",
                familia="cementicios",
                consulta="Que tipo necesitas? 1: portland, 2: albanileria",
                consulta_atributo="tipo",
            )
        ],
    )
    agent._request_store.save(request_state, message_id)

    # Estado de conversacion con proceso activo
    conv_state = state_store.load(oportunidad_id)
    conv_state.active_process = "solicitud_materiales"
    state_store.save(conv_state)

    # LLM: el mensaje es independiente de la consulta pendiente (smalltalk)
    monkeypatch.setattr(
        agent._llm_client,
        "classify_pending_turn",
        lambda context, pending_item, pending_attribute: PendingTurnDecision(
            decision_type="independent_message",
        ),
    )
    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda context, prompt_families: NormalTurnDecision(
            decision_type="smalltalk",
            reply_to_user="Hola! Todo bien.",
        ),
    )
    monkeypatch.setattr(
        agent._llm_client,
        "reply_independent_during_pending",
        lambda context, pending_item, pending_attribute: "Hola! Todo bien. Dicho esto, necesito que me confirmes: Que tipo necesitas? 1: portland, 2: albanileria",
    )

    orchestrator = AgentTurnOrchestrator(processes=[agent], state_store=state_store)
    result = asyncio.run(orchestrator.process_turn(db_session, message_id, "manual_button"))

    assert result["type"] == "material_request"
    assert result["cached"] is False
    assert result["process_name"] == "solicitud_materiales"
    assert "Hola" in result["respuesta"]
    assert "portland" in result["respuesta"]
