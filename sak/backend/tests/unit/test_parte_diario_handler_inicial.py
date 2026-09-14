"""Pruebas de contexto y fecha del handler."""

from copy import deepcopy
from datetime import date
from unittest.mock import AsyncMock

import pytest
from sqlmodel import select

from agente.v3.contracts import V3ConversationContext, V3InboundMessage
from agente.v3.subprocesses.parte_diario import handler
from agente.v3.subprocesses.parte_diario.domain import parte_diario
from agente.v3.subprocesses.parte_diario.utils import calendario
from app import db
from agente.v3.subprocesses.parte_diario.state import ParteDiarioOption, ParteDiarioV3State
from app.models import CRMContacto, CRMOportunidad, EstadoParteDiario, ParteDiario, Proyecto, User


def mensaje(text):
    """Construye un mensaje normalizado para invocar el handler."""
    return V3InboundMessage(
        id="msg", provider="meta", channel_type="whatsapp", account_ref="account",
        conversation_id="conv", external_message_id="external", from_address="549111111",
        to_address="549999999", text=text, message_type="text", raw_payload={}, normalized_payload={},
    )


@pytest.fixture
def escenario(db_session, monkeypatch):
    """Prepara una obra accesible por telefono y una base aislada para las fechas."""
    monkeypatch.setattr(db, "engine", db_session.bind)
    monkeypatch.setattr(calendario, "hoy", lambda: date(2026, 9, 12))
    user = User(nombre="Tester", email="handler-inicial@example.com")
    db_session.add(user)
    db_session.flush()
    contact = CRMContacto(nombre_completo="Encargado", telefonos=["549111111"], responsable_id=user.id)
    db_session.add(contact)
    db_session.flush()
    opportunity = CRMOportunidad(contacto_id=contact.id, responsable_id=user.id, activo=True)
    db_session.add(opportunity)
    db_session.flush()
    project = Proyecto(nombre="Francia", oportunidad_id=opportunity.id, responsable_id=user.id)
    db_session.add(project)
    db_session.commit()
    return ParteDiarioOption(1, project.nombre, contact.id, opportunity.id, project.id)


def contexto(option, etapa="carga"):
    """Construye un contexto resuelto con borrador para probar etapas persistidas."""
    state = ParteDiarioV3State()
    state.set_obra(option)
    draft = state.draft()
    draft.fecha = "2026-09-11"
    draft.sin_novedades_informado = True
    state.set_draft(draft)
    state.etapa = etapa
    return V3ConversationContext(conversation_id="conv", active_process="parteDiario", process_state=state.to_dict())


@pytest.mark.asyncio
async def test_inicio_resuelve_obra_fecha_y_no_guarda(escenario, db_session):
    """Verifica el recorrido inicial real y la ausencia de persistencia del paso 5."""
    llm = AsyncMock()
    original = V3ConversationContext(conversation_id="conv")
    result = await handler.ParteDiarioSubprocess(llm_client=llm).handle(mensaje("parte diario"), original)
    assert original.process_state == {}
    assert result.context.process_state["proyecto_id"] == escenario.proyecto_id
    assert result.context.process_state["parte_state"]["fecha"] == "2026-09-11"
    assert result.context.process_state["etapa"] == "carga"
    assert "Que novedades hubo ese dia?" in result.reply_text
    assert not db_session.exec(select(ParteDiario)).all()
    llm.normalize_initial_request.assert_not_called()


@pytest.mark.asyncio
async def test_seleccion_obra_conserva_fecha_inicial(escenario, monkeypatch):
    """Verifica menus sucesivos sin interpretar el numero de obra como una fecha."""
    other = ParteDiarioOption(2, "Centro", escenario.contacto_id, escenario.oportunidad_id, escenario.proyecto_id)
    monkeypatch.setattr(handler.obras, "resolver_obras_por_telefono", lambda phone: [escenario, other])
    process = handler.ParteDiarioSubprocess(llm_client=AsyncMock())
    first = await process.handle(mensaje("parte diario 10/09/2026"), V3ConversationContext(conversation_id="conv"))
    assert first.context.process_state["etapa"] == "seleccionar_obra"
    invalid = await process.handle(mensaje("99"), first.context)
    assert invalid.context.process_state["etapa"] == "seleccionar_obra"
    result = await process.handle(mensaje("2"), invalid.context)
    assert result.context.process_state["nombre_obra"] == "Centro"
    assert result.context.process_state["parte_state"]["fecha"] == "2026-09-10"
    assert result.context.process_state["modo_apertura"] == "puntual"


@pytest.mark.asyncio
async def test_seleccion_obra_por_nombre(escenario, monkeypatch):
    """Verifica que un nombre identifica una unica obra entre varias opciones."""
    other = ParteDiarioOption(2, "Centro", escenario.contacto_id, escenario.oportunidad_id, escenario.proyecto_id)
    monkeypatch.setattr(handler.obras, "resolver_obras_por_telefono", lambda phone: [escenario, other])
    result = await handler.ParteDiarioSubprocess(llm_client=AsyncMock()).handle(
        mensaje("parte diario francia"), V3ConversationContext(conversation_id="conv"),
    )
    assert result.context.process_state["nombre_obra"] == "Francia"
    assert result.context.process_state["etapa"] == "carga"


@pytest.mark.asyncio
@pytest.mark.parametrize("text,fecha", [("parte diario hoy", "2026-09-12"), ("parte diario ayer", "2026-09-11"),
                                       ("parte diario 2026-09-10", "2026-09-10"), ("parte diario viernes", "2026-09-04")])
async def test_fecha_explicita(escenario, text, fecha):
    """Comprueba fechas explicitas y relativas sin llamadas al LLM."""
    llm = AsyncMock()
    result = await handler.ParteDiarioSubprocess(llm_client=llm).handle(mensaje(text), V3ConversationContext(conversation_id="conv"))
    assert result.context.process_state["parte_state"]["fecha"] == fecha
    llm.normalize_initial_request.assert_not_called()


@pytest.mark.asyncio
async def test_fecha_interpretada_por_llm(escenario):
    """Comprueba la interpretacion de una referencia temporal no resuelta localmente."""
    llm = AsyncMock()
    llm.normalize_initial_request.return_value = {"fecha": "2026-09-09"}
    result = await handler.ParteDiarioSubprocess(llm_client=llm).handle(
        mensaje("parte diario del 9 de septiembre"), V3ConversationContext(conversation_id="conv"),
    )
    assert result.context.process_state["parte_state"]["fecha"] == "2026-09-09"
    llm.normalize_initial_request.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("text", ["parte diario 31/02/2026", "parte diario 2026-09-20"])
async def test_fecha_invalida_o_futura_pide_opcion(escenario, text):
    """Impide reemplazar una fecha invalida o futura por la fecha por defecto."""
    process = handler.ParteDiarioSubprocess(llm_client=AsyncMock())
    result = await process.handle(mensaje(text), V3ConversationContext(conversation_id="conv"))
    assert result.context.process_state["etapa"] == "seleccionar_fecha"
    assert "Paso 5" not in result.reply_text
    result = await process.handle(mensaje("2"), result.context)
    assert result.context.process_state["parte_state"]["fecha"] == "2026-09-11"


@pytest.mark.asyncio
async def test_pendientes_muestra_menu_y_selecciona(escenario):
    """Comprueba el menu de partes pendientes y la seleccion por fecha ISO."""
    process = handler.ParteDiarioSubprocess(llm_client=AsyncMock())
    result = await process.handle(mensaje("partes pendientes"), V3ConversationContext(conversation_id="conv"))
    assert result.context.process_state["etapa"] == "pendientes"
    result = await process.handle(mensaje("2026-09-10"), result.context)
    assert result.context.process_state["parte_state"]["fecha"] == "2026-09-10"
    assert result.context.process_state["etapa"] == "carga"


@pytest.mark.asyncio
@pytest.mark.parametrize("etapa", ["revision", "confirmar_salida"])
async def test_opcion_invalida_no_guarda_ni_muta_borrador(escenario, db_session, etapa):
    """Verifica que los menus esperan una opcion valida sin persistir ni mutar el borrador."""
    original = contexto(escenario, etapa)
    snapshot = deepcopy(original.process_state)
    result = await handler.ParteDiarioSubprocess(llm_client=AsyncMock()).handle(mensaje("99"), original)
    assert result.context.process_state == {**snapshot, "historial": result.context.process_state["historial"]}
    assert original.process_state == snapshot
    assert "Paso " not in result.reply_text
    assert not db_session.exec(select(ParteDiario)).all()


@pytest.mark.asyncio
@pytest.mark.parametrize("cerrado", [False, True])
async def test_recupera_parte_existente_o_consulta_cerrado(escenario, db_session, cerrado):
    """Recupera el identificador existente y mantiene cerrados en solo lectura."""
    parte = ParteDiario(idproyecto=escenario.proyecto_id, contacto_id=escenario.contacto_id,
                       fecha=date(2026, 9, 11), estado=EstadoParteDiario.CERRADO if cerrado else EstadoParteDiario.BORRADOR)
    db_session.add(parte)
    db_session.commit()
    result = await handler.ParteDiarioSubprocess(llm_client=AsyncMock()).handle(
        mensaje("parte diario 11/09/2026"), V3ConversationContext(conversation_id="conv"),
    )
    if cerrado:
        assert result.context.active_process == "general"
        assert result.context.process_state == {}
        assert "Paso 5" not in result.reply_text
    else:
        assert result.context.process_state["parte_state"]["parte_id"] == parte.id
        assert result.context.process_state["parte_state"]["retomado"] is True
    assert len(db_session.exec(select(ParteDiario)).all()) == 1


@pytest.mark.asyncio
async def test_sin_obra_y_salir_devuelven_contexto_general(escenario):
    """Comprueba la respuesta final sin obra y la salida desde seleccion de fecha."""
    process = handler.ParteDiarioSubprocess(llm_client=AsyncMock())
    inbound = mensaje("parte diario")
    inbound.from_address = "desconocido"
    result = await process.handle(inbound, V3ConversationContext(conversation_id="conv"))
    assert "No encontre una obra" in result.reply_text
    assert result.context.active_process == "general"
    result = await process.handle(mensaje("salir"), contexto(escenario, "seleccionar_fecha"))
    assert result.context.active_process == "general"
    assert result.context.process_state == {}
