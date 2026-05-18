from __future__ import annotations

from agente.v2.processes.solicitud_materiales.handler import build_v2_dependencies
from agente.v2.processes.solicitud_materiales.models import (
    MaterialItem,
    MaterialRequestProcessState,
    MaterialRequestState,
)


def _agent(tmp_path):
    _, agent = build_v2_dependencies(requests_root=tmp_path)
    return agent


def _pending_request() -> MaterialRequestState:
    return MaterialRequestState(
        oportunidad_id=1,
        estado_solicitud="needs_clarification",
        items=[
            MaterialItem(
                descripcion="arena fina",
                cantidad=None,
                unidad="m3",
                familia="aridos",
                consulta="Que cantidad necesitas para arena fina?",
                consulta_atributo="cantidad",
                faltantes=["cantidad"],
            )
        ],
    )


def test_material_dialogue_reply_asks_follow_up_directly_after_operation_summary(tmp_path):
    agent = _agent(tmp_path)

    reply = agent._build_material_dialogue_reply(
        _pending_request(),
        request_action="update",
        operation_summary="Realice estos cambios:\n- Agregue m3 arena fina.\n- Agregue bolsa cemento.",
    )

    assert reply == (
        "Realice estos cambios:\n"
        "- Agregue m3 arena fina.\n"
        "- Agregue bolsa cemento.\n\n"
        "Que cantidad necesitas para arena fina?"
    )
    assert "Para seguir con la solicitud necesito esto:" not in reply


def test_contextual_chat_reply_asks_follow_up_directly(tmp_path):
    agent = _agent(tmp_path)

    reply = agent._build_contextual_chat_reply(
        request_state=_pending_request(),
        process_state=MaterialRequestProcessState(),
        base_reply="De nada.",
    )

    assert reply == "De nada.\n\nQue cantidad necesitas para arena fina?"
    assert "Para seguir con la solicitud necesito esto:" not in reply
