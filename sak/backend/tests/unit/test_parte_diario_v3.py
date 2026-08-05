from __future__ import annotations

from copy import deepcopy
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from sqlmodel import Session, select

import agente.v3.subprocesses.parte_diario.handler as parte_diario_handler
from agente.v3.contracts import V3ConversationContext, V3InboundMessage
from agente.v3.subprocesses.parte_diario.handler import ParteDiarioSubprocess, resolver_fecha_default_parte_diario
from agente.v3.subprocesses.parte_diario.models import (
    EstadoItem,
    NominaItem,
    NovedadPersonal,
    ParteDiarioOperation,
    ParteDiarioState,
    PendienteAmbiguo,
    TurnPlan,
)
from agente.v3.subprocesses.parte_diario.process import (
    _fallback_simple_attendance_plan,
    _normalize_attendance_transcription,
    _today,
)
from agente.v3.subprocesses.parte_diario.query_service import ParteDiarioQueryService
from agente.v3.subprocesses.parte_diario.resolver import NominaResolver
from app.models import (
    CRMContacto,
    CRMMensaje,
    CRMOportunidad,
    EstadoParteDiario,
    Nomina,
    OrigenDetalle,
    ParteDiario,
    ParteDiarioDetalle,
    ParteDiarioEstado,
    Proyecto,
    ProyectoEncargado,
    User,
)
from app.services.parte_diario_estado_service import seed_parte_diario_estados


class FakeParteDiarioLLM:
    def __init__(self, plan: TurnPlan, *, contextual_reply: str = "Respuesta contextual de prueba.") -> None:
        self.plan = plan
        self.contextual_reply_text = contextual_reply
        self.contextual_calls: list[dict] = []

    async def interpret_turn(self, mensaje, state, nominas_proyecto, estados):
        return self.plan

    async def interpretar_estado_pendiente(self, mensaje, estados):
        return "PER"

    async def contextual_reply(self, **kwargs):
        self.contextual_calls.append(kwargs)
        return self.contextual_reply_text


class FailingParteDiarioLLM(FakeParteDiarioLLM):
    def __init__(self) -> None:
        super().__init__(TurnPlan())

    async def interpret_turn(self, mensaje, state, nominas_proyecto, estados):
        raise ValueError("LLM no disponible")


class FakeParteDiarioQueryAgent:
    def __init__(self, reply: str | None = None) -> None:
        self.reply = reply
        self.calls: list[dict] = []

    async def respond(self, **kwargs):
        self.calls.append(kwargs)
        return self.reply or ""


class FakeEmisor:
    def __init__(self) -> None:
        self.messages: list[dict] = []

    async def emitir(self, texto: str, metadata: dict | None = None) -> str:
        self.messages.append({"texto": texto, "metadata": metadata or {}})
        return f"fake-{len(self.messages)}"


def _message(
    text: str,
    *,
    external_id: str = "wamid-test-1",
    from_address: str = "549111111",
) -> V3InboundMessage:
    return V3InboundMessage(
        id="msg-1",
        provider="meta",
        channel_type="whatsapp",
        account_ref="account",
        conversation_id="meta:account:549111111",
        external_message_id=external_id,
        from_address=from_address,
        to_address="549999999",
        text=text,
        message_type="text",
        raw_payload={"raw": True},
        normalized_payload={"normalized": True},
    )


def test_parte_diario_v3_simple_attendance_fallback_extracts_absence_and_hours():
    plan = _fallback_simple_attendance_plan(
        "falto vera y serrano trabajo 12hs",
        [
            EstadoItem(id=1, abreviatura="P", nombre="PRESENTE"),
            EstadoItem(id=2, abreviatura="FAL", nombre="FALTA"),
        ],
    )

    assert plan is not None
    assert [(item.nombre, item.estado_codigo, item.horas) for item in plan.operations] == [
        ("vera", "FAL", None),
        ("serrano", "P", 12.0),
    ]


def test_parte_diario_v3_simple_attendance_fallback_extracts_plural_absences():
    plan = _fallback_simple_attendance_plan(
        "faltaron vera y serrano",
        [
            EstadoItem(id=1, abreviatura="P", nombre="PRESENTE"),
            EstadoItem(id=2, abreviatura="FAL", nombre="FALTA"),
        ],
    )

    assert plan is not None
    assert [(item.nombre, item.estado_codigo, item.horas) for item in plan.operations] == [
        ("vera", "FAL", None),
        ("serrano", "FAL", None),
    ]


def test_parte_diario_v3_simple_attendance_fallback_extracts_illness():
    plan = _fallback_simple_attendance_plan(
        "medina esta enfermo",
        [
            EstadoItem(id=1, abreviatura="P", nombre="PRESENTE"),
            EstadoItem(id=2, abreviatura="FAL", nombre="FALTA"),
            EstadoItem(id=3, abreviatura="ENF", nombre="ENFERMEDAD"),
        ],
    )

    assert plan is not None
    assert [(item.nombre, item.estado_codigo, item.horas) for item in plan.operations] == [
        ("medina", "ENF", None),
    ]


@pytest.fixture()
def seeded_parte_v3(db_session: Session, monkeypatch):
    monkeypatch.setattr(parte_diario_handler, "engine", db_session.bind)
    user = User(nombre="Tester", email="parte-v3@example.com")
    db_session.add(user)
    db_session.flush()
    contact = CRMContacto(
        nombre_completo="Encargado",
        telefonos=["549111111"],
        responsable_id=user.id,
    )
    db_session.add(contact)
    db_session.flush()
    opportunity = CRMOportunidad(contacto_id=contact.id, responsable_id=user.id, activo=True)
    db_session.add(opportunity)
    db_session.flush()
    project = Proyecto(nombre="Obra Centro", responsable_id=user.id, oportunidad_id=opportunity.id)
    db_session.add(project)
    db_session.flush()
    employee_1 = Nomina(nombre="Juan", apellido="Garcia", dni="parte-v3-1", idproyecto=project.id)
    employee_2 = Nomina(nombre="Pedro", apellido="Perez", dni="parte-v3-2", idproyecto=project.id)
    db_session.add(employee_1)
    db_session.add(employee_2)
    db_session.commit()
    seed_parte_diario_estados(db_session)
    return {
        "contact": contact,
        "opportunity": opportunity,
        "project": project,
        "employee_1": employee_1,
        "employee_2": employee_2,
    }


@pytest.mark.asyncio
async def test_parte_diario_v3_first_load_resolves_project_and_sets_default_oldest_pending_date(seeded_parte_v3):
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(type="agregar_novedad", nombre="Juan Garcia", estado_codigo="FAL"),
                ]
            )
        )
    )
    context = V3ConversationContext(conversation_id="meta:account:549111111")

    result = await process.handle(_message("Juan Garcia falto"), context)

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["contacto_id"] == seeded_parte_v3["contact"].id
    draft = result.context.process_state["parte_state"]
    assert draft["fecha"] == (_today() - timedelta(days=6)).isoformat()
    assert draft["novedades"][0]["idnomina"] == seeded_parte_v3["employee_1"].id
    assert draft["novedades"][0]["estado_codigo"] == "FAL"
    assert "Obra: Obra Centro" in (result.reply_text or "")
    assert "Hay alguna otra novedad?" in (result.reply_text or "")
    assert "Opciones: 1:GUARDAR 2:CERRAR 3:SALIR." not in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_contacto_encargado_un_proyecto_selecciona_automatico(
    db_session: Session,
    seeded_parte_v3,
):
    principal = CRMContacto(
        nombre_completo="Contacto principal",
        telefonos=["549222222"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    db_session.add(principal)
    db_session.flush()
    seeded_parte_v3["opportunity"].contacto_id = principal.id
    db_session.add(
        ProyectoEncargado(
            proyecto_id=seeded_parte_v3["project"].id,
            contacto_id=seeded_parte_v3["contact"].id,
            activo=True,
        )
    )
    db_session.commit()
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(TurnPlan(operations=[ParteDiarioOperation(type="sin_novedades")]))
    )

    result = await process.handle(_message("sin novedades"), V3ConversationContext(conversation_id="conv-asignado"))

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["contacto_id"] == seeded_parte_v3["contact"].id
    assert result.context.process_state["oportunidad_id"] == seeded_parte_v3["opportunity"].id
    assert result.context.process_state["proyecto_id"] == seeded_parte_v3["project"].id
    assert "En que obra" not in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_contacto_encargado_varios_proyectos_muestra_menu(
    db_session: Session,
    seeded_parte_v3,
):
    user_id = seeded_parte_v3["contact"].responsable_id
    principal = CRMContacto(nombre_completo="Principal", telefonos=["549222222"], responsable_id=user_id)
    db_session.add(principal)
    db_session.flush()
    seeded_parte_v3["opportunity"].contacto_id = principal.id
    second_opportunity = CRMOportunidad(contacto_id=principal.id, responsable_id=user_id, activo=True)
    db_session.add(second_opportunity)
    db_session.flush()
    second_project = Proyecto(nombre="Obra Norte", responsable_id=user_id, oportunidad_id=second_opportunity.id)
    db_session.add(second_project)
    db_session.flush()
    db_session.add(
        ProyectoEncargado(
            proyecto_id=seeded_parte_v3["project"].id,
            contacto_id=seeded_parte_v3["contact"].id,
            activo=True,
        )
    )
    db_session.add(
        ProyectoEncargado(
            proyecto_id=second_project.id,
            contacto_id=seeded_parte_v3["contact"].id,
            activo=True,
        )
    )
    db_session.commit()
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(TurnPlan()),
        query_agent_client=FakeParteDiarioQueryAgent(),
    )

    result = await process.handle(_message("parte diario"), V3ConversationContext(conversation_id="conv-varios"))

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "inicial"
    assert "En que obra" in (result.reply_text or "")
    assert "Obra Centro" in (result.reply_text or "")
    assert "Obra Norte" in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_contacto_encargado_por_nomina_se_incluye_en_menu(
    db_session: Session,
    seeded_parte_v3,
):
    user_id = seeded_parte_v3["contact"].responsable_id
    principal = CRMContacto(nombre_completo="Principal", telefonos=["549222222"], responsable_id=user_id)
    db_session.add(principal)
    db_session.flush()
    seeded_parte_v3["opportunity"].contacto_id = principal.id
    second_opportunity = CRMOportunidad(contacto_id=principal.id, responsable_id=user_id, activo=True)
    france_opportunity = CRMOportunidad(contacto_id=principal.id, responsable_id=user_id, activo=True)
    db_session.add(second_opportunity)
    db_session.add(france_opportunity)
    db_session.flush()
    second_project = Proyecto(nombre="Obra Norte", responsable_id=user_id, oportunidad_id=second_opportunity.id)
    france_project = Proyecto(nombre="Francia", responsable_id=user_id, oportunidad_id=france_opportunity.id)
    db_session.add(second_project)
    db_session.add(france_project)
    db_session.flush()
    db_session.add(
        ProyectoEncargado(
            proyecto_id=seeded_parte_v3["project"].id,
            contacto_id=seeded_parte_v3["contact"].id,
            activo=True,
        )
    )
    db_session.add(
        ProyectoEncargado(
            proyecto_id=second_project.id,
            contacto_id=seeded_parte_v3["contact"].id,
            activo=True,
        )
    )
    db_session.add(
        Nomina(
            nombre="Empleado",
            apellido="Francia",
            dni="parte-v3-francia-1",
            idproyecto=france_project.id,
            encargado_contacto_id=seeded_parte_v3["contact"].id,
        )
    )
    db_session.commit()
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(_message("parte diario"), V3ConversationContext(conversation_id="conv-francia"))

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "inicial"
    assert "En que obra" in (result.reply_text or "")
    assert "Obra Centro" in (result.reply_text or "")
    assert "Obra Norte" in (result.reply_text or "")
    assert "Francia" in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_mostrar_nomina_muestra_proyecto_activo_sin_filtrar_por_encargado(
    db_session: Session,
    seeded_parte_v3,
):
    otro_contacto = CRMContacto(
        nombre_completo="Otro Encargado",
        telefonos=["549222222"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    db_session.add(otro_contacto)
    db_session.flush()
    external_project = Proyecto(nombre="Obra Externa", responsable_id=seeded_parte_v3["contact"].responsable_id)
    db_session.add(external_project)
    db_session.flush()
    external_employee = Nomina(
        nombre="Mario",
        apellido="Externo",
        dni="parte-v3-nomina-global",
        idproyecto=external_project.id,
    )
    db_session.add(external_employee)
    seeded_parte_v3["employee_1"].encargado_contacto_id = seeded_parte_v3["contact"].id
    seeded_parte_v3["employee_2"].encargado_contacto_id = otro_contacto.id
    db_session.commit()
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": ParteDiarioState(
                oportunidad_id=seeded_parte_v3["opportunity"].id,
                idproyecto=seeded_parte_v3["project"].id,
                fecha=date(2026, 7, 4).isoformat(),
            ).to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(TurnPlan(operations=[ParteDiarioOperation(type="mostrar_nomina")]))
    )

    result = await process.handle(_message("mostrar nomina"), context)

    assert "*NOMINA ACTIVA*" in (result.reply_text or "")
    assert "Garcia, Juan" in (result.reply_text or "")
    assert "Perez, Pedro" in (result.reply_text or "")
    assert "Externo, Mario" not in (result.reply_text or "")

    result_full = await process.handle(_message("mostrar toda la nomina", external_id="wamid-test-2"), context)

    assert "*NOMINA ACTIVA*" in (result_full.reply_text or "")
    assert "Garcia, Juan" in (result_full.reply_text or "")
    assert "Perez, Pedro" in (result_full.reply_text or "")
    assert "Externo, Mario" in (result_full.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_contacto_no_habilitado_no_encuentra_obra(
    db_session: Session,
    seeded_parte_v3,
):
    contact = CRMContacto(
        nombre_completo="Sin asignacion",
        telefonos=["549333333"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    db_session.add(contact)
    db_session.commit()
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(
        _message("parte diario", from_address="549333333"),
        V3ConversationContext(conversation_id="conv-no-habilitado"),
    )

    assert result.context.active_process is None
    assert result.metadata["status"] == "obra_not_found"
    assert "No encontre una obra asociada" in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_command_shows_last_seven_days_menu(
    db_session: Session,
    monkeypatch,
    seeded_parte_v3,
):
    monkeypatch.setattr(parte_diario_handler, "_today", lambda: date(2026, 5, 16))
    other_contact = CRMContacto(
        nombre_completo="Otro Encargado",
        telefonos=["549222222"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    db_session.add(other_contact)
    db_session.flush()
    seeded_parte_v3["employee_2"].encargado_contacto_id = other_contact.id
    db_session.add(
        ParteDiario(
            idproyecto=seeded_parte_v3["project"].id,
            contacto_id=seeded_parte_v3["contact"].id,
            fecha=date(2026, 5, 16),
            estado=EstadoParteDiario.BORRADOR,
        )
    )
    db_session.add(
        ParteDiario(
            idproyecto=seeded_parte_v3["project"].id,
            contacto_id=seeded_parte_v3["contact"].id,
            fecha=date(2026, 5, 15),
            estado=EstadoParteDiario.CONFIRMADO,
        )
    )
    db_session.add(
        ParteDiario(
            idproyecto=seeded_parte_v3["project"].id,
            contacto_id=other_contact.id,
            fecha=date(2026, 5, 14),
            estado=EstadoParteDiario.BORRADOR,
        )
    )
    db_session.commit()
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))
    context = V3ConversationContext(
        conversation_id="conv-menu",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "nombre_obra": "Obra Centro",
        },
    )

    result = await process.handle(_message("Parte diario"), context)

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "seleccionar_fecha"
    assert result.metadata["outbound"]["type"] == "interactive"
    assert result.metadata["outbound"]["interactive"]["type"] == "list"
    body = result.metadata["outbound"]["interactive"]["body"]["text"]
    assert body == "Selecciona la fecha del parte diario:\nObra: Obra Centro"
    assert "Selecciona la fecha del parte diario:" in (result.reply_text or "")
    assert "Obra: Obra Centro" in (result.reply_text or "")
    rows = result.metadata["outbound"]["interactive"]["action"]["sections"][0]["rows"]
    assert rows[0]["id"] == "2026-05-16"
    assert rows[0]["title"] == "16/05/2026 sab"
    assert rows[0]["description"] == "borrador"
    assert rows[1]["title"] == "15/05/2026 vie"
    assert rows[1]["description"] == "confirmado"
    assert rows[2]["title"] == "14/05/2026 jue"
    assert rows[2]["description"] == "sin cargar"
    assert "1: 16/05/2026 sab (borrador)" in (result.reply_text or "")
    assert "2: 15/05/2026 vie (confirmado)" in (result.reply_text or "")
    assert "3: 14/05/2026 jue (sin cargar)" in (result.reply_text or "")
    assert "Responde con el numero de una fecha o SALIR" in (result.reply_text or "")

    nomina = await process.handle(_message("mostrar nomina"), result.context)

    assert nomina.context.active_process == "parteDiario"
    assert nomina.context.process_state["etapa"] == "seleccionar_fecha"
    assert "*NOMINA ACTIVA*" in (nomina.reply_text or "")
    assert "Garcia, Juan" in (nomina.reply_text or "")
    assert "Perez, Pedro" in (nomina.reply_text or "")
    assert "Selecciona la fecha del parte diario:" in (nomina.reply_text or "")
    assert "Obra: Obra Centro" in (nomina.reply_text or "")
    assert nomina.metadata["outbound"]["interactive"]["body"]["text"].startswith("*NOMINA ACTIVA*")
    assert "Obra: Obra Centro" in nomina.metadata["outbound"]["interactive"]["body"]["text"]

    fallback_llm = process._llm
    fallback_llm.contextual_reply_text = "No tengo un calendario de feriados disponible en este paso."
    fallback = await process.handle(_message("cuales son los feriados de julio?"), result.context)

    assert fallback.context.active_process == "parteDiario"
    assert fallback.context.process_state["etapa"] == "seleccionar_fecha"
    assert "No tengo un calendario de feriados disponible en este paso." in (fallback.reply_text or "")
    assert "Selecciona la fecha del parte diario:" in (fallback.reply_text or "")
    assert "Obra: Obra Centro" in (fallback.reply_text or "")
    assert fallback.metadata["status"] == "contextual_fallback"
    assert fallback.metadata["outbound"]["interactive"]["type"] == "list"
    assert fallback_llm.contextual_calls[-1]["etapa"] == "seleccionar_fecha"
    assert fallback_llm.contextual_calls[-1]["obra"] == "Obra Centro"

    exited = await process.handle(_message("salir"), result.context)

    assert exited.context.active_process == "general"
    assert "1: PEDIDO OBRA" in (exited.reply_text or "")
    assert "2: PARTE DIARIO" in (exited.reply_text or "")


def test_resolver_fecha_default_parte_diario_returns_oldest_pending_date(
    db_session: Session,
    monkeypatch,
    seeded_parte_v3,
):
    monkeypatch.setattr(parte_diario_handler, "_today", lambda: date(2026, 5, 16))
    db_session.add(
        ParteDiario(
            idproyecto=seeded_parte_v3["project"].id,
            contacto_id=seeded_parte_v3["contact"].id,
            fecha=date(2026, 5, 10),
            estado=EstadoParteDiario.CONFIRMADO,
        )
    )
    db_session.add(
        ParteDiario(
            idproyecto=seeded_parte_v3["project"].id,
            contacto_id=seeded_parte_v3["contact"].id,
            fecha=date(2026, 5, 11),
            estado=EstadoParteDiario.BORRADOR,
        )
    )
    db_session.add(
        ParteDiario(
            idproyecto=seeded_parte_v3["project"].id,
            contacto_id=seeded_parte_v3["contact"].id,
            fecha=date(2026, 5, 12),
            estado=EstadoParteDiario.CERRADO,
        )
    )
    db_session.commit()

    assert (
        resolver_fecha_default_parte_diario(
            seeded_parte_v3["project"].id,
            contacto_id=seeded_parte_v3["contact"].id,
        )
        == "2026-05-11"
    )


@pytest.mark.asyncio
async def test_parte_diario_v3_date_menu_uses_query_agent_before_contextual_llm(
    db_session: Session,
    monkeypatch,
    seeded_parte_v3,
):
    monkeypatch.setattr(parte_diario_handler, "_today", lambda: date(2026, 5, 16))
    query_agent = FakeParteDiarioQueryAgent("Garcia, Juan falto el 16/05/2026.")
    llm = FakeParteDiarioLLM(TurnPlan())
    process = ParteDiarioSubprocess(llm_client=llm, query_agent_client=query_agent)
    context = V3ConversationContext(
        conversation_id="conv-query-agent",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "nombre_obra": "Obra Centro",
        },
    )

    result = await process.handle(_message("Parte diario"), context)
    fallback = await process.handle(_message("que dias falto Garcia?"), result.context)

    assert fallback.context.active_process == "parteDiario"
    assert fallback.context.process_state["etapa"] == "seleccionar_fecha"
    assert fallback.metadata["status"] == "contextual_query"
    assert "Garcia, Juan falto el 16/05/2026." in (fallback.reply_text or "")
    assert "Selecciona la fecha del parte diario:" in (fallback.reply_text or "")
    assert query_agent.calls[-1]["proyecto_id"] == seeded_parte_v3["project"].id
    assert query_agent.calls[-1]["contacto_id"] == seeded_parte_v3["contact"].id
    assert llm.contextual_calls == []


@pytest.mark.asyncio
async def test_parte_diario_v3_show_nomina_in_load_keeps_selected_project_context(seeded_parte_v3):
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 6, 30).isoformat(),
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "nombre_obra": "Obra Centro",
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(TurnPlan(operations=[ParteDiarioOperation(type="mostrar_nomina")]))
    )

    result = await process.handle(_message("mostrame la nomina"), context)

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "carga"
    assert result.context.process_state["proyecto_id"] == seeded_parte_v3["project"].id
    assert result.context.process_state["parte_state"]["fecha"] == "2026-06-30"
    assert "*NOMINA ACTIVA*" in (result.reply_text or "")
    assert "Garcia, Juan" in (result.reply_text or "")
    assert "Hay alguna otra novedad?" in (result.reply_text or "")
    assert "Opciones: 1:GUARDAR 2:CERRAR 3:SALIR." not in (result.reply_text or "")


def test_parte_diario_query_service_answers_absences_report_and_pending(
    db_session: Session,
    monkeypatch,
    seeded_parte_v3,
):
    monkeypatch.setattr("agente.v3.subprocesses.parte_diario.query_service._today", lambda: date(2026, 5, 16))
    falta = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).one()
    accidente = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "ACC")
    ).one()
    presente = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "P")
    ).one()
    external_project = Proyecto(nombre="Obra Externa", responsable_id=seeded_parte_v3["contact"].responsable_id)
    db_session.add(external_project)
    db_session.flush()
    otro_contacto = CRMContacto(
        nombre_completo="Otro Encargado",
        telefonos=["549222222"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    db_session.add(otro_contacto)
    db_session.flush()
    external_employee = Nomina(
        nombre="Mario",
        apellido="Externo",
        dni="parte-v3-extra-externo",
        idproyecto=external_project.id,
    )
    db_session.add(external_employee)
    db_session.flush()
    default_employee = Nomina(
        nombre="Laura",
        apellido="Normal",
        dni="parte-v3-default-normal",
        idproyecto=seeded_parte_v3["project"].id,
        encargado_contacto_id=otro_contacto.id,
    )
    db_session.add(default_employee)
    db_session.flush()
    accident_employee = Nomina(
        nombre="Ana",
        apellido="Accidentada",
        dni="parte-v3-zero-acc",
        idproyecto=seeded_parte_v3["project"].id,
    )
    db_session.add(accident_employee)
    db_session.flush()
    parte = ParteDiario(
        idproyecto=seeded_parte_v3["project"].id,
        contacto_id=seeded_parte_v3["contact"].id,
        fecha=date(2026, 5, 16),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add(parte)
    db_session.flush()
    db_session.add(
        ParteDiarioDetalle(
            parte_diario_id=parte.id,
            idnomina=seeded_parte_v3["employee_1"].id,
            idestado=falta.id,
            horas=Decimal("0"),
            origen=OrigenDetalle.AGENTE,
        )
    )
    db_session.add(
        ParteDiarioDetalle(
            parte_diario_id=parte.id,
            idnomina=seeded_parte_v3["employee_2"].id,
            idestado=presente.id,
            horas=Decimal("11"),
            origen=OrigenDetalle.AGENTE,
        )
    )
    db_session.add(
        ParteDiarioDetalle(
            parte_diario_id=parte.id,
            idnomina=accident_employee.id,
            idestado=accidente.id,
            horas=Decimal("0"),
            origen=OrigenDetalle.AGENTE,
        )
    )
    db_session.add(
        ParteDiarioDetalle(
            parte_diario_id=parte.id,
            idnomina=external_employee.id,
            idestado=presente.id,
            horas=Decimal("12"),
            origen=OrigenDetalle.AGENTE,
        )
    )
    db_session.add(
        ParteDiarioDetalle(
            parte_diario_id=parte.id,
            idnomina=default_employee.id,
            idestado=presente.id,
            horas=Decimal("9"),
            # Fila materializada al cerrar el parte; no fue una novedad recibida por el agente.
            origen=OrigenDetalle.DEFAULT,
        )
    )
    db_session.commit()
    service = ParteDiarioQueryService(
        session=db_session,
        proyecto_id=seeded_parte_v3["project"].id,
        contacto_id=seeded_parte_v3["contact"].id,
        nombre_obra="Obra Centro",
    )

    absences = service.consultar_faltas_persona(persona="Garcia", desde="2026-05-01", hasta="2026-05-16")
    all_absences = service.consultar_faltas(desde="2026-05-01", hasta="2026-05-16")
    generic_absences = service.consultar_novedades(
        estado_codigo="FAL",
        desde="2026-05-01",
        hasta="2026-05-16",
    )
    generic_person = service.consultar_novedades(
        estado_codigo="FAL",
        persona="Garcia",
        desde="2026-05-01",
        hasta="2026-05-16",
        agrupar_por="persona",
    )
    all_novelties = service.consultar_novedades(
        desde="2026-05-01",
        hasta="2026-05-16",
    )
    report = service.consultar_parte_fecha(fecha="2026-05-16")
    pending = service.consultar_partes_pendientes(desde="2026-05-15", hasta="2026-05-16")
    generic_pending = service.consultar_partes(
        desde="2026-05-15",
        hasta="2026-05-16",
        estado_parte="borrador",
        incluir_sin_cargar=True,
    )
    extra_hours = service.consultar_novedades(
        desde="2026-05-01",
        hasta="2026-05-16",
        solo_horas_extras=True,
        agrupar_por="persona",
    )
    external_hours = service.consultar_novedades(
        desde="2026-05-01",
        hasta="2026-05-16",
        estado_codigo="P",
        incluir_presentes=True,
        alcance_personal="otra_nomina",
    )
    context_nomina = service.consultar_contexto_parte(tipo="nomina")
    full_context_nomina = service.consultar_contexto_parte(tipo="toda la nomina")

    assert "Garcia, Juan" in absences
    assert "16/05/2026" in absences
    assert "Personas que no trabajaron:" in all_absences
    assert "16/05/2026: Garcia, Juan" in all_absences
    assert "Accidentada, Ana" in all_absences
    assert "Faltas registradas:" in generic_absences
    assert "Garcia, Juan" in generic_absences
    assert "Accidentada, Ana" not in generic_absences
    assert "Garcia, Juan: 16/05/2026" in generic_person
    assert "Novedades registradas:" in all_novelties
    assert "Garcia, Juan" in all_novelties
    assert "Perez, Pedro: P, 11h" in all_novelties
    assert "Externo, Mario (otra nomina: Obra Externa): P, 12h" in all_novelties
    assert "Normal, Laura" not in all_novelties
    assert "Parte diario de Obra Centro del 16/05/2026: borrador." in report
    assert "Garcia, Juan" in report
    assert "16/05/2026: borrador" in pending
    assert "15/05/2026: sin cargar" in pending
    assert "16/05/2026: borrador" in generic_pending
    assert "Horas extras registradas:" in extra_hours
    assert "Perez, Pedro: 16/05/2026 (2h extras)" in extra_hours
    assert "Externo, Mario" not in extra_hours
    assert "Externo, Mario (otra nomina: Obra Externa): P, 12h" in external_hours
    assert "*NOMINA ACTIVA*" in context_nomina
    assert "Normal, Laura" in context_nomina
    assert "Externo, Mario" not in context_nomina
    assert "*NOMINA COMPLETA*" in full_context_nomina
    assert "Externo, Mario (Obra Externa)" in full_context_nomina


def test_parte_diario_v3_internal_query_detector_accepts_novedades_and_hours():
    assert parte_diario_handler._looks_like_internal_query("quiero ver todas las novedades desde el 29/06 al 05/07")
    assert parte_diario_handler._looks_like_internal_query("necesito saber las horas extras de esta semana")


@pytest.mark.asyncio
async def test_parte_diario_v3_date_selection_recovers_open_part(
    db_session: Session,
    monkeypatch,
    seeded_parte_v3,
):
    monkeypatch.setattr(parte_diario_handler, "_today", lambda: date(2026, 5, 16))
    falta = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).one()
    parte = ParteDiario(
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 5, 16),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add(parte)
    db_session.flush()
    db_session.add(
        ParteDiarioDetalle(
            parte_diario_id=parte.id,
            idnomina=seeded_parte_v3["employee_1"].id,
            idestado=falta.id,
            horas=Decimal("0"),
            origen=OrigenDetalle.AGENTE,
        )
    )
    db_session.commit()
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    menu = await process.handle(_message("Parte diario"), V3ConversationContext(conversation_id="conv-select-date"))
    selected = await process.handle(_message("2026-05-16"), menu.context)

    assert selected.context.active_process == "parteDiario"
    assert selected.context.process_state["etapa"] == "carga"
    assert "outbound" not in selected.metadata
    draft = selected.context.process_state["parte_state"]
    assert draft["fecha"] == "2026-05-16"
    assert draft["parte_id"] == parte.id
    assert draft["novedades"][0]["idnomina"] == seeded_parte_v3["employee_1"].id
    assert draft["novedades"][0]["estado_codigo"] == "FAL"
    assert "Parte diario borrador recuperado" in (selected.reply_text or "")
    assert "Obra: Obra Centro" in (selected.reply_text or "")
    assert "Queres agregar o corregir alguna novedad?" in (selected.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_interactive_date_without_context_resolves_single_project(
    monkeypatch,
    seeded_parte_v3,
):
    monkeypatch.setattr(parte_diario_handler, "_today", lambda: date(2026, 6, 28))
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(
        _message("2026-06-28"),
        V3ConversationContext(conversation_id="conv-direct-date"),
    )

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "carga"
    assert result.context.process_state["parte_state"]["fecha"] == "2026-06-28"
    assert result.metadata["status"] == "date_loaded"
    assert "Parte diario en carga:" in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_visible_date_title_resolves_single_project(
    monkeypatch,
    seeded_parte_v3,
):
    monkeypatch.setattr(parte_diario_handler, "_today", lambda: date(2026, 6, 28))
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(
        _message("28/06/2026 dom"),
        V3ConversationContext(conversation_id="conv-visible-date"),
    )

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "carga"
    assert result.context.process_state["parte_state"]["fecha"] == "2026-06-28"
    assert result.metadata["status"] == "date_loaded"
    assert "Parte diario en carga:" in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_date_selection_recovers_provisional_name_detail(
    db_session: Session,
    monkeypatch,
    seeded_parte_v3,
):
    monkeypatch.setattr(parte_diario_handler, "_today", lambda: date(2026, 5, 16))
    falta = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).one()
    parte = ParteDiario(
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 5, 16),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add(parte)
    db_session.flush()
    db_session.add(
        ParteDiarioDetalle(
            parte_diario_id=parte.id,
            idnomina=None,
            nombre_provisorio="Petro",
            idestado=falta.id,
            horas=Decimal("0"),
            origen=OrigenDetalle.AGENTE,
        )
    )
    db_session.commit()
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))
    context = V3ConversationContext(
        conversation_id="conv-select-date",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "nombre_obra": "Obra Centro",
        },
    )

    menu = await process.handle(_message("Parte diario"), context)
    selected = await process.handle(_message("1"), menu.context)

    draft = selected.context.process_state["parte_state"]
    assert draft["novedades"] == []
    assert draft["pendientes_ambiguos"][0]["nombre"] == "Petro"
    assert draft["pendientes_ambiguos"][0]["estado_codigo"] == "FAL"
    assert "Petro (**a validar): FAL, 0h" in (selected.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_without_default_pending_date_forwards_to_date_selection(
    db_session: Session,
    seeded_parte_v3,
):
    for offset in range(7):
        db_session.add(
            ParteDiario(
                idproyecto=seeded_parte_v3["project"].id,
                contacto_id=seeded_parte_v3["contact"].id,
                fecha=_today() - timedelta(days=offset),
                estado=EstadoParteDiario.CONFIRMADO,
            )
        )
    db_session.commit()
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(TurnPlan(operations=[ParteDiarioOperation(type="sin_novedades")]))
    )

    result = await process.handle(_message("todos presentes"), V3ConversationContext(conversation_id="conv-closed"))

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "seleccionar_fecha"
    assert "Selecciona la fecha del parte diario:" in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_closed_date_selection_loads_saved_part(
    db_session: Session,
    monkeypatch,
    seeded_parte_v3,
):
    monkeypatch.setattr(parte_diario_handler, "_today", lambda: date(2026, 6, 17))
    falta = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).one()
    parte = ParteDiario(
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 6, 17),
        estado=EstadoParteDiario.CONFIRMADO,
    )
    db_session.add(parte)
    db_session.flush()
    db_session.add(
        ParteDiarioDetalle(
            parte_diario_id=parte.id,
            idnomina=seeded_parte_v3["employee_1"].id,
            idestado=falta.id,
            horas=Decimal("0"),
            origen=OrigenDetalle.AGENTE,
        )
    )
    db_session.commit()
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))
    context = V3ConversationContext(
        conversation_id="conv-closed-select",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "nombre_obra": "Obra Centro",
        },
    )

    menu = await process.handle(_message("Parte diario"), context)
    selected = await process.handle(_message("1"), menu.context)

    assert selected.context.active_process is None
    assert selected.metadata["status"] == "closed_date_selected"
    assert selected.metadata["parte_id"] == parte.id
    assert "No hay un parte diario guardado" not in (selected.reply_text or "")
    assert "Garcia, Juan: FAL, 0h" in (selected.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_initial_inferred_date_is_loaded_before_today(
    db_session: Session,
    seeded_parte_v3,
):
    db_session.add(
        ParteDiario(
            idproyecto=seeded_parte_v3["project"].id,
            fecha=_today(),
            estado=EstadoParteDiario.CONFIRMADO,
        )
    )
    db_session.commit()
    target_date = (_today() - timedelta(days=1)).isoformat()
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(type="set_fecha", fecha=target_date),
                    ParteDiarioOperation(type="sin_novedades"),
                ]
            )
        )
    )

    result = await process.handle(_message("ayer sin novedades"), V3ConversationContext(conversation_id="conv-yesterday"))

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "revision"
    assert result.context.process_state["parte_state"]["fecha"] == target_date
    assert result.context.process_state["parte_state"]["sin_novedades_informado"] is True
    assert "Resumen del parte" in (result.reply_text or "")
    assert "Sin novedades. Todos presentes." in (result.reply_text or "")
    buttons = result.metadata["outbound"]["interactive"]["action"]["buttons"]
    assert [button["reply"]["id"] for button in buttons] == [
        "guardar borrador",
        "finalizar parte",
        "seguir editando",
    ]


@pytest.mark.asyncio
async def test_parte_diario_v3_active_selected_date_is_not_overwritten_by_today_reference(seeded_parte_v3):
    selected_date = (_today() - timedelta(days=2)).isoformat()
    today = _today().isoformat()
    draft = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=selected_date,
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": draft.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(type="set_fecha", fecha=today),
                    ParteDiarioOperation(type="agregar_novedad", nombre="Medina", estado_codigo="FAL"),
                ]
            )
        )
    )

    result = await process.handle(_message("hoy falto medina"), context)

    result_draft = result.context.process_state["parte_state"]
    assert result_draft["fecha"] == selected_date
    assert result_draft["fecha_propuesta"] == today
    assert result_draft["esperando"] == "confirmacion_cambio_fecha"
    assert result_draft["novedades"] == []
    assert result_draft["pendientes_ambiguos"] == []
    assert "El parte en carga corresponde" in (result.reply_text or "")
    assert "Opciones: 1:CAMBIAR FECHA 2:MANTENER FECHA." in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_load_does_not_validate_short_workday(seeded_parte_v3):
    fal_id = 2
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 6, 10).isoformat(),
        novedades=[
            NovedadPersonal(
                nombre="Garcia, Juan",
                idnomina=seeded_parte_v3["employee_1"].id,
                idestado=fal_id,
                estado_codigo="FAL",
                horas=0,
            )
        ],
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="modificar_novedad",
                        nombre="Garcia, Juan",
                        estado_codigo="P",
                        horas=4,
                    ),
                ]
            )
        )
    )

    result = await process.handle(_message("garcia trabajo 4hs"), context)

    assert "jornada menor a 9 horas" not in (result.reply_text or "")
    draft = result.context.process_state["parte_state"]
    assert draft["novedades"][0]["estado_codigo"] == "P"
    assert draft["novedades"][0]["horas"] == 4
    assert "Hay alguna otra novedad?" in (result.reply_text or "")
    assert "Opciones: 1:GUARDAR 2:CERRAR 3:SALIR." not in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_modify_for_missing_person_adds_new_attendance(seeded_parte_v3):
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 6, 10).isoformat(),
        novedades=[
            NovedadPersonal(
                nombre="Garcia, Juan",
                idnomina=seeded_parte_v3["employee_1"].id,
                idestado=2,
                estado_codigo="FAL",
                horas=0,
            )
        ],
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="modificar_novedad",
                        nombre="Pedro Perez",
                        estado_codigo="ENF",
                    ),
                ]
            )
        )
    )

    result = await process.handle(_message("perez esta enfermo"), context)

    assert "No encontre una unica novedad" not in (result.reply_text or "")
    draft = result.context.process_state["parte_state"]
    assert [item["estado_codigo"] for item in draft["novedades"]] == ["FAL", "ENF"]
    assert draft["novedades"][1]["idnomina"] == seeded_parte_v3["employee_2"].id
    assert draft["novedades"][1]["horas"] == 0


@pytest.mark.asyncio
async def test_parte_diario_v3_fallback_parses_simple_attendance_when_llm_fails(seeded_parte_v3):
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 7, 30).isoformat(),
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(llm_client=FailingParteDiarioLLM())

    result = await process.handle(_message("falto garcia y perez trabajo 12hs"), context)

    assert "No pude interpretar el parte diario" not in (result.reply_text or "")
    draft = result.context.process_state["parte_state"]
    assert [(item["estado_codigo"], item["horas"]) for item in draft["novedades"]] == [
        ("FAL", 0.0),
        ("P", 12.0),
    ]
    assert [item["idnomina"] for item in draft["novedades"]] == [
        seeded_parte_v3["employee_1"].id,
        seeded_parte_v3["employee_2"].id,
    ]


@pytest.mark.asyncio
async def test_parte_diario_v3_does_not_add_bare_transcribed_names(seeded_parte_v3):
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 6, 10).isoformat(),
        novedades=[
            NovedadPersonal(
                nombre="Garcia, Juan",
                idnomina=seeded_parte_v3["employee_1"].id,
                idestado=2,
                estado_codigo="FAL",
                horas=0,
            )
        ],
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(type="agregar_novedad", nombre="Montaño Oscuera"),
                    ParteDiarioOperation(type="agregar_novedad", nombre="Serrano"),
                    ParteDiarioOperation(type="agregar_novedad", nombre="Quisí"),
                    ParteDiarioOperation(type="agregar_novedad", nombre="Montaño", estado_codigo="P", horas=4),
                ]
            )
        )
    )

    result = await process.handle(
        _message("Montaño Oscuera, Serrano, Quisí. Montaño Trabajo, 4 horas."),
        context,
    )

    draft = result.context.process_state["parte_state"]
    assert [item["nombre"] for item in draft["novedades"]] == ["Garcia, Juan"]
    assert [item["nombre"] for item in draft["pendientes_ambiguos"]] == ["Montaño"]
    assert "Montaño Oscuera (**a validar)" not in (result.reply_text or "")
    assert "Quisí (**a validar)" not in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_marks_ambiguous_surname_as_pending(
    db_session: Session,
    seeded_parte_v3,
):
    ruiz_pablo = Nomina(nombre="Pablo", apellido="Ruiz", dni="parte-v3-ruiz-1", idproyecto=seeded_parte_v3["project"].id)
    ruiz_teresa = Nomina(nombre="Teresa", apellido="Ruiz", dni="parte-v3-ruiz-2", idproyecto=seeded_parte_v3["project"].id)
    db_session.add(ruiz_pablo)
    db_session.add(ruiz_teresa)
    db_session.commit()
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 6, 10).isoformat(),
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(type="agregar_novedad", nombre="ruiz", estado_codigo="ACC"),
                ]
            )
        )
    )

    result = await process.handle(_message("ruiz se accidento"), context)

    draft = result.context.process_state["parte_state"]
    assert draft["novedades"] == []
    assert draft["pendientes_ambiguos"][0]["nombre"] == "ruiz"
    assert draft["pendientes_ambiguos"][0]["estado_codigo"] == "ACC"
    assert {item["nombre"] for item in draft["pendientes_ambiguos"][0]["candidatos"]} == {"Pablo", "Teresa"}
    assert "Ruiz, Pablo: ACC" not in (result.reply_text or "")
    assert "ruiz (**a validar): ACC, 0h" in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_resolves_disambiguated_person_name(
    db_session: Session,
    seeded_parte_v3,
):
    ruiz_pablo = Nomina(nombre="Pablo", apellido="Ruiz", dni="parte-v3-ruiz-3", idproyecto=seeded_parte_v3["project"].id)
    ruiz_teresa = Nomina(nombre="Teresa", apellido="Ruiz", dni="parte-v3-ruiz-4", idproyecto=seeded_parte_v3["project"].id)
    db_session.add(ruiz_pablo)
    db_session.add(ruiz_teresa)
    db_session.commit()
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 6, 10).isoformat(),
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(type="agregar_novedad", nombre="pablo ruiz", estado_codigo="ACC"),
                ]
            )
        )
    )

    result = await process.handle(_message("pablo ruiz se accidento"), context)

    draft = result.context.process_state["parte_state"]
    assert draft["pendientes_ambiguos"] == []
    assert draft["novedades"][0]["idnomina"] == ruiz_pablo.id
    assert draft["novedades"][0]["estado_codigo"] == "ACC"


@pytest.mark.asyncio
async def test_parte_diario_v3_delete_removes_pending_ambiguous_novelty(seeded_parte_v3):
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 6, 10).isoformat(),
        pendientes_ambiguos=[
            PendienteAmbiguo(nombre="Montaño Oscuera", estado_codigo="FAL", nombre_no_encontrado=True),
            PendienteAmbiguo(nombre="Quisí", estado_codigo="FAL", nombre_no_encontrado=True),
        ],
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(type="eliminar_novedad", nombre="montaño"),
                ]
            )
        )
    )

    result = await process.handle(_message("quitar a montaño"), context)

    assert "No encontre una unica novedad" not in (result.reply_text or "")
    draft = result.context.process_state["parte_state"]
    assert [item["nombre"] for item in draft["pendientes_ambiguos"]] == ["Quisí"]


@pytest.mark.asyncio
async def test_parte_diario_v3_modify_updates_pending_ambiguous_novelty(seeded_parte_v3):
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 6, 10).isoformat(),
        pendientes_ambiguos=[
            PendienteAmbiguo(nombre="Montaño", estado_codigo="FAL", nombre_no_encontrado=True),
        ],
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(type="modificar_novedad", nombre="montaño", estado_codigo="ENF"),
                ]
            )
        )
    )

    result = await process.handle(_message("corregi montaño, esta enfermo"), context)

    assert "No encontre una unica novedad" not in (result.reply_text or "")
    draft = result.context.process_state["parte_state"]
    assert draft["pendientes_ambiguos"][0]["nombre"] == "Montaño"
    assert draft["pendientes_ambiguos"][0]["estado_codigo"] == "ENF"
    assert draft["novedades"] == []


@pytest.mark.asyncio
async def test_parte_diario_v3_multiple_projects_selection_does_not_interpret_option_as_part(
    db_session: Session,
    seeded_parte_v3,
):
    user_id = seeded_parte_v3["contact"].responsable_id
    second_opportunity = CRMOportunidad(
        contacto_id=seeded_parte_v3["contact"].id,
        responsable_id=user_id,
        activo=True,
    )
    db_session.add(second_opportunity)
    db_session.flush()
    second_project = Proyecto(nombre="Obra Norte", responsable_id=user_id, oportunidad_id=second_opportunity.id)
    db_session.add(second_project)
    db_session.commit()
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(TurnPlan(operations=[ParteDiarioOperation(type="sin_novedades")]))
    )

    requested = await process.handle(
        _message("quiero cargar el parte diario"),
        V3ConversationContext(conversation_id="conv-multiple"),
    )
    selected = await process.handle(_message("1"), requested.context)

    assert requested.context.active_process == "parteDiario"
    assert "En que obra" in (requested.reply_text or "")
    assert selected.context.active_process == "parteDiario"
    assert selected.context.process_state["proyecto_id"] == seeded_parte_v3["project"].id
    assert selected.context.process_state["etapa"] == "carga"
    assert selected.context.process_state["parte_state"]["fecha"] == (_today() - timedelta(days=6)).isoformat()
    assert selected.context.process_state["parte_state"]["novedades"] == []
    assert "Parte diario en carga" in (selected.reply_text or "")
    assert "Que novedades hubo para esta fecha?" in (selected.reply_text or "")
    assert "Opciones: 1:GUARDAR 2:CERRAR 3:SALIR." not in (selected.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_empty_part_close_requires_confirmation(seeded_parte_v3):
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 6, 10).isoformat(),
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    review = await process.handle(_message("no"), context)
    back = await process.handle(
        _message("3", external_id="wamid-test-empty-close-back"),
        review.context,
    )
    result = await process.handle(
        _message("2", external_id="wamid-test-empty-close-ok"),
        review.context,
    )

    assert review.context.active_process == "parteDiario"
    assert review.context.process_state["etapa"] == "revision"
    assert review.context.process_state["parte_state"]["sin_novedades_informado"] is True
    assert "Resumen del parte" in (review.reply_text or "")
    assert "Sin novedades. Todos presentes." in (review.reply_text or "")
    buttons = review.metadata["outbound"]["interactive"]["action"]["buttons"]
    assert [button["reply"]["id"] for button in buttons] == [
        "guardar borrador",
        "finalizar parte",
        "seguir editando",
    ]
    assert back.context.process_state["etapa"] == "carga"
    assert "Seguimos editando" in (back.reply_text or "")
    assert "Parte diario en carga:" in (back.reply_text or "")
    assert "Sin novedades. Todos presentes." in (back.reply_text or "")
    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "continuar"
    assert result.metadata["parte_listo"] is True
    assert result.metadata["result"]["cerrar_parte"] is True
    assert result.metadata["result"]["sin_novedades_informado"] is True
    assert "*PARTE DIARIO CONFIRMADO*" in (result.reply_text or "")
    assert "Selecciona la fecha del parte diario:" not in (result.reply_text or "")
    assert len(result.additional_messages) == 1
    follow_up = result.additional_messages[0]
    assert "Ahora corresponde cargar el parte del dia" in follow_up.text
    assert "CONTINUAR" in str(follow_up.metadata)
    assert "FINALIZAR" in str(follow_up.metadata)
    finalized = await process.handle(_message("finalizar"), result.context)
    assert finalized.context.active_process is None
    assert finalized.context.process_state == {}
    assert "finalizamos la carga" in (finalized.reply_text or "")
    next_load = await process.handle(_message("continuar"), result.context)
    assert next_load.context.process_state["etapa"] == "carga"
    assert "Parte diario en carga:" in (next_load.reply_text or "")
    assert "Selecciona la fecha del parte diario:" not in (next_load.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_command_with_multiple_projects_uses_default_date_after_project_selection(
    db_session: Session,
    monkeypatch,
    seeded_parte_v3,
):
    monkeypatch.setattr(parte_diario_handler, "_today", lambda: date(2026, 5, 16))
    user_id = seeded_parte_v3["contact"].responsable_id
    second_opportunity = CRMOportunidad(
        contacto_id=seeded_parte_v3["contact"].id,
        responsable_id=user_id,
        activo=True,
    )
    db_session.add(second_opportunity)
    db_session.flush()
    second_project = Proyecto(nombre="Obra Norte", responsable_id=user_id, oportunidad_id=second_opportunity.id)
    db_session.add(second_project)
    db_session.commit()
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))
    emisor = FakeEmisor()

    requested = await process.handle(
        _message("Parte diario"),
        V3ConversationContext(conversation_id="conv-multiple-menu"),
    )
    selected = await process.handle(_message("1"), requested.context, emisor)

    assert requested.context.process_state["fecha_menu_pendiente"] is True
    assert selected.context.process_state["etapa"] == "carga"
    assert selected.context.process_state["parte_state"]["fecha"] == "2026-05-10"
    assert "Parte diario en carga:" in (selected.reply_text or "")
    assert "Selecciona la fecha del parte diario:" not in (selected.reply_text or "")
    assert len(emisor.messages) == 1
    assert emisor.messages[0]["texto"] == (
        "Hola Encargado, tenes 7 partes pendientes, "
        "por favor podrias informar las novedades de la fecha 10/05/2026?"
    )
    assert emisor.messages[0]["metadata"]["status"] == "default_fecha_selected"
    assert emisor.messages[0]["metadata"]["fecha"] == "2026-05-10"
    assert emisor.messages[0]["metadata"]["pending_count"] == 7


@pytest.mark.asyncio
async def test_parte_diario_v3_command_after_confirmation_uses_next_default_date(
    db_session: Session,
    monkeypatch,
    seeded_parte_v3,
):
    monkeypatch.setattr(parte_diario_handler, "_today", lambda: date(2026, 7, 12))
    for confirmed_date in (date(2026, 7, 6), date(2026, 7, 7)):
        db_session.add(
            ParteDiario(
                idproyecto=seeded_parte_v3["project"].id,
                contacto_id=seeded_parte_v3["contact"].id,
                fecha=confirmed_date,
                estado=EstadoParteDiario.CONFIRMADO,
            )
        )
    db_session.commit()
    context = V3ConversationContext(
        conversation_id="conv-after-confirmation",
        active_process="parteDiario",
        process_state={
            "etapa": "seleccionar_fecha",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "nombre_obra": "Obra Centro",
            "parte_state": {},
        },
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))
    emisor = FakeEmisor()

    result = await process.handle(_message("parte diario"), context, emisor)

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "carga"
    assert result.context.process_state["parte_state"]["fecha"] == "2026-07-08"
    assert "Parte diario en carga:" in (result.reply_text or "")
    assert "Fecha: 2026-07-08" in (result.reply_text or "")
    assert "Selecciona la fecha del parte diario:" not in (result.reply_text or "")
    assert len(emisor.messages) == 1
    assert emisor.messages[0]["texto"] == (
        "Hola Encargado, tenes 5 partes pendientes, "
        "por favor podrias informar las novedades de la fecha 08/07/2026?"
    )
    assert emisor.messages[0]["metadata"]["fecha"] == "2026-07-08"
    assert emisor.messages[0]["metadata"]["pending_count"] == 5


@pytest.mark.asyncio
async def test_parte_diario_v3_menu_guardar_persists_draft(seeded_parte_v3):
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 5, 30).isoformat(),
        sin_novedades_informado=True,
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "revision",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(_message("1"), context)

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "continuar"
    assert result.metadata["parte_listo"] is True
    assert result.metadata["result"]["cerrar_parte"] is False
    assert "Parte diario guardado como borrador para 2026-05-30." in (result.reply_text or "")
    assert "*PARTE DIARIO GUARDADO*" not in (result.reply_text or "")
    assert "*Novedades*" not in (result.reply_text or "")
    assert "Selecciona la fecha del parte diario:" not in (result.reply_text or "")
    assert len(result.additional_messages) == 1
    assert "Ahora corresponde cargar el parte del dia" in result.additional_messages[0].text


@pytest.mark.asyncio
async def test_parte_diario_v3_menu_guardar_persists_pending_as_provisional_detail(
    db_session: Session,
    seeded_parte_v3,
):
    accidente = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "ACC")
    ).one()
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=_today().isoformat(),
        pendientes_ambiguos=[
            PendienteAmbiguo(
                nombre="ruiz",
                idestado=accidente.id,
                estado_codigo="ACC",
                horas=0,
                candidatos=[
                    NominaItem(95, "Pablo", "Ruiz", idproyecto=seeded_parte_v3["project"].id),
                    NominaItem(84, "Teresa", "Ruiz", idproyecto=seeded_parte_v3["project"].id),
                ],
            )
        ],
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "revision",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    saved = await process.handle(_message("1", external_id="wamid-save-pending"), context)

    assert saved.metadata["parte_listo"] is True
    assert saved.metadata["next_fecha"] != _today().isoformat()
    assert "Parte diario guardado como borrador" in (saved.reply_text or "")
    assert "ruiz (**a validar)" not in (saved.reply_text or "")
    parte_id = saved.metadata["parte_diario_id"]
    details = db_session.exec(
        select(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == parte_id)
    ).all()
    assert len(details) == 1
    assert details[0].idnomina is None
    assert details[0].nombre_provisorio == "ruiz"
    assert details[0].idestado == accidente.id
    assert details[0].horas == Decimal("0.00")

    menu = await process.handle(_message("Parte diario", external_id="wamid-recover-menu"), saved.context)
    recovered = await process.handle(_message(_today().isoformat(), external_id="wamid-recover-pending"), menu.context)

    draft = recovered.context.process_state["parte_state"]
    assert draft["novedades"] == []
    assert draft["pendientes_ambiguos"][0]["nombre"] == "ruiz"
    assert draft["pendientes_ambiguos"][0]["estado_codigo"] == "ACC"
    assert "ruiz (**a validar): ACC, 0h" in (recovered.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_menu_cerrar_activates_pending_validation(seeded_parte_v3):
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 6, 13).isoformat(),
        novedades=[
            NovedadPersonal(
                nombre="Serrano, Juan David",
                idnomina=seeded_parte_v3["employee_1"].id,
                idestado=2,
                estado_codigo="FAL",
                horas=0,
            )
        ],
        pendientes_ambiguos=[
            PendienteAmbiguo(
                nombre="Vera",
                idestado=2,
                estado_codigo="FAL",
                candidatos=[
                    NominaItem(10, "Juan", "Vera", idproyecto=seeded_parte_v3["project"].id),
                    NominaItem(11, "Pedro", "Vera", idproyecto=seeded_parte_v3["project"].id),
                ],
            )
        ],
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "revision",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(_message("2"), context)

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["parte_state"]["esperando"] == "confirmacion_ambiguos"
    assert "A cual Vera te referis?" in (result.reply_text or "")
    assert "Opciones: 1:CONFIRMAR" not in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_close_persists_after_pending_validation(
    db_session: Session,
    seeded_parte_v3,
):
    falta = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).one()
    accidente = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "ACC")
    ).one()
    ruiz_pablo = Nomina(
        nombre="Pablo",
        apellido="Ruiz",
        dni="parte-v3-close-ruiz-1",
        idproyecto=seeded_parte_v3["project"].id,
        nro_legajo="501001",
    )
    ruiz_teresa = Nomina(
        nombre="Teresa",
        apellido="Ruiz",
        dni="parte-v3-close-ruiz-2",
        idproyecto=seeded_parte_v3["project"].id,
        nro_legajo="501002",
    )
    db_session.add(ruiz_pablo)
    db_session.add(ruiz_teresa)
    db_session.flush()
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 6, 13).isoformat(),
        novedades=[
            NovedadPersonal(
                nombre="Serrano, Juan David",
                idnomina=seeded_parte_v3["employee_1"].id,
                idestado=falta.id,
                estado_codigo="FAL",
                horas=0,
            )
        ],
        pendientes_ambiguos=[
            PendienteAmbiguo(
                nombre="ruiz",
                idestado=accidente.id,
                estado_codigo="ACC",
                horas=0,
                candidatos=[
                    NominaItem(
                        ruiz_pablo.id,
                        "Pablo",
                        "Ruiz",
                        idproyecto=seeded_parte_v3["project"].id,
                        nro_legajo="501001",
                    ),
                    NominaItem(
                        ruiz_teresa.id,
                        "Teresa",
                        "Ruiz",
                        idproyecto=seeded_parte_v3["project"].id,
                        nro_legajo="501002",
                    ),
                ],
            )
        ],
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "revision",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    validating = await process.handle(_message("2", external_id="wamid-close-validating"), context)
    confirmation = await process.handle(_message("1", external_id="wamid-close-selected"), validating.context)

    assert confirmation.context.active_process == "parteDiario"
    assert confirmation.context.process_state["etapa"] == "cierre"
    assert confirmation.context.process_state["parte_state"]["esperando"] == "confirmacion_cierre_validado"
    assert confirmation.metadata["result"]["parte_listo"] is False
    assert "Parte diario listo para cerrar:" in (confirmation.reply_text or "")
    assert "Ruiz, Pablo (legajo 501001): ACC, 0h" in (confirmation.reply_text or "")
    assert "- ruiz: ACC" not in (confirmation.reply_text or "")
    assert "Opciones: OK / VOLVER." in (confirmation.reply_text or "")
    assert confirmation.metadata["outbound"]["type"] == "interactive"
    buttons = confirmation.metadata["outbound"]["interactive"]["action"]["buttons"]
    assert [button["reply"]["id"] for button in buttons] == ["ok", "volver"]

    confirmation_context_for_ok = confirmation.context.copy()
    confirmation_context_for_ok.process_state = deepcopy(confirmation.context.process_state)
    back = await process.handle(_message("volver", external_id="wamid-close-back"), confirmation.context)

    assert back.context.process_state["etapa"] == "revision"
    assert back.context.process_state["parte_state"]["esperando"] is None
    assert "Resumen del parte" in (back.reply_text or "")
    assert "Serrano" in (back.reply_text or "")
    assert "Ruiz" in (back.reply_text or "")

    result = await process.handle(_message("ok", external_id="wamid-close-ok"), confirmation_context_for_ok)

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "continuar"
    assert result.metadata["parte_listo"] is True
    assert result.metadata["result"]["cerrar_parte"] is True
    assert "*PARTE DIARIO CONFIRMADO*" in (result.reply_text or "")
    assert len(result.additional_messages) == 1
    assert "Ahora corresponde cargar el parte del dia" in result.additional_messages[0].text
    parte = db_session.get(ParteDiario, result.metadata["parte_diario_id"])
    assert parte.estado == EstadoParteDiario.CONFIRMADO


def test_parte_diario_v3_resolver_keeps_similar_search_out_of_load(seeded_parte_v3):
    candidates = [
        NominaItem(
            seeded_parte_v3["employee_2"].id,
            "Pedro",
            "Perez",
            idproyecto=seeded_parte_v3["project"].id,
        )
    ]

    result = NominaResolver.resolve("Petro", candidates, candidates)

    assert result.error
    assert result.match is None
    assert not result.ambiguo

    similar = NominaResolver.find_similar("Petro", candidates, candidates)
    assert similar[0].idnomina == seeded_parte_v3["employee_2"].id


def test_parte_diario_v3_normalizes_falcon_transcription_when_not_active_name():
    nominas = [
        NominaItem(1, "Ivan", "Medina", idproyecto=18),
        NominaItem(2, "Juan Manuel", "Medina", idproyecto=18),
    ]

    result = _normalize_attendance_transcription("Medina Falcón!", nominas, nominas)

    assert result == "Medina falto!"


def test_parte_diario_v3_keeps_falcon_transcription_when_active_name_exists():
    nominas = [
        NominaItem(1, "Ivan", "Medina", idproyecto=18),
        NominaItem(2, "Jose", "Falcon", idproyecto=18),
    ]

    result = _normalize_attendance_transcription("Falcon falto", nominas, nominas)

    assert result == "Falcon falto"


def test_parte_diario_v3_candidate_row_uses_legajo_when_name_is_missing():
    candidate = NominaItem(
        idnomina=1,
        nombre="",
        apellido="",
        nro_legajo="501167",
    )

    assert parte_diario_handler._candidate_button_title(candidate, 1) == "Legajo 501167"


def test_parte_diario_v3_similar_search_is_not_limited_to_five():
    candidates = [
        NominaItem(idnomina=index, nombre=f"Nombre {index}", apellido="Gonzalez")
        for index in range(1, 8)
    ]

    result = NominaResolver.find_similar("gonsalez", candidates, [])

    assert len(result) == 7


@pytest.mark.asyncio
async def test_parte_diario_v3_validation_list_with_ten_candidates_has_no_more(seeded_parte_v3):
    candidates = [
        NominaItem(idnomina=100 + index, nombre=f"Nombre {index}", apellido="Gonzalez")
        for index in range(1, 11)
    ]
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 7, 2).isoformat(),
        pendientes_ambiguos=[
            PendienteAmbiguo(
                nombre="gonzalez",
                idestado=2,
                estado_codigo="FAL",
                candidatos=candidates,
            )
        ],
        esperando="confirmacion_ambiguos",
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "validacion",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    options = await process.handle(_message("elegir opcion"), context)

    assert options.metadata["outbound"]["interactive"]["type"] == "button"
    assert "1: Gonzalez, Nombre 1" in (options.reply_text or "")
    assert "10: Gonzalez, Nombre 10" in (options.reply_text or "")
    assert "Mostrar mas" not in (options.reply_text or "")
    assert "Registrar sin validar" not in (options.reply_text or "")
    assert "VOLVER" not in (options.reply_text or "")
    buttons = options.metadata["outbound"]["interactive"]["action"]["buttons"]
    assert [button["reply"]["id"] for button in buttons] == ["registrar sin validar", "volver"]


@pytest.mark.asyncio
async def test_parte_diario_v3_validation_list_paginates_and_selects_second_page(
    db_session: Session,
    seeded_parte_v3,
):
    falta = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).one()
    candidates = [
        NominaItem(idnomina=100 + index, nombre=f"Nombre {index}", apellido="Gonzalez")
        for index in range(1, 12)
    ]
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 7, 2).isoformat(),
        pendientes_ambiguos=[
            PendienteAmbiguo(
                nombre="gonzalez",
                idestado=falta.id,
                estado_codigo="FAL",
                candidatos=candidates,
            )
        ],
        esperando="confirmacion_ambiguos",
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "validacion",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    first_page = await process.handle(_message("elegir opcion", external_id="wamid-page-1"), context)
    first_buttons = first_page.metadata["outbound"]["interactive"]["action"]["buttons"]
    second_page = await process.handle(
        _message("mostrar mas candidatos", external_id="wamid-page-2"),
        first_page.context,
    )
    selected = await process.handle(_message("1", external_id="wamid-page-3"), second_page.context)

    assert "1: Gonzalez, Nombre 1" in (first_page.reply_text or "")
    assert "9: Gonzalez, Nombre 9" in (first_page.reply_text or "")
    assert "10: Mostrar mas" not in (first_page.reply_text or "")
    assert [button["reply"]["id"] for button in first_buttons] == ["mostrar mas candidatos", "registrar sin validar", "volver"]
    assert second_page.context.process_state["parte_state"]["pendientes_ambiguos"][0]["pagina_candidatos"] == 1
    assert second_page.metadata["outbound"]["interactive"]["type"] == "button"
    assert "1: Gonzalez, Nombre 10" in (second_page.reply_text or "")
    assert "2: Gonzalez, Nombre 11" in (second_page.reply_text or "")
    assert "Registrar sin validar" not in (second_page.reply_text or "")
    assert "VOLVER" not in (second_page.reply_text or "")
    assert selected.metadata["result"]["pendientes_ambiguos"] == []
    assert selected.metadata["result"]["novedades"][0]["idnomina"] == candidates[9].idnomina


@pytest.mark.asyncio
async def test_parte_diario_v3_validation_more_shows_external_candidates_without_project_duplicates(
    seeded_parte_v3,
):
    project_candidates = [
        NominaItem(idnomina=101, nombre="Juan", apellido="Medina", idproyecto=seeded_parte_v3["project"].id),
        NominaItem(idnomina=102, nombre="Juan", apellido="Serrano", idproyecto=seeded_parte_v3["project"].id),
    ]
    external_candidates = [
        NominaItem(
            idnomina=201,
            nombre="Juan",
            apellido="Medina",
            idproyecto=999,
            nombre_proyecto="Obra Norte",
            fuera_de_proyecto=True,
        ),
        NominaItem(
            idnomina=202,
            nombre="Juan",
            apellido="Ruiz",
            idproyecto=998,
            nombre_proyecto="Obra Sur",
            fuera_de_proyecto=True,
        ),
    ]
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 7, 2).isoformat(),
        pendientes_ambiguos=[
            PendienteAmbiguo(
                nombre="juan",
                idestado=2,
                estado_codigo="FAL",
                candidatos=project_candidates,
                candidatos_externos=external_candidates,
            )
        ],
        esperando="confirmacion_ambiguos",
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "validacion",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    project_page = await process.handle(_message("elegir opcion", external_id="wamid-project-page"), context)
    project_buttons = project_page.metadata["outbound"]["interactive"]["action"]["buttons"]
    external_page = await process.handle(
        _message("mostrar mas candidatos", external_id="wamid-external-page"),
        project_page.context,
    )
    selected = await process.handle(_message("1", external_id="wamid-external-selected"), external_page.context)

    assert "1: Medina, Juan" in (project_page.reply_text or "")
    assert "2: Serrano, Juan" in (project_page.reply_text or "")
    assert "3: Mostrar mas" not in (project_page.reply_text or "")
    assert [button["reply"]["id"] for button in project_buttons] == ["mostrar mas candidatos", "registrar sin validar", "volver"]
    assert external_page.context.process_state["parte_state"]["pendientes_ambiguos"][0]["mostrando_candidatos_externos"] is True
    assert external_page.metadata["outbound"]["interactive"]["type"] == "button"
    assert "Otros fuera de la obra para juan:" in (external_page.reply_text or "")
    assert "1: Medina, Juan (asignado a Obra Norte)" in (external_page.reply_text or "")
    assert "2: Ruiz, Juan (asignado a Obra Sur)" in (external_page.reply_text or "")
    assert "Registrar sin validar" not in (external_page.reply_text or "")
    assert "VOLVER" not in (external_page.reply_text or "")
    assert "Serrano" not in (external_page.reply_text or "")
    assert selected.metadata["result"]["novedades"][0]["idnomina"] == external_candidates[0].idnomina
    assert selected.metadata["result"]["novedades"][0]["fuera_de_proyecto"] is True
    assert selected.metadata["result"]["novedades"][0]["nombre_proyecto"] == "Obra Norte"


@pytest.mark.asyncio
async def test_parte_diario_v3_validation_more_paginates_project_before_external_candidates(
    seeded_parte_v3,
):
    project_candidates = [
        NominaItem(idnomina=100 + index, nombre=f"Juan {index}", apellido="Medina", idproyecto=seeded_parte_v3["project"].id)
        for index in range(1, 12)
    ]
    external_candidates = [
        NominaItem(
            idnomina=200 + index,
            nombre=f"Juan {index}",
            apellido="Externo",
            idproyecto=900 + index,
            nombre_proyecto=f"Obra {index}",
            fuera_de_proyecto=True,
        )
        for index in range(1, 8)
    ]
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 7, 2).isoformat(),
        pendientes_ambiguos=[
            PendienteAmbiguo(
                nombre="juan",
                idestado=2,
                estado_codigo="FAL",
                candidatos=project_candidates,
                candidatos_externos=external_candidates,
            )
        ],
        esperando="confirmacion_ambiguos",
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "validacion",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    first_page = await process.handle(_message("elegir opcion", external_id="wamid-project-page-1"), context)
    first_buttons = first_page.metadata["outbound"]["interactive"]["action"]["buttons"]
    second_page = await process.handle(
        _message("mostrar mas candidatos", external_id="wamid-project-page-2"),
        first_page.context,
    )
    external_page = await process.handle(
        _message("mostrar mas candidatos", external_id="wamid-external-page"),
        second_page.context,
    )

    assert "1: Medina, Juan 1" in (first_page.reply_text or "")
    assert "9: Medina, Juan 9" in (first_page.reply_text or "")
    assert "10: Mostrar mas" not in (first_page.reply_text or "")
    assert [button["reply"]["id"] for button in first_buttons] == ["mostrar mas candidatos", "registrar sin validar", "volver"]
    assert second_page.metadata["outbound"]["interactive"]["type"] == "button"
    assert "1: Medina, Juan 10" in (second_page.reply_text or "")
    assert "2: Medina, Juan 11" in (second_page.reply_text or "")
    assert "Mostrar mas" not in (second_page.reply_text or "")
    assert "Registrar sin validar" not in (second_page.reply_text or "")
    assert "VOLVER" not in (second_page.reply_text or "")
    assert external_page.context.process_state["parte_state"]["pendientes_ambiguos"][0]["pagina_candidatos"] == 0
    assert external_page.context.process_state["parte_state"]["pendientes_ambiguos"][0]["mostrando_candidatos_externos"] is True
    assert external_page.metadata["outbound"]["interactive"]["type"] == "button"
    assert "1: Externo, Juan 1 (asignado a Obra 1)" in (external_page.reply_text or "")
    assert "7: Externo, Juan 7 (asignado a Obra 7)" in (external_page.reply_text or "")
    assert "Registrar sin validar" not in (external_page.reply_text or "")
    assert "VOLVER" not in (external_page.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_cerrar_asks_to_select_similar_pending_name(seeded_parte_v3):
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(type="agregar_novedad", nombre="Petro", estado_codigo="FAL"),
                ]
            )
        )
    )
    context = V3ConversationContext(conversation_id="meta:account:549111111")

    loaded = await process.handle(_message("Petro falto"), context)
    loaded_draft = loaded.context.process_state["parte_state"]
    assert loaded.context.process_state["etapa"] == "carga"
    assert loaded_draft["pendientes_ambiguos"][0]["nombre_no_encontrado"] is True
    assert loaded_draft["pendientes_ambiguos"][0]["candidatos"] is None
    assert "Petro (**a validar): FAL, 0h" in (loaded.reply_text or "")

    review = await process.handle(_message("no", external_id="wamid-test-review"), loaded.context)
    result = await process.handle(_message("2", external_id="wamid-test-2"), review.context)

    assert review.context.process_state["etapa"] == "revision"
    assert "Resumen del parte" in (review.reply_text or "")
    assert result.context.process_state["etapa"] == "validacion"
    assert result.context.process_state["parte_state"]["esperando"] == "confirmacion_ambiguos"
    assert result.context.process_state["parte_state"]["pendientes_ambiguos"][0]["lista_candidatos_mostrada"] is True
    assert "A cual Petro te referis?" in (result.reply_text or "")
    assert "1: Perez, Pedro" in (result.reply_text or "")
    assert "Registrar como Petro sin validar" not in (result.reply_text or "")
    assert "Opciones: 1:CONFIRMAR" not in (result.reply_text or "")
    assert result.metadata["outbound"]["type"] == "interactive"
    interactive = result.metadata["outbound"]["interactive"]
    assert interactive["type"] == "button"
    buttons = interactive["action"]["buttons"]
    assert [button["reply"]["id"] for button in buttons] == ["registrar sin validar", "volver"]

    back = await process.handle(_message("volver", external_id="wamid-test-back"), result.context)

    assert back.context.process_state["etapa"] == "carga"
    assert back.context.process_state["parte_state"]["esperando"] is None
    assert back.context.process_state["parte_state"]["pendientes_ambiguos"]
    assert "Parte diario en carga:" in (back.reply_text or "")
    assert "Petro (**a validar): FAL, 0h" in (back.reply_text or "")
    assert "Que queres agregar o corregir?" in (back.reply_text or "")

    selected = await process.handle(_message("1", external_id="wamid-test-3"), result.context)

    assert selected.context.process_state["parte_state"]["esperando"] == "confirmacion_cierre_validado"
    assert "Perez, Pedro: FAL, 0h" in (selected.reply_text or "")
    assert "Opcion 1" not in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_unvalidated_selection_is_registered_as_provisional_detail(
    db_session: Session,
    seeded_parte_v3,
):
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(type="agregar_novedad", nombre="Petro", estado_codigo="FAL"),
                ]
            )
        )
    )
    context = V3ConversationContext(conversation_id="meta:account:549111111")

    loaded = await process.handle(_message("Petro falto"), context)
    review = await process.handle(_message("no", external_id="wamid-test-review"), loaded.context)
    validating = await process.handle(_message("2", external_id="wamid-test-2"), review.context)
    confirmation = await process.handle(_message("registrar sin validar", external_id="wamid-test-3"), validating.context)

    assert confirmation.context.process_state["etapa"] == "cierre"
    assert confirmation.context.process_state["parte_state"]["esperando"] == "confirmacion_cierre_validado"
    assert confirmation.metadata["result"]["parte_listo"] is False
    assert "Petro quedo registrado sin validar" in (confirmation.reply_text or "")
    assert "Petro (sin validar): FAL, 0h" in (confirmation.reply_text or "")
    assert "Opciones: OK / VOLVER." in (confirmation.reply_text or "")

    result = await process.handle(_message("ok", external_id="wamid-test-4"), confirmation.context)

    assert result.context.process_state["etapa"] == "continuar"
    assert result.metadata["result"]["cerrar_parte"] is True
    assert "Petro (sin validar): FAL, 0h" in (result.reply_text or "")
    assert len(result.additional_messages) == 1
    assert "Ahora corresponde cargar el parte del dia" in result.additional_messages[0].text
    parte_id = result.metadata["parte_diario_id"]
    details = db_session.exec(
        select(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == parte_id)
    ).all()
    provisional = next((detail for detail in details if detail.nombre_provisorio == "Petro"), None)
    assert provisional is not None
    assert provisional.idnomina is None
    assert provisional.horas == Decimal("0.00")


@pytest.mark.asyncio
async def test_parte_diario_v3_menu_salir_confirms_discard(seeded_parte_v3):
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 5, 30).isoformat(),
        sin_novedades_informado=True,
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "cierre",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    exit_confirmation = await process.handle(_message("salir"), context)
    back = await process.handle(_message("volver"), exit_confirmation.context)
    discarded = await process.handle(_message("ok"), exit_confirmation.context)

    assert exit_confirmation.context.process_state["etapa"] == "confirmar_salida"
    assert "Se perderan los cambios no guardados." in (exit_confirmation.reply_text or "")
    assert "Opciones: OK / VOLVER." in (exit_confirmation.reply_text or "")
    assert "Fecha: 2026-05-30" not in (exit_confirmation.reply_text or "")
    assert exit_confirmation.metadata["outbound"]["type"] == "interactive"
    buttons = exit_confirmation.metadata["outbound"]["interactive"]["action"]["buttons"]
    assert [button["reply"]["id"] for button in buttons] == ["ok", "volver"]
    assert back.context.process_state["etapa"] == "carga"
    assert "Volvemos a la carga" in (back.reply_text or "")
    assert "Parte diario en carga:" in (back.reply_text or "")
    assert "Sin novedades. Todos presentes." in (back.reply_text or "")
    assert discarded.context.active_process == "parteDiario"
    assert discarded.context.process_state["etapa"] == "seleccionar_fecha"
    assert "descartado" in (discarded.reply_text or "")
    assert "Selecciona la fecha del parte diario:" in (discarded.reply_text or "")

    returned = await process.handle(_message("salir"), discarded.context)

    assert returned.context.active_process == "general"
    assert "1: PEDIDO OBRA" in (returned.reply_text or "")
    assert "2: PARTE DIARIO" in (returned.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_confirm_persists_part_and_crm_message(db_session: Session, seeded_parte_v3):
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 5, 30).isoformat(),
        sin_novedades_informado=True,
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "cierre",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(_message("1", external_id="wamid-confirm-parte"), context)

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "continuar"
    assert result.metadata["parte_listo"] is True
    parte = db_session.exec(select(ParteDiario)).one()
    assert parte.id == result.metadata["parte_diario_id"]
    assert parte.estado == EstadoParteDiario.BORRADOR
    assert parte.contacto_id == seeded_parte_v3["contact"].id
    assert parte.mensaje_origen_id is not None
    message = db_session.get(CRMMensaje, parte.mensaje_origen_id)
    assert message is not None
    assert message.contacto_id == seeded_parte_v3["contact"].id
    assert message.metadata_json["agent_v3"]["result"]["contacto_id"] == seeded_parte_v3["contact"].id
    assert message.metadata_json["agent_v3"]["result"]["parte_listo"] is True
    assert "Selecciona la fecha del parte diario:" not in (result.reply_text or "")
    assert len(result.additional_messages) == 1
    assert "Ahora corresponde cargar el parte del dia" in result.additional_messages[0].text
    details = db_session.exec(
        select(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == parte.id)
    ).all()
    assert details == []


@pytest.mark.asyncio
async def test_parte_diario_v3_confirm_creates_new_part_when_soft_deleted_exists_same_unique_key(
    db_session: Session,
    seeded_parte_v3,
):
    existing = ParteDiario(
        idproyecto=seeded_parte_v3["project"].id,
        contacto_id=seeded_parte_v3["contact"].id,
        fecha=date(2026, 6, 29),
        estado=EstadoParteDiario.CONFIRMADO,
        deleted_at=datetime.now(UTC),
    )
    db_session.add(existing)
    db_session.flush()
    existing_id = int(existing.id)
    db_session.add(
        ParteDiarioDetalle(
            parte_diario_id=existing_id,
            idnomina=seeded_parte_v3["employee_1"].id,
            horas=Decimal("0.00"),
            origen=OrigenDetalle.AGENTE,
        )
    )
    db_session.commit()

    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 6, 29).isoformat(),
        sin_novedades_informado=True,
        esperando="confirmacion_cierre_validado",
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "cierre",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(_message("ok", external_id="wamid-soft-delete-confirm"), context)

    assert result.metadata["parte_listo"] is True
    assert result.metadata["parte_diario_id"] != existing_id

    old_part = db_session.get(ParteDiario, existing_id)
    assert old_part is not None
    assert old_part.deleted_at is not None

    new_part = db_session.get(ParteDiario, int(result.metadata["parte_diario_id"]))
    assert new_part is not None
    assert new_part.deleted_at is None
    assert new_part.estado == EstadoParteDiario.CONFIRMADO


@pytest.mark.asyncio
async def test_parte_diario_v3_crm_mensaje_contacto_puede_diferir_de_oportunidad(
    db_session: Session,
    seeded_parte_v3,
):
    principal = CRMContacto(
        nombre_completo="Contacto principal oportunidad",
        telefonos=["549222222"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    db_session.add(principal)
    db_session.flush()
    seeded_parte_v3["opportunity"].contacto_id = principal.id
    db_session.add(
        ProyectoEncargado(
            proyecto_id=seeded_parte_v3["project"].id,
            contacto_id=seeded_parte_v3["contact"].id,
            activo=True,
        )
    )
    db_session.commit()
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 6, 1).isoformat(),
        sin_novedades_informado=True,
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "cierre",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(_message("1", external_id="wamid-contacto-diferente"), context)

    parte = db_session.get(ParteDiario, result.metadata["parte_diario_id"])
    mensaje = db_session.get(CRMMensaje, parte.mensaje_origen_id)
    db_session.refresh(seeded_parte_v3["opportunity"])
    assert parte.contacto_id == seeded_parte_v3["contact"].id
    assert mensaje.contacto_id == seeded_parte_v3["contact"].id
    assert mensaje.oportunidad_id == seeded_parte_v3["opportunity"].id
    assert seeded_parte_v3["opportunity"].contacto_id == principal.id
    assert mensaje.contacto_id != seeded_parte_v3["opportunity"].contacto_id


@pytest.mark.asyncio
async def test_parte_diario_v3_close_persists_closed_part(db_session: Session, seeded_parte_v3):
    state = ParteDiarioState(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 5, 31).isoformat(),
        sin_novedades_informado=True,
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "cierre",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(_message("2", external_id="wamid-close-parte"), context)

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "continuar"
    assert result.metadata["parte_listo"] is True
    parte = db_session.exec(select(ParteDiario)).one()
    assert parte.estado == EstadoParteDiario.CONFIRMADO
    assert "*PARTE DIARIO CONFIRMADO*" in (result.reply_text or "")
    assert "Selecciona la fecha del parte diario:" not in (result.reply_text or "")
    assert len(result.additional_messages) == 1
    follow_up = result.additional_messages[0]
    assert "Ahora corresponde cargar el parte del dia" in follow_up.text
    assert "CONTINUAR" in str(follow_up.metadata)
    assert "FINALIZAR" in str(follow_up.metadata)
    message = db_session.get(CRMMensaje, parte.mensaje_origen_id)
    assert message is not None
    assert message.metadata_json["agent_v3"]["result"]["cerrar_parte"] is True
