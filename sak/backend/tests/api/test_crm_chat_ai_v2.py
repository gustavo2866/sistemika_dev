import json

import pytest

import app.routers.crm_mensaje_router as crm_mensaje_router_module
from agente.v2.processes.solicitud_materiales.models import (
    ItemOperation,
    MaterialItem,
    MaterialRequestState,
    NormalTurnDecision,
    PendingTurnDecision,
)
from agente.v2.processes.solicitud_materiales.handler import build_v2_dependencies
from app.models import CRMContacto, CRMMensaje, CRMOportunidad, Proyecto, User
from app.models.enums import EstadoOportunidad


@pytest.fixture()
def isolated_v2(monkeypatch, tmp_path):
    state_store, agent = build_v2_dependencies(requests_root=tmp_path)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_STATE_STORE", state_store)
    monkeypatch.setattr(crm_mensaje_router_module, "V2_AGENT", agent)
    return agent, tmp_path


@pytest.fixture()
def isolated_v2_catalog(monkeypatch, tmp_path):
    families_path = tmp_path / "familias_materiales.json"
    families_path.write_text(
        json.dumps(
            {
                "version": "pytest",
                "origen": "tests",
                "familias": [
                    {
                        "codigo": "aridos",
                        "nombre": "Aridos",
                        "estado": "confirmada",
                        "descripcion": "Materiales sueltos",
                        "tags": ["arena"],
                        "atributos": [
                            {
                                "nombre": "tipo",
                                "descripcion": "Tipo de arido",
                                "obligatorio": True,
                                "tipo_dato": "enum",
                                "valores_posibles": ["arena fina", "arena gruesa"],
                            }
                        ],
                    }
                ],
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )

    def fake_reload() -> None:
        state_store, agent = build_v2_dependencies(
            families_path=families_path,
            requests_root=tmp_path / "requests",
            state_root=tmp_path / "conversation_state",
        )
        monkeypatch.setattr(crm_mensaje_router_module, "V2_STATE_STORE", state_store)
        monkeypatch.setattr(crm_mensaje_router_module, "V2_AGENT", agent)

    monkeypatch.setattr(crm_mensaje_router_module, "V2_FAMILIES_PATH", families_path)
    monkeypatch.setattr(crm_mensaje_router_module, "_reload_v2_dependencies", fake_reload)
    fake_reload()
    return families_path


def _seed_context(db_session, *, latest_message: str) -> int:
    user = User(nombre="Tester V2", email="tester-v2@example.com")
    db_session.add(user)
    db_session.flush()

    contacto = CRMContacto(
        nombre_completo="Cliente V2",
        telefonos=["+5491111111111"],
        email="cliente-v2@example.com",
        responsable_id=user.id,
    )
    db_session.add(contacto)
    db_session.flush()

    oportunidad = CRMOportunidad(
        titulo="Oportunidad V2",
        contacto_id=contacto.id,
        responsable_id=user.id,
        estado=EstadoOportunidad.PROSPECT.value,
        activo=True,
    )
    db_session.add(oportunidad)
    db_session.flush()

    proyecto = Proyecto(
        nombre="Proyecto V2",
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
    return oportunidad.id


def _persist_pending_cement_request(agent, oportunidad_id: int, ultimo_mensaje_id: int | None = None) -> MaterialRequestState:
    request_state = MaterialRequestState(
        oportunidad_id=oportunidad_id,
        items=[
            MaterialItem(
                descripcion="cemento",
                cantidad=10,
                unidad="bolsa",
                familia="cementicios",
            )
        ],
    )
    request_state = agent._request_validator.refresh(request_state)
    return agent._request_store.save(request_state, ultimo_mensaje_id)


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


def test_chat_ai_v2_returns_smalltalk_reply(client, db_session, isolated_v2, monkeypatch):
    agent, _ = isolated_v2
    oportunidad_id = _seed_context(db_session, latest_message="Hola, como estas?")

    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda context, prompt_families: NormalTurnDecision(
            decision_type="smalltalk",
            reply_to_user="Hola, todo bien.",
        ),
    )

    response = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2")
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "chat_reply"
    assert body["respuesta"] == "Hola, todo bien."
    assert body["workflow"]["mode"] == "normal"


def test_chat_ai_v2_adds_item_and_asks_missing_attribute(client, db_session, isolated_v2, monkeypatch):
    agent, _ = isolated_v2
    oportunidad_id = _seed_context(db_session, latest_message="Necesito 10 bolsas de cemento")

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
    assert body["type"] == "material_request"
    assert body["solicitud"]["items"][0]["familia"] == "cementicios"
    assert body["solicitud"]["items"][0]["consulta_atributo"] == "tipo"
    assert "Que tipo necesitas para cemento?" in body["respuesta"]
    assert "1: portland" in body["respuesta"]
    assert body["workflow"]["mode"] == "completa_atributos"


def test_chat_ai_v2_requires_quantity_for_each_line_even_if_family_is_complete(client, db_session, isolated_v2, monkeypatch):
    agent, _ = isolated_v2
    oportunidad_id = _seed_context(db_session, latest_message="agrega arena fina")

    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda context, prompt_families: NormalTurnDecision(
            decision_type="request_operation",
            operations=[
                ItemOperation(
                    action="add",
                    descripcion="arena fina",
                    familia="aridos",
                    cantidad=0,
                    unidad="m3",
                    atributos={"tipo": "arena fina"},
                )
            ],
        ),
    )

    response = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2")
    assert response.status_code == 200
    body = response.json()
    item = body["solicitud"]["items"][0]
    assert item["cantidad"] is None
    assert item["faltantes"] == ["cantidad"]
    assert item["consulta_atributo"] == "cantidad"
    assert "Que cantidad necesitas para arena fina?" in body["respuesta"]
    assert body["workflow"]["mode"] == "completa_atributos"


def test_request_validator_infers_cement_family_even_with_numeric_description(isolated_v2):
    agent, _ = isolated_v2
    request_state = MaterialRequestState(
        oportunidad_id=1,
        items=[
            MaterialItem(
                descripcion="10 bolsas de cemento",
                cantidad=10,
                unidad="bolsa",
            )
        ],
    )

    request_state = agent._request_validator.refresh(request_state)
    item = request_state.items[0]
    assert item.familia == "cementicios"
    assert item.faltantes == ["tipo"]
    assert item.consulta_atributo == "tipo"


def test_chat_ai_v2_canonicalizes_family_aliases_and_keeps_pending_attributes(client, db_session, isolated_v2, monkeypatch):
    agent, _ = isolated_v2
    oportunidad_id = _seed_context(db_session, latest_message="necesito 4 barras de hierro del 12 y 10 bolsas de cemento")

    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda context, prompt_families: NormalTurnDecision(
            decision_type="request_operation",
            operations=[
                ItemOperation(
                    action="add",
                    descripcion="4 barras de hierro del 12",
                    familia="hierro",
                    cantidad=4,
                    unidad="barra",
                    atributos={"calibre": 12},
                ),
                ItemOperation(
                    action="add",
                    descripcion="10 bolsas de cemento",
                    familia="cemento",
                    cantidad=10,
                    unidad="bolsa",
                ),
            ],
        ),
    )

    response = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2")
    assert response.status_code == 200
    body = response.json()
    assert body["workflow"]["mode"] == "completa_atributos"
    assert body["solicitud"]["items"][0]["familia"] == "acero_refuerzo"
    assert body["solicitud"]["items"][0]["consulta_atributo"] == "diametro_mm"
    assert body["solicitud"]["items"][1]["familia"] == "cementicios"
    assert "tipo" in body["solicitud"]["items"][1]["faltantes"]
    assert "Que diametro en mm necesitas para 4 barras de hierro del 12?" in body["respuesta"]


def test_chat_ai_v2_maps_pending_enum_response_by_index(client, db_session, isolated_v2, monkeypatch):
    agent, _ = isolated_v2
    oportunidad_id = _seed_context(db_session, latest_message="1")
    _persist_pending_cement_request(agent, oportunidad_id)

    def fail_pending_classifier(*args, **kwargs):
        raise AssertionError("No deberia consultar al LLM si el mapeo directo fue exitoso")

    monkeypatch.setattr(agent._llm_client, "classify_pending_turn", fail_pending_classifier)

    response = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2")
    assert response.status_code == 200
    body = response.json()
    assert body["solicitud"]["items"][0]["atributos"]["tipo"] == "portland"
    assert body["solicitud"]["estado_solicitud"] == "ready"
    assert body["workflow"]["mode"] == "revision"
    assert body["workflow"]["awaiting_user_decision"] == "continue_or_close"


def test_chat_ai_v2_maps_pending_quantity_response_without_calling_llm(client, db_session, isolated_v2, monkeypatch):
    agent, _ = isolated_v2
    oportunidad_id = _seed_context(db_session, latest_message="10 metros")
    request_state = MaterialRequestState(
        oportunidad_id=oportunidad_id,
        items=[
            MaterialItem(
                descripcion="arena fina",
                cantidad=None,
                unidad="m3",
                familia="aridos",
                atributos={"tipo": "arena fina"},
            )
        ],
    )
    request_state = agent._request_validator.refresh(request_state)
    agent._request_store.save(request_state, ultimo_mensaje_id=None)

    def fail_pending_classifier(*args, **kwargs):
        raise AssertionError("No deberia consultar al LLM si la cantidad se mapea directamente")

    monkeypatch.setattr(agent._llm_client, "classify_pending_turn", fail_pending_classifier)

    response = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2")
    assert response.status_code == 200
    body = response.json()
    item = body["solicitud"]["items"][0]
    assert item["cantidad"] == 10
    assert item["faltantes"] == []
    assert item["consulta_atributo"] is None
    assert body["solicitud"]["estado_solicitud"] == "ready"
    assert body["workflow"]["mode"] == "revision"
    assert body["workflow"]["awaiting_user_decision"] == "continue_or_close"


def test_chat_ai_v2_request_view_returns_existing_request(client, db_session, isolated_v2):
    agent, _ = isolated_v2
    oportunidad_id = _seed_context(db_session, latest_message="Hola")
    _persist_pending_cement_request(agent, oportunidad_id)

    response = client.get(f"/crm/mensajes/acciones/chat/{oportunidad_id}/solicitud-v2")
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "material_request"
    assert body["request_action"] == "show"
    assert body["solicitud"]["oportunidad_id"] == oportunidad_id
    assert body["analysis"]["items"][0]["familia"] == "cementicios"
    assert body["workflow"]["mode"] == "completa_atributos"


def test_chat_ai_v2_request_view_returns_summary_for_ready_request(client, db_session, isolated_v2):
    agent, _ = isolated_v2
    oportunidad_id = _seed_context(db_session, latest_message="Hola")
    _persist_ready_request(agent, oportunidad_id)

    response = client.get(f"/crm/mensajes/acciones/chat/{oportunidad_id}/solicitud-v2")
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "material_request"
    assert body["request_action"] == "show"
    assert body["respuesta"].startswith("Te detallo la solicitud:")
    assert "10 bolsa cemento" in body["respuesta"]
    assert "tipo: portland" in body["respuesta"]
    assert body["workflow"]["mode"] == "revision"
    assert body["workflow"]["awaiting_user_decision"] == "continue_or_close"


def test_chat_ai_v2_request_view_repairs_zero_quantity_and_asks_for_it(client, db_session, isolated_v2):
    agent, _ = isolated_v2
    oportunidad_id = _seed_context(db_session, latest_message="Hola")
    broken_request = MaterialRequestState(
        oportunidad_id=oportunidad_id,
        items=[
            MaterialItem(
                descripcion="arena fina",
                cantidad=0,
                unidad="m3",
                familia="aridos",
                atributos={"tipo": "arena fina"},
            )
        ],
        estado_solicitud="ready",
    )
    agent._request_store.save(broken_request, ultimo_mensaje_id=None)

    response = client.get(f"/crm/mensajes/acciones/chat/{oportunidad_id}/solicitud-v2")
    assert response.status_code == 200
    body = response.json()
    item = body["solicitud"]["items"][0]
    assert item["cantidad"] is None
    assert item["faltantes"] == ["cantidad"]
    assert item["consulta_atributo"] == "cantidad"
    assert body["respuesta"] == "Que cantidad necesitas para arena fina?"
    assert body["workflow"]["mode"] == "completa_atributos"


def test_chat_ai_v2_maps_pending_enum_response_with_controlled_fuzzy_match(client, db_session, isolated_v2, monkeypatch):
    agent, _ = isolated_v2
    oportunidad_id = _seed_context(db_session, latest_message="porland")
    _persist_pending_cement_request(agent, oportunidad_id)

    def fail_pending_classifier(*args, **kwargs):
        raise AssertionError("No deberia consultar al LLM si el typo se resuelve por fuzzy match")

    monkeypatch.setattr(agent._llm_client, "classify_pending_turn", fail_pending_classifier)

    response = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2")
    assert response.status_code == 200
    body = response.json()
    assert body["solicitud"]["items"][0]["atributos"]["tipo"] == "portland"
    assert body["workflow"]["mode"] == "revision"
    assert body["workflow"]["awaiting_user_decision"] == "continue_or_close"


def test_chat_ai_v2_show_request_returns_summary_reply_for_ready_request(client, db_session, isolated_v2, monkeypatch):
    agent, _ = isolated_v2
    oportunidad_id = _seed_context(db_session, latest_message="mostrame la solicitud")
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
    assert body["type"] == "material_request"
    assert body["request_action"] == "show"
    assert body["respuesta"].startswith("Te detallo la solicitud:")
    assert "10 bolsa cemento" in body["respuesta"]
    assert "tipo: portland" in body["respuesta"]
    assert body["workflow"]["mode"] == "revision"
    assert body["workflow"]["awaiting_user_decision"] == "continue_or_close"


def test_chat_ai_v2_smalltalk_keeps_guiding_when_request_is_ready(client, db_session, isolated_v2, monkeypatch):
    agent, _ = isolated_v2
    oportunidad_id = _seed_context(db_session, latest_message="gracias")
    _persist_ready_request(agent, oportunidad_id)

    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda context, prompt_families: NormalTurnDecision(
            decision_type="smalltalk",
            reply_to_user="De nada.",
        ),
    )

    response = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2")
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "chat_reply"
    assert body["respuesta"].startswith("De nada.")
    assert "La solicitud sigue abierta." in body["respuesta"]
    assert body["workflow"]["mode"] == "revision"
    assert body["workflow"]["awaiting_user_decision"] == "continue_or_close"


def test_chat_ai_v2_re_routes_independent_message_during_pending_query(client, db_session, isolated_v2, monkeypatch):
    agent, _ = isolated_v2
    oportunidad_id = _seed_context(db_session, latest_message="elimina el item cemento")
    existing_request = _persist_pending_cement_request(agent, oportunidad_id)

    monkeypatch.setattr(
        agent._llm_client,
        "classify_pending_turn",
        lambda context, pending_item, pending_attribute: PendingTurnDecision(
            decision_type="independent_message"
        ),
    )
    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda context, prompt_families: NormalTurnDecision(
            decision_type="request_operation",
            operations=[
                ItemOperation(
                    action="remove",
                    target_item_id=existing_request.items[0].item_id,
                )
            ],
        ),
    )

    response = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2")
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "material_request"
    assert body["solicitud"]["items"] == []
    assert body["solicitud"]["estado_solicitud"] == "draft"
    assert body["workflow"]["mode"] == "normal"


def test_chat_ai_v2_uses_llm_to_reask_when_pending_answer_attempt_is_not_mappable(client, db_session, isolated_v2, monkeypatch):
    agent, _ = isolated_v2
    oportunidad_id = _seed_context(db_session, latest_message="potland gris comun")
    _persist_pending_cement_request(agent, oportunidad_id)

    monkeypatch.setattr(
        agent._llm_client,
        "classify_pending_turn",
        lambda context, pending_item, pending_attribute: PendingTurnDecision(
            decision_type="answer_attempt",
            reply_to_user="No pude identificar el tipo. Responde 1: portland, 2: albanileria o 3: mamposteria.",
        ),
    )

    response = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2")
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "material_request"
    assert body["respuesta"] == "No pude identificar el tipo. Responde 1: portland, 2: albanileria o 3: mamposteria."
    assert body["solicitud"]["items"][0]["consulta_intentos"] == 1
    assert body["workflow"]["mode"] == "completa_atributos"


def test_chat_ai_legacy_endpoint_delegates_to_v2_preview(client, db_session, isolated_v2, monkeypatch):
    agent, _ = isolated_v2
    oportunidad_id = _seed_context(db_session, latest_message="Hola desde el endpoint legacy")

    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda context, prompt_families: NormalTurnDecision(
            decision_type="smalltalk",
            reply_to_user="Hola desde v2.",
        ),
    )

    response = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta")
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "chat_reply"
    assert body["respuesta"] == "Hola desde v2."
    assert body["cached"] is False


def test_chat_ai_v2_family_endpoint_reads_catalog_from_v2(client, isolated_v2_catalog):
    response = client.get("/crm/mensajes/acciones/chat/ia-familias/aridos")
    assert response.status_code == 200
    body = response.json()
    assert body["family"]["codigo"] == "aridos"
    assert body["family"]["atributos"][0]["tipo_dato"] == "enum"
    assert body["family"]["atributos"][0]["valores_posibles"] == ["arena fina", "arena gruesa"]


def test_chat_ai_v2_family_endpoint_writes_catalog_in_v2(client, isolated_v2_catalog):
    payload = {
        "codigo": "cementicios",
        "nombre": "Cementicios",
        "estado": "confirmada",
        "descripcion": "Cementos y derivados",
        "tags": ["cemento"],
        "atributos": [
            {
                "nombre": "tipo",
                "descripcion": "Tipo de cemento",
                "obligatorio": True,
                "tipo_dato": "enum",
                "valores_posibles": ["portland", "albanileria"],
            },
            {
                "nombre": "peso_kg",
                "descripcion": "Peso de la bolsa",
                "obligatorio": True,
                "tipo_dato": "numero",
                "valores_posibles": [],
            },
        ],
    }

    response = client.put("/crm/mensajes/acciones/chat/ia-familias/cementicios", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["created"] is True
    assert body["family"]["codigo"] == "cementicios"
    assert body["family"]["atributos"][1]["tipo_dato"] == "numero"

    persisted_payload = json.loads(isolated_v2_catalog.read_text(encoding="utf-8"))
    persisted_family = next(
        family for family in persisted_payload["familias"] if family.get("codigo") == "cementicios"
    )
    assert persisted_family["nombre"] == "Cementicios"
    assert persisted_family["atributos"][0]["valores_posibles"] == ["portland", "albanileria"]

    get_response = client.get("/crm/mensajes/acciones/chat/ia-familias/cementicios")
    assert get_response.status_code == 200
    assert get_response.json()["family"]["codigo"] == "cementicios"
