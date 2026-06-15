from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlmodel import Session, select

import agente.v3.subprocesses.parte_diario.handler as parte_diario_handler
from agente.v3.contracts import V3ConversationContext, V3InboundMessage
from agente.v3.subprocesses.parte_diario.handler import ParteDiarioSubprocess
from agente.v3.subprocesses.parte_diario.models import (
    NominaItem,
    NovedadPersonal,
    ParteDiarioOperation,
    ParteDiarioState,
    PendienteAmbiguo,
    TurnPlan,
)
from agente.v3.subprocesses.parte_diario.process import _today
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
    User,
)
from app.services.parte_diario_estado_service import seed_parte_diario_estados


class FakeParteDiarioLLM:
    def __init__(self, plan: TurnPlan) -> None:
        self.plan = plan

    async def interpret_turn(self, mensaje, state, nominas_proyecto, estados):
        return self.plan

    async def interpretar_estado_pendiente(self, mensaje, estados):
        return "PER"


def _message(text: str, *, external_id: str = "wamid-test-1") -> V3InboundMessage:
    return V3InboundMessage(
        id="msg-1",
        provider="meta",
        channel_type="whatsapp",
        account_ref="account",
        conversation_id="meta:account:549111111",
        external_message_id=external_id,
        from_address="549111111",
        to_address="549999999",
        text=text,
        message_type="text",
        raw_payload={"raw": True},
        normalized_payload={"normalized": True},
    )


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
async def test_parte_diario_v3_first_load_resolves_project_and_sets_today(seeded_parte_v3):
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
    assert draft["fecha"] == _today().isoformat()
    assert draft["novedades"][0]["idnomina"] == seeded_parte_v3["employee_1"].id
    assert draft["novedades"][0]["estado_codigo"] == "FAL"
    assert "Opciones: 1:GUARDAR 2:CERRAR 3:SALIR." in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_command_shows_last_seven_days_menu(
    db_session: Session,
    monkeypatch,
    seeded_parte_v3,
):
    monkeypatch.setattr(parte_diario_handler, "_today", lambda: date(2026, 5, 16))
    db_session.add(
        ParteDiario(
            idproyecto=seeded_parte_v3["project"].id,
            fecha=date(2026, 5, 16),
            estado=EstadoParteDiario.BORRADOR,
        )
    )
    db_session.add(
        ParteDiario(
            idproyecto=seeded_parte_v3["project"].id,
            fecha=date(2026, 5, 15),
            estado=EstadoParteDiario.CERRADO,
        )
    )
    db_session.commit()
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(_message("Parte diario"), V3ConversationContext(conversation_id="conv-menu"))

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "seleccionar_fecha"
    assert "1: 16/05/2026 sab (borrador)" in (result.reply_text or "")
    assert "2: 15/05/2026 vie (cerrado)" in (result.reply_text or "")
    assert "3: 14/05/2026 jue (sin cargar)" in (result.reply_text or "")
    assert "Responde con el numero de una fecha o SALIR" in (result.reply_text or "")

    exited = await process.handle(_message("salir"), result.context)

    assert exited.context.active_process == "general"
    assert "1: PEDIDO OBRA" in (exited.reply_text or "")
    assert "2: PARTE DIARIO" in (exited.reply_text or "")


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
    selected = await process.handle(_message("1"), menu.context)

    assert selected.context.active_process == "parteDiario"
    assert selected.context.process_state["etapa"] == "carga"
    draft = selected.context.process_state["parte_state"]
    assert draft["fecha"] == "2026-05-16"
    assert draft["parte_id"] == parte.id
    assert draft["novedades"][0]["idnomina"] == seeded_parte_v3["employee_1"].id
    assert draft["novedades"][0]["estado_codigo"] == "FAL"
    assert "Parte diario borrador recuperado" in (selected.reply_text or "")
    assert "Opciones: 1:GUARDAR 2:CERRAR 3:SALIR." in (selected.reply_text or "")


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

    menu = await process.handle(_message("Parte diario"), V3ConversationContext(conversation_id="conv-select-date"))
    selected = await process.handle(_message("1"), menu.context)

    draft = selected.context.process_state["parte_state"]
    assert draft["novedades"][0]["idnomina"] is None
    assert draft["novedades"][0]["nombre"] == "Petro"
    assert "Petro (sin validar): FAL, 0h" in (selected.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_closed_part_for_today_forwards_to_date_selection(db_session: Session, seeded_parte_v3):
    closed = ParteDiario(
        idproyecto=seeded_parte_v3["project"].id,
        fecha=_today(),
        estado=EstadoParteDiario.CERRADO,
    )
    db_session.add(closed)
    db_session.commit()
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(TurnPlan(operations=[ParteDiarioOperation(type="sin_novedades")]))
    )

    result = await process.handle(_message("todos presentes"), V3ConversationContext(conversation_id="conv-closed"))

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "seleccionar_fecha"
    assert "ya esta cerrado" in (result.reply_text or "")
    assert "Selecciona la fecha del parte diario:" in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_initial_inferred_date_is_loaded_before_today(
    db_session: Session,
    seeded_parte_v3,
):
    db_session.add(
        ParteDiario(
            idproyecto=seeded_parte_v3["project"].id,
            fecha=_today(),
            estado=EstadoParteDiario.CERRADO,
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
    assert result.context.process_state["etapa"] == "carga"
    assert result.context.process_state["parte_state"]["fecha"] == target_date
    assert result.context.process_state["parte_state"]["sin_novedades_informado"] is True
    assert "Opciones: 1:GUARDAR 2:CERRAR 3:SALIR." in (result.reply_text or "")


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
    assert "Opciones: 1:GUARDAR 2:CERRAR 3:SALIR." in (result.reply_text or "")


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
    assert selected.context.process_state["parte_state"]["fecha"] == _today().isoformat()
    assert selected.context.process_state["parte_state"]["novedades"] == []
    assert "Parte diario en carga" in (selected.reply_text or "")
    assert "Opciones: 1:GUARDAR 2:CERRAR 3:SALIR." in (selected.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_empty_part_close_marks_sin_novedades_and_closes(seeded_parte_v3):
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

    result = await process.handle(_message("2"), context)

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "seleccionar_fecha"
    assert result.metadata["parte_listo"] is True
    assert result.metadata["result"]["cerrar_parte"] is True
    assert result.metadata["result"]["sin_novedades_informado"] is True
    assert "*PARTE DIARIO CERRADO*" in (result.reply_text or "")
    assert "Selecciona la fecha del parte diario:" in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_command_with_multiple_projects_keeps_date_menu_intent(
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

    requested = await process.handle(
        _message("Parte diario"),
        V3ConversationContext(conversation_id="conv-multiple-menu"),
    )
    selected = await process.handle(_message("1"), requested.context)

    assert requested.context.process_state["fecha_menu_pendiente"] is True
    assert selected.context.process_state["etapa"] == "seleccionar_fecha"
    assert "1: 16/05/2026 sab (sin cargar)" in (selected.reply_text or "")


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
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(_message("1"), context)

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "seleccionar_fecha"
    assert result.metadata["parte_listo"] is True
    assert result.metadata["result"]["cerrar_parte"] is False
    assert "*PARTE DIARIO REGISTRADO*" in (result.reply_text or "")
    assert "Selecciona la fecha del parte diario:" in (result.reply_text or "")


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
            "etapa": "carga",
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
    assert "Petro (**a validar)" in (loaded.reply_text or "")

    result = await process.handle(_message("2", external_id="wamid-test-2"), loaded.context)

    assert result.context.process_state["etapa"] == "validacion"
    assert result.context.process_state["parte_state"]["esperando"] == "confirmacion_ambiguos"
    assert "A cual Petro te referis?" in (result.reply_text or "")
    assert "Perez, Pedro" in (result.reply_text or "")
    assert "Registrar como Petro sin validar" in (result.reply_text or "")
    assert "Opciones: 1:CONFIRMAR" not in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_unvalidated_selection_is_not_registered(seeded_parte_v3):
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
    validating = await process.handle(_message("2", external_id="wamid-test-2"), loaded.context)
    result = await process.handle(_message("2", external_id="wamid-test-3"), validating.context)

    assert result.context.process_state["etapa"] == "cierre"
    assert result.context.process_state["parte_state"]["pendientes_ambiguos"] == []
    assert result.context.process_state["parte_state"]["novedades"] == []
    assert "Petro quedo sin validar y no se registrara" in (result.reply_text or "")
    assert "Parte diario para confirmar:" in (result.reply_text or "")


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

    exit_confirmation = await process.handle(_message("3"), context)
    back = await process.handle(_message("2"), exit_confirmation.context)
    discarded = await process.handle(_message("1"), exit_confirmation.context)

    assert exit_confirmation.context.process_state["etapa"] == "confirmar_salida"
    assert "Se perderan los cambios no guardados." in (exit_confirmation.reply_text or "")
    assert "Opciones: 1:OK 2:VOLVER." in (exit_confirmation.reply_text or "")
    assert "Fecha: 2026-05-30" not in (exit_confirmation.reply_text or "")
    assert back.context.process_state["etapa"] == "carga"
    assert "Volvemos a la carga" in (back.reply_text or "")
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
    assert result.context.process_state["etapa"] == "seleccionar_fecha"
    assert result.metadata["parte_listo"] is True
    parte = db_session.exec(select(ParteDiario)).one()
    assert parte.id == result.metadata["parte_diario_id"]
    assert parte.estado == EstadoParteDiario.BORRADOR
    assert parte.mensaje_origen_id is not None
    message = db_session.get(CRMMensaje, parte.mensaje_origen_id)
    assert message is not None
    assert message.metadata_json["agent_v3"]["result"]["parte_listo"] is True
    assert "Selecciona la fecha del parte diario:" in (result.reply_text or "")
    details = db_session.exec(
        select(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == parte.id)
    ).all()
    assert details == []


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
    assert result.context.process_state["etapa"] == "seleccionar_fecha"
    assert result.metadata["parte_listo"] is True
    parte = db_session.exec(select(ParteDiario)).one()
    assert parte.estado == EstadoParteDiario.CERRADO
    assert "*PARTE DIARIO CERRADO*" in (result.reply_text or "")
    assert "Selecciona la fecha del parte diario:" in (result.reply_text or "")
    message = db_session.get(CRMMensaje, parte.mensaje_origen_id)
    assert message is not None
    assert message.metadata_json["agent_v3"]["result"]["cerrar_parte"] is True
