from __future__ import annotations

from copy import deepcopy
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from sqlmodel import Session, select

import agente.v3.subprocesses.parte_diario.handler as parte_diario_handler
from agente.v3.subprocesses.parte_diario.utils import renderer
from agente.v3.contracts import V3ConversationContext, V3InboundMessage, V3ProcessMessage, V3ProcessResult
from agente.v3.subprocesses.parte_diario.adapters.carga_agent import ParteDiarioCargaAgentOutput
from agente.v3.subprocesses.parte_diario.domain.novedades import execute_plan
from agente.v3.subprocesses.parte_diario.handler import (
    ParteDiarioSubprocess,
)
from agente.v3.subprocesses.parte_diario.utils.calendario import (
    dia_operativo_anterior,
    es_dia_laborable,
    es_feriado,
)
from agente.v3.subprocesses.parte_diario.domain.models import EstadoItem, NominaItem, NovedadPersonal, ParteDiarioDraft, PendienteAmbiguo
from agente.v3.subprocesses.parte_diario.models import ParteDiarioOperation, TurnPlan
from agente.v3.subprocesses.parte_diario.utils.interpretacion import (
    _fallback_simple_attendance_plan,
    _normalize_attendance_transcription,
)
from agente.v3.subprocesses.parte_diario.utils.calendario import hoy as _today
from agente.v3.subprocesses.parte_diario.domain import empleados, obras, parte_diario as parte_diario_domain
from app import db
from agente.v3.subprocesses.parte_diario.domain.parte_diario import ParteDiarioQueryService
from agente.v3.subprocesses.parte_diario.domain.empleados import NominaResolver, parse_candidate_selection
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text
from agente.v3.subprocesses.parte_diario.state import (
    ParteDiarioAsistenciaOption,
    ParteDiarioV3State,
)
from agente.v3.subprocesses.parte_diario.state import ParteDiarioFechaOption
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
from app.models.tarja import Tarja, TarjaNomina
from app.routers.partediario_router import ParteDiarioCRUD
from app.services.parte_diario_service import parte_diario_service
from app.services.parte_diario_estado_service import seed_parte_diario_estados


class FakeParteDiarioLLM:
    def __init__(self, plan: TurnPlan, *, contextual_reply: str = "Respuesta contextual de prueba.") -> None:
        self.plan = plan
        self.contextual_reply_text = contextual_reply
        self.contextual_calls: list[dict] = []

    async def interpret_turn(self, mensaje, state, nominas_proyecto, estados, *, contexto_conversacion=None):
        return self.plan

    async def interpretar_estado_pendiente(self, mensaje, estados):
        return "PER"

    async def contextual_reply(self, **kwargs):
        self.contextual_calls.append(kwargs)
        return self.contextual_reply_text


class FailingParteDiarioLLM(FakeParteDiarioLLM):
    def __init__(self) -> None:
        super().__init__(TurnPlan())

    async def interpret_turn(self, mensaje, state, nominas_proyecto, estados, *, contexto_conversacion=None):
        raise ValueError("LLM no disponible")


class FakeParteDiarioQueryAgent:
    def __init__(self, reply: str | None = None) -> None:
        self.reply = reply
        self.calls: list[dict] = []

    async def respond(self, **kwargs):
        self.calls.append(kwargs)
        return self.reply or ""


class FakeParteDiarioCargaAgent:
    def __init__(self, output: ParteDiarioCargaAgentOutput) -> None:
        self.output = output
        self.calls: list[dict] = []

    async def resolve_person_validation(self, **kwargs):
        self.calls.append(kwargs)
        return self.output


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
    monkeypatch.setattr(db, "engine", db_session.bind)
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
async def test_parte_diario_v3_first_load_resolves_project_and_sets_previous_operational_day(seeded_parte_v3):
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
    assert draft["fecha"] == dia_operativo_anterior(_today()).isoformat()
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
    assert result.context.process_state["etapa"] == "seleccionar_obra"
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
    assert result.context.process_state["etapa"] == "seleccionar_obra"
    assert "En que obra" in (result.reply_text or "")
    assert "Obra Centro" in (result.reply_text or "")
    assert "Obra Norte" in (result.reply_text or "")
    assert "Francia" in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_mostrar_nomina_muestra_por_defecto_la_nomina_del_encargado(
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
            "parte_state": ParteDiarioDraft(
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
    assert "Garcia Juan" in (result.reply_text or "")
    assert "Perez Pedro" not in (result.reply_text or "")
    assert "encargado" not in (result.reply_text or "").lower()
    assert "Externo Mario" not in (result.reply_text or "")

    process_full = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(operations=[ParteDiarioOperation(type="mostrar_nomina", alcance="obra")])
        )
    )

    result_full = await process_full.handle(_message("mostrar toda la nomina", external_id="wamid-test-2"), context)

    assert "*NOMINA ACTIVA*" in (result_full.reply_text or "")
    assert "Garcia Juan" in (result_full.reply_text or "")
    assert "Perez Pedro" in (result_full.reply_text or "")
    assert "Externo Mario" not in (result_full.reply_text or "")

    process_global = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(operations=[ParteDiarioOperation(type="mostrar_nomina", alcance="global")])
        )
    )

    result_global = await process_global.handle(
        _message("mostrar toda la nomina no solo la de esta obra", external_id="wamid-test-3"),
        context,
    )

    assert "*NOMINA ACTIVA*" in (result_global.reply_text or "")
    assert "Garcia Juan" in (result_global.reply_text or "")
    assert "Perez Pedro" in (result_global.reply_text or "")
    assert "Externo Mario" in (result_global.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_listado_usa_tarja_nomina_vigente_por_encargado_y_fecha(
    db_session: Session,
    seeded_parte_v3,
):
    seeded_parte_v3["employee_1"].encargado_contacto_id = seeded_parte_v3["contact"].id
    seeded_parte_v3["employee_2"].encargado_contacto_id = seeded_parte_v3["contact"].id
    seeded_parte_v3["employee_2"].activo = True
    tarja = Tarja(
        idproyecto=seeded_parte_v3["project"].id,
        contacto_id=seeded_parte_v3["contact"].id,
        fechainicio=date(2026, 8, 26),
        fechafinal=date(2026, 9, 10),
    )
    db_session.add(tarja)
    db_session.flush()
    db_session.add(
        TarjaNomina(
            tarja_id=tarja.id,
            nomina_id=seeded_parte_v3["employee_1"].id,
            fecha_desde=date(2026, 8, 26),
            fecha_hasta=date(2026, 9, 10),
            documentos=[],
        )
    )
    db_session.add(
        TarjaNomina(
            tarja_id=tarja.id,
            nomina_id=seeded_parte_v3["employee_2"].id,
            fecha_desde=date(2026, 9, 10),
            fecha_hasta=date(2026, 9, 10),
            documentos=[],
        )
    )
    db_session.commit()
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "nombre_obra": "Obra Centro",
            "parte_state": ParteDiarioDraft(
                oportunidad_id=seeded_parte_v3["opportunity"].id,
                idproyecto=seeded_parte_v3["project"].id,
                fecha=date(2026, 9, 9).isoformat(),
            ).to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="agregar_novedad",
                        nombre="Ruiz, Pablo",
                        estado_codigo="P",
                        horas=4,
                        nombre_proyecto="axion",
                        fuera_de_proyecto=True,
                    ),
                ]
            )
        )
    )

    result = await process.handle(_message("listado"), context)

    assert result.metadata["status"] == "asistencia_page"
    assert "Garcia, Juan" in (result.reply_text or "")
    assert "Perez, Pedro" not in (result.reply_text or "")


def test_parte_diario_v3_mostrar_nomina_filtra_por_nombre():
    state = ParteDiarioDraft(oportunidad_id=1, idproyecto=10, fecha="2026-08-03")
    nomina = [
        NominaItem(idnomina=1, nombre="Ivan", apellido="Medina"),
        NominaItem(idnomina=2, nombre="Juan Manuel", apellido="Medina"),
        NominaItem(idnomina=3, nombre="Daniela", apellido="Vera"),
    ]

    result = execute_plan(
        state,
        TurnPlan(operations=[ParteDiarioOperation(type="mostrar_nomina", nombre="medina")]),
        nomina,
        nomina,
        [],
    )

    assert result.status == "shown_nomina"
    assert "Medina Ivan" in result.reply
    assert "Medina Juan Manuel" in result.reply
    assert "encargado" not in result.reply.lower()
    assert "Vera Daniela" not in result.reply


def test_parte_diario_v3_nomina_display_scope_defaults_to_encargado(monkeypatch):
    propias = [NominaItem(idnomina=1, nombre="Juan", apellido="Garcia", encargado_contacto_id=5)]
    obra = [
        *propias,
        NominaItem(idnomina=2, nombre="Pedro", apellido="Perez", encargado_contacto_id=8),
    ]
    globales = [
        *obra,
        NominaItem(idnomina=3, nombre="Mario", apellido="Externo", idproyecto=99),
    ]
    calls: list[bool] = []

    def fake_load_nominas(session, idproyecto, *, contacto_id=None, fecha=None, filtrar_por_contacto=True):
        calls.append(filtrar_por_contacto)
        if filtrar_por_contacto:
            return propias, globales
        return obra, globales

    monkeypatch.setattr(empleados, "cargar_referencias", fake_load_nominas)

    default_items = empleados.listar_para_consulta(None,
        10,
        contacto_id=5,
        command="mostrar nomina",
        alcance=None,
        nominas_completas=globales,
    )
    obra_items = empleados.listar_para_consulta(None,
        10,
        contacto_id=5,
        command="mostrar toda la obra",
        alcance=None,
        nominas_completas=globales,
    )
    global_items = empleados.listar_para_consulta(None,
        10,
        contacto_id=5,
        command="mostrar toda la nomina no solo la de esta obra",
        alcance=None,
        nominas_completas=globales,
    )

    assert [item.nombre_completo for item in default_items] == ["Garcia, Juan"]
    assert [item.nombre_completo for item in obra_items] == ["Garcia, Juan", "Perez, Pedro"]
    assert [item.nombre_completo for item in global_items] == [
        "Garcia, Juan",
        "Perez, Pedro",
        "Externo, Mario",
    ]
    assert calls == [True, False]


def test_parte_diario_v3_mostrar_nomina_agrupa_compacto():
    nomina = [
        NominaItem(idnomina=1, nombre="Fabio", apellido="Acosta"),
        NominaItem(idnomina=2, nombre="Ana", apellido="Benitez"),
        NominaItem(idnomina=3, nombre="Matias", apellido="Bustos"),
        NominaItem(idnomina=4, nombre="Hector", apellido="Cajal"),
        NominaItem(idnomina=5, nombre="Matias", apellido="Cajal"),
        NominaItem(idnomina=6, nombre="Adriana", apellido="Carrasco"),
        NominaItem(idnomina=7, nombre="Juan", apellido="Cruz"),
        NominaItem(idnomina=8, nombre="Ana", apellido="Cardenas"),
        NominaItem(idnomina=9, nombre="Cristian", apellido="Diaz"),
    ]

    reply = renderer.mostrar_nomina(nomina)

    assert "*NOMINA ACTIVA*" in reply
    assert "9 personas" in reply
    assert "A-C:" in reply
    assert "D:" in reply
    assert "Acosta Fabio, Benitez Ana" in reply
    assert "- Acosta" not in reply


def test_parte_diario_v3_plan_vacio_pide_aclaracion_sin_renderizar_actualizado():
    state = ParteDiarioDraft(
        oportunidad_id=1,
        idproyecto=10,
        fecha="2026-08-03",
        novedades=[
            NovedadPersonal(nombre="Vera, Daniela", estado_codigo="FAL", horas=0),
        ],
    )

    result = execute_plan(state, TurnPlan(), [], [], [])

    assert result.status == "clarification"
    assert result.applied_operations == []
    assert "Parte diario actualizado" not in result.reply
    assert "confirma si terminaste la carga" in result.reply


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
    assert rows[0]["description"] == "en carga"
    assert rows[1]["title"] == "15/05/2026 vie"
    assert rows[1]["description"] == "confirmado"
    assert rows[2]["title"] == "14/05/2026 jue"
    assert rows[2]["description"] == "sin cargar"
    assert "1: sabado 16/05/2026 (en carga)" in (result.reply_text or "")
    assert "2: viernes 15/05/2026 (finalizado)" in (result.reply_text or "")
    assert "3: 14/05/2026 jue (sin cargar)" in (result.reply_text or "")
    assert "Responde con el numero de una fecha o SALIR" in (result.reply_text or "")

    nomina = await process.handle(_message("mostrar nomina"), result.context)

    assert nomina.context.active_process == "parteDiario"
    assert nomina.context.process_state["etapa"] == "seleccionar_fecha"
    assert "*NOMINA ACTIVA*" in (nomina.reply_text or "")
    assert "Garcia Juan" in (nomina.reply_text or "")
    assert "Perez Pedro" in (nomina.reply_text or "")
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


def test_dia_operativo_anterior_skips_sunday():
    assert es_feriado(date(2026, 8, 9)) is True
    assert es_dia_laborable(date(2026, 8, 9)) is False
    assert es_feriado(date(2026, 8, 8)) is False
    assert es_dia_laborable(date(2026, 8, 8)) is True
    assert dia_operativo_anterior(date(2026, 8, 10)) == date(2026, 8, 8)
    assert dia_operativo_anterior(date(2026, 8, 11)) == date(2026, 8, 10)


def test_parte_diario_v3_fecha_visible_incluye_dia_completo():
    draft = ParteDiarioDraft(oportunidad_id=1, idproyecto=10, fecha="2026-08-08")

    reply = parte_diario_handler._load_start_reply(draft, "sin cargar", obra="Francia 118")

    assert "Fecha: sabado 08/08/2026" in reply
    assert "Obra: Francia 118" in reply
    assert "Que novedades hubo ese dia?" in reply


def test_parte_diario_v3_listado_parsea_referencia_numerada_sin_interpretar_motivo():
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="agregar_novedad",
                        nombre="Medina, Ivan",
                        estado_codigo="ENF",
                        descripcion="enfermo en casa",
                    ),
                ]
            )
        )
    )
    options = [ParteDiarioAsistenciaOption(opcion=23, idnomina=123, nombre="Juan", apellido="Perez")]

    parsed, error = process._parse_asistencia_entries("23 se accidento", options)

    assert error is None
    assert parsed[0][0].idnomina == 123
    assert parsed[0][1] == "se accidento"


def test_parte_diario_v3_listado_parsea_multiples_referencias_numeradas():
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="agregar_novedad",
                        nombre="Ruiz, Pablo",
                        estado_codigo="P",
                        horas=4,
                        nombre_proyecto="axion",
                        fuera_de_proyecto=True,
                    ),
                ]
            )
        )
    )
    options = [
        ParteDiarioAsistenciaOption(opcion=1, idnomina=123, nombre="Juan", apellido="Perez"),
        ParteDiarioAsistenciaOption(opcion=8, idnomina=456, nombre="Ana", apellido="Gomez"),
    ]

    parsed, error = process._parse_asistencia_entries("1 accidente, 8 enfermo", options)

    assert error is None
    assert [(option.idnomina, motivo) for option, motivo in parsed] == [
        (123, "accidente"),
        (456, "enfermo"),
    ]


def test_parte_diario_v3_listado_normaliza_input_comun_con_idnomina():
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="agregar_novedad",
                        nombre="Medina, Ivan",
                        estado_codigo="ENF",
                        descripcion="enfermo en casa",
                    ),
                ]
            )
        )
    )
    options = [ParteDiarioAsistenciaOption(opcion=23, idnomina=123, nombre="Juan", apellido="Perez")]

    parsed, error = process._parse_asistencia_entries("23 trabajo en Francia 118 7hs", options)

    assert error is None
    assert process._asistencia_interpreter_text(parsed) == (
        "[idnomina=123] Perez, Juan: trabajo en Francia 118 7hs"
    )


def test_parte_diario_v3_listado_rechaza_numero_fuera_de_pagina():
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))
    options = [ParteDiarioAsistenciaOption(opcion=23, idnomina=123, nombre="Juan", apellido="Perez")]

    parsed, error = process._parse_asistencia_entries("24 enfermo", options)

    assert parsed == []
    assert "El numero 24 no esta en esta pagina" in str(error)


def test_parte_diario_v3_listado_aplica_presente_con_horas():
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))
    draft = ParteDiarioDraft(oportunidad_id=10, idproyecto=100, fecha="2026-08-22")
    state = ParteDiarioV3State(etapa="novedades")
    option = ParteDiarioAsistenciaOption(opcion=23, idnomina=123, nombre="Juan", apellido="Perez")

    process._apply_asistencia_novedad(
        draft,
        state,
        option=option,
        estado_id=1,
        estado_codigo="P",
        motivo="trabajo 10hs",
        horas=10.0,
    )

    assert draft.novedades[0].estado_codigo == "P"
    assert draft.novedades[0].horas == 10.0
    assert draft.novedades[0].descripcion == "trabajo 10hs"
    assert state.asistencia_registros[0].horas == 10.0


def test_parte_diario_v3_listado_aplica_presente_en_otra_obra():
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))
    draft = ParteDiarioDraft(oportunidad_id=10, idproyecto=100, fecha="2026-08-22")
    state = ParteDiarioV3State(etapa="novedades")
    option = ParteDiarioAsistenciaOption(opcion=23, idnomina=123, nombre="Juan", apellido="Perez")

    process._apply_asistencia_novedad(
        draft,
        state,
        option=option,
        estado_id=1,
        estado_codigo="P",
        motivo="fue a Francia 118",
        horas=9.0,
        fuera_de_proyecto=True,
        nombre_proyecto="Francia 118",
    )

    assert draft.novedades[0].estado_codigo == "P"
    assert draft.novedades[0].horas == 9.0
    assert draft.novedades[0].fuera_de_proyecto is True
    assert draft.novedades[0].nombre_proyecto == "Francia 118"
    assert draft.novedades[0].idproyecto_destino is None


def test_parte_diario_v3_carga_agrega_empleado_actual_en_otra_obra_sin_horas():
    state = ParteDiarioDraft(oportunidad_id=10, idproyecto=100, fecha="2026-08-22")
    nominas = [
        NominaItem(
            idnomina=123,
            nombre="Juan",
            apellido="Perez",
            idproyecto=100,
            nombre_proyecto="Obra actual",
        )
    ]
    estados = [EstadoItem(id=1, abreviatura="P", nombre="PRESENTE")]

    result = execute_plan(
        state,
        TurnPlan(
            operations=[
                ParteDiarioOperation(
                    type="agregar_novedad",
                    nombre="Perez",
                    fuera_de_proyecto=True,
                    nombre_proyecto="Francia 118",
                )
            ]
        ),
        nominas,
        nominas,
        estados,
    )

    assert result.errors == []
    assert result.next_state.novedades[0].estado_codigo == "P"
    assert result.next_state.novedades[0].horas == 9.0
    assert result.next_state.novedades[0].fuera_de_proyecto is True
    assert result.next_state.novedades[0].nombre_proyecto == "Francia 118"


def test_parte_diario_v3_executor_prioriza_idnomina_resuelto():
    state = ParteDiarioDraft(oportunidad_id=10, idproyecto=100, fecha="2026-08-22")
    nominas = [
        NominaItem(idnomina=123, nombre="Juan", apellido="Perez", idproyecto=100),
        NominaItem(idnomina=124, nombre="Pedro", apellido="Perez", idproyecto=100),
    ]
    estados = [EstadoItem(id=1, abreviatura="ACC", nombre="Accidente")]

    result = execute_plan(
        state,
        TurnPlan(
            operations=[
                ParteDiarioOperation(
                    type="agregar_novedad",
                    idnomina=124,
                    nombre="Perez",
                    estado_codigo="ACC",
                    descripcion="accidente",
                )
            ]
        ),
        nominas,
        nominas,
        estados,
    )

    assert result.errors == []
    assert result.next_state.pendientes_ambiguos == []
    assert result.next_state.novedades[0].idnomina == 124
    assert result.next_state.novedades[0].nombre == "Perez, Pedro"


@pytest.mark.parametrize("operation_type", ["agregar_novedad", "modificar_novedad", "eliminar_novedad"])
def test_parte_diario_v3_rechaza_cambios_si_el_empleado_tiene_novedad_interna(operation_type):
    state = ParteDiarioDraft(
        oportunidad_id=10,
        idproyecto=100,
        fecha="2026-08-28",
        novedades_internas=[
            NovedadPersonal(
                nombre="Neto, Rodrigo",
                idnomina=123,
                idestado=10,
                estado_codigo="ALT",
                horas=9,
            )
        ],
    )
    nominas = [NominaItem(idnomina=123, nombre="Rodrigo", apellido="Neto", idproyecto=100)]
    estados = [EstadoItem(id=7, abreviatura="PER", nombre="PERMISO")]
    operation = ParteDiarioOperation(
        type=operation_type,
        idnomina=123,
        nombre="Neto, Rodrigo",
        estado_codigo="PER",
        horas=4,
    )

    result = execute_plan(state, TurnPlan(operations=[operation]), nominas, nominas, estados)

    assert result.next_state.novedades == []
    assert result.next_state.novedades_internas[0].estado_codigo == "ALT"
    assert result.errors == [
        "No se cargo la novedad de Neto, Rodrigo: ya tiene ALT registrado en este parte. "
        "Solo se admite una novedad por empleado."
    ]


def test_parte_diario_v3_carga_resuelve_obra_destino_aproximada():
    class FakeResult:
        def __init__(self, rows):
            self._rows = rows

        def all(self):
            return self._rows

    class FakeSession:
        def __init__(self):
            self.calls = 0

        def exec(self, query):
            self.calls += 1
            if self.calls > 1:
                return FakeResult([])
            return FakeResult(
                [
                    SimpleNamespace(id=200, nombre="Francia 118"),
                    SimpleNamespace(id=201, nombre="Catamarca 50"),
                ]
            )

    session = FakeSession()
    plan = TurnPlan(
        operations=[
            ParteDiarioOperation(
                type="agregar_novedad",
                nombre="Perez",
                fuera_de_proyecto=True,
                nombre_proyecto="franci",
            )
        ]
    )

    error = obras.resolver_operaciones_destino(session, plan, current_project_id=100)

    assert error is None
    assert plan.operations[0].idproyecto_destino == 200
    assert plan.operations[0].nombre_proyecto == "Francia 118"
    assert plan.operations[0].estado_codigo == "P"


@pytest.mark.asyncio
async def test_parte_diario_v3_trabajo_en_obra_con_varios_encargados_pide_encargado(
    db_session: Session,
    seeded_parte_v3,
):
    ruiz = Nomina(nombre="Pablo", apellido="Ruiz", dni="parte-v3-ruiz-axion", idproyecto=seeded_parte_v3["project"].id)
    axion = Proyecto(nombre="Axion", responsable_id=seeded_parte_v3["contact"].responsable_id)
    encargado_axion_1 = CRMContacto(
        nombre_completo="Encargado Axion Uno",
        telefonos=["549333333"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    encargado_axion_2 = CRMContacto(
        nombre_completo="Encargado Axion Dos",
        telefonos=["549444444"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    db_session.add(ruiz)
    db_session.add(axion)
    db_session.add(encargado_axion_1)
    db_session.add(encargado_axion_2)
    db_session.flush()
    db_session.add(
        ProyectoEncargado(
            proyecto_id=axion.id,
            contacto_id=encargado_axion_1.id,
            activo=True,
        )
    )
    db_session.add(
        ProyectoEncargado(
            proyecto_id=axion.id,
            contacto_id=encargado_axion_2.id,
            activo=True,
        )
    )
    db_session.commit()
    state = ParteDiarioDraft(
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
            "nombre_obra": "Obra Centro",
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="agregar_novedad",
                        nombre="ruiz",
                        estado_codigo="P",
                        horas=4,
                        fuera_de_proyecto=True,
                        nombre_proyecto="axion",
                    ),
                ]
            )
        )
    )

    result = await process.handle(_message("ruiz trabajo 4hs en axion"), context)

    draft = result.context.process_state["parte_state"]
    assert draft["novedades"] == []
    assert draft["esperando"] == "confirmacion_ambiguos"
    assert draft["pendientes_ambiguos"][0]["destino_pendiente"] == "encargado"
    assert draft["pendientes_ambiguos"][0]["idproyecto_destino"] == axion.id
    assert {item["nombre"] for item in draft["pendientes_ambiguos"][0]["opciones_encargado_destino"]} == {
        "Encargado Axion Uno",
        "Encargado Axion Dos",
    }
    assert "A que encargado de Axion corresponde Ruiz?" in (result.reply_text or "")
    assert "Encargado Axion Uno" in (result.reply_text or "")
    assert "Encargado Axion Dos" in (result.reply_text or "")

    selected = await process.handle(_message("1", external_id="wamid-axion-manager"), result.context)
    selected_draft = selected.context.process_state["parte_state"]

    assert selected_draft["pendientes_ambiguos"] == []
    assert selected_draft["novedades"][0]["idnomina"] == ruiz.id
    assert selected_draft["novedades"][0]["fuera_de_proyecto"] is True
    assert selected_draft["novedades"][0]["idproyecto_destino"] == axion.id
    assert selected_draft["novedades"][0]["contacto_id_destino"] == encargado_axion_2.id


@pytest.mark.asyncio
async def test_parte_diario_v3_obra_destino_sin_match_muestra_obras_activas_resumidas(
    db_session: Session,
    seeded_parte_v3,
):
    medina = Nomina(
        nombre="Ivan",
        apellido="Medina",
        dni="parte-v3-medina-cister",
        idproyecto=seeded_parte_v3["project"].id,
    )
    active_project = Proyecto(
        nombre="ALPHA SISTEMIKA OBRA LARGA",
        estado="02-ejecucion",
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    inactive_project = Proyecto(
        nombre="CISTER TERMINADA NO VA",
        estado="04-terminados",
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    db_session.add(medina)
    db_session.add(active_project)
    db_session.add(inactive_project)
    db_session.commit()
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "nombre_obra": "Obra Centro",
            "parte_state": ParteDiarioDraft(
                oportunidad_id=seeded_parte_v3["opportunity"].id,
                idproyecto=seeded_parte_v3["project"].id,
                fecha=date(2026, 9, 2).isoformat(),
            ).to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="agregar_novedad",
                        nombre="medina",
                        estado_codigo="P",
                        horas=9,
                        fuera_de_proyecto=True,
                        nombre_proyecto="cister",
                    ),
                ]
            )
        )
    )

    result = await process.handle(_message("medina trabajo en cister 9hs"), context)

    draft = result.context.process_state["parte_state"]
    assert draft["novedades"] == []
    assert draft["pendientes_ambiguos"][0]["destino_pendiente"] == "obra"
    assert draft["pendientes_ambiguos"][0]["idnomina_resuelto"] == medina.id
    assert draft["pendientes_ambiguos"][0]["opciones_proyecto_destino"][0]["nombre"] == active_project.nombre
    assert "A que obra fue Medina?" in (result.reply_text or "")
    assert "ALPHA SISTEMIKA OBRA" in (result.reply_text or "")
    assert "CISTER TERMINADA" not in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_obra_destino_no_referenciada_muestra_obras_activas(
    db_session: Session,
    seeded_parte_v3,
):
    medina = Nomina(
        nombre="Ivan",
        apellido="Medina",
        dni="parte-v3-medina-sin-obra",
        idproyecto=seeded_parte_v3["project"].id,
    )
    active_project = Proyecto(
        nombre="OBRA DESTINO ACTIVA MUY LARGA",
        estado="01-plan",
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    db_session.add(medina)
    db_session.add(active_project)
    db_session.commit()
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "nombre_obra": "Obra Centro",
            "parte_state": ParteDiarioDraft(
                oportunidad_id=seeded_parte_v3["opportunity"].id,
                idproyecto=seeded_parte_v3["project"].id,
                fecha=date(2026, 9, 2).isoformat(),
            ).to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="agregar_novedad",
                        nombre="medina",
                        estado_codigo="P",
                        horas=9,
                        fuera_de_proyecto=True,
                    ),
                ]
            )
        )
    )

    result = await process.handle(_message("medina fue a otra obra 9hs"), context)

    draft = result.context.process_state["parte_state"]
    assert draft["novedades"] == []
    assert draft["pendientes_ambiguos"][0]["destino_pendiente"] == "obra"
    assert draft["pendientes_ambiguos"][0]["opciones_proyecto_destino"][0]["nombre"] == active_project.nombre
    assert "A que obra fue Medina?" in (result.reply_text or "")
    assert "OBRA DESTINO ACTIVA" in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_listado_usa_validacion_comun_para_encargado_destino(
    db_session: Session,
    seeded_parte_v3,
):
    ruiz = Nomina(
        nombre="Pablo",
        apellido="Ruiz",
        dni="parte-v3-listado-ruiz-axion",
        idproyecto=seeded_parte_v3["project"].id,
        encargado_contacto_id=seeded_parte_v3["contact"].id,
    )
    axion = Proyecto(nombre="Axion", responsable_id=seeded_parte_v3["contact"].responsable_id)
    encargado_axion_1 = CRMContacto(
        nombre_completo="Encargado Axion Uno",
        telefonos=["549333337"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    encargado_axion_2 = CRMContacto(
        nombre_completo="Encargado Axion Dos",
        telefonos=["549444447"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    db_session.add(ruiz)
    db_session.add(axion)
    db_session.add(encargado_axion_1)
    db_session.add(encargado_axion_2)
    db_session.flush()
    db_session.add(ProyectoEncargado(proyecto_id=axion.id, contacto_id=encargado_axion_1.id, activo=True))
    db_session.add(ProyectoEncargado(proyecto_id=axion.id, contacto_id=encargado_axion_2.id, activo=True))
    db_session.commit()
    draft = ParteDiarioDraft(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 6, 10).isoformat(),
    )
    state = ParteDiarioV3State(
        etapa="novedades",
        contacto_id=seeded_parte_v3["contact"].id,
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        proyecto_id=seeded_parte_v3["project"].id,
        nombre_obra="Obra Centro",
        asistencia_opciones=[
            ParteDiarioAsistenciaOption(opcion=1, idnomina=ruiz.id, nombre="Pablo", apellido="Ruiz"),
        ],
        parte_state=draft.to_dict(),
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state=state.to_dict(),
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="agregar_novedad",
                        nombre="Ruiz, Pablo",
                        estado_codigo="P",
                        horas=4,
                        nombre_proyecto="axion",
                        fuera_de_proyecto=True,
                    ),
                ]
            )
        )
    )

    result = await process.handle(_message("1 trabajo 4hs en axion"), context)

    loaded = result.context.process_state["parte_state"]
    assert result.context.process_state["etapa"] == "validacion_carga"
    assert result.context.process_state["validacion_origen"] == "novedades"
    assert result.context.process_state["validacion_tipo"] == "encargado_destino"
    assert loaded["novedades"] == []
    assert loaded["esperando"] == "confirmacion_ambiguos"
    assert loaded["validacion_origen"] == "novedades"
    assert loaded["pendientes_ambiguos"][0]["idnomina_resuelto"] == ruiz.id
    assert loaded["pendientes_ambiguos"][0]["destino_pendiente"] == "encargado"
    assert loaded["pendientes_ambiguos"][0]["idproyecto_destino"] == axion.id
    assert "A que encargado de Axion corresponde Ruiz, Pablo?" in (result.reply_text or "")

    selected = await process.handle(_message("Encargado Axion Uno", external_id="wamid-listado-manager"), result.context)
    selected_draft = selected.context.process_state["parte_state"]

    assert selected.context.process_state["etapa"] == "novedades"
    assert selected.context.process_state["validacion_origen"] is None
    assert selected.context.process_state["validacion_tipo"] is None
    assert selected_draft["pendientes_ambiguos"] == []
    assert selected_draft["esperando"] is None
    assert selected_draft["validacion_origen"] is None
    assert selected_draft["novedades"][0]["idnomina"] == ruiz.id
    assert selected_draft["novedades"][0]["fuera_de_proyecto"] is True
    assert selected_draft["novedades"][0]["idproyecto_destino"] == axion.id
    assert selected_draft["novedades"][0]["contacto_id_destino"] == encargado_axion_1.id
    assert "Cargado." in (selected.reply_text or "")
    assert "Listado - Obra Centro" in (selected.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_listado_no_trata_enfermo_en_casa_como_transferencia(
    db_session: Session,
    seeded_parte_v3,
):
    medina = Nomina(
        nombre="Ivan",
        apellido="Medina",
        dni="parte-v3-listado-medina-en-casa",
        idproyecto=seeded_parte_v3["project"].id,
        encargado_contacto_id=seeded_parte_v3["contact"].id,
    )
    db_session.add(medina)
    db_session.commit()
    draft = ParteDiarioDraft(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 6, 10).isoformat(),
    )
    state = ParteDiarioV3State(
        etapa="novedades",
        contacto_id=seeded_parte_v3["contact"].id,
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        proyecto_id=seeded_parte_v3["project"].id,
        nombre_obra="Obra Centro",
        asistencia_opciones=[
            ParteDiarioAsistenciaOption(opcion=1, idnomina=medina.id, nombre="Ivan", apellido="Medina"),
        ],
        parte_state=draft.to_dict(),
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state=state.to_dict(),
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="agregar_novedad",
                        nombre="Medina, Ivan",
                        estado_codigo="ENF",
                        descripcion="enfermo en casa",
                    ),
                ]
            )
        )
    )

    result = await process.handle(_message("1 enfermo en casa"), context)

    loaded = result.context.process_state["parte_state"]
    assert loaded["pendientes_ambiguos"] == []
    assert loaded["novedades"][0]["idnomina"] == medina.id
    assert loaded["novedades"][0]["estado_codigo"] == "ENF"
    assert loaded["novedades"][0]["fuera_de_proyecto"] is False
    assert loaded["novedades"][0]["validar_destino_trabajo"] is False


@pytest.mark.asyncio
async def test_parte_diario_v3_listado_delega_input_normalizado_al_llm_comun(
    db_session: Session,
    seeded_parte_v3,
):
    class CapturingLLM(FakeParteDiarioLLM):
        def __init__(self, plan: TurnPlan) -> None:
            super().__init__(plan)
            self.messages: list[str] = []

        async def interpret_turn(self, mensaje, state, nominas_proyecto, estados, *, contexto_conversacion=None):
            self.messages.append(mensaje)
            return self.plan

    medina = Nomina(
        nombre="Ivan",
        apellido="Medina",
        dni="parte-v3-listado-medina-normalizado",
        idproyecto=seeded_parte_v3["project"].id,
        encargado_contacto_id=seeded_parte_v3["contact"].id,
    )
    db_session.add(medina)
    db_session.commit()
    draft = ParteDiarioDraft(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 6, 10).isoformat(),
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state=ParteDiarioV3State(
            etapa="novedades",
            contacto_id=seeded_parte_v3["contact"].id,
            oportunidad_id=seeded_parte_v3["opportunity"].id,
            proyecto_id=seeded_parte_v3["project"].id,
            nombre_obra="Obra Centro",
            asistencia_opciones=[
                ParteDiarioAsistenciaOption(opcion=1, idnomina=medina.id, nombre="Ivan", apellido="Medina"),
            ],
            parte_state=draft.to_dict(),
        ).to_dict(),
    )
    llm = CapturingLLM(
        TurnPlan(
            operations=[
                ParteDiarioOperation(
                    type="agregar_novedad",
                    nombre="Medina, Ivan",
                    estado_codigo="ENF",
                    descripcion="enfermo",
                ),
            ]
        )
    )
    process = ParteDiarioSubprocess(llm_client=llm)

    result = await process.handle(_message("1 enfermo"), context)

    loaded = result.context.process_state["parte_state"]
    assert llm.messages == [f"[idnomina={medina.id}] Medina, Ivan: enfermo"]
    assert loaded["novedades"][0]["idnomina"] == medina.id
    assert loaded["novedades"][0]["estado_codigo"] == "ENF"


@pytest.mark.asyncio
async def test_parte_diario_v3_infiere_obra_destino_si_llm_no_marca_fuera_de_proyecto(
    db_session: Session,
    seeded_parte_v3,
):
    ruiz = Nomina(
        nombre="Cristian Tomas",
        apellido="Ruiz",
        dni="parte-v3-ruiz-axion-infer",
        idproyecto=seeded_parte_v3["project"].id,
    )
    axion = Proyecto(nombre="Axion", responsable_id=seeded_parte_v3["contact"].responsable_id)
    encargado_axion_1 = CRMContacto(
        nombre_completo="Encargado Axion Uno",
        telefonos=["549333335"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    encargado_axion_2 = CRMContacto(
        nombre_completo="Encargado Axion Dos",
        telefonos=["549444445"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    db_session.add(ruiz)
    db_session.add(axion)
    db_session.add(encargado_axion_1)
    db_session.add(encargado_axion_2)
    db_session.flush()
    db_session.add(ProyectoEncargado(proyecto_id=axion.id, contacto_id=encargado_axion_1.id, activo=True))
    db_session.add(ProyectoEncargado(proyecto_id=axion.id, contacto_id=encargado_axion_2.id, activo=True))
    db_session.commit()
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "nombre_obra": "Francia 118",
            "parte_state": ParteDiarioDraft(
                oportunidad_id=seeded_parte_v3["opportunity"].id,
                idproyecto=seeded_parte_v3["project"].id,
                fecha=date(2026, 9, 3).isoformat(),
            ).to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="agregar_novedad",
                        nombre="ruiz",
                        estado_codigo="P",
                        horas=3,
                    ),
                ]
            )
        )
    )

    result = await process.handle(_message("ruiz trabajo 3hs en axion"), context)

    draft = result.context.process_state["parte_state"]
    assert draft["novedades"] == []
    assert draft["pendientes_ambiguos"][0]["nombre"] == "ruiz"
    assert draft["pendientes_ambiguos"][0]["nombre_proyecto"] == "Axion"
    assert draft["pendientes_ambiguos"][0]["destino_pendiente"] == "encargado"
    assert "A que encargado de Axion corresponde Ruiz?" in (result.reply_text or "")
    assert "RUIZ, CRISTIAN TOMAS: P, 3h" not in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_trabajo_con_horas_sin_obra_no_es_transferencia(
    db_session: Session,
    seeded_parte_v3,
):
    medina = Nomina(
        nombre="Ivan",
        apellido="Medina",
        dni="parte-v3-medina-horas-sin-obra",
        idproyecto=seeded_parte_v3["project"].id,
    )
    db_session.add(medina)
    db_session.commit()
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "nombre_obra": "Obra Centro",
            "parte_state": ParteDiarioDraft(
                oportunidad_id=seeded_parte_v3["opportunity"].id,
                idproyecto=seeded_parte_v3["project"].id,
                fecha=date(2026, 9, 3).isoformat(),
            ).to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="agregar_novedad",
                        nombre="medina",
                        estado_codigo="P",
                        horas=4,
                    ),
                ]
            )
        )
    )

    result = await process.handle(_message("medina trabajo 4hs"), context)

    draft = result.context.process_state["parte_state"]
    assert draft["pendientes_ambiguos"] == []
    assert draft["novedades"][0]["idnomina"] == medina.id
    assert draft["novedades"][0]["horas"] == 4
    assert draft["novedades"][0]["fuera_de_proyecto"] is False
    assert draft["novedades"][0]["validar_destino_trabajo"] is False


@pytest.mark.parametrize(
    ("mensaje", "horas"),
    [
        ("medina trabajo 4hs en francia", 4),
        ("medina estuvo en francia", None),
        ("mande a medina a francia", None),
    ],
)
@pytest.mark.asyncio
async def test_parte_diario_v3_infiere_transferencia_por_frase_destino(
    db_session: Session,
    seeded_parte_v3,
    mensaje: str,
    horas: float | None,
):
    medina = Nomina(
        nombre="Ivan",
        apellido="Medina",
        dni=f"parte-v3-medina-destino-{normalize_text(mensaje).replace(' ', '-')}",
        idproyecto=seeded_parte_v3["project"].id,
    )
    francia = Proyecto(nombre="Francia", responsable_id=seeded_parte_v3["contact"].responsable_id)
    encargado = CRMContacto(
        nombre_completo="Encargado Francia",
        telefonos=[f"549777{len(mensaje)}"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    db_session.add(medina)
    db_session.add(francia)
    db_session.add(encargado)
    db_session.flush()
    db_session.add(ProyectoEncargado(proyecto_id=francia.id, contacto_id=encargado.id, activo=True))
    db_session.commit()
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "nombre_obra": "Obra Centro",
            "parte_state": ParteDiarioDraft(
                oportunidad_id=seeded_parte_v3["opportunity"].id,
                idproyecto=seeded_parte_v3["project"].id,
                fecha=date(2026, 9, 3).isoformat(),
            ).to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="agregar_novedad",
                        nombre="medina",
                        estado_codigo="P",
                        horas=horas,
                    ),
                ]
            )
        )
    )

    result = await process.handle(_message(mensaje), context)

    draft = result.context.process_state["parte_state"]
    assert draft["pendientes_ambiguos"] == []
    assert draft["novedades"][0]["idnomina"] == medina.id
    assert draft["novedades"][0]["fuera_de_proyecto"] is True
    assert draft["novedades"][0]["validar_destino_trabajo"] is True
    assert draft["novedades"][0]["idproyecto_destino"] == francia.id
    assert draft["novedades"][0]["contacto_id_destino"] == encargado.id
    assert draft["novedades"][0]["nombre_proyecto"] == "Francia"


@pytest.mark.asyncio
async def test_parte_diario_v3_empleado_externo_trabajo_en_obra_pide_encargado_destino(
    db_session: Session,
    seeded_parte_v3,
):
    axion = Proyecto(nombre="Axion", responsable_id=seeded_parte_v3["contact"].responsable_id)
    ruiz = Nomina(nombre="Cristian Tomas", apellido="Ruiz", dni="parte-v3-ruiz-en-axion", idproyecto=axion.id)
    encargado_axion_1 = CRMContacto(
        nombre_completo="Edgardo (Axion)",
        telefonos=["549333337"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    encargado_axion_2 = CRMContacto(
        nombre_completo="Gustavo Test",
        telefonos=["549444447"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    db_session.add(axion)
    db_session.flush()
    ruiz.idproyecto = axion.id
    db_session.add(ruiz)
    db_session.add(encargado_axion_1)
    db_session.add(encargado_axion_2)
    db_session.flush()
    db_session.add(ProyectoEncargado(proyecto_id=axion.id, contacto_id=encargado_axion_1.id, activo=True))
    db_session.add(ProyectoEncargado(proyecto_id=axion.id, contacto_id=encargado_axion_2.id, activo=True))
    db_session.commit()
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "nombre_obra": "Francia 118",
            "parte_state": ParteDiarioDraft(
                oportunidad_id=seeded_parte_v3["opportunity"].id,
                idproyecto=seeded_parte_v3["project"].id,
                fecha=date(2026, 9, 3).isoformat(),
            ).to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="agregar_novedad",
                        nombre="ruiz",
                        estado_codigo="P",
                        horas=3,
                    ),
                ]
            )
        )
    )

    result = await process.handle(_message("ruiz trabajo 3hs en axion"), context)

    draft = result.context.process_state["parte_state"]
    assert draft["novedades"] == []
    assert draft["pendientes_ambiguos"][0]["idnomina_resuelto"] == ruiz.id
    assert draft["pendientes_ambiguos"][0]["validar_destino_trabajo"] is True
    assert draft["pendientes_ambiguos"][0]["destino_pendiente"] == "encargado"
    assert draft["pendientes_ambiguos"][0]["idproyecto_destino"] == axion.id
    assert "A que encargado de Axion corresponde Ruiz?" in (result.reply_text or "")
    assert "RUIZ, CRISTIAN TOMAS (AXION): P, 3h" not in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_empleado_externo_sin_trabajo_en_obra_no_pide_destino(
    db_session: Session,
    seeded_parte_v3,
):
    falta = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "FAL")
    ).one()
    axion = Proyecto(nombre="Axion", responsable_id=seeded_parte_v3["contact"].responsable_id)
    db_session.add(axion)
    db_session.flush()
    ruiz = Nomina(nombre="Cristian Tomas", apellido="Ruiz", dni="parte-v3-ruiz-falta-axion", idproyecto=axion.id)
    encargado_axion_1 = CRMContacto(
        nombre_completo="Encargado Axion Uno",
        telefonos=["549333338"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    encargado_axion_2 = CRMContacto(
        nombre_completo="Encargado Axion Dos",
        telefonos=["549444448"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    db_session.add(ruiz)
    db_session.add(encargado_axion_1)
    db_session.add(encargado_axion_2)
    db_session.flush()
    db_session.add(ProyectoEncargado(proyecto_id=axion.id, contacto_id=encargado_axion_1.id, activo=True))
    db_session.add(ProyectoEncargado(proyecto_id=axion.id, contacto_id=encargado_axion_2.id, activo=True))
    db_session.commit()
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "nombre_obra": "Francia 118",
            "parte_state": ParteDiarioDraft(
                oportunidad_id=seeded_parte_v3["opportunity"].id,
                idproyecto=seeded_parte_v3["project"].id,
                fecha=date(2026, 9, 3).isoformat(),
            ).to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="agregar_novedad",
                        nombre="ruiz",
                        estado_codigo=falta.abreviatura,
                    ),
                ]
            )
        )
    )

    result = await process.handle(_message("ruiz falto"), context)

    draft = result.context.process_state["parte_state"]
    assert draft["pendientes_ambiguos"] == []
    assert draft["novedades"][0]["idnomina"] == ruiz.id
    assert draft["novedades"][0]["validar_destino_trabajo"] is False
    assert draft["novedades"][0]["idproyecto_destino"] is None
    assert draft["novedades"][0]["contacto_id_destino"] is None
    assert "A que encargado" not in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_flujo_deriva_a_parte_destino_con_encargado_validado(
    db_session: Session,
    seeded_parte_v3,
):
    ruiz = Nomina(
        nombre="Cristian Tomas",
        apellido="Ruiz",
        dni="parte-v3-ruiz-axion-e2e",
        idproyecto=seeded_parte_v3["project"].id,
    )
    axion = Proyecto(nombre="Axion", responsable_id=seeded_parte_v3["contact"].responsable_id)
    edgardo = CRMContacto(
        nombre_completo="Edgardo Axion",
        telefonos=["549555333"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    otro = CRMContacto(
        nombre_completo="Otro Axion",
        telefonos=["549555444"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    db_session.add(ruiz)
    db_session.add(axion)
    db_session.add(edgardo)
    db_session.add(otro)
    db_session.flush()
    db_session.add(ProyectoEncargado(proyecto_id=axion.id, contacto_id=edgardo.id, activo=True))
    db_session.add(ProyectoEncargado(proyecto_id=axion.id, contacto_id=otro.id, activo=True))
    db_session.commit()
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "nombre_obra": "Francia 118",
            "parte_state": ParteDiarioDraft(
                oportunidad_id=seeded_parte_v3["opportunity"].id,
                idproyecto=seeded_parte_v3["project"].id,
                fecha=date(2026, 9, 2).isoformat(),
            ).to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="agregar_novedad",
                        nombre="ruiz",
                        estado_codigo="P",
                        horas=4,
                    ),
                ]
            )
        )
    )

    asks_manager = await process.handle(_message("ruiz trabajo 4hs en axion"), context)
    selected = await process.handle(_message("Edgardo Axion", external_id="wamid-axion-edgardo"), asks_manager.context)
    closed = await process.handle(_message("cerrar", external_id="wamid-axion-cerrar"), selected.context)

    assert closed.metadata["parte_listo"] is True
    parte_destino = db_session.exec(
        select(ParteDiario)
        .where(ParteDiario.idproyecto == axion.id)
        .where(ParteDiario.fecha == date(2026, 9, 2))
        .where(ParteDiario.deleted_at.is_(None))
    ).one()
    assert parte_destino.contacto_id == edgardo.id
    detalle_destino = db_session.exec(
        select(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == parte_destino.id)
    ).one()
    assert detalle_destino.idnomina == ruiz.id
    assert detalle_destino.horas == Decimal("4.00")
    detalle_origen = db_session.exec(
        select(ParteDiarioDetalle)
        .where(ParteDiarioDetalle.parte_diario_id != parte_destino.id)
        .where(ParteDiarioDetalle.idnomina == ruiz.id)
    ).one()
    assert detalle_origen.horas == Decimal("5.00")
    assert f"[parte_diario_destino_id={parte_destino.id}]" in (detalle_origen.descripcion or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_resuelve_encargado_destino_mencionado_en_mensaje(
    db_session: Session,
    seeded_parte_v3,
):
    ruiz = Nomina(nombre="Pablo", apellido="Ruiz", dni="parte-v3-ruiz-axion-edgardo", idproyecto=seeded_parte_v3["project"].id)
    axion = Proyecto(nombre="Axion", responsable_id=seeded_parte_v3["contact"].responsable_id)
    edgardo = CRMContacto(
        nombre_completo="Edgardo Axion",
        telefonos=["549555555"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    otro = CRMContacto(
        nombre_completo="Otro Axion",
        telefonos=["549555556"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    db_session.add(ruiz)
    db_session.add(axion)
    db_session.add(edgardo)
    db_session.add(otro)
    db_session.flush()
    db_session.add(ProyectoEncargado(proyecto_id=axion.id, contacto_id=edgardo.id, activo=True))
    db_session.add(ProyectoEncargado(proyecto_id=axion.id, contacto_id=otro.id, activo=True))
    db_session.commit()
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "nombre_obra": "Francia 118",
            "parte_state": ParteDiarioDraft(
                oportunidad_id=seeded_parte_v3["opportunity"].id,
                idproyecto=seeded_parte_v3["project"].id,
                fecha=date(2026, 9, 2).isoformat(),
            ).to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="agregar_novedad",
                        nombre="ruiz",
                        estado_codigo="P",
                        horas=9,
                    ),
                ]
            )
        )
    )

    result = await process.handle(_message("ruiz trabajo 9hs en axion con edgardo"), context)

    draft = result.context.process_state["parte_state"]
    assert draft["pendientes_ambiguos"] == []
    assert draft["novedades"][0]["idnomina"] == ruiz.id
    assert draft["novedades"][0]["idproyecto_destino"] == axion.id
    assert draft["novedades"][0]["contacto_id_destino"] == edgardo.id


@pytest.mark.asyncio
async def test_parte_diario_v3_no_acepta_encargado_destino_si_no_fue_mencionado(
    db_session: Session,
    seeded_parte_v3,
):
    ruiz = Nomina(nombre="Pablo", apellido="Ruiz", dni="parte-v3-ruiz-axion-hallucinated", idproyecto=seeded_parte_v3["project"].id)
    axion = Proyecto(nombre="Axion", responsable_id=seeded_parte_v3["contact"].responsable_id)
    edgardo = CRMContacto(
        nombre_completo="Edgardo Axion",
        telefonos=["549555557"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    otro = CRMContacto(
        nombre_completo="Otro Axion",
        telefonos=["549555558"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    db_session.add(ruiz)
    db_session.add(axion)
    db_session.add(edgardo)
    db_session.add(otro)
    db_session.flush()
    db_session.add(ProyectoEncargado(proyecto_id=axion.id, contacto_id=edgardo.id, activo=True))
    db_session.add(ProyectoEncargado(proyecto_id=axion.id, contacto_id=otro.id, activo=True))
    db_session.commit()
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "nombre_obra": "Francia 118",
            "parte_state": ParteDiarioDraft(
                oportunidad_id=seeded_parte_v3["opportunity"].id,
                idproyecto=seeded_parte_v3["project"].id,
                fecha=date(2026, 9, 2).isoformat(),
            ).to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="agregar_novedad",
                        nombre="ruiz",
                        estado_codigo="P",
                        horas=4,
                        fuera_de_proyecto=True,
                        nombre_proyecto="axion",
                        contacto_id_destino=edgardo.id,
                    ),
                ]
            )
        )
    )

    result = await process.handle(_message("ruiz trabajo 4hs en axion"), context)

    draft = result.context.process_state["parte_state"]
    assert draft["novedades"] == []
    assert draft["pendientes_ambiguos"][0]["destino_pendiente"] == "encargado"
    assert "A que encargado de Axion corresponde Ruiz?" in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_persona_ambigua_con_obra_destino_pide_encargado_despues_de_persona(
    db_session: Session,
    seeded_parte_v3,
):
    ruiz_pablo = Nomina(nombre="Pablo", apellido="Ruiz", dni="parte-v3-ruiz-axion-amb-1", idproyecto=seeded_parte_v3["project"].id)
    ruiz_teresa = Nomina(nombre="Teresa", apellido="Ruiz", dni="parte-v3-ruiz-axion-amb-2", idproyecto=seeded_parte_v3["project"].id)
    axion = Proyecto(nombre="Axion", responsable_id=seeded_parte_v3["contact"].responsable_id)
    edgardo = CRMContacto(
        nombre_completo="Edgardo",
        telefonos=["549555559"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    otro = CRMContacto(
        nombre_completo="Otro",
        telefonos=["549555560"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    db_session.add(ruiz_pablo)
    db_session.add(ruiz_teresa)
    db_session.add(axion)
    db_session.add(edgardo)
    db_session.add(otro)
    db_session.flush()
    db_session.add(ProyectoEncargado(proyecto_id=axion.id, contacto_id=edgardo.id, activo=True))
    db_session.add(ProyectoEncargado(proyecto_id=axion.id, contacto_id=otro.id, activo=True))
    db_session.commit()
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_parte_v3["contact"].id,
            "oportunidad_id": seeded_parte_v3["opportunity"].id,
            "proyecto_id": seeded_parte_v3["project"].id,
            "nombre_obra": "Francia 118",
            "parte_state": ParteDiarioDraft(
                oportunidad_id=seeded_parte_v3["opportunity"].id,
                idproyecto=seeded_parte_v3["project"].id,
                fecha=date(2026, 9, 2).isoformat(),
            ).to_dict(),
        },
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(
                        type="agregar_novedad",
                        nombre="ruiz",
                        estado_codigo="P",
                        horas=4,
                    ),
                ]
            )
        )
    )

    asks_person = await process.handle(_message("ruiz trabajo 4hs en axion"), context)
    asks_manager = await process.handle(_message("Pablo Ruiz", external_id="wamid-ruiz-pablo"), asks_person.context)

    draft = asks_manager.context.process_state["parte_state"]
    assert draft["novedades"] == []
    assert draft["pendientes_ambiguos"][0]["idnomina_resuelto"] == ruiz_pablo.id
    assert draft["pendientes_ambiguos"][0]["fuera_de_proyecto"] is True
    assert draft["pendientes_ambiguos"][0]["destino_pendiente"] == "encargado"
    assert "A que encargado de Axion corresponde Ruiz?" in (asks_manager.reply_text or "")


def test_parte_diario_v3_persistencia_deriva_empleado_a_obra_destino():
    class FakeResult:
        def first(self):
            return 1

    class FakeSession:
        def get(self, model, item_id):
            if model is Nomina and item_id == 123:
                return SimpleNamespace(idproyecto=100)
            return None

        def exec(self, query):
            return FakeResult()

    current_items, destination_items = parte_diario_service._split_destination_novedades(
        FakeSession(),
        [
            {
                "nombre": "Perez, Pedro",
                "idnomina": 123,
                "idestado": 1,
                "estado_codigo": "P",
                "horas": None,
                "descripcion": None,
                "fuera_de_proyecto": True,
                "nombre_proyecto": "Francia 118",
                "idproyecto_destino": 200,
                "contacto_id_destino": 300,
            }
        ],
        idproyecto=100,
        fecha=date(2026, 8, 21),
    )

    assert current_items[0]["idnomina"] == 123
    assert current_items[0]["horas"] == 0.0
    assert current_items[0]["fuera_de_proyecto"] is True
    assert current_items[0]["descripcion"] == "Trabajo en Francia 118"
    assert destination_items[0]["idproyecto"] == 200
    assert destination_items[0]["idnomina"] == 123
    assert destination_items[0]["horas"] == 9.0
    parte_diario_service._validate_novedades(
        current_items,
        present_id=1,
        require_close_rules=True,
    )


def test_parte_diario_v3_persistencia_deriva_horas_remanentes_a_origen():
    class FakeResult:
        def first(self):
            return 1

    class FakeSession:
        def get(self, model, item_id):
            if model is Nomina and item_id == 123:
                return SimpleNamespace(idproyecto=100)
            return None

        def exec(self, query):
            return FakeResult()

    current_items, destination_items = parte_diario_service._split_destination_novedades(
        FakeSession(),
        [
            {
                "nombre": "Perez, Pedro",
                "idnomina": 123,
                "idestado": 1,
                "estado_codigo": "P",
                "horas": 5.0,
                "descripcion": None,
                "fuera_de_proyecto": True,
                "nombre_proyecto": "Francia 118",
                "idproyecto_destino": 200,
                "contacto_id_destino": 300,
            }
        ],
        idproyecto=100,
        fecha=date(2026, 8, 21),
    )

    assert current_items[0]["horas"] == 4.0
    assert destination_items[0]["horas"] == 5.0


def test_parte_diario_v3_persistencia_deriva_origen_cero_si_no_hay_horas_o_supera_jornada():
    class FakeResult:
        def first(self):
            return 1

    class FakeSession:
        def get(self, model, item_id):
            if model is Nomina:
                return SimpleNamespace(idproyecto=100)
            return None

        def exec(self, query):
            return FakeResult()

    current_without_hours, destination_without_hours = parte_diario_service._split_destination_novedades(
        FakeSession(),
        [
            {
                "idnomina": 123,
                "idestado": 1,
                "estado_codigo": "P",
                "horas": None,
                "fuera_de_proyecto": True,
                "nombre_proyecto": "Francia 118",
                "idproyecto_destino": 200,
                "contacto_id_destino": 300,
            }
        ],
        idproyecto=100,
        fecha=date(2026, 8, 21),
    )
    current_extra_hours, destination_extra_hours = parte_diario_service._split_destination_novedades(
        FakeSession(),
        [
            {
                "idnomina": 124,
                "idestado": 1,
                "estado_codigo": "P",
                "horas": 12.0,
                "fuera_de_proyecto": True,
                "nombre_proyecto": "Francia 118",
                "idproyecto_destino": 200,
                "contacto_id_destino": 300,
            }
        ],
        idproyecto=100,
        fecha=date(2026, 8, 21),
    )

    assert current_without_hours[0]["horas"] == 0.0
    assert destination_without_hours[0]["horas"] == 9.0
    assert current_extra_hours[0]["horas"] == 0.0
    assert destination_extra_hours[0]["horas"] == 12.0


def test_parte_diario_v3_persistencia_crea_parte_destino_borrador(monkeypatch):
    class FakeSession:
        def __init__(self):
            self.added = []
            self.exec_calls = 0

        def get(self, model, item_id):
            return None

        def add(self, item):
            self.added.append(item)

        def flush(self):
            for item in self.added:
                if isinstance(item, ParteDiario) and item.id is None:
                    item.id = 500

        def exec(self, query):
            self.exec_calls += 1

    def fake_resolve_parte(session, result, *, idproyecto, fecha, contacto_id):
        return None

    fake_session = FakeSession()
    monkeypatch.setattr(parte_diario_service, "_resolve_parte", fake_resolve_parte)

    parte_diario_service._materialize_destination_novedades(
        fake_session,
        [
            {
                "idproyecto": 200,
                "idnomina": 123,
                "idestado": 1,
                "estado_codigo": "P",
                "horas": 5.0,
                "descripcion": "Trabajo derivado",
                "contacto_id_destino": 206,
            }
        ],
        result={"type": "parte_diario_reply"},
        fecha=date(2026, 8, 22),
        contacto_id=106,
        mensaje_id=900,
    )

    partes = [item for item in fake_session.added if isinstance(item, ParteDiario)]
    details = [item for item in fake_session.added if isinstance(item, ParteDiarioDetalle)]
    assert partes[0].estado == EstadoParteDiario.BORRADOR
    assert partes[0].contacto_id == 206
    assert details[0].parte_diario_id == 500
    assert details[0].horas == Decimal("5.0")


def test_parte_diario_v3_persistencia_rechaza_derivacion_sin_encargado_destino():
    class FakeSession:
        def get(self, model, item_id):
            if model is Nomina and item_id == 123:
                return SimpleNamespace(idproyecto=100)
            return None

    with pytest.raises(ValueError, match="requiere encargado destino"):
        parte_diario_service._split_destination_novedades(
            FakeSession(),
            [
                {
                    "idnomina": 123,
                    "idestado": 1,
                    "estado_codigo": "P",
                    "horas": 4.0,
                    "fuera_de_proyecto": True,
                    "nombre_proyecto": "Axion",
                    "idproyecto_destino": 200,
                }
            ],
            idproyecto=100,
            fecha=date(2026, 9, 2),
        )


def test_parte_diario_v3_persistencia_crea_parte_destino_con_encargado_destino(
    db_session: Session,
    seeded_parte_v3,
):
    presente = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "P")
    ).one()
    axion = Proyecto(nombre="AXION - Emilio Castelar 1003", responsable_id=seeded_parte_v3["contact"].responsable_id)
    encargado_axion = CRMContacto(
        nombre_completo="Edgardo Axion",
        telefonos=["549555111"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    otro_encargado_axion = CRMContacto(
        nombre_completo="Otro Axion",
        telefonos=["549555222"],
        responsable_id=seeded_parte_v3["contact"].responsable_id,
    )
    db_session.add(axion)
    db_session.add(encargado_axion)
    db_session.add(otro_encargado_axion)
    db_session.flush()
    db_session.add(
        ProyectoEncargado(
            proyecto_id=axion.id,
            contacto_id=encargado_axion.id,
            activo=True,
        )
    )
    db_session.add(
        ProyectoEncargado(
            proyecto_id=axion.id,
            contacto_id=otro_encargado_axion.id,
            activo=True,
        )
    )
    db_session.commit()
    result = {
        "type": "parte_diario_reply",
        "parte_listo": True,
        "confirmar_parte": True,
        "cerrar_parte": True,
        "idproyecto": seeded_parte_v3["project"].id,
        "contacto_id": seeded_parte_v3["contact"].id,
        "fecha": "2026-09-02",
        "novedades": [
            {
                "nombre": "Ruiz, Cristian Tomas",
                "idnomina": seeded_parte_v3["employee_1"].id,
                "idestado": presente.id,
                "estado_codigo": "P",
                "horas": 4,
                "descripcion": "trabajo 4hs en axion",
                "fuera_de_proyecto": True,
                "nombre_proyecto": axion.nombre,
                "idproyecto_destino": axion.id,
                "contacto_id_destino": encargado_axion.id,
            }
        ],
        "pendientes_ambiguos": [],
        "conflictos_novedad": [],
    }

    parte_origen = parte_diario_service.create_or_update_from_agent_v3_confirmation(
        db_session,
        contacto_id=seeded_parte_v3["contact"].id,
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        result=result,
        conversation_id="conv-destino-contacto",
        provider="meta",
        channel_type="whatsapp",
        account_ref="account",
        from_address="549111111",
        to_address="549999999",
        external_message_id="wamid-destino-contacto",
        text="cerrar",
        message_type="text",
        raw_payload={"raw": True},
        normalized_payload={"normalized": True},
        received_at=datetime(2026, 9, 2, 12, 0, tzinfo=UTC),
    )

    parte_destino = db_session.exec(
        select(ParteDiario)
        .where(ParteDiario.idproyecto == axion.id)
        .where(ParteDiario.fecha == date(2026, 9, 2))
        .where(ParteDiario.deleted_at.is_(None))
    ).one()
    assert parte_origen.contacto_id == seeded_parte_v3["contact"].id
    assert parte_destino.contacto_id == encargado_axion.id
    assert parte_destino.contacto_id != seeded_parte_v3["contact"].id
    detalle_destino = db_session.exec(
        select(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == parte_destino.id)
    ).one()
    assert detalle_destino.idnomina == seeded_parte_v3["employee_1"].id
    assert detalle_destino.horas == Decimal("4.00")
    detalle_origen = db_session.exec(
        select(ParteDiarioDetalle)
        .where(ParteDiarioDetalle.parte_diario_id == parte_origen.id)
        .where(ParteDiarioDetalle.idnomina == seeded_parte_v3["employee_1"].id)
    ).one()
    assert f"[parte_diario_destino_id={parte_destino.id}]" in (detalle_origen.descripcion or "")


def test_parte_diario_v3_eliminar_novedad_origen_elimina_destino(
    db_session: Session,
    seeded_parte_v3,
):
    origin = ParteDiario(
        idproyecto=seeded_parte_v3["project"].id,
        contacto_id=seeded_parte_v3["contact"].id,
        fecha=date(2026, 9, 4),
        estado=EstadoParteDiario.BORRADOR,
    )
    destination = ParteDiario(
        idproyecto=seeded_parte_v3["project"].id,
        contacto_id=None,
        fecha=date(2026, 9, 5),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add(origin)
    db_session.add(destination)
    db_session.flush()
    origin_detail = ParteDiarioDetalle(
        parte_diario_id=origin.id,
        idnomina=seeded_parte_v3["employee_1"].id,
        horas=Decimal("5.00"),
        descripcion=f"Trabajo en obra destino [parte_diario_destino_id={destination.id}]",
        origen=OrigenDetalle.AGENTE,
    )
    destination_detail = ParteDiarioDetalle(
        parte_diario_id=destination.id,
        idnomina=seeded_parte_v3["employee_1"].id,
        horas=Decimal("4.00"),
        origen=OrigenDetalle.AGENTE,
    )
    db_session.add(origin_detail)
    db_session.add(destination_detail)
    db_session.commit()
    origin_detail_id = origin_detail.id
    destination_detail_id = destination_detail.id

    ParteDiarioCRUD._delete_detalle(db_session, origin_detail)
    db_session.commit()

    assert db_session.get(ParteDiarioDetalle, origin_detail_id) is None
    assert db_session.get(ParteDiarioDetalle, destination_detail_id) is None


def test_parte_diario_v3_eliminar_novedad_destino_elimina_origen(
    db_session: Session,
    seeded_parte_v3,
):
    origin = ParteDiario(
        idproyecto=seeded_parte_v3["project"].id,
        contacto_id=seeded_parte_v3["contact"].id,
        fecha=date(2026, 9, 6),
        estado=EstadoParteDiario.BORRADOR,
    )
    destination = ParteDiario(
        idproyecto=seeded_parte_v3["project"].id,
        contacto_id=None,
        fecha=date(2026, 9, 7),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add(origin)
    db_session.add(destination)
    db_session.flush()
    origin_detail = ParteDiarioDetalle(
        parte_diario_id=origin.id,
        idnomina=seeded_parte_v3["employee_1"].id,
        horas=Decimal("5.00"),
        descripcion=f"Trabajo en obra destino [parte_diario_destino_id={destination.id}]",
        origen=OrigenDetalle.AGENTE,
    )
    destination_detail = ParteDiarioDetalle(
        parte_diario_id=destination.id,
        idnomina=seeded_parte_v3["employee_1"].id,
        horas=Decimal("4.00"),
        origen=OrigenDetalle.AGENTE,
    )
    db_session.add(origin_detail)
    db_session.add(destination_detail)
    db_session.commit()
    origin_detail_id = origin_detail.id
    destination_detail_id = destination_detail.id

    ParteDiarioCRUD._delete_detalle(db_session, destination_detail)
    db_session.commit()

    assert db_session.get(ParteDiarioDetalle, origin_detail_id) is None
    assert db_session.get(ParteDiarioDetalle, destination_detail_id) is None


# Un destino cerrado no se reabre automaticamente al recibir transferencias.
def test_parte_diario_v3_persistencia_rechaza_parte_destino_cerrado(monkeypatch):
    existing_destination = SimpleNamespace(
        id=500,
        estado=EstadoParteDiario.CERRADO,
        mensaje_origen_id=None,
    )

    class FakeSession:
        def __init__(self):
            self.added = []
            self.exec_calls = 0

        def get(self, model, item_id):
            return None

        def add(self, item):
            self.added.append(item)

        def flush(self):
            return None

        def exec(self, query):
            self.exec_calls += 1

    def fake_resolve_parte(session, result, *, idproyecto, fecha, contacto_id):
        return existing_destination

    fake_session = FakeSession()
    monkeypatch.setattr(parte_diario_service, "_resolve_parte", fake_resolve_parte)

    try:
        parte_diario_service._materialize_destination_novedades(
            fake_session,
            [
                {
                    "idproyecto": 200,
                    "idnomina": 123,
                    "idestado": 1,
                    "estado_codigo": "P",
                    "horas": 8.0,
                    "descripcion": "Trabajo derivado",
                    "contacto_id_destino": 206,
                }
            ],
            result={"type": "parte_diario_reply"},
            fecha=date(2026, 8, 22),
            contacto_id=106,
            mensaje_id=900,
        )
    except ValueError as exc:
        assert "parte diario destino 200 ya fue cerrado" in str(exc)
    else:
        raise AssertionError("Debe rechazar el parte destino ya cerrado")


def test_parte_diario_v3_listado_muestra_empleado_informado():
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))
    draft = ParteDiarioDraft(
        oportunidad_id=10,
        idproyecto=100,
        fecha="2026-08-22",
        novedades=[
            NovedadPersonal(
                nombre="Perez, Juan",
                idnomina=123,
                estado_codigo="P",
                horas=10.0,
                descripcion="trabajo 10hs",
            ),
            NovedadPersonal(
                nombre="Gomez, Ana",
                idnomina=124,
                estado_codigo="ENF",
                horas=0,
                descripcion="enfermo",
            ),
        ],
    )
    state = ParteDiarioV3State(
        etapa="novedades",
        parte_state=draft.to_dict(),
        asistencia_opciones=[
            ParteDiarioAsistenciaOption(opcion=23, idnomina=123, nombre="Juan", apellido="Perez"),
            ParteDiarioAsistenciaOption(opcion=24, idnomina=124, nombre="Ana", apellido="Gomez"),
        ],
    )

    text = process._asistencia_page_text(state, total=2)

    assert "23. Perez, Juan - informado: P, 10h" in text
    assert "24. Gomez, Ana - informado: ENF, motivo: enfermo" in text
    assert "ya cargado" not in text


def test_parte_diario_v3_borrador_conserva_novedades_sin_estado_conversacional():
    draft = ParteDiarioDraft(
        oportunidad_id=10,
        idproyecto=100,
        fecha="2026-08-22",
        novedades=[
            NovedadPersonal(
                nombre="Cardenas, Ignacio",
                idnomina=123,
                idestado=2,
                estado_codigo="FAL",
                horas=0,
                descripcion="falto Cardenas",
            )
        ],
    )
    state = ParteDiarioV3State(
        etapa="listado",
        contacto_id=5,
        oportunidad_id=10,
        proyecto_id=100,
        nombre_obra="Francia 118",
        parte_state=draft.to_dict(),
    )
    restored = ParteDiarioV3State.from_dict(state.to_dict())
    assert restored.etapa == "listado"
    assert restored.draft().novedades == draft.novedades
    assert "asistencia_registros" not in restored.to_dict()
    assert "esperando" not in restored.draft().to_dict()
    assert "validacion_origen" not in restored.draft().to_dict()


@pytest.mark.asyncio
async def test_parte_diario_v3_listado_inicia_auxiliar_de_novedades():
    class ProbeProcess(ParteDiarioSubprocess):
        def _show_asistencia_page(self, context, state, *, prefix=None):
            return self._active_result(context, state, "Listado de prueba", "asistencia_page")

    draft = ParteDiarioDraft(oportunidad_id=10, idproyecto=100, fecha="2026-08-22")
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": 5,
            "oportunidad_id": 10,
            "proyecto_id": 100,
            "nombre_obra": "Francia 118",
            "parte_state": draft.to_dict(),
        },
    )
    process = ProbeProcess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(_message("listado"), context)

    assert result.context.process_state["etapa"] == "novedades"
    assert result.metadata["status"] == "asistencia_page"
    assert result.reply_text == "Listado de prueba"


@pytest.mark.asyncio
async def test_parte_diario_v3_apoyo_command_no_inicia_modalidad():
    draft = ParteDiarioDraft(oportunidad_id=10, idproyecto=100, fecha="2026-08-22")
    captured = {}

    class ProbeProcess(ParteDiarioSubprocess):
        async def _handle_parte_diario(self, message, context, state, forced_text=None, extra_result_metadata=None):
            captured["text"] = message.text
            captured["etapa"] = state.etapa
            return self._active_result(context, state, "flujo carga", "carga_normal")

    process = ProbeProcess(llm_client=FakeParteDiarioLLM(TurnPlan()))
    context = V3ConversationContext(
        conversation_id="conv-apoyo-disabled",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": 1,
            "oportunidad_id": 10,
            "proyecto_id": 100,
            "nombre_obra": "Obra Centro",
            "parte_state": draft.to_dict(),
        },
    )

    result = await process.handle(_message("apoyo Francia"), context)

    assert result.context.process_state["etapa"] == "carga"
    assert result.metadata["status"] == "carga_normal"
    assert captured == {"text": "apoyo Francia", "etapa": "carga"}


@pytest.mark.asyncio
async def test_parte_diario_v3_apoyos_state_vuelve_a_carga():
    draft = ParteDiarioDraft(oportunidad_id=10, idproyecto=100, fecha="2026-08-22")
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))
    context = V3ConversationContext(
        conversation_id="conv-apoyos-old-state",
        active_process="parteDiario",
        process_state={
            "etapa": "apoyos",
            "contacto_id": 1,
            "oportunidad_id": 10,
            "proyecto_id": 100,
            "nombre_obra": "Obra Centro",
            "apoyo_proyecto_id": 20,
            "apoyo_proyecto_nombre": "Francia",
            "parte_state": draft.to_dict(),
        },
    )

    result = await process.handle(_message("23 8hs"), context)

    assert result.context.process_state["etapa"] == "carga"
    assert result.context.process_state["apoyo_proyecto_id"] is None
    assert result.metadata["status"] == "apoyos_disabled"
    assert "La modalidad APOYO ya no esta disponible" in (result.reply_text or "")


def test_parte_diario_v3_apoyos_next_steps_no_ofrece_modalidad_apoyo():
    text = parte_diario_handler._apoyos_next_steps()

    assert "Hay alguna otra novedad?" not in text
    assert "Volvemos al parte diario" in text
    assert "APOYO" not in text
    assert "trabajo en otra obra" in text
    assert "LISTADO" in text
    assert "GUARDAR" in text
    assert "CERRAR" in text


def test_parte_diario_v3_fecha_visible_pregunta_hoy(monkeypatch):
    monkeypatch.setattr(parte_diario_handler, "_today", lambda: date(2026, 8, 9))
    draft = ParteDiarioDraft(oportunidad_id=1, idproyecto=10, fecha="2026-08-09")

    reply = parte_diario_handler._load_start_reply(draft, "sin cargar", obra="Francia 118")

    assert "Fecha: domingo 09/08/2026" in reply
    assert "Que novedades hubo hoy?" in reply


def test_parte_diario_v3_clarification_no_agrega_followup_generico():
    state = ParteDiarioV3State(
        etapa="carga",
        nombre_obra="Francia 118",
        parte_state={"oportunidad_id": 1, "idproyecto": 10, "fecha": "2026-08-08"},
    )
    payload = {"parte_diario": {"status": "clarification"}}

    reply = parte_diario_handler._format_reply(
        "No entendi que novedad queres cargar.",
        state,
        payload,
    )

    assert reply == "No entendi que novedad queres cargar."
    assert "Hay alguna otra novedad?" not in reply


def test_parte_diario_v3_clarification_humaniza_fecha_iso(monkeypatch):
    monkeypatch.setattr(parte_diario_handler, "_today", lambda: date(2026, 8, 9))
    state = ParteDiarioV3State(
        etapa="carga",
        nombre_obra="Francia 118",
        parte_state={"oportunidad_id": 1, "idproyecto": 10, "fecha": "2026-08-09"},
    )
    payload = {"parte_diario": {"status": "clarification"}}

    reply = parte_diario_handler._format_reply(
        "Queres agregar alguna novedad o dar por finalizada la carga para el parte del 2026-08-09?",
        state,
        payload,
    )

    assert "para el parte de hoy, domingo 09/08/2026" in reply
    assert "2026-08-09" not in reply


@pytest.mark.asyncio
async def test_parte_diario_v3_confirmation_required_today_guarda_borrador(monkeypatch):
    monkeypatch.setattr(parte_diario_handler, "_today", lambda: date(2026, 8, 9))

    class SavingProbeProcess(ParteDiarioSubprocess):
        async def _guardar_borrador(self, message, context, state):
            return self._active_result(context, state, "guardado", "saved_probe")

    process = SavingProbeProcess(
        llm_client=FakeParteDiarioLLM(TurnPlan(operations=[ParteDiarioOperation(type="solicitar_confirmacion")]))
    )
    state = ParteDiarioV3State(
        etapa="carga",
        contacto_id=1,
        oportunidad_id=1,
        proyecto_id=1,
        nombre_obra="Francia 118",
        parte_state={"oportunidad_id": 1, "idproyecto": 1, "fecha": "2026-08-09"},
    )
    context = V3ConversationContext(
        conversation_id="conv",
        active_process="parteDiario",
        process_state=state.to_dict(),
    )

    result = await process._handle_parte_diario(_message("no hay mas"), context, state)

    assert result.metadata["status"] == "saved_probe"
    assert "Cerrar definitivamente?" not in (result.reply_text or "")


def test_parte_diario_v3_sin_novedades_con_novedades_equivale_a_fin_carga():
    state = ParteDiarioDraft(
        oportunidad_id=1,
        idproyecto=1,
        fecha="2026-08-10",
        novedades=[NovedadPersonal(nombre="Peralta, Lorena", estado_codigo="ACC", horas=0)],
    )

    result = execute_plan(
        state,
        TurnPlan(operations=[ParteDiarioOperation(type="sin_novedades")]),
        [],
        [],
        [],
    )

    assert result.status == "confirmation_required"
    assert "Parte diario para confirmar" in result.reply
    assert "Ya hay novedades cargadas" not in result.reply


@pytest.mark.asyncio
async def test_parte_diario_v3_initial_plain_command_does_not_infer_explicit_today():
    class FailingInitialDateLLM(FakeParteDiarioLLM):
        async def normalize_initial_request(self, mensaje):
            raise AssertionError("No debe normalizar fecha para comando sin referencia temporal")

    process = ParteDiarioSubprocess(llm_client=FailingInitialDateLLM(TurnPlan()))
    state = ParteDiarioV3State()

    await process._infer_initial_date_text("parte diario", state)

    assert state.draft().fecha is None
    assert state.fecha_objetivo is None
    assert state.fecha_referida_explicita is False


@pytest.mark.asyncio
async def test_parte_diario_v3_weekday_only_loads_oldest_open_matching_pending(monkeypatch):
    def fake_build_fecha_options(proyecto_id, *, contacto_id=None, today=None, days=7):
        assert days == 10
        return [
            ParteDiarioFechaOption(opcion=1, fecha="2026-08-10", estado="sin cargar"),
            ParteDiarioFechaOption(opcion=2, fecha="2026-08-08", estado="borrador"),
            ParteDiarioFechaOption(opcion=3, fecha="2026-08-01", estado="sin cargar"),
        ]

    class ProbeProcess(ParteDiarioSubprocess):
        def _aplicar_fecha(self, state, *, allow_closed=False):
            state.etapa = "carga"
            state.set_draft(state.draft())
            return None

        def _draft_fecha_is_closed(self, draft):
            return False

    monkeypatch.setattr(ParteDiarioSubprocess, "_build_fecha_options", staticmethod(fake_build_fecha_options))
    process = ProbeProcess(llm_client=FakeParteDiarioLLM(TurnPlan()))
    state = ParteDiarioV3State(
        contacto_id=5,
        oportunidad_id=10,
        proyecto_id=100,
        nombre_obra="Obra Centro",
    )
    await process._infer_initial_date_text("parte del sabado", state)

    result = await process._preparar_fecha(V3ConversationContext(conversation_id="conv-weekday"), state)

    assert result.context.process_state["parte_state"]["fecha"] == "2026-08-01"
    assert result.context.process_state["fecha_objetivo"] == "2026-08-01"
    assert "Fecha: sabado 01/08/2026" in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_weekday_only_returns_closed_message_when_no_open_match(monkeypatch):
    def fake_build_fecha_options(proyecto_id, *, contacto_id=None, today=None, days=7):
        assert days == 10
        return [
            ParteDiarioFechaOption(opcion=1, fecha="2026-08-08", estado="confirmado"),
            ParteDiarioFechaOption(opcion=2, fecha="2026-08-01", estado="cerrado"),
        ]

    monkeypatch.setattr(ParteDiarioSubprocess, "_build_fecha_options", staticmethod(fake_build_fecha_options))
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))
    state = ParteDiarioV3State(
        contacto_id=5,
        oportunidad_id=10,
        proyecto_id=100,
        nombre_obra="Obra Centro",
    )
    await process._infer_initial_date_text("parte del sabado", state)

    result = await process._preparar_fecha(V3ConversationContext(conversation_id="conv-weekday-closed"), state)

    assert result.context.active_process is None
    assert "El parte de sabado de los ultimos 10 dias ya esta cerrado." in (result.reply_text or "")


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
async def test_parte_diario_v3_partes_pendientes_in_load_uses_query_agent(monkeypatch):
    class DummySession:
        def __init__(self, _engine):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr(parte_diario_handler, "Session", DummySession)
    query_agent = FakeParteDiarioQueryAgent("Partes pendientes:\n- 09/08/2026: sin cargar")
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(TurnPlan(operations=[ParteDiarioOperation(type="mostrar_nomina")])),
        query_agent_client=query_agent,
    )
    state = ParteDiarioDraft(
        oportunidad_id=10,
        idproyecto=100,
        fecha="2026-08-10",
    )
    context = V3ConversationContext(
        conversation_id="conv-pending-active",
        active_process="parteDiario",
        process_state={
            "etapa": "carga",
            "contacto_id": 5,
            "oportunidad_id": 10,
            "proyecto_id": 100,
            "nombre_obra": "Obra Centro",
            "parte_state": state.to_dict(),
        },
    )

    result = await process.handle(_message("partes pendientes"), context)

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "carga"
    assert result.metadata["status"] == "contextual_query"
    assert "Partes pendientes:" in (result.reply_text or "")
    assert "*NOMINA ACTIVA*" not in (result.reply_text or "")
    assert "Hay alguna otra novedad?" in (result.reply_text or "")
    assert query_agent.calls[-1]["message_text"] == "partes pendientes"


@pytest.mark.asyncio
async def test_parte_diario_v3_show_nomina_in_load_keeps_selected_project_context(seeded_parte_v3):
    state = ParteDiarioDraft(
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
    assert "Garcia Juan" in (result.reply_text or "")
    assert "Hay alguna otra novedad?" in (result.reply_text or "")
    assert "Opciones: 1:GUARDAR 2:CERRAR 3:SALIR." not in (result.reply_text or "")


def test_parte_diario_query_service_answers_absences_report_and_pending(
    db_session: Session,
    monkeypatch,
    seeded_parte_v3,
):
    monkeypatch.setattr("agente.v3.subprocesses.parte_diario.utils.calendario.hoy", lambda: date(2026, 5, 16))
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

    absences = service.consultar_novedades(
        persona="Garcia", desde="2026-05-01", hasta="2026-05-16", horas_igual_a=0, agrupar_por="persona",
    )
    all_absences = service.consultar_novedades(desde="2026-05-01", hasta="2026-05-16", horas_igual_a=0)
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
    report = service.consultar_partes(desde="2026-05-16", hasta="2026-05-16")
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
    assert "16/05/2026: borrador" in report
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


def test_parte_diario_query_service_hides_nomina_internal_states(
    db_session: Session,
    monkeypatch,
    seeded_parte_v3,
):
    monkeypatch.setattr("agente.v3.subprocesses.parte_diario.utils.calendario.hoy", lambda: date(2026, 9, 3))
    enfermedad = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "ENF")
    ).one()
    baja = db_session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == "BAJ")
    ).one()
    traspaso = ParteDiarioEstado(abreviatura="TRA", nombre="TRASPASO")
    alta = ParteDiarioEstado(abreviatura="ALT", nombre="ALTA")
    db_session.add_all([traspaso, alta])
    db_session.flush()
    sick_employee = Nomina(
        nombre="Diego",
        apellido="Cabrera",
        dni="parte-v3-query-enf",
        idproyecto=seeded_parte_v3["project"].id,
    )
    transfer_employee = Nomina(
        nombre="Jorge",
        apellido="Acosta",
        dni="parte-v3-query-tra",
        idproyecto=seeded_parte_v3["project"].id,
    )
    high_employee = Nomina(
        nombre="Falcon",
        apellido="Ruiz",
        dni="parte-v3-query-alt",
        idproyecto=seeded_parte_v3["project"].id,
    )
    low_employee = Nomina(
        nombre="Luis",
        apellido="Conti",
        dni="parte-v3-query-baj",
        idproyecto=seeded_parte_v3["project"].id,
    )
    db_session.add_all([sick_employee, transfer_employee, high_employee, low_employee])
    db_session.flush()
    parte = ParteDiario(
        idproyecto=seeded_parte_v3["project"].id,
        contacto_id=seeded_parte_v3["contact"].id,
        fecha=date(2026, 9, 3),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add(parte)
    db_session.flush()
    db_session.add_all(
        [
            ParteDiarioDetalle(
                parte_diario_id=parte.id,
                idnomina=sick_employee.id,
                idestado=enfermedad.id,
                horas=Decimal("0"),
                descripcion="enfermo",
                origen=OrigenDetalle.AGENTE,
            ),
            ParteDiarioDetalle(
                parte_diario_id=parte.id,
                idnomina=transfer_employee.id,
                idestado=traspaso.id,
                horas=Decimal("0"),
                descripcion='{"tipo":"traspaso"}',
                origen=OrigenDetalle.AGENTE,
            ),
            ParteDiarioDetalle(
                parte_diario_id=parte.id,
                idnomina=high_employee.id,
                idestado=alta.id,
                horas=Decimal("9"),
                descripcion="alta",
                origen=OrigenDetalle.AGENTE,
            ),
            ParteDiarioDetalle(
                parte_diario_id=parte.id,
                idnomina=low_employee.id,
                idestado=baja.id,
                horas=Decimal("0"),
                descripcion="baja",
                origen=OrigenDetalle.AGENTE,
            ),
        ]
    )
    db_session.commit()
    service = ParteDiarioQueryService(
        session=db_session,
        proyecto_id=seeded_parte_v3["project"].id,
        contacto_id=seeded_parte_v3["contact"].id,
        nombre_obra="Obra Centro",
    )

    all_novelties = service.consultar_novedades(desde="2026-09-03", hasta="2026-09-03")

    assert "Cabrera, Diego: ENF, 0h, motivo: enfermo" in all_novelties
    for hidden in ["Acosta, Jorge", "Ruiz, Falcon", "Conti, Luis", "TRA", "ALT", "BAJ", "traspaso"]:
        assert hidden not in all_novelties


def test_parte_diario_query_service_treats_pendiente_as_borrador_and_sin_cargar():
    service = ParteDiarioQueryService.__new__(ParteDiarioQueryService)
    service._nombre_obra = "Obra Centro"

    def fake_query_partes(start, end):
        return [
            SimpleNamespace(fecha=date(2026, 8, 10), estado=EstadoParteDiario.CONFIRMADO),
            SimpleNamespace(fecha=date(2026, 8, 9), estado=EstadoParteDiario.BORRADOR),
        ]

    service._query_partes = fake_query_partes

    report = service.consultar_partes(
        desde="2026-08-08",
        hasta="2026-08-10",
        estado_parte="pendiente",
    )

    assert report == "Partes pendientes:\n- 08/08/2026: sin cargar"


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
    assert "Parte diario recuperado" in (selected.reply_text or "")
    assert "Obra: Obra Centro" in (selected.reply_text or "")
    assert "Queres agregar o corregir alguna novedad?" in (selected.reply_text or "")


def test_parte_diario_v3_recovers_internal_novelty_as_non_editable(
    db_session: Session,
    seeded_parte_v3,
):
    alta = ParteDiarioEstado(abreviatura="ALT", nombre="ALTA", activo=False)
    parte = ParteDiario(
        idproyecto=seeded_parte_v3["project"].id,
        fecha=date(2026, 8, 28),
        estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add_all([alta, parte])
    db_session.flush()
    db_session.add(
        ParteDiarioDetalle(
            parte_diario_id=parte.id,
            idnomina=seeded_parte_v3["employee_1"].id,
            idestado=alta.id,
            horas=Decimal("9"),
            descripcion="17",
            origen=OrigenDetalle.AGENTE,
        )
    )
    db_session.commit()
    state = ParteDiarioDraft(
        oportunidad_id=seeded_parte_v3["opportunity"].id,
        idproyecto=seeded_parte_v3["project"].id,
        contacto_id=seeded_parte_v3["contact"].id,
    )
    estados = parte_diario_domain.cargar_estados(db_session)

    error = parte_diario_domain.aplicar_fecha(db_session, state, "2026-08-28", estados)

    assert error is None
    assert state.parte_id == parte.id
    assert state.novedades == []
    assert state.novedades_internas[0].estado_codigo == "ALT"
    assert state.novedades_internas[0].descripcion is None


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
async def test_parte_diario_v3_initial_referenced_date_survives_project_selection(monkeypatch):
    target_date = "2026-08-06"
    monkeypatch.setattr(parte_diario_handler, "_today", lambda: date(2026, 8, 10))

    class InferAfterProjectLLM(FakeParteDiarioLLM):
        async def interpret_turn(self, mensaje, state, nominas_proyecto, estados, *, contexto_conversacion=None):
            return TurnPlan(operations=[ParteDiarioOperation(type="set_fecha", fecha=target_date)])

    class ProbeProcess(ParteDiarioSubprocess):
        async def _preparar_fecha(self, context, state, *, reply_on_success=True, emisor=None):
            return self._active_result(
                context,
                state,
                f"fecha={state.draft().fecha}",
                "prepared_probe",
            )

    options = [
        parte_diario_handler.ParteDiarioOption(1, "Catamarca", 1, 10, 100),
        parte_diario_handler.ParteDiarioOption(2, "AXION", 1, 20, 200),
        parte_diario_handler.ParteDiarioOption(3, "Francia 118", 1, 30, 300),
    ]
    monkeypatch.setattr(ProbeProcess, "_resolve_obra_options", staticmethod(lambda phone: options))
    process = ProbeProcess(llm_client=InferAfterProjectLLM(TurnPlan()))

    requested = await process.handle(
        _message("parte diario del jueves"),
        V3ConversationContext(conversation_id="conv-explicit-date"),
    )
    selected = await process.handle(_message("3"), requested.context)

    assert requested.context.process_state["parte_state"]["fecha"] == target_date
    assert requested.context.process_state["texto_fecha_inicial"] == "parte diario del jueves"
    assert selected.metadata["status"] == "prepared_probe"
    assert selected.context.process_state["parte_state"]["fecha"] == target_date
    assert selected.context.process_state["fecha_objetivo"] == target_date
    assert selected.context.process_state["fecha_referida_explicita"] is True
    assert selected.reply_text == f"fecha={target_date}"


@pytest.mark.asyncio
async def test_parte_diario_v3_initial_message_selects_project_by_name(monkeypatch):
    class ProbeProcess(ParteDiarioSubprocess):
        async def _preparar_fecha(self, context, state, *, reply_on_success=True, emisor=None):
            assert reply_on_success is True
            return self._active_result(
                context,
                state,
                f"obra={state.nombre_obra}",
                "prepared_probe",
            )

        async def _handle_carga(self, message, context, state):
            pytest.fail("initial project shortcut must not reuse the command text as carga input")

    monkeypatch.setattr(
        ProbeProcess,
        "_resolve_obra_options",
        staticmethod(
            lambda phone: [
                parte_diario_handler.ParteDiarioOption(1, "Catamarca y Corrientes", 1, 10, 100),
                parte_diario_handler.ParteDiarioOption(2, "AXION - Emilio Castelar 1003", 1, 20, 200),
                parte_diario_handler.ParteDiarioOption(3, "Francia 118", 1, 30, 300),
            ]
        ),
    )
    process = ProbeProcess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(
        _message("parte diario francia"),
        V3ConversationContext(conversation_id="conv-project-name"),
    )

    assert result.metadata["status"] == "prepared_probe"
    assert result.context.process_state["proyecto_id"] == 300
    assert result.context.process_state["nombre_obra"] == "Francia 118"
    assert "En que obra" not in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_initial_message_selects_project_and_embedded_date(monkeypatch):
    monkeypatch.setattr(parte_diario_handler, "_today", lambda: date(2026, 9, 8))

    class ProbeProcess(ParteDiarioSubprocess):
        async def _preparar_fecha(self, context, state, *, reply_on_success=True, emisor=None):
            return self._active_result(
                context,
                state,
                f"fecha={state.draft().fecha}; obra={state.nombre_obra}",
                "prepared_probe",
            )

        async def _handle_carga(self, message, context, state):
            pytest.fail("initial project shortcut must not reuse the command text as carga input")

    monkeypatch.setattr(
        ProbeProcess,
        "_resolve_obra_options",
        staticmethod(
            lambda phone: [
                parte_diario_handler.ParteDiarioOption(1, "Catamarca y Corrientes", 1, 10, 100),
                parte_diario_handler.ParteDiarioOption(2, "AXION - Emilio Castelar 1003", 1, 20, 200),
                parte_diario_handler.ParteDiarioOption(3, "Francia 118", 1, 30, 300),
            ]
        ),
    )
    process = ProbeProcess(llm_client=FailingParteDiarioLLM())

    result = await process.handle(
        _message("parte diario francia 01/09"),
        V3ConversationContext(conversation_id="conv-project-name-date"),
    )

    assert result.metadata["status"] == "prepared_probe"
    assert result.context.process_state["proyecto_id"] == 300
    assert result.context.process_state["nombre_obra"] == "Francia 118"
    assert result.context.process_state["parte_state"]["fecha"] == "2026-09-01"
    assert result.context.process_state["fecha_objetivo"] == "2026-09-01"
    assert result.context.process_state["fecha_referida_explicita"] is True
    assert result.reply_text == "fecha=2026-09-01; obra=Francia 118"


@pytest.mark.asyncio
async def test_parte_diario_v3_single_project_initial_command_uses_standard_start_reply(monkeypatch):
    monkeypatch.setattr(parte_diario_handler, "_today", lambda: date(2026, 9, 8))

    class ProbeProcess(ParteDiarioSubprocess):
        async def _preparar_fecha(self, context, state, *, reply_on_success=True, emisor=None):
            assert reply_on_success is True
            return self._active_result(
                context,
                state,
                f"fecha={state.draft().fecha}; obra={state.nombre_obra}",
                "prepared_probe",
            )

        async def _handle_carga(self, message, context, state):
            pytest.fail("single-project initial command must not be treated as carga input")

    monkeypatch.setattr(
        ProbeProcess,
        "_resolve_obra_options",
        staticmethod(
            lambda phone: [
                parte_diario_handler.ParteDiarioOption(1, "AXION - Emilio Castelar 1003", 1, 20, 200),
            ]
        ),
    )
    process = ProbeProcess(llm_client=FailingParteDiarioLLM())

    result = await process.handle(
        _message("parte diario AXION - Emilio Castelar 1003 01/09/2026"),
        V3ConversationContext(conversation_id="conv-single-project-start"),
    )

    assert result.metadata["status"] == "prepared_probe"
    assert result.context.process_state["proyecto_id"] == 200
    assert result.context.process_state["nombre_obra"] == "AXION - Emilio Castelar 1003"
    assert result.context.process_state["parte_state"]["fecha"] == "2026-09-01"
    assert result.context.process_state["fecha_objetivo"] == "2026-09-01"
    assert result.context.process_state["fecha_referida_explicita"] is True
    assert result.reply_text == "fecha=2026-09-01; obra=AXION - Emilio Castelar 1003"


@pytest.mark.asyncio
async def test_parte_diario_v3_obra_selection_accepts_project_name():
    class ProbeProcess(ParteDiarioSubprocess):
        async def _preparar_fecha(self, context, state, *, reply_on_success=True, emisor=None):
            return self._active_result(
                context,
                state,
                f"obra={state.nombre_obra}",
                "prepared_probe",
            )

    state = ParteDiarioV3State(
        etapa="seleccionar_obra",
        opciones_obra=[
            parte_diario_handler.ParteDiarioOption(1, "Catamarca y Corrientes", 1, 10, 100),
            parte_diario_handler.ParteDiarioOption(2, "AXION - Emilio Castelar 1003", 1, 20, 200),
            parte_diario_handler.ParteDiarioOption(3, "Francia 118", 1, 30, 300),
        ],
    )
    context = V3ConversationContext(
        conversation_id="conv-project-name-selection",
        active_process="parteDiario",
        process_state=state.to_dict(),
    )
    process = ProbeProcess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(_message("francia"), context)

    assert result.metadata["status"] == "prepared_probe"
    assert result.context.process_state["proyecto_id"] == 300
    assert result.context.process_state["nombre_obra"] == "Francia 118"


@pytest.mark.asyncio
async def test_parte_diario_v3_explicit_closed_date_is_query(monkeypatch):
    target_date = "2026-08-06"

    class ClosedProbeProcess(ParteDiarioSubprocess):
        def _aplicar_fecha(self, state, *, allow_closed=False):
            assert allow_closed is True
            draft = state.draft()
            draft.fecha = target_date
            draft.parte_id = 44
            draft.sin_novedades_informado = True
            state.set_draft(draft)
            state.etapa = "carga"
            return None

        def _draft_fecha_is_closed(self, draft):
            return True

    state = ParteDiarioV3State(
        etapa="seleccionar_fecha",
        contacto_id=1,
        oportunidad_id=10,
        proyecto_id=100,
        nombre_obra="Francia 118",
        fecha_referida_explicita=True,
        fecha_objetivo=target_date,
        parte_state=ParteDiarioDraft(oportunidad_id=10, idproyecto=100, fecha=target_date).to_dict(),
    )
    process = ClosedProbeProcess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process._preparar_fecha(V3ConversationContext(conversation_id="conv-closed-explicit"), state)

    assert result.context.active_process is None
    assert result.metadata["status"] == "closed_date_selected"
    assert result.metadata["fecha"] == target_date
    assert "*PARTE DIARIO GUARDADO*" in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_target_date_close_finishes_flow():
    state = ParteDiarioV3State(
        etapa="carga",
        contacto_id=1,
        oportunidad_id=10,
        proyecto_id=100,
        nombre_obra="Francia 118",
        fecha_objetivo="2026-08-05",
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process._post_action_result(
        V3ConversationContext(conversation_id="conv-target-close", active_process="parteDiario"),
        state,
        "cerrado",
        "confirmed",
        {"result": {"fecha": "2026-08-05", "cerrar_parte": True}},
    )

    assert result.context.active_process is None
    assert result.reply_text == "cerrado"
    assert result.metadata["status"] == "confirmed"


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
    assert "Cerrar definitivamente?" in (result.reply_text or "")
    assert "SI cierra el parte. NO lo deja pendiente." in (result.reply_text or "")
    buttons = result.metadata["outbound"]["interactive"]["action"]["buttons"]
    assert [button["reply"]["id"] for button in buttons] == ["si", "no"]


@pytest.mark.asyncio
async def test_parte_diario_v3_active_selected_date_is_not_overwritten_by_today_reference(seeded_parte_v3):
    selected_date = (_today() - timedelta(days=2)).isoformat()
    today = _today().isoformat()
    draft = ParteDiarioDraft(
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
    state = ParteDiarioDraft(
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
    state = ParteDiarioDraft(
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
    state = ParteDiarioDraft(
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
    state = ParteDiarioDraft(
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
    state = ParteDiarioDraft(
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
    state = ParteDiarioDraft(
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
    state = ParteDiarioDraft(
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
    state = ParteDiarioDraft(
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
    assert selected.context.process_state["parte_state"]["fecha"] == dia_operativo_anterior(_today()).isoformat()
    assert selected.context.process_state["parte_state"]["novedades"] == []
    assert "Parte diario en carga" in (selected.reply_text or "")
    assert "Que novedades hubo ese dia?" in (selected.reply_text or "")
    assert "Opciones: 1:GUARDAR 2:CERRAR 3:SALIR." not in (selected.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_empty_part_close_requires_confirmation(seeded_parte_v3):
    state = ParteDiarioDraft(
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
    assert "Cerrar definitivamente?" in (review.reply_text or "")
    assert "SI cierra el parte. NO lo deja pendiente." in (review.reply_text or "")
    buttons = review.metadata["outbound"]["interactive"]["action"]["buttons"]
    assert [button["reply"]["id"] for button in buttons] == ["si", "no"]
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
    state = ParteDiarioDraft(
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
    assert "Carga finalizada para el parte de hoy, sabado 30/05/2026." in (result.reply_text or "")
    assert "borrador" not in (result.reply_text or "").lower()
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
    state = ParteDiarioDraft(
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
    assert "Carga finalizada para el parte" in (saved.reply_text or "")
    assert "borrador" not in (saved.reply_text or "").lower()
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
    state = ParteDiarioDraft(
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
    state = ParteDiarioDraft(
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


def test_parte_diario_v3_resolver_finds_similar_for_unresolved_name(seeded_parte_v3):
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


def test_parte_diario_v3_pending_last_days_message_is_ordered_and_conversational(monkeypatch):
    def fake_build_fecha_options(proyecto_id, *, contacto_id=None, today=None, days=7):
        assert proyecto_id == 100
        assert contacto_id == 5
        assert days == 10
        return [
            ParteDiarioFechaOption(opcion=1, fecha="2026-08-10", estado="sin cargar"),
            ParteDiarioFechaOption(opcion=2, fecha="2026-08-09", estado="sin cargar"),
            ParteDiarioFechaOption(opcion=3, fecha="2026-08-08", estado="borrador"),
            ParteDiarioFechaOption(opcion=4, fecha="2026-08-07", estado="sin cargar"),
        ]

    monkeypatch.setattr(ParteDiarioSubprocess, "_build_fecha_options", staticmethod(fake_build_fecha_options))
    state = ParteDiarioV3State(proyecto_id=100, contacto_id=5)

    messages = parte_diario_handler._pending_parts_last_days_messages(
        state,
        exclude_fechas={"2026-08-10"},
    )

    assert len(messages) == 1
    assert messages[0].text == (
        "Te quedan pendientes estos partes de los ultimos 10 dias: "
        "viernes 07/08/2026, sabado 08/08/2026."
    )


@pytest.mark.asyncio
async def test_parte_diario_v3_auto_open_today_after_previous_close_does_not_show_pending_list(monkeypatch):
    def fail_pending_messages(*args, **kwargs):
        raise AssertionError("No debe consultar pendientes antes de abrir hoy automaticamente")

    class ProbeProcess(ParteDiarioSubprocess):
        async def _auto_open_today_after_previous_close(
            self,
            context,
            state,
            reply,
            status,
            metadata,
            additional_messages=None,
        ):
            assert additional_messages == []
            return V3ProcessResult(
                context=context,
                reply_text=reply,
                metadata=metadata,
                additional_messages=[V3ProcessMessage(text="Ahora seguimos con el parte de hoy.")],
            )

    monkeypatch.setattr(parte_diario_handler, "_pending_parts_last_days_messages", fail_pending_messages)
    state = ParteDiarioV3State(
        proyecto_id=100,
        contacto_id=5,
        fecha_objetivo="2026-08-10",
        fecha_referida_explicita=False,
    )
    process = ProbeProcess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process._post_action_result(
        V3ConversationContext(conversation_id="conv-auto-today"),
        state,
        "cerrado",
        "confirmed",
        {"result": {"fecha": "2026-08-08", "cerrar_parte": True}},
    )

    assert result.additional_messages[0].text == "Ahora seguimos con el parte de hoy."


@pytest.mark.asyncio
async def test_parte_diario_v3_today_draft_save_shows_pending_list(monkeypatch):
    monkeypatch.setattr(parte_diario_handler, "_today", lambda: date(2026, 8, 10))
    monkeypatch.setattr(
        parte_diario_handler,
        "_pending_parts_last_days_options",
        lambda *args, **kwargs: [ParteDiarioFechaOption(opcion=1, fecha="2026-08-07", estado="sin cargar")],
    )
    state = ParteDiarioV3State(proyecto_id=100, contacto_id=5, nombre_obra="Obra Centro")
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process._post_action_result(
        V3ConversationContext(conversation_id="conv-save-today"),
        state,
        "guardado",
        "saved",
        {"result": {"fecha": "2026-08-10", "cerrar_parte": False}},
    )

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "pendientes"
    assert result.additional_messages == []
    assert "Te queda 1 parte pendiente de los ultimos 10 dias." in result.reply_text
    assert "Cual queres cargar?" in result.reply_text
    assert "1: viernes 07/08/2026" in result.reply_text


@pytest.mark.asyncio
async def test_parte_diario_v3_pending_stage_uses_selected_work_without_asking_again():
    class ProbeProcess(ParteDiarioSubprocess):
        def _aplicar_fecha(self, state, *, allow_closed=False):
            state.etapa = "carga"
            state.set_draft(state.draft())
            return None

        def _draft_fecha_is_closed(self, draft):
            return False

    state = ParteDiarioV3State(
        etapa="pendientes",
        contacto_id=5,
        oportunidad_id=10,
        proyecto_id=100,
        nombre_obra="Francia 118",
        opciones_fecha=[
            ParteDiarioFechaOption(opcion=1, fecha="2026-08-06", estado="sin cargar"),
            ParteDiarioFechaOption(opcion=2, fecha="2026-08-07", estado="sin cargar"),
        ],
    )
    context = V3ConversationContext(
        conversation_id="conv-pending-stage",
        active_process="parteDiario",
        process_state=state.to_dict(),
    )
    process = ProbeProcess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(_message("parte del jueves"), context)

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "carga"
    assert result.context.process_state["proyecto_id"] == 100
    assert result.context.process_state["nombre_obra"] == "Francia 118"
    assert result.context.process_state["parte_state"]["fecha"] == "2026-08-06"
    assert "En que obra" not in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_parte_pendiente_starts_pending_stage(monkeypatch):
    monkeypatch.setattr(
        ParteDiarioSubprocess,
        "_resolve_obra_options",
        staticmethod(lambda phone: [parte_diario_handler.ParteDiarioOption(1, "Francia 118", 5, 10, 100)]),
    )
    monkeypatch.setattr(
        parte_diario_handler,
        "_pending_parts_last_days_options",
        lambda *args, **kwargs: [
            ParteDiarioFechaOption(opcion=1, fecha="2026-08-06", estado="sin cargar"),
            ParteDiarioFechaOption(opcion=2, fecha="2026-08-07", estado="borrador"),
        ],
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(_message("parte pendiente"), V3ConversationContext(conversation_id="conv-pending-command"))

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "pendientes"
    assert result.context.process_state["proyecto_id"] == 100
    assert result.context.process_state["nombre_obra"] == "Francia 118"
    assert result.context.process_state["modo_pendientes"] is False
    assert "Te quedan 2 partes pendientes de los ultimos 10 dias." in (result.reply_text or "")
    assert "1: jueves 06/08/2026" in (result.reply_text or "")
    assert "2: viernes 07/08/2026" in (result.reply_text or "")
    assert "Parte diario en carga:" not in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_parte_pendiente_survives_project_selection(monkeypatch):
    monkeypatch.setattr(
        ParteDiarioSubprocess,
        "_resolve_obra_options",
        staticmethod(
            lambda phone: [
                parte_diario_handler.ParteDiarioOption(1, "Catamarca", 5, 10, 100),
                parte_diario_handler.ParteDiarioOption(2, "Francia 118", 5, 20, 200),
            ]
        ),
    )
    monkeypatch.setattr(
        parte_diario_handler,
        "_pending_parts_last_days_options",
        lambda state, **kwargs: [ParteDiarioFechaOption(opcion=1, fecha="2026-08-07", estado="sin cargar")],
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    requested = await process.handle(
        _message("parte pendiente"),
        V3ConversationContext(conversation_id="conv-pending-command-menu"),
    )
    selected = await process.handle(_message("2"), requested.context)

    assert requested.context.process_state["etapa"] == "seleccionar_obra"
    assert requested.context.process_state["modo_pendientes"] is True
    assert selected.context.active_process == "parteDiario"
    assert selected.context.process_state["etapa"] == "pendientes"
    assert selected.context.process_state["proyecto_id"] == 200
    assert selected.context.process_state["nombre_obra"] == "Francia 118"
    assert "1: viernes 07/08/2026" in (selected.reply_text or "")
    assert "Parte diario en carga:" not in (selected.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_parte_pendiente_without_pending_parts_finishes(monkeypatch):
    monkeypatch.setattr(
        ParteDiarioSubprocess,
        "_resolve_obra_options",
        staticmethod(lambda phone: [parte_diario_handler.ParteDiarioOption(1, "Francia 118", 5, 10, 100)]),
    )
    monkeypatch.setattr(parte_diario_handler, "_pending_parts_last_days_options", lambda *args, **kwargs: [])
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(_message("parte pendiente"), V3ConversationContext(conversation_id="conv-no-pending"))

    assert result.context.active_process is None
    assert result.context.process_state == {}
    assert result.metadata["status"] == "no_pending_parts"
    assert "No quedan partes pendientes de los ultimos 10 dias." in (result.reply_text or "")


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


def test_parte_diario_v3_candidate_selection_ignores_accents():
    candidates = [
        NominaItem(idnomina=1, nombre="Iván", apellido="Medina"),
        NominaItem(idnomina=2, nombre="Juan Manuel", apellido="Medina"),
    ]

    selected = parse_candidate_selection("ivan", candidates)

    assert selected is not None
    assert selected.idnomina == 1


def test_parte_diario_v3_normalize_text_repairs_common_mojibake_accents():
    assert normalize_text("IvÃ¡n") == "ivan"
    assert normalize_text("Iván") == "ivan"


def test_parte_diario_v3_resumen_omits_absence_zero_hours_legajo_and_shortens_external_project():
    state = ParteDiarioDraft(
        oportunidad_id=1,
        idproyecto=10,
        fecha="2026-08-01",
        novedades=[
            NovedadPersonal(
                nombre="Serrano, Juan David",
                estado_codigo="FAL",
                horas=0,
                idnomina=24,
                nro_legajo="501183",
            ),
            NovedadPersonal(
                nombre="Medina, Ivan",
                estado_codigo="FAL",
                horas=0,
                idnomina=25,
                fuera_de_proyecto=True,
                nombre_proyecto="AXION - Emilio Castelar 1003",
            ),
        ],
    )

    reply = renderer.resumen(state)

    assert "- Serrano, Juan David: FAL" in reply
    assert "Serrano, Juan David: FAL, 0h" not in reply
    assert "legajo" not in reply
    assert "- Medina, Ivan (AXION): FAL" in reply


def test_parte_diario_v3_resumen_hides_nomina_internal_states():
    state = ParteDiarioDraft(
        oportunidad_id=1,
        idproyecto=10,
        fecha="2026-09-03",
        novedades=[
            NovedadPersonal(
                nombre="Acosta, Jorge",
                estado_codigo="TRA",
                horas=0,
                descripcion='{"tipo":"traspaso"}',
            ),
            NovedadPersonal(
                nombre="Ruiz, Falcon",
                estado_codigo="ALT",
                horas=9,
                descripcion="alta",
            ),
            NovedadPersonal(
                nombre="Conti, Luis",
                estado_codigo="BAJ",
                horas=0,
                descripcion="baja",
            ),
            NovedadPersonal(
                nombre="Cabrera, Diego",
                estado_codigo="ENF",
                horas=0,
                descripcion="enfermo",
            ),
        ],
        pendientes_ambiguos=[
            PendienteAmbiguo(nombre="Fernandez, Karina", estado_codigo="TRA", descripcion="traspaso"),
        ],
    )

    reply = renderer.confirmado(state)

    assert "Cabrera, Diego (sin validar): ENF, 0h, motivo: enfermo" in reply
    assert "Acosta, Jorge" not in reply
    assert "Ruiz, Falcon" not in reply
    assert "Conti, Luis" not in reply
    assert "Fernandez, Karina" not in reply
    assert "traspaso" not in reply


def test_parte_diario_v3_validation_without_candidates_allows_retry_none_or_new_load():
    pending = PendienteAmbiguo(nombre="Medina", estado_codigo="FAL", nombre_no_encontrado=True)

    reply = parte_diario_handler._validation_text_menu(pending)

    assert "No encontre a Medina en la nomina activa." in reply
    assert "Volve a ingresar el nombre" in reply
    assert "NINGUNO" in reply
    assert "informa la nueva novedad" in reply


def test_parte_diario_v3_validation_shows_otros_before_external_candidates():
    pending = PendienteAmbiguo(
        nombre="Medina",
        estado_codigo="FAL",
        candidatos=[
            NominaItem(idnomina=1, nombre="Ivan", apellido="Medina"),
            NominaItem(idnomina=2, nombre="Juan", apellido="Medina"),
        ],
        candidatos_externos=[
            NominaItem(
                idnomina=3,
                nombre="Pedro",
                apellido="Medina",
                nombre_proyecto="La Rioja 474",
                fuera_de_proyecto=True,
            ),
        ],
    )

    first_reply = parte_diario_handler._validation_text_menu(pending)
    pending.mostrando_candidatos_externos = True
    other_reply = parte_diario_handler._validation_text_menu(pending)

    assert "Medina Ivan; Medina Juan." in first_reply
    assert "OTROS" in first_reply
    assert "Medina Pedro" not in first_reply
    assert "Otros Medina:" in other_reply
    assert "La Rio: Medina Pedro." in other_reply


@pytest.mark.asyncio
async def test_parte_diario_v3_validation_selects_compound_first_name(monkeypatch):
    pending = PendienteAmbiguo(
        nombre="medina",
        estado_codigo="FAL",
        candidatos=[
            NominaItem(idnomina=1, nombre="Iván", apellido="Medina"),
            NominaItem(idnomina=2, nombre="Juan Manuel", apellido="Medina"),
        ],
        lista_candidatos_mostrada=False,
    )
    state = ParteDiarioDraft(
        oportunidad_id=10,
        idproyecto=20,
        fecha="2026-08-04",
        pendientes_ambiguos=[pending],
        esperando="confirmacion_ambiguos",
        validacion_origen="carga",
    )
    context = V3ConversationContext(
        conversation_id="test",
        active_process="parteDiario",
        process_state={
            "etapa": "validacion",
            "contacto_id": 1,
            "oportunidad_id": 10,
            "proyecto_id": 20,
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))
    captured = {}

    async def fake_handle_parte_diario(message, context, state, *, forced_text=None, extra_result_metadata=None):
        captured["forced_text"] = forced_text
        captured["state"] = state.to_dict()
        return V3ProcessResult(context=context, reply_text="ok", metadata={})

    monkeypatch.setattr(process, "_handle_parte_diario", fake_handle_parte_diario)

    await process._handle_validacion(_message("juan manuel"), context, ParteDiarioV3State.from_dict(context.process_state))

    assert captured["forced_text"] == "2"
    assert captured["state"]["parte_state"]["pendientes_ambiguos"][0]["lista_candidatos_mostrada"] is True


@pytest.mark.asyncio
async def test_parte_diario_v3_validation_list_with_ten_candidates_has_no_more(seeded_parte_v3):
    candidates = [
        NominaItem(idnomina=100 + index, nombre=f"Nombre {index}", apellido="Gonzalez")
        for index in range(1, 11)
    ]
    state = ParteDiarioDraft(
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

    assert "Gonzalez Nombre 1" in (options.reply_text or "")
    assert "Gonzalez Nombre 10" in (options.reply_text or "")
    assert "Mostrar mas" not in (options.reply_text or "")
    assert "NINGUNO" in (options.reply_text or "")
    assert "Registrar gonzalez sin validar" not in (options.reply_text or "")
    assert "VOLVER" not in (options.reply_text or "")
    assert "outbound" not in options.metadata


@pytest.mark.asyncio
async def test_parte_diario_v3_validation_list_shows_names_and_selects_by_name(
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
    state = ParteDiarioDraft(
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
    selected = await process.handle(_message("Gonzalez Nombre 10", external_id="wamid-page-2"), first_page.context)

    assert "Gonzalez Nombre 1" in (first_page.reply_text or "")
    assert "Gonzalez Nombre 11" in (first_page.reply_text or "")
    assert "Ver mas resultados" not in (first_page.reply_text or "")
    assert "NINGUNO" in (first_page.reply_text or "")
    assert "VOLVER" not in (first_page.reply_text or "")
    assert selected.metadata["result"]["pendientes_ambiguos"] == []
    assert selected.metadata["result"]["novedades"][0]["idnomina"] == candidates[9].idnomina


@pytest.mark.asyncio
async def test_parte_diario_v3_validation_list_shows_external_candidates_after_otros(
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
    state = ParteDiarioDraft(
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
    other_page = await process.handle(_message("OTROS", external_id="wamid-other-page"), project_page.context)

    assert "Medina Juan" in (project_page.reply_text or "")
    assert "Serrano Juan" in (project_page.reply_text or "")
    assert "NINGUNO" in (project_page.reply_text or "")
    assert "OTROS" in (project_page.reply_text or "")
    assert "Obra Norte" not in (project_page.reply_text or "")
    assert "Obra Sur" not in (project_page.reply_text or "")
    assert "Otros juan:" in (other_page.reply_text or "")
    assert "NORT: Medina Juan." in (other_page.reply_text or "")
    assert "SUR: Ruiz Juan." in (other_page.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_validation_list_shows_all_project_candidates(
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
    state = ParteDiarioDraft(
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

    assert "Medina Juan 1" in (first_page.reply_text or "")
    assert "Medina Juan 11" in (first_page.reply_text or "")
    assert "Externo Juan 1" not in (first_page.reply_text or "")
    assert "OTROS" in (first_page.reply_text or "")
    assert "Ver mas resultados" not in (first_page.reply_text or "")
    assert "NINGUNO" in (first_page.reply_text or "")
    assert "VOLVER" not in (first_page.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_load_asks_to_select_similar_pending_name(seeded_parte_v3):
    carga_agent = FakeParteDiarioCargaAgent(
        ParteDiarioCargaAgentOutput(
            action="seleccionar_persona",
            candidate_id=seeded_parte_v3["employee_2"].id,
        )
    )
    process = ParteDiarioSubprocess(
        llm_client=FakeParteDiarioLLM(
            TurnPlan(
                operations=[
                    ParteDiarioOperation(type="agregar_novedad", nombre="Petro", estado_codigo="FAL"),
                ]
            )
        ),
        carga_agent_client=carga_agent,
    )
    context = V3ConversationContext(conversation_id="meta:account:549111111")

    loaded = await process.handle(_message("Petro falto"), context)
    loaded_draft = loaded.context.process_state["parte_state"]
    assert loaded.context.process_state["etapa"] == "validacion_carga"
    assert loaded.context.process_state["validacion_origen"] == "carga"
    assert loaded.context.process_state["validacion_tipo"] == "persona"
    assert loaded.context.process_state["parte_state"]["esperando"] == "confirmacion_ambiguos"
    assert loaded_draft["validacion_origen"] == "carga"
    assert loaded_draft["pendientes_ambiguos"][0]["lista_candidatos_mostrada"] is True
    assert "A cual Petro te referis?" in (loaded.reply_text or "")
    assert "Perez Pedro" in (loaded.reply_text or "")
    assert "NINGUNO" in (loaded.reply_text or "")
    assert "Opciones: 1:CONFIRMAR" not in (loaded.reply_text or "")
    assert "VOLVER" not in (loaded.reply_text or "")
    assert "outbound" not in loaded.metadata

    selected = await process.handle(_message("Pedro Perez", external_id="wamid-test-3"), loaded.context)

    assert not carga_agent.calls
    assert selected.context.process_state["etapa"] == "carga"
    assert selected.context.process_state["validacion_origen"] is None
    assert selected.context.process_state["validacion_tipo"] is None
    assert selected.context.process_state["parte_state"]["esperando"] is None
    assert selected.context.process_state["parte_state"]["validacion_origen"] is None
    assert selected.metadata["carga_agent_source"] == "deterministic"
    assert selected.metadata["carga_agent_action"] == "seleccionar_persona"
    assert "Perez, Pedro: FAL" in (selected.reply_text or "")
    assert "Hay alguna otra novedad?" in (selected.reply_text or "")
    assert "Opcion 1" not in (loaded.reply_text or "")


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

    validating = await process.handle(_message("Petro falto"), context)
    loaded = await process.handle(_message("NINGUNO", external_id="wamid-test-3"), validating.context)

    assert loaded.context.process_state["etapa"] == "carga"
    assert loaded.context.process_state["validacion_origen"] is None
    assert loaded.context.process_state["validacion_tipo"] is None
    assert loaded.context.process_state["parte_state"]["esperando"] is None
    assert loaded.metadata["result"]["parte_listo"] is False
    assert "Petro quedo registrado sin validar" in (loaded.reply_text or "")
    assert "Petro (sin validar): FAL" in (loaded.reply_text or "")
    assert "Hay alguna otra novedad?" in (loaded.reply_text or "")

    result = await process.handle(_message("no", external_id="wamid-test-review"), loaded.context)

    assert result.context.process_state["etapa"] == "carga"
    assert result.context.process_state["validacion_origen"] is None
    assert result.context.process_state["validacion_tipo"] is None
    assert result.metadata["result"]["cerrar_parte"] is True
    assert "Petro (sin validar): FAL" in (result.reply_text or "")
    assert len(result.additional_messages) == 1
    assert "Ahora seguimos con el parte de hoy" in result.additional_messages[0].text
    parte_id = result.metadata["parte_diario_id"]
    details = db_session.exec(
        select(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == parte_id)
    ).all()
    provisional = next((detail for detail in details if detail.nombre_provisorio == "Petro"), None)
    assert provisional is not None
    assert provisional.idnomina is None
    assert provisional.horas == Decimal("0.00")


@pytest.mark.asyncio
async def test_parte_diario_v3_review_text_free_returns_to_load_and_processes_message(monkeypatch):
    state = ParteDiarioDraft(
        oportunidad_id=10,
        idproyecto=20,
        fecha=date(2026, 5, 30).isoformat(),
        sin_novedades_informado=True,
    )
    context = V3ConversationContext(
        conversation_id="meta:account:549111111",
        active_process="parteDiario",
        process_state={
            "etapa": "revision",
            "contacto_id": 1,
            "oportunidad_id": 10,
            "proyecto_id": 20,
            "nombre_obra": "Obra Centro",
            "parte_state": state.to_dict(),
        },
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))
    captured = {}

    async def fake_handle_carga(message, context, state):
        captured["message_text"] = message.text
        captured["etapa"] = state.etapa
        captured["draft"] = state.draft().to_dict()
        return V3ProcessResult(
            context=context,
            reply_text="Que novedad queres cargar?",
            metadata={},
        )

    monkeypatch.setattr(process, "_handle_carga", fake_handle_carga)

    result = await process.handle(_message("necesito cargar otra novedad"), context)

    assert captured["message_text"] == "necesito cargar otra novedad"
    assert captured["etapa"] == "carga"
    assert captured["draft"]["esperando"] is None
    assert captured["draft"]["validacion_origen"] is None
    assert result.metadata["interrupted_status"] == "review_interrupted"
    assert "En que obra" not in (result.reply_text or "")
    assert "Que novedad queres cargar?" in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_menu_salir_confirms_discard(seeded_parte_v3):
    state = ParteDiarioDraft(
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
    assert discarded.context.active_process == "general"
    assert discarded.context.process_state["agent_source"] == "parte_diario_exit_confirmed"
    assert "descartado" in (discarded.reply_text or "")
    assert "Selecciona la fecha del parte diario:" not in (discarded.reply_text or "")
    assert "1: PEDIDO OBRA" in (discarded.reply_text or "")
    assert "2: PARTE DIARIO" in (discarded.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_obra_selection_salir_returns_to_general():
    state = ParteDiarioV3State(
        etapa="seleccionar_obra",
        opciones_obra=[
            parte_diario_handler.ParteDiarioOption(1, "Catamarca", 1, 10, 100),
            parte_diario_handler.ParteDiarioOption(2, "Francia 118", 1, 20, 200),
        ],
    )
    context = V3ConversationContext(
        conversation_id="conv-obra-salir",
        active_process="parteDiario",
        process_state=state.to_dict(),
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(_message("salir"), context)

    assert result.context.active_process == "general"
    assert result.context.process_state["agent_source"] == "parte_diario_obra_selection"
    assert result.metadata["status"] == "returned_to_general"
    assert "Carga de parte diario cancelada." in (result.reply_text or "")
    assert "1: PEDIDO OBRA" in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_validacion_salir_confirms_discard():
    state = ParteDiarioV3State(
        etapa="validacion",
        contacto_id=1,
        oportunidad_id=10,
        proyecto_id=100,
        nombre_obra="Francia 118",
    )
    context = V3ConversationContext(
        conversation_id="conv-validacion-salir",
        active_process="parteDiario",
        process_state=state.to_dict(),
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(_message("salir"), context)

    assert result.context.active_process == "parteDiario"
    assert result.context.process_state["etapa"] == "confirmar_salida"
    assert result.metadata["status"] == "exit_confirmation"
    assert "Se perderan los cambios no guardados." in (result.reply_text or "")
    assert "Opciones: OK / VOLVER." in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_pendientes_salir_finishes_without_asking_project():
    state = ParteDiarioV3State(
        etapa="pendientes",
        contacto_id=1,
        oportunidad_id=10,
        proyecto_id=100,
        nombre_obra="Francia 118",
        opciones_fecha=[
            ParteDiarioFechaOption(opcion=1, fecha="2026-08-06", estado="sin cargar"),
        ],
    )
    context = V3ConversationContext(
        conversation_id="conv-pendientes-salir",
        active_process="parteDiario",
        process_state=state.to_dict(),
    )
    process = ParteDiarioSubprocess(llm_client=FakeParteDiarioLLM(TurnPlan()))

    result = await process.handle(_message("salir"), context)

    assert result.context.active_process is None
    assert result.context.process_state == {}
    assert result.metadata["status"] == "finished"
    assert "En que obra" not in (result.reply_text or "")


@pytest.mark.asyncio
async def test_parte_diario_v3_confirm_persists_part_and_crm_message(db_session: Session, seeded_parte_v3):
    state = ParteDiarioDraft(
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

    state = ParteDiarioDraft(
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
    state = ParteDiarioDraft(
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
    state = ParteDiarioDraft(
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
