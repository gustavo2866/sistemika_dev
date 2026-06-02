"""Pruebas del dominio y materializacion de parte_diario."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from sqlmodel import Session, select

from agente.v2.processes.parte_diario import renderer
from agente.v2.processes.parte_diario.executor import execute_plan
from agente.v2.processes.parte_diario.handler import ParteDiarioProcess, _today
from agente.v2.processes.parte_diario.models import (
    EstadoItem,
    ConflictoNovedad,
    NominaItem,
    NovedadPersonal,
    ParteDiarioOperation,
    ParteDiarioState,
    PendienteAmbiguo,
    TurnPlan,
)
from agente.v2.processes.parte_diario.resolver import NominaResolver
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
from app.services.parte_diario_service import parte_diario_service


ESTADOS = [
    EstadoItem(1, "P", "PRESENTE"),
    EstadoItem(2, "FAL", "FALTA"),
    EstadoItem(3, "ACC", "ACCIDENTE"),
    EstadoItem(4, "PER", "PERMISO"),
]
INTERNOS = [
    NominaItem(1, "Juan", "Garcia", idproyecto=10),
    NominaItem(2, "Pedro", "Garcia", idproyecto=10),
]
TODOS = [*INTERNOS, NominaItem(3, "Rafael", "Perez", idproyecto=20, nombre_proyecto="Obra Norte")]


def _plan(*operations: ParteDiarioOperation) -> TurnPlan:
    return TurnPlan(operations=list(operations))


def test_nomina_resolver_prioritizes_project_and_detects_ambiguity():
    result = NominaResolver.resolve("Garcia", INTERNOS, TODOS)

    assert result.ambiguo
    assert {item.idnomina for item in result.candidatos or []} == {1, 2}


def test_external_employee_without_hours_defaults_to_nine():
    state = ParteDiarioState(oportunidad_id=1, idproyecto=10)

    result = execute_plan(
        state,
        _plan(ParteDiarioOperation(type="agregar_novedad", nombre="Rafael Perez")),
        INTERNOS,
        TODOS,
        ESTADOS,
    )

    assert result.next_state.novedades[0].fuera_de_proyecto
    assert result.next_state.novedades[0].horas == 9.0
    assert not result.next_state.pendientes_ambiguos


def test_external_explicit_absence_without_hours_defaults_to_zero():
    state = ParteDiarioState(oportunidad_id=1, idproyecto=10)

    result = execute_plan(
        state,
        _plan(ParteDiarioOperation(type="agregar_novedad", nombre="Rafael Perez", estado_codigo="FAL")),
        INTERNOS,
        TODOS,
        ESTADOS,
    )

    assert result.next_state.novedades[0].fuera_de_proyecto
    assert result.next_state.novedades[0].estado_codigo == "FAL"
    assert result.next_state.novedades[0].horas == 0.0
    assert not result.next_state.pendientes_ambiguos


def test_external_partial_hours_do_not_require_reason():
    state = ParteDiarioState(oportunidad_id=1, idproyecto=10)

    result = execute_plan(
        state,
        _plan(ParteDiarioOperation(type="agregar_novedad", nombre="Rafael Perez", horas=3)),
        INTERNOS,
        TODOS,
        ESTADOS,
    )

    assert result.next_state.novedades[0].fuera_de_proyecto
    assert result.next_state.novedades[0].estado_codigo is None
    assert result.next_state.novedades[0].horas == 3
    assert not result.next_state.pendientes_ambiguos


def test_internal_partial_hours_without_reason_remains_pending():
    state = ParteDiarioState(oportunidad_id=1, idproyecto=10)

    result = execute_plan(
        state,
        _plan(ParteDiarioOperation(type="agregar_novedad", nombre="Juan Garcia", horas=5)),
        INTERNOS,
        TODOS,
        ESTADOS,
    )

    assert not result.next_state.novedades
    assert result.next_state.pendientes_ambiguos[0].estado_pendiente
    assert result.next_state.pendientes_ambiguos[0].horas == 5


def test_summary_lists_ambiguous_employee_as_pending_clarification():
    state = ParteDiarioState(
        oportunidad_id=1,
        idproyecto=10,
        novedades=[
            NovedadPersonal(nombre="Reyes, Horacio", idnomina=4, idestado=2, estado_codigo="FAL", horas=0),
        ],
        pendientes_ambiguos=[
            PendienteAmbiguo(
                nombre="Varela",
                idestado=2,
                estado_codigo="FAL",
                candidatos=[
                    NominaItem(5, "Juan", "Varela", idproyecto=10),
                    NominaItem(6, "Pedro", "Varela", idproyecto=10),
                ],
            )
        ],
    )

    summary = renderer.actualizado(state)

    assert "- Reyes, Horacio: FAL, 0h" in summary
    assert "- Varela (**a validar)" in summary
    assert "Pendientes de aclarar:" not in summary


def test_summary_lists_identified_employee_with_pending_state():
    state = ParteDiarioState(
        oportunidad_id=1,
        idproyecto=10,
        pendientes_ambiguos=[
            PendienteAmbiguo(
                nombre="Juan Garcia",
                idnomina_resuelto=1,
                horas=5,
            )
        ],
    )

    summary = renderer.resumen(state)

    assert summary == "- Juan Garcia (**a validar)"


def test_summary_lists_defined_absence_reason():
    state = ParteDiarioState(
        oportunidad_id=1,
        idproyecto=10,
        novedades=[
            NovedadPersonal(
                nombre="Garcia, Juan",
                idnomina=1,
                idestado=3,
                estado_codigo="ACC",
                horas=0,
                descripcion="tuvo un accidente en la obra",
            )
        ],
    )

    assert renderer.resumen(state) == "- Garcia, Juan: ACC, 0h, motivo: tuvo un accidente en la obra"


def test_summary_does_not_label_present_description_as_absence_reason():
    state = ParteDiarioState(
        oportunidad_id=1,
        idproyecto=10,
        novedades=[
            NovedadPersonal(
                nombre="Garcia, Juan",
                idnomina=1,
                idestado=1,
                estado_codigo="P",
                horas=11,
                descripcion="hizo 2 horas extra",
            )
        ],
    )

    assert renderer.resumen(state) == "- Garcia, Juan: P, 11h"


def test_confirmed_part_uses_highlighted_summary_format():
    state = ParteDiarioState(
        oportunidad_id=1,
        idproyecto=10,
        fecha="2026-06-01",
        novedades=[
            NovedadPersonal(
                nombre="Garcia, Juan",
                idnomina=1,
                idestado=3,
                estado_codigo="ACC",
                horas=0,
                descripcion="tuvo un accidente",
            )
        ],
    )

    assert renderer.confirmado(state) == (
        "*PARTE DIARIO REGISTRADO*\n"
        "━━━━━━━━━━━━━━\n\n"
        "*Fecha:* 2026-06-01\n\n"
        "*Novedades*\n"
        "• Garcia, Juan: ACC, 0h, motivo: tuvo un accidente"
    )


def test_saved_part_query_reuses_confirmed_summary_format():
    state = ParteDiarioState(
        oportunidad_id=1,
        idproyecto=10,
        parte_id=15,
        fecha="2026-06-01",
        novedades=[
            NovedadPersonal(
                nombre="Garcia, Juan",
                idnomina=1,
                idestado=2,
                estado_codigo="FAL",
                horas=0,
            )
        ],
    )

    assert renderer.consulta(state) == renderer.confirmado(state)
    assert "CONFIRMAR" not in renderer.consulta(state)


def test_preconfirmation_summaries_show_target_date():
    state = ParteDiarioState(
        oportunidad_id=1,
        idproyecto=10,
        fecha="2026-05-29",
        novedades=[
            NovedadPersonal(nombre="Garcia, Juan", idnomina=1, idestado=2, estado_codigo="FAL", horas=0)
        ],
    )

    assert "Parte diario actualizado:\nFecha: 2026-05-29" in renderer.actualizado(state)
    assert "Parte diario para confirmar:\nFecha: 2026-05-29" in renderer.solicitar_confirmacion(state)


def test_summary_lists_repeated_pending_name_only_once():
    state = ParteDiarioState(
        oportunidad_id=1,
        idproyecto=10,
        pendientes_ambiguos=[
            PendienteAmbiguo(nombre="varela", idestado=2, estado_codigo="FAL", candidatos=INTERNOS),
            PendienteAmbiguo(nombre="Varela", candidatos=INTERNOS),
        ],
    )

    summary = renderer.resumen(state)

    assert summary == "- varela (**a validar)"


def test_unknown_employee_is_listed_as_pending_clarification():
    state = ParteDiarioState(oportunidad_id=1, idproyecto=10)

    result = execute_plan(
        state,
        _plan(ParteDiarioOperation(type="agregar_novedad", nombre="Varela", estado_codigo="FAL")),
        INTERNOS,
        TODOS,
        ESTADOS,
    )

    assert not result.errors
    assert not result.next_state.novedades
    assert result.next_state.pendientes_ambiguos[0].nombre_no_encontrado
    assert "- Varela (**a validar)" in result.reply


@pytest.mark.asyncio
async def test_unknown_employee_can_be_corrected_during_confirmation():
    state = ParteDiarioState(
        oportunidad_id=1,
        idproyecto=10,
        esperando="confirmacion_ambiguos",
        pendientes_ambiguos=[
            PendienteAmbiguo(
                nombre="Varela",
                idestado=2,
                estado_codigo="FAL",
                nombre_no_encontrado=True,
            )
        ],
    )
    process = ParteDiarioProcess(session=SimpleNamespace())

    result = await process._handle_pending_selection(state, "Juan Garcia", ESTADOS, INTERNOS, TODOS)

    assert result.process_state["pendientes_ambiguos"] == []
    assert result.process_state["novedades"][0]["idnomina"] == 1
    assert "Parte diario para confirmar:" in result.payload["reply_to_user"]


@pytest.mark.asyncio
async def test_unknown_employee_correction_can_open_candidate_selection():
    state = ParteDiarioState(
        oportunidad_id=1,
        idproyecto=10,
        esperando="confirmacion_ambiguos",
        pendientes_ambiguos=[PendienteAmbiguo(nombre="Varela", nombre_no_encontrado=True)],
    )
    process = ParteDiarioProcess(session=SimpleNamespace())

    result = await process._handle_pending_selection(state, "Garcia", ESTADOS, INTERNOS, TODOS)

    assert len(result.process_state["pendientes_ambiguos"][0]["candidatos"]) == 2
    assert "A cual Garcia te referis?" in result.payload["reply_to_user"]


def test_pending_question_distinguishes_candidates_by_project_and_employee_number():
    pending = PendienteAmbiguo(
        nombre="Varela",
        candidatos=[
            NominaItem(
                5,
                "Juan",
                "Varela",
                idproyecto=20,
                nombre_proyecto="Obra Norte",
                fuera_de_proyecto=True,
                nro_legajo="L-20",
            ),
            NominaItem(
                6,
                "Juan",
                "Varela",
                idproyecto=30,
                nombre_proyecto="Obra Sur",
                fuera_de_proyecto=True,
                nro_legajo="L-30",
            ),
        ],
    )

    question = renderer.preguntar_pendiente(pending, ESTADOS)

    assert "1. Varela, Juan (legajo L-20, asignado a Obra Norte)" in question
    assert "2. Varela, Juan (legajo L-30, asignado a Obra Sur)" in question


def test_internal_extra_hours_imply_present_and_add_standard_day():
    state = ParteDiarioState(oportunidad_id=1, idproyecto=10)

    result = execute_plan(
        state,
        _plan(ParteDiarioOperation(type="agregar_novedad", nombre="Juan Garcia", horas_extra=2)),
        INTERNOS,
        TODOS,
        ESTADOS,
    )

    assert result.next_state.novedades[0].estado_codigo == "P"
    assert result.next_state.novedades[0].horas == 11
    assert not result.next_state.pendientes_ambiguos


def test_extra_hours_with_non_present_state_are_rejected():
    state = ParteDiarioState(oportunidad_id=1, idproyecto=10)

    result = execute_plan(
        state,
        _plan(
            ParteDiarioOperation(
                type="agregar_novedad",
                nombre="Juan Garcia",
                estado_codigo="ACC",
                horas_extra=2,
            )
        ),
        INTERNOS,
        TODOS,
        ESTADOS,
    )

    assert not result.next_state.novedades
    assert result.errors == ["Para Juan Garcia, las horas extra solo pueden registrarse como PRESENTE."]


def test_internal_partial_present_is_queued_for_reason_clarification():
    state = ParteDiarioState(oportunidad_id=1, idproyecto=10)

    result = execute_plan(
        state,
        _plan(
            ParteDiarioOperation(
                type="agregar_novedad",
                nombre="Juan Garcia",
                estado_codigo="P",
                horas=5,
            )
        ),
        INTERNOS,
        TODOS,
        ESTADOS,
    )

    assert not result.next_state.novedades
    assert result.next_state.pendientes_ambiguos[0].estado_pendiente
    assert result.next_state.pendientes_ambiguos[0].horas == 5


@pytest.mark.parametrize(
    ("initial_code", "initial_hours", "updated_code", "expected_hours"),
    [
        ("P", 9, "FAL", 0),
        ("FAL", 0, "P", 9),
    ],
)
def test_modifying_status_without_hours_recalculates_default(
    initial_code: str,
    initial_hours: float,
    updated_code: str,
    expected_hours: float,
):
    initial_state = next(item for item in ESTADOS if item.abreviatura == initial_code)
    state = ParteDiarioState(
        oportunidad_id=1,
        idproyecto=10,
        novedades=[
            NovedadPersonal(
                nombre="Garcia, Juan",
                idnomina=1,
                idestado=initial_state.id,
                estado_codigo=initial_code,
                horas=initial_hours,
            )
        ],
    )

    result = execute_plan(
        state,
        _plan(
            ParteDiarioOperation(
                type="modificar_novedad",
                nombre="Juan Garcia",
                estado_codigo=updated_code,
            )
        ),
        INTERNOS,
        TODOS,
        ESTADOS,
    )

    assert not result.errors
    assert result.next_state.novedades[0].estado_codigo == updated_code
    assert result.next_state.novedades[0].horas == expected_hours


def test_duplicate_employee_creates_conflict_without_merging():
    state = ParteDiarioState(oportunidad_id=1, idproyecto=10)

    result = execute_plan(
        state,
        _plan(
            ParteDiarioOperation(type="agregar_novedad", nombre="Juan Garcia", estado_codigo="FAL"),
            ParteDiarioOperation(type="agregar_novedad", nombre="Juan Garcia", estado_codigo="ACC"),
        ),
        INTERNOS,
        TODOS,
        ESTADOS,
    )

    assert len(result.next_state.novedades) == 1
    assert len(result.next_state.conflictos_novedad) == 1
    assert len(result.next_state.conflictos_novedad[0].opciones) == 2


def test_same_novelty_replayed_is_ignored_without_creating_conflict():
    state = ParteDiarioState(oportunidad_id=1, idproyecto=10)

    result = execute_plan(
        state,
        _plan(
            ParteDiarioOperation(type="agregar_novedad", nombre="Juan Garcia", estado_codigo="FAL"),
            ParteDiarioOperation(type="agregar_novedad", nombre="Juan Garcia", estado_codigo="FAL"),
        ),
        INTERNOS,
        TODOS,
        ESTADOS,
    )

    assert len(result.next_state.novedades) == 1
    assert result.next_state.conflictos_novedad == []


def test_deleting_employee_removes_pending_conflict_too():
    state = ParteDiarioState(oportunidad_id=1, idproyecto=10)
    loaded = execute_plan(
        state,
        _plan(
            ParteDiarioOperation(type="agregar_novedad", nombre="Juan Garcia", estado_codigo="FAL"),
            ParteDiarioOperation(type="agregar_novedad", nombre="Juan Garcia", estado_codigo="ACC"),
        ),
        INTERNOS,
        TODOS,
        ESTADOS,
    ).next_state

    result = execute_plan(
        loaded,
        _plan(ParteDiarioOperation(type="eliminar_novedad", nombre="Juan Garcia")),
        INTERNOS,
        TODOS,
        ESTADOS,
    )

    assert not result.errors
    assert result.next_state.novedades == []
    assert result.next_state.conflictos_novedad == []


def test_sin_novedades_does_not_remove_existing_items():
    state = ParteDiarioState(
        oportunidad_id=1,
        idproyecto=10,
        novedades=[NovedadPersonal(nombre="Garcia", idnomina=1, idestado=2, estado_codigo="FAL", horas=0)],
    )

    result = execute_plan(
        state,
        _plan(ParteDiarioOperation(type="sin_novedades")),
        INTERNOS,
        TODOS,
        ESTADOS,
    )

    assert result.status == "sin_novedades_rejected"
    assert len(result.next_state.novedades) == 1
    assert not result.next_state.sin_novedades_informado


@pytest.fixture()
def seeded_partes(db_session: Session):
    user = User(nombre="Tester", email="parte-tester@example.com")
    db_session.add(user)
    db_session.flush()
    contact = CRMContacto(nombre_completo="Encargado", responsable_id=user.id)
    db_session.add(contact)
    db_session.flush()
    opportunity = CRMOportunidad(contacto_id=contact.id, responsable_id=user.id, activo=True)
    db_session.add(opportunity)
    db_session.flush()
    project = Proyecto(nombre="Obra Centro", responsable_id=user.id, oportunidad_id=opportunity.id)
    db_session.add(project)
    db_session.flush()
    employee_1 = Nomina(nombre="Juan", apellido="Garcia", dni="parte-1", idproyecto=project.id)
    employee_2 = Nomina(nombre="Pedro", apellido="Perez", dni="parte-2", idproyecto=project.id)
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


def _agent_message(
    db_session: Session,
    seeded_partes,
    *,
    novedades: list[dict],
    parte_id: int | None = None,
    sin_novedades_informado: bool = False,
):
    payload = {
        "type": "parte_diario_reply",
        "parte_listo": True,
        "idproyecto": seeded_partes["project"].id,
        "fecha": "2026-05-30",
        "parte_id_existente": parte_id,
        "sin_novedades_informado": sin_novedades_informado,
        "novedades": novedades,
        "pendientes_ambiguos": [],
        "conflictos_novedad": [],
    }
    message = CRMMensaje(
        contacto_id=seeded_partes["contact"].id,
        oportunidad_id=seeded_partes["opportunity"].id,
        contenido="CONFIRMAR",
        metadata_json={"agent_v2": {"result": payload}},
    )
    db_session.add(message)
    db_session.commit()
    db_session.refresh(message)
    return message


def _context(seeded_partes, state: ParteDiarioState, text: str):
    return SimpleNamespace(
        oportunidad_id=seeded_partes["opportunity"].id,
        is_project=True,
        active_process="parte_diario",
        process_state=state.to_dict(),
        message=SimpleNamespace(contenido=text),
    )


def test_materialization_adds_implicit_present(db_session: Session, seeded_partes):
    status = db_session.exec(select(ParteDiarioDetalle)).all()
    assert status == []
    falta = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).first()
    message = _agent_message(
        db_session,
        seeded_partes,
        novedades=[
            {
                "nombre": "Garcia, Juan",
                "idnomina": seeded_partes["employee_1"].id,
                "idestado": falta.id,
                "estado_codigo": "FAL",
                "horas": 0,
                "fuera_de_proyecto": False,
            }
        ],
    )

    parte = parte_diario_service.create_or_update_from_agent_message(db_session, message.id)
    details = db_session.exec(
        select(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == parte.id)
    ).all()

    assert len(details) == 2
    explicit = next(item for item in details if item.idnomina == seeded_partes["employee_1"].id)
    implicit = next(item for item in details if item.idnomina == seeded_partes["employee_2"].id)
    assert explicit.origen == OrigenDetalle.AGENTE
    assert explicit.horas == Decimal("0")
    assert implicit.origen == OrigenDetalle.DEFAULT
    assert implicit.horas == Decimal("9")
    db_session.refresh(message)
    assert message.metadata_json["agent_v2"]["parte_diario_id"] == parte.id


def test_materialization_rejects_empty_part_without_explicit_sin_novedades(db_session: Session, seeded_partes):
    message = _agent_message(db_session, seeded_partes, novedades=[])

    with pytest.raises(ValueError, match="requiere declaracion explicita"):
        parte_diario_service.create_or_update_from_agent_message(db_session, message.id)


def test_update_replaces_details_and_regenerates_defaults(db_session: Session, seeded_partes):
    first = _agent_message(db_session, seeded_partes, novedades=[], sin_novedades_informado=True)
    parte = parte_diario_service.create_or_update_from_agent_message(db_session, first.id)
    present = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "P")
    ).first()
    second = _agent_message(
        db_session,
        seeded_partes,
        parte_id=parte.id,
        novedades=[
            {
                "nombre": "Garcia, Juan",
                "idnomina": seeded_partes["employee_1"].id,
                "idestado": present.id,
                "estado_codigo": "P",
                "horas": 11,
                "fuera_de_proyecto": False,
            }
        ],
    )

    updated = parte_diario_service.create_or_update_from_agent_message(db_session, second.id)
    details = db_session.exec(
        select(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == updated.id)
    ).all()

    assert len(details) == 2
    explicit = next(item for item in details if item.idnomina == seeded_partes["employee_1"].id)
    assert explicit.origen == OrigenDetalle.AGENTE
    assert explicit.horas == Decimal("11")


@pytest.mark.asyncio
async def test_exact_confirm_requires_resolving_pending_state(db_session: Session, seeded_partes):
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
        fecha=date.today().isoformat(),
        pendientes_ambiguos=[
            PendienteAmbiguo(
                nombre="Juan Garcia",
                idnomina_resuelto=seeded_partes["employee_1"].id,
                horas=5,
            )
        ],
    )
    process = ParteDiarioProcess(session=db_session)
    result = await process.handle(_context(seeded_partes, state, "CONFIRMAR"))

    assert result.keep_active
    assert not result.payload["parte_listo"]
    assert "Que le paso a Juan Garcia?" in result.payload["reply_to_user"]


@pytest.mark.asyncio
async def test_name_ambiguity_is_resolved_only_after_exact_confirm(db_session: Session, seeded_partes):
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
        fecha=date.today().isoformat(),
        pendientes_ambiguos=[
            PendienteAmbiguo(
                nombre="Garcia",
                idestado=2,
                estado_codigo="FAL",
                candidatos=[
                    NominaItem(seeded_partes["employee_1"].id, "Juan", "Garcia", idproyecto=seeded_partes["project"].id),
                    NominaItem(999, "Pedro", "Garcia", idproyecto=seeded_partes["project"].id),
                ],
            )
        ],
    )
    process = ParteDiarioProcess(session=db_session)

    requested = await process.handle(_context(seeded_partes, state, "CONFIRMAR"))

    assert requested.process_state["esperando"] == "confirmacion_ambiguos"
    assert "A cual Garcia te referis?" in requested.payload["reply_to_user"]

    waiting = ParteDiarioState.from_dict(
        requested.process_state,
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
    )
    resolved = await process.handle(_context(seeded_partes, waiting, "1"))

    assert resolved.process_state["pendientes_ambiguos"] == []
    assert resolved.process_state["novedades"][0]["idnomina"] == seeded_partes["employee_1"].id


@pytest.mark.asyncio
async def test_pending_state_option_is_resolved_locally(db_session: Session, seeded_partes):
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
        fecha=date.today().isoformat(),
        esperando="confirmacion_ambiguos",
        pendientes_ambiguos=[
            PendienteAmbiguo(
                nombre="Juan Garcia",
                idnomina_resuelto=seeded_partes["employee_1"].id,
                horas=5,
            )
        ],
    )
    llm = SimpleNamespace(
        interpret_turn=AsyncMock(),
        interpretar_estado_pendiente=AsyncMock(),
    )
    process = ParteDiarioProcess(session=db_session, llm_client=llm)

    result = await process.handle(_context(seeded_partes, state, "permiso"))

    llm.interpret_turn.assert_not_awaited()
    llm.interpretar_estado_pendiente.assert_not_awaited()
    assert result.process_state["pendientes_ambiguos"] == []
    assert result.process_state["novedades"][0]["estado_codigo"] == "PER"
    assert result.process_state["novedades"][0]["horas"] == 5


@pytest.mark.asyncio
async def test_pending_partial_hours_cannot_be_resolved_as_present(db_session: Session, seeded_partes):
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
        fecha=date.today().isoformat(),
        esperando="confirmacion_ambiguos",
        pendientes_ambiguos=[
            PendienteAmbiguo(
                nombre="Juan Garcia",
                idnomina_resuelto=seeded_partes["employee_1"].id,
                horas=5,
            )
        ],
    )
    llm = SimpleNamespace(
        interpret_turn=AsyncMock(),
        interpretar_estado_pendiente=AsyncMock(),
    )
    process = ParteDiarioProcess(session=db_session, llm_client=llm)

    result = await process.handle(_context(seeded_partes, state, "presente"))

    llm.interpret_turn.assert_not_awaited()
    llm.interpretar_estado_pendiente.assert_not_awaited()
    assert not result.process_state["novedades"]
    assert len(result.process_state["pendientes_ambiguos"]) == 1
    assert "una jornada menor a 9 horas requiere indicar el motivo" in result.payload["reply_to_user"]


@pytest.mark.asyncio
async def test_pending_state_fallback_stops_after_two_failed_attempts(db_session: Session, seeded_partes):
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
        fecha=date.today().isoformat(),
        esperando="confirmacion_ambiguos",
        pendientes_ambiguos=[
            PendienteAmbiguo(
                nombre="Juan Garcia",
                idnomina_resuelto=seeded_partes["employee_1"].id,
                horas=5,
            )
        ],
    )
    llm = SimpleNamespace(
        interpret_turn=AsyncMock(),
        interpretar_estado_pendiente=AsyncMock(return_value="NO_DETERMINADO"),
    )
    process = ParteDiarioProcess(session=db_session, llm_client=llm)

    for _ in range(3):
        result = await process.handle(_context(seeded_partes, state, "no se"))
        state = ParteDiarioState.from_dict(
            result.process_state,
            oportunidad_id=seeded_partes["opportunity"].id,
            idproyecto=seeded_partes["project"].id,
        )

    assert llm.interpretar_estado_pendiente.await_count == 2
    assert state.pendientes_ambiguos[0].intentos_estado == 3
    assert "Responde con el numero de una opcion." in result.payload["reply_to_user"]


@pytest.mark.asyncio
async def test_conflict_selection_keeps_only_explicit_choice(db_session: Session, seeded_partes):
    employee_id = seeded_partes["employee_1"].id
    falta = NovedadPersonal(nombre="Garcia, Juan", idnomina=employee_id, idestado=2, estado_codigo="FAL", horas=0)
    accidente = NovedadPersonal(nombre="Garcia, Juan", idnomina=employee_id, idestado=3, estado_codigo="ACC", horas=0)
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
        fecha=date.today().isoformat(),
        novedades=[falta],
        conflictos_novedad=[ConflictoNovedad(employee_id, "Garcia, Juan", [falta, accidente])],
        esperando="resolucion_conflictos",
    )
    process = ParteDiarioProcess(session=db_session)

    result = await process.handle(_context(seeded_partes, state, "2"))

    assert result.process_state["conflictos_novedad"] == []
    assert len(result.process_state["novedades"]) == 1
    assert result.process_state["novedades"][0]["estado_codigo"] == "ACC"


@pytest.mark.asyncio
async def test_redundant_persisted_conflict_is_repaired_before_confirm(db_session: Session, seeded_partes):
    employee_id = seeded_partes["employee_1"].id
    falta = NovedadPersonal(nombre="Garcia, Juan", idnomina=employee_id, idestado=2, estado_codigo="FAL", horas=0)
    repeated = NovedadPersonal(nombre="Garcia, Juan", idnomina=employee_id, idestado=2, estado_codigo="FAL", horas=0)
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
        fecha=date.today().isoformat(),
        novedades=[falta],
        conflictos_novedad=[ConflictoNovedad(employee_id, "Garcia, Juan", [falta, repeated])],
        esperando="resolucion_conflictos",
    )
    llm = SimpleNamespace(interpret_turn=AsyncMock())
    process = ParteDiarioProcess(session=db_session, llm_client=llm)

    result = await process.handle(_context(seeded_partes, state, "CONFIRMAR"))

    llm.interpret_turn.assert_not_awaited()
    assert result.process_state["conflictos_novedad"] == []
    assert result.process_state["esperando"] is None
    assert result.payload["parte_listo"]


@pytest.mark.asyncio
async def test_loading_turn_defers_conflict_resolution_until_exact_confirm(db_session: Session, seeded_partes):
    employee_id = seeded_partes["employee_1"].id
    falta = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).first()
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
        fecha=date.today().isoformat(),
        novedades=[
            NovedadPersonal(
                nombre="Garcia, Juan",
                idnomina=employee_id,
                idestado=falta.id,
                estado_codigo="FAL",
                horas=0,
            )
        ],
    )
    llm = SimpleNamespace(
        interpret_turn=AsyncMock(
            return_value=_plan(
                ParteDiarioOperation(type="agregar_novedad", nombre="Juan Garcia", estado_codigo="ACC")
            )
        )
    )
    process = ParteDiarioProcess(session=db_session, llm_client=llm)

    loaded = await process.handle(_context(seeded_partes, state, "Juan Garcia tuvo un accidente"))

    assert loaded.process_state["esperando"] is None
    assert len(loaded.process_state["conflictos_novedad"]) == 1
    assert "Conflictos por resolver:" not in loaded.payload["reply_to_user"]
    assert "fue mencionado mas de una vez" not in loaded.payload["reply_to_user"]

    queued = ParteDiarioState.from_dict(
        loaded.process_state,
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
    )
    confirmation = await process.handle(_context(seeded_partes, queued, "CONFIRMAR"))

    assert confirmation.process_state["esperando"] == "resolucion_conflictos"
    assert "fue mencionado mas de una vez" in confirmation.payload["reply_to_user"]


@pytest.mark.asyncio
async def test_readonly_query_keeps_active_part_with_pending_clarifications(db_session: Session, seeded_partes):
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
        fecha=date.today().isoformat(),
        pendientes_ambiguos=[
            PendienteAmbiguo(
                nombre="Varela",
                idestado=2,
                estado_codigo="FAL",
                candidatos=[
                    NominaItem(5, "Juan", "Varela", idproyecto=seeded_partes["project"].id),
                    NominaItem(6, "Pedro", "Varela", idproyecto=seeded_partes["project"].id),
                ],
            )
        ],
    )
    llm = SimpleNamespace(
        interpret_turn=AsyncMock(
            return_value=_plan(ParteDiarioOperation(type="mostrar_parte"))
        )
    )
    process = ParteDiarioProcess(session=db_session, llm_client=llm)

    result = await process.handle(_context(seeded_partes, state, "mostrame el parte"))

    assert result.keep_active
    assert len(result.process_state["pendientes_ambiguos"]) == 1
    assert "Varela (**a validar)" in result.payload["reply_to_user"]


@pytest.mark.asyncio
async def test_readonly_query_does_not_consume_pending_selection(db_session: Session, seeded_partes):
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
        fecha=date.today().isoformat(),
        pendientes_ambiguos=[
            PendienteAmbiguo(
                nombre="Varela",
                idestado=2,
                estado_codigo="FAL",
                candidatos=[
                    NominaItem(5, "Abel Mariano", "Varela", idproyecto=seeded_partes["project"].id),
                    NominaItem(6, "Rene Orlando", "Varela", idproyecto=seeded_partes["project"].id),
                ],
            )
        ],
        esperando="confirmacion_ambiguos",
    )
    llm = SimpleNamespace(interpret_turn=AsyncMock())
    process = ParteDiarioProcess(session=db_session, llm_client=llm)

    result = await process.handle(_context(seeded_partes, state, "me muestras el parte de hoy?"))

    llm.interpret_turn.assert_not_awaited()
    assert result.process_state["esperando"] == "confirmacion_ambiguos"
    assert len(result.process_state["pendientes_ambiguos"]) == 1
    assert "Varela (**a validar)" in result.payload["reply_to_user"]
    assert "A cual varela te referis?" not in result.payload["reply_to_user"].lower()


@pytest.mark.asyncio
async def test_employee_list_query_does_not_consume_pending_selection(db_session: Session, seeded_partes):
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
        fecha=date.today().isoformat(),
        pendientes_ambiguos=[
            PendienteAmbiguo(
                nombre="varela",
                idestado=2,
                estado_codigo="FAL",
                candidatos=[
                    NominaItem(5, "Abel Mariano", "Varela", idproyecto=seeded_partes["project"].id),
                    NominaItem(6, "Rene Orlando", "Varela", idproyecto=seeded_partes["project"].id),
                ],
            )
        ],
        esperando="confirmacion_ambiguos",
    )
    llm = SimpleNamespace(interpret_turn=AsyncMock())
    process = ParteDiarioProcess(session=db_session, llm_client=llm)

    result = await process.handle(_context(seeded_partes, state, "mostrame la lista de empleados"))

    llm.interpret_turn.assert_not_awaited()
    assert result.process_state["esperando"] == "confirmacion_ambiguos"
    assert len(result.process_state["pendientes_ambiguos"]) == 1
    assert "*NOMINA ACTIVA*" in result.payload["reply_to_user"]
    assert "A cual varela te referis?" not in result.payload["reply_to_user"].lower()


@pytest.mark.asyncio
async def test_general_query_during_pending_selection_explains_validation_requirement(
    db_session: Session,
    seeded_partes,
):
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
        fecha=date.today().isoformat(),
        pendientes_ambiguos=[
            PendienteAmbiguo(
                nombre="varela",
                idestado=2,
                estado_codigo="FAL",
                candidatos=[
                    NominaItem(5, "Abel Mariano", "Varela", idproyecto=seeded_partes["project"].id),
                    NominaItem(6, "Rene Orlando", "Varela", idproyecto=seeded_partes["project"].id),
                ],
            )
        ],
        esperando="confirmacion_ambiguos",
    )
    process = ParteDiarioProcess(session=db_session)

    result = await process.handle(_context(seeded_partes, state, "quiero consultar otra cosa"))

    assert "Antes de continuar, necesito completar la validacion pendiente." in result.payload["reply_to_user"]
    assert "A cual varela te referis?" in result.payload["reply_to_user"]


@pytest.mark.asyncio
async def test_future_date_is_rejected_without_changing_state(db_session: Session, seeded_partes):
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
    )
    llm = SimpleNamespace(
        interpret_turn=AsyncMock(
            return_value=_plan(ParteDiarioOperation(type="set_fecha", fecha="2099-01-01"))
        )
    )
    process = ParteDiarioProcess(session=db_session, llm_client=llm)

    result = await process.handle(_context(seeded_partes, state, "cargar el parte de 2099-01-01"))

    assert result.keep_active
    assert result.process_state["fecha"] is None
    assert "fechas futuras" in result.payload["reply_to_user"]


@pytest.mark.asyncio
async def test_exact_cancel_discards_part_without_llm(db_session: Session, seeded_partes):
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
        fecha=date.today().isoformat(),
        novedades=[NovedadPersonal(nombre="Garcia, Juan", idnomina=1, idestado=2, estado_codigo="FAL", horas=0)],
    )
    llm = SimpleNamespace(interpret_turn=AsyncMock())
    process = ParteDiarioProcess(session=db_session, llm_client=llm)

    result = await process.handle(_context(seeded_partes, state, "CANCELAR"))

    llm.interpret_turn.assert_not_awaited()
    assert not result.keep_active
    assert result.payload["cancelado"]
    assert not result.payload["parte_listo"]


@pytest.mark.asyncio
async def test_exact_confirm_without_items_does_not_materialize(db_session: Session, seeded_partes):
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
        fecha=date.today().isoformat(),
    )
    llm = SimpleNamespace(interpret_turn=AsyncMock())
    process = ParteDiarioProcess(session=db_session, llm_client=llm)

    result = await process.handle(_context(seeded_partes, state, "CONFIRMAR"))

    llm.interpret_turn.assert_not_awaited()
    assert result.keep_active
    assert not result.payload["parte_listo"]
    assert "Todavia no informaste novedades" in result.payload["reply_to_user"]


@pytest.mark.asyncio
async def test_sin_novedades_requires_followup_exact_confirm(db_session: Session, seeded_partes):
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
    )
    llm = SimpleNamespace(
        interpret_turn=AsyncMock(
            return_value=_plan(ParteDiarioOperation(type="sin_novedades"))
        )
    )
    process = ParteDiarioProcess(session=db_session, llm_client=llm)

    registered = await process.handle(_context(seeded_partes, state, "todos presentes"))

    assert registered.keep_active
    assert not registered.payload["parte_listo"]
    assert registered.process_state["sin_novedades_informado"]

    waiting = ParteDiarioState.from_dict(
        registered.process_state,
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
    )
    confirmed = await process.handle(_context(seeded_partes, waiting, "CONFIRMAR"))

    assert confirmed.payload["parte_listo"]
    assert confirmed.payload["sin_novedades_informado"]


@pytest.mark.asyncio
async def test_colloquial_ok_only_requests_confirmation(db_session: Session, seeded_partes):
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
        fecha=date.today().isoformat(),
        novedades=[
            NovedadPersonal(
                nombre="Garcia, Juan",
                idnomina=seeded_partes["employee_1"].id,
                idestado=2,
                estado_codigo="FAL",
                horas=0,
            )
        ],
    )
    llm = SimpleNamespace(
        interpret_turn=AsyncMock(
            return_value=_plan(ParteDiarioOperation(type="solicitar_confirmacion"))
        )
    )
    process = ParteDiarioProcess(session=db_session, llm_client=llm)

    result = await process.handle(_context(seeded_partes, state, "ok"))

    assert result.keep_active
    assert not result.payload["parte_listo"]
    assert "Para guardarlo, responde CONFIRMAR." in result.payload["reply_to_user"]


@pytest.mark.asyncio
async def test_exact_confirm_marks_complete_part_ready_for_materialization(db_session: Session, seeded_partes):
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
        fecha=date.today().isoformat(),
        novedades=[
            NovedadPersonal(
                nombre="Garcia, Juan",
                idnomina=seeded_partes["employee_1"].id,
                idestado=2,
                estado_codigo="FAL",
                horas=0,
            )
        ],
    )
    llm = SimpleNamespace(interpret_turn=AsyncMock())
    process = ParteDiarioProcess(session=db_session, llm_client=llm)

    result = await process.handle(_context(seeded_partes, state, "CONFIRMAR"))

    llm.interpret_turn.assert_not_awaited()
    assert result.keep_active
    assert result.payload["parte_listo"]
    assert result.payload["close_after_materialization"]
    assert result.payload["reply_to_user"].startswith("*PARTE DIARIO REGISTRADO*")
    assert "*Novedades*" in result.payload["reply_to_user"]
    assert "Cuando termines, escribi CONFIRMAR." not in result.payload["reply_to_user"]


@pytest.mark.asyncio
async def test_existing_draft_resumes_only_explicit_items(db_session: Session, seeded_partes):
    falta = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).first()
    presente = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "P")
    ).first()
    parte = ParteDiario(
        idproyecto=seeded_partes["project"].id,
        fecha=_today(),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add(parte)
    db_session.flush()
    db_session.add(
        ParteDiarioDetalle(
            parte_diario_id=parte.id,
            idnomina=seeded_partes["employee_1"].id,
            idestado=falta.id,
            horas=0,
            origen=OrigenDetalle.AGENTE,
        )
    )
    db_session.add(
        ParteDiarioDetalle(
            parte_diario_id=parte.id,
            idnomina=seeded_partes["employee_2"].id,
            idestado=presente.id,
            horas=9,
            origen=OrigenDetalle.DEFAULT,
        )
    )
    db_session.commit()
    llm = SimpleNamespace(
        interpret_turn=AsyncMock(
            return_value=_plan(ParteDiarioOperation(type="solicitar_confirmacion"))
        )
    )
    process = ParteDiarioProcess(session=db_session, llm_client=llm)
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
    )

    result = await process.handle(_context(seeded_partes, state, "quiero cargar el parte"))

    assert result.process_state["parte_id"] == parte.id
    assert result.process_state["retomado"]
    assert len(result.process_state["novedades"]) == 1
    assert result.process_state["novedades"][0]["idnomina"] == seeded_partes["employee_1"].id


@pytest.mark.asyncio
async def test_closed_part_for_today_is_not_reopened(db_session: Session, seeded_partes):
    db_session.add(
        ParteDiario(
            idproyecto=seeded_partes["project"].id,
            fecha=_today(),
            estado=EstadoParteDiario.CERRADO,
        )
    )
    db_session.commit()
    llm = SimpleNamespace(
        interpret_turn=AsyncMock(
            return_value=_plan(ParteDiarioOperation(type="sin_novedades"))
        )
    )
    process = ParteDiarioProcess(session=db_session, llm_client=llm)
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
    )

    result = await process.handle(_context(seeded_partes, state, "todos presentes"))

    assert not result.keep_active
    assert "ya esta cerrado" in result.payload["reply_to_user"]


@pytest.mark.asyncio
async def test_closed_part_query_uses_final_summary_without_opening_draft(db_session: Session, seeded_partes):
    falta = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).first()
    parte = ParteDiario(
        idproyecto=seeded_partes["project"].id,
        fecha=_today(),
        estado=EstadoParteDiario.CERRADO,
    )
    db_session.add(parte)
    db_session.flush()
    db_session.add(
        ParteDiarioDetalle(
            parte_diario_id=parte.id,
            idnomina=seeded_partes["employee_1"].id,
            idestado=falta.id,
            horas=0,
            origen=OrigenDetalle.AGENTE,
        )
    )
    db_session.commit()
    llm = SimpleNamespace(
        interpret_turn=AsyncMock(
            return_value=_plan(
                ParteDiarioOperation(type="set_fecha", fecha=_today().isoformat()),
                ParteDiarioOperation(type="mostrar_parte"),
            )
        )
    )
    process = ParteDiarioProcess(session=db_session, llm_client=llm)
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
    )

    result = await process.handle(_context(seeded_partes, state, "mostrame el parte de hoy"))

    assert not result.keep_active
    assert result.payload["reply_to_user"].startswith("*PARTE DIARIO REGISTRADO*")
    assert "━━━━━━━━━━━━━━" in result.payload["reply_to_user"]
    assert "Para guardarlo, responde CONFIRMAR." not in result.payload["reply_to_user"]


@pytest.mark.asyncio
async def test_resumed_draft_requires_explicit_authorization_to_change_date(db_session: Session, seeded_partes):
    original = (_today() - timedelta(days=2)).isoformat()
    target = (_today() - timedelta(days=1)).isoformat()
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
        fecha=original,
        parte_id=123,
        retomado=True,
        novedades=[
            NovedadPersonal(
                nombre="Garcia, Juan",
                idnomina=seeded_partes["employee_1"].id,
                idestado=2,
                estado_codigo="FAL",
                horas=0,
            )
        ],
    )
    llm = SimpleNamespace(
        interpret_turn=AsyncMock(
            return_value=_plan(ParteDiarioOperation(type="set_fecha", fecha=target))
        )
    )
    process = ParteDiarioProcess(session=db_session, llm_client=llm)

    proposed = await process.handle(_context(seeded_partes, state, f"mover al {target}"))

    assert proposed.process_state["fecha"] == original
    assert proposed.process_state["fecha_propuesta"] == target
    assert proposed.process_state["esperando"] == "confirmacion_cambio_fecha"

    authorized_state = ParteDiarioState.from_dict(
        proposed.process_state,
        oportunidad_id=seeded_partes["opportunity"].id,
    )
    authorized = await process.handle(_context(seeded_partes, authorized_state, "CAMBIAR FECHA"))

    assert authorized.process_state["fecha"] == target
    assert authorized.process_state["fecha_propuesta"] is None
    assert authorized.process_state["esperando"] is None
    assert authorized.process_state["novedades"][0]["idnomina"] == seeded_partes["employee_1"].id


@pytest.mark.asyncio
async def test_resumed_draft_can_keep_original_date_explicitly(db_session: Session, seeded_partes):
    original = (_today() - timedelta(days=2)).isoformat()
    target = (_today() - timedelta(days=1)).isoformat()
    state = ParteDiarioState(
        oportunidad_id=seeded_partes["opportunity"].id,
        idproyecto=seeded_partes["project"].id,
        fecha=original,
        parte_id=123,
        retomado=True,
        fecha_propuesta=target,
        esperando="confirmacion_cambio_fecha",
        novedades=[
            NovedadPersonal(
                nombre="Garcia, Juan",
                idnomina=seeded_partes["employee_1"].id,
                idestado=2,
                estado_codigo="FAL",
                horas=0,
            )
        ],
    )
    process = ParteDiarioProcess(session=db_session)

    result = await process.handle(_context(seeded_partes, state, "MANTENER FECHA"))

    assert result.process_state["fecha"] == original
    assert result.process_state["fecha_propuesta"] is None
    assert result.process_state["esperando"] is None
