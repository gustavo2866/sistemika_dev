import json
from pathlib import Path

import pytest
from sqlmodel import select

import app.routers.crm_mensaje_router as crm_mensaje_router_module
from agente.v2.core.models import (
    ItemOperation,
    MaterialItem,
    MaterialRequestState,
    NormalTurnDecision,
    PendingTurnDecision,
)
from agente.v2.processes.solicitud_materiales.handler import build_v2_dependencies
from app.models import CRMContacto, CRMMensaje, CRMOportunidad, Proyecto, User
from app.models.enums import EstadoOportunidad


DEFAULT_FAMILIES_PATH = (
    Path(__file__).resolve().parents[2]
    / "agente"
    / "v2"
    / "processes"
    / "solicitud_materiales"
    / "knowledge"
    / "familias_materiales.json"
)


@pytest.fixture()
def scenario_v2(monkeypatch, tmp_path):
    def build(extra_families: list[dict] | None = None):
        families_payload = json.loads(DEFAULT_FAMILIES_PATH.read_text(encoding="utf-8"))
        if extra_families:
            families_payload["familias"].extend(extra_families)

        families_path = tmp_path / "familias_materiales.json"
        families_path.write_text(
            json.dumps(families_payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        requests_root = tmp_path / "requests"
        context_loader, agent = build_v2_dependencies(
            families_path=families_path,
            requests_root=requests_root,
        )
        monkeypatch.setattr(crm_mensaje_router_module, "V2_CONTEXT_LOADER", context_loader)
        monkeypatch.setattr(crm_mensaje_router_module, "V2_AGENT", agent)
        return agent, requests_root

    return build


def _seed_context(db_session, *, latest_message: str) -> int:
    user = User(nombre="Tester V2 Escenarios", email="tester-v2-scenarios@example.com")
    db_session.add(user)
    db_session.flush()

    contacto = CRMContacto(
        nombre_completo="Cliente V2 Escenarios",
        telefonos=["+5491111111111"],
        email="cliente-v2-scenarios@example.com",
        responsable_id=user.id,
    )
    db_session.add(contacto)
    db_session.flush()

    oportunidad = CRMOportunidad(
        titulo="Oportunidad V2 Escenarios",
        contacto_id=contacto.id,
        responsable_id=user.id,
        estado=EstadoOportunidad.PROSPECT.value,
        activo=True,
    )
    db_session.add(oportunidad)
    db_session.flush()

    proyecto = Proyecto(
        nombre="Proyecto V2 Escenarios",
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


def _append_message(db_session, oportunidad_id: int, contenido: str) -> None:
    previous_message = db_session.exec(
        select(CRMMensaje)
        .where(CRMMensaje.oportunidad_id == oportunidad_id)
        .order_by(CRMMensaje.id.desc())
    ).first()
    assert previous_message is not None

    new_message = CRMMensaje(
        tipo="entrada",
        canal=previous_message.canal,
        contacto_id=previous_message.contacto_id,
        oportunidad_id=oportunidad_id,
        contenido=contenido,
        estado="recibido",
        contacto_referencia=previous_message.contacto_referencia,
    )
    db_session.add(new_message)
    db_session.commit()


def _persist_request(
    agent,
    oportunidad_id: int,
    items: list[MaterialItem],
    *,
    ultimo_mensaje_id: int | None = None,
) -> MaterialRequestState:
    request_state = MaterialRequestState(
        oportunidad_id=oportunidad_id,
        items=items,
    )
    request_state = agent._request_validator.refresh(request_state)
    return agent._request_store.save(request_state, ultimo_mensaje_id)


def _persist_ready_request(
    agent,
    oportunidad_id: int,
    items: list[MaterialItem],
    *,
    ultimo_mensaje_id: int | None = None,
) -> MaterialRequestState:
    request_state = MaterialRequestState(
        oportunidad_id=oportunidad_id,
        items=items,
    )
    request_state = agent._request_validator.refresh(request_state)
    assert request_state.estado_solicitud == "ready"
    return agent._request_store.save(request_state, ultimo_mensaje_id)


def _custom_finish_family() -> dict:
    return {
        "codigo": "terminaciones_gris",
        "nombre": "Terminaciones gris",
        "estado": "confirmada",
        "descripcion": "Terminaciones de color gris.",
        "tags": ["terminacion", "gris"],
        "atributos": [
            {
                "nombre": "tipo",
                "descripcion": "Tipo de terminacion",
                "default": None,
                "valores_posibles": ["gris claro", "gris oscuro", "gris perla"],
            }
        ],
    }


def _custom_close_family() -> dict:
    return {
        "codigo": "cales",
        "nombre": "Cales",
        "estado": "confirmada",
        "descripcion": "Productos de cal.",
        "tags": ["cal", "cal hidratada"],
        "atributos": [],
    }


def _custom_ambiguous_enum_family() -> dict:
    return {
        "codigo": "suscripciones",
        "nombre": "Suscripciones",
        "estado": "confirmada",
        "descripcion": "Opciones de suscripcion similares.",
        "tags": ["premium", "premiun", "comun"],
        "atributos": [
            {
                "nombre": "tipo",
                "descripcion": "Tipo de suscripcion",
                "default": None,
                "valores_posibles": ["comun", "premium", "premiun"],
            }
        ],
    }


def test_document_scenario_01_high_adds_pending_attribute(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2()
    oportunidad_id = _seed_context(db_session, latest_message="Necesito 10 bolsas de cemento")

    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda context, prompt_families: NormalTurnDecision(
            decision_type="request_operation",
            operations=[ItemOperation(action="add", descripcion="cemento", familia="cementicios", cantidad=10, unidad="bolsa")],
        ),
    )

    body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    assert body["solicitud"]["estado_solicitud"] == "needs_clarification"
    assert body["solicitud"]["items"][0]["consulta_atributo"] == "tipo"
    assert body["workflow"]["mode"] == "completa_atributos"


def test_document_scenario_02_maps_enum_by_index(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2()
    oportunidad_id = _seed_context(db_session, latest_message="1")
    _persist_request(agent, oportunidad_id, [MaterialItem(descripcion="cemento", cantidad=10, unidad="bolsa", familia="cementicios")])

    monkeypatch.setattr(agent._llm_client, "classify_pending_turn", lambda *args, **kwargs: pytest.fail("No debe usar LLM"))
    body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    assert body["solicitud"]["items"][0]["atributos"]["tipo"] == "portland"
    assert body["solicitud"]["estado_solicitud"] == "ready"


def test_document_scenario_03_maps_enum_by_exact_text(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2()
    oportunidad_id = _seed_context(db_session, latest_message="portland")
    _persist_request(agent, oportunidad_id, [MaterialItem(descripcion="cemento", cantidad=10, unidad="bolsa", familia="cementicios")])

    monkeypatch.setattr(agent._llm_client, "classify_pending_turn", lambda *args, **kwargs: pytest.fail("No debe usar LLM"))
    body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    assert body["solicitud"]["items"][0]["atributos"]["tipo"] == "portland"


def test_document_scenario_04_maps_enum_with_controlled_fuzzy_match(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2()
    oportunidad_id = _seed_context(db_session, latest_message="porland")
    _persist_request(agent, oportunidad_id, [MaterialItem(descripcion="cemento", cantidad=10, unidad="bolsa", familia="cementicios")])

    monkeypatch.setattr(agent._llm_client, "classify_pending_turn", lambda *args, **kwargs: pytest.fail("No debe usar LLM"))
    body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    assert body["solicitud"]["items"][0]["atributos"]["tipo"] == "portland"


def test_document_scenario_05_maps_numeric_attribute(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2()
    oportunidad_id = _seed_context(db_session, latest_message="12")
    _persist_request(agent, oportunidad_id, [MaterialItem(descripcion="hierro", cantidad=5, familia="acero_refuerzo")])

    monkeypatch.setattr(agent._llm_client, "classify_pending_turn", lambda *args, **kwargs: pytest.fail("No debe usar LLM"))
    body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    item = body["solicitud"]["items"][0]
    assert item["atributos"]["diametro_mm"] == 12
    assert item["consulta_atributo"] == "largo_m"


def test_document_scenario_06_reasks_after_unmappable_answer_attempt(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2()
    oportunidad_id = _seed_context(db_session, latest_message="potland gris comun")
    _persist_request(agent, oportunidad_id, [MaterialItem(descripcion="cemento", cantidad=10, unidad="bolsa", familia="cementicios")])

    monkeypatch.setattr(
        agent._llm_client,
        "classify_pending_turn",
        lambda context, pending_item, pending_attribute: PendingTurnDecision(
            decision_type="answer_attempt",
            reply_to_user="No pude identificar el tipo. Responde 1: portland, 2: albanileria o 3: mamposteria.",
        ),
    )
    body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    assert body["respuesta"].startswith("No pude identificar el tipo.")
    assert body["solicitud"]["items"][0]["consulta_intentos"] == 1


def test_document_scenario_07_routes_independent_message_during_pending(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2()
    oportunidad_id = _seed_context(db_session, latest_message="elimina el item cemento")
    existing_request = _persist_request(agent, oportunidad_id, [MaterialItem(descripcion="cemento", cantidad=10, unidad="bolsa", familia="cementicios")])

    monkeypatch.setattr(
        agent._llm_client,
        "classify_pending_turn",
        lambda *args, **kwargs: PendingTurnDecision(decision_type="independent_message"),
    )
    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda *args, **kwargs: NormalTurnDecision(
            decision_type="request_operation",
            operations=[ItemOperation(action="remove", target_item_id=existing_request.items[0].item_id)],
        ),
    )
    body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    assert body["solicitud"]["items"] == []
    assert body["workflow"]["active_query"] is None


def test_document_scenario_08_adds_new_item_while_query_is_pending(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2()
    oportunidad_id = _seed_context(db_session, latest_message="agrega tambien 5 metros de hierro del 8")
    _persist_request(agent, oportunidad_id, [MaterialItem(descripcion="cemento", cantidad=10, unidad="bolsa", familia="cementicios")])

    monkeypatch.setattr(agent._llm_client, "classify_pending_turn", lambda *args, **kwargs: PendingTurnDecision(decision_type="independent_message"))
    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda *args, **kwargs: NormalTurnDecision(
            decision_type="request_operation",
            operations=[ItemOperation(action="add", descripcion="hierro del 8", familia="acero_refuerzo", cantidad=5, unidad="metro")],
        ),
    )
    body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    assert len(body["solicitud"]["items"]) == 2
    assert body["workflow"]["mode"] == "completa_atributos"


def test_document_scenario_09_handles_smalltalk_during_pending_without_losing_query(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2()
    oportunidad_id = _seed_context(db_session, latest_message="ok gracias")
    _persist_request(agent, oportunidad_id, [MaterialItem(descripcion="cemento", cantidad=10, unidad="bolsa", familia="cementicios")])

    monkeypatch.setattr(agent._llm_client, "classify_pending_turn", lambda *args, **kwargs: PendingTurnDecision(decision_type="independent_message"))
    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda *args, **kwargs: NormalTurnDecision(decision_type="smalltalk", reply_to_user="De nada."),
    )
    body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    assert body["type"] == "chat_reply"
    assert body["respuesta"].startswith("De nada.")
    assert "Para seguir con la solicitud necesito esto:" in body["respuesta"]
    assert body["workflow"]["mode"] == "completa_atributos"


def test_document_scenario_10_updates_existing_quantity(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2()
    oportunidad_id = _seed_context(db_session, latest_message="en lugar de 10 bolsas, deja 15")
    ready_request = _persist_ready_request(
        agent,
        oportunidad_id,
        [MaterialItem(descripcion="cemento", cantidad=10, unidad="bolsa", familia="cementicios", atributos={"tipo": "portland", "peso_kg": 50})],
    )

    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda *args, **kwargs: NormalTurnDecision(
            decision_type="request_operation",
            operations=[ItemOperation(action="update", target_item_id=ready_request.items[0].item_id, cantidad=15)],
        ),
    )
    body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    assert body["solicitud"]["items"][0]["cantidad"] == 15


def test_document_scenario_11_clears_last_item_and_deactivates_pending_mode(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2()
    oportunidad_id = _seed_context(db_session, latest_message="borra todo")
    _persist_request(agent, oportunidad_id, [MaterialItem(descripcion="cemento", cantidad=10, unidad="bolsa", familia="cementicios")])

    monkeypatch.setattr(agent._llm_client, "classify_pending_turn", lambda *args, **kwargs: PendingTurnDecision(decision_type="independent_message"))
    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda *args, **kwargs: NormalTurnDecision(
            decision_type="request_operation",
            operations=[ItemOperation(action="clear_request")],
        ),
    )
    body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    assert body["solicitud"]["items"] == []
    assert body["workflow"]["mode"] == "normal"


def test_document_scenario_12_confirms_complete_request(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2()
    oportunidad_id = _seed_context(db_session, latest_message="confirmo")
    _persist_ready_request(
        agent,
        oportunidad_id,
        [MaterialItem(descripcion="cemento", cantidad=10, unidad="bolsa", familia="cementicios", atributos={"tipo": "portland", "peso_kg": 50})],
    )

    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda *args, **kwargs: NormalTurnDecision(
            decision_type="request_operation",
            operations=[ItemOperation(action="confirm_request")],
        ),
    )
    body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    assert body["solicitud"]["estado_solicitud"] == "confirmed"
    assert body["solicitud"]["activa"] is False


def test_document_scenario_13_does_not_confirm_request_with_pending_attributes(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2()
    oportunidad_id = _seed_context(db_session, latest_message="confirmo")
    _persist_request(agent, oportunidad_id, [MaterialItem(descripcion="cemento", cantidad=10, unidad="bolsa", familia="cementicios")])

    monkeypatch.setattr(agent._llm_client, "classify_pending_turn", lambda *args, **kwargs: PendingTurnDecision(decision_type="independent_message"))
    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda *args, **kwargs: NormalTurnDecision(
            decision_type="request_operation",
            operations=[ItemOperation(action="confirm_request")],
        ),
    )
    body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    assert body["solicitud"]["estado_solicitud"] == "needs_clarification"
    assert body["workflow"]["mode"] == "completa_atributos"


def test_document_scenario_14_keeps_query_when_turn_is_ambiguous(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2()
    oportunidad_id = _seed_context(db_session, latest_message="si")
    _persist_request(agent, oportunidad_id, [MaterialItem(descripcion="cemento", cantidad=10, unidad="bolsa", familia="cementicios")])

    monkeypatch.setattr(
        agent._llm_client,
        "classify_pending_turn",
        lambda *args, **kwargs: PendingTurnDecision(
            decision_type="ambiguous",
            reply_to_user="No me quedo claro. Responde el tipo o indica una nueva accion.",
        ),
    )
    body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    assert body["respuesta"].startswith("No me quedo claro.")
    assert body["workflow"]["mode"] == "completa_atributos"


def test_document_scenario_15_does_not_auto_pick_between_multiple_similar_options(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2([_custom_finish_family()])
    oportunidad_id = _seed_context(db_session, latest_message="gris")
    _persist_request(agent, oportunidad_id, [MaterialItem(descripcion="terminacion", familia="terminaciones_gris")])

    monkeypatch.setattr(
        agent._llm_client,
        "classify_pending_turn",
        lambda *args, **kwargs: PendingTurnDecision(
            decision_type="ambiguous",
            reply_to_user="Hay varias opciones de gris. Necesito que elijas una.",
        ),
    )
    body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    item = body["solicitud"]["items"][0]
    assert "tipo" not in item["atributos"]
    assert body["respuesta"] == "Hay varias opciones de gris. Necesito que elijas una."


def test_document_scenario_16_completes_multiple_attributes_in_sequence(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2()
    oportunidad_id = _seed_context(db_session, latest_message="12")
    _persist_request(agent, oportunidad_id, [MaterialItem(descripcion="hierro", cantidad=4, familia="acero_refuerzo")])

    monkeypatch.setattr(agent._llm_client, "classify_pending_turn", lambda *args, **kwargs: pytest.fail("No debe usar LLM"))
    first_body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    assert first_body["solicitud"]["items"][0]["atributos"]["diametro_mm"] == 12
    assert first_body["solicitud"]["items"][0]["consulta_atributo"] == "largo_m"

    _append_message(db_session, oportunidad_id, "6 metros")
    second_body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    item = second_body["solicitud"]["items"][0]
    assert item["atributos"]["largo_m"] == 6
    assert second_body["workflow"]["mode"] == "revision"
    assert second_body["workflow"]["awaiting_user_decision"] == "continue_or_close"


def test_document_scenario_17_re_routes_update_that_invalidates_previous_query(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2([_custom_close_family()])
    oportunidad_id = _seed_context(db_session, latest_message="cambia cemento por cal")
    existing_request = _persist_request(agent, oportunidad_id, [MaterialItem(descripcion="cemento", cantidad=10, unidad="bolsa", familia="cementicios")])

    monkeypatch.setattr(agent._llm_client, "classify_pending_turn", lambda *args, **kwargs: PendingTurnDecision(decision_type="independent_message"))
    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda *args, **kwargs: NormalTurnDecision(
            decision_type="request_operation",
            operations=[
                ItemOperation(
                    action="update",
                    target_item_id=existing_request.items[0].item_id,
                    descripcion="cal",
                    familia="cales",
                    unidad="bolsa",
                )
            ],
        ),
    )
    body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    item = body["solicitud"]["items"][0]
    assert item["descripcion"] == "cal"
    assert item["familia"] == "cales"
    assert body["workflow"]["mode"] == "revision"
    assert body["workflow"]["awaiting_user_decision"] == "continue_or_close"


def test_document_scenario_18_handles_free_message_out_of_scope(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2()
    oportunidad_id = _seed_context(db_session, latest_message="como va todo?")
    _persist_request(agent, oportunidad_id, [MaterialItem(descripcion="cemento", cantidad=10, unidad="bolsa", familia="cementicios")])

    monkeypatch.setattr(agent._llm_client, "classify_pending_turn", lambda *args, **kwargs: PendingTurnDecision(decision_type="independent_message"))
    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda *args, **kwargs: NormalTurnDecision(decision_type="smalltalk", reply_to_user="Todo bien, seguimos cuando quieras."),
    )
    body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    assert body["type"] == "chat_reply"
    assert body["respuesta"].startswith("Todo bien, seguimos cuando quieras.")
    assert "Para seguir con la solicitud necesito esto:" in body["respuesta"]
    assert body["workflow"]["mode"] == "completa_atributos"


def test_document_scenario_19_adds_new_independent_message_without_pending_query(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2()
    oportunidad_id = _seed_context(db_session, latest_message="agrega 20 ladrillos huecos")

    monkeypatch.setattr(
        agent._llm_client,
        "interpret_normal_turn",
        lambda *args, **kwargs: NormalTurnDecision(
            decision_type="request_operation",
            operations=[ItemOperation(action="add", descripcion="ladrillos huecos", familia="mamposteria", cantidad=20, unidad="unidad")],
        ),
    )
    body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    assert body["solicitud"]["items"][0]["familia"] == "mamposteria"
    assert body["workflow"]["mode"] == "completa_atributos"


def test_document_scenario_20_rejects_exact_match_when_catalog_options_are_too_similar(client, db_session, scenario_v2, monkeypatch):
    agent, _ = scenario_v2([_custom_ambiguous_enum_family()])
    oportunidad_id = _seed_context(db_session, latest_message="premiun")
    _persist_request(agent, oportunidad_id, [MaterialItem(descripcion="suscripcion", familia="suscripciones")])

    monkeypatch.setattr(
        agent._llm_client,
        "classify_pending_turn",
        lambda *args, **kwargs: PendingTurnDecision(
            decision_type="ambiguous",
            reply_to_user="Las opciones son demasiado parecidas. Elige por indice.",
        ),
    )
    body = client.post(f"/crm/mensajes/acciones/chat/{oportunidad_id}/ia-respuesta-v2").json()
    item = body["solicitud"]["items"][0]
    assert "tipo" not in item["atributos"]
    assert body["respuesta"] == "Las opciones son demasiado parecidas. Elige por indice."
