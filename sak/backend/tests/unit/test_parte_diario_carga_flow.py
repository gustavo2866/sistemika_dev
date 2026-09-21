"""Carga y validacion inmediata con DB aislada y respuestas LLM controladas."""

from copy import deepcopy
from datetime import date
from types import SimpleNamespace

import pytest
from sqlmodel import select

from agente.v3.contracts import V3ConversationContext
from agente.v3.subprocesses.parte_diario import handler
from agente.v3.subprocesses.parte_diario.adapters.carga_agent import fallback_person_validation
from agente.v3.subprocesses.parte_diario.domain import novedades, parte_diario
from agente.v3.subprocesses.parte_diario.domain.models import NovedadPersonal
from agente.v3.subprocesses.parte_diario.flows import validacion_carga
from agente.v3.subprocesses.parte_diario.models import ParteDiarioOperation, TurnPlan
from agente.v3.subprocesses.parte_diario.state import ParteDiarioV3State
from app.models import CRMContacto, Nomina, ParteDiario, Proyecto, ProyectoEncargado
from app.models.tarja import Tarja, TarjaNomina
from app.services.parte_diario_estado_service import seed_parte_diario_estados
from tests.unit.test_parte_diario_handler_inicial import contexto, escenario, mensaje


# Devuelve planes predefinidos y registra que ambos modos usan el mismo interprete.
class FakeLLM:
    # Conserva planes independientes para que su normalizacion no altere el test.
    def __init__(self, *plans):
        self.plans = list(plans)
        self.calls = []
        self.stages = []
        self.contexts = []

    # Registra la etapa usada al interpretar o resolver una aclaracion.
    def for_stage(self, stage):
        self.stages.append(stage)
        return self

    # Entrega la siguiente interpretacion del mensaje sin acceder a un servicio externo.
    async def interpret_turn(self, text, state, nominas, estados, *, contexto_conversacion=None):
        self.calls.append(text)
        self.contexts.append(deepcopy(contexto_conversacion))
        assert self.plans, f"Interpretacion inesperada: {text}"
        plan = self.plans.pop(0)
        if isinstance(plan, Exception):
            raise plan
        return deepcopy(plan)

    # Interpreta una aclaracion de motivo usando un codigo del catalogo.
    async def interpretar_estado_pendiente(self, text, estados):
        return "PER"


# Resuelve aclaraciones de personas sin servicios externos.
class FakeCargaAgent:
    # Reutiliza el fallback determinista del adaptador real.
    async def resolve_person_validation(self, *, message_text, pending):
        return fallback_person_validation(message_text, pending)


# Construye un plan de novedades con el contrato real del interprete.
def plan(*operations):
    return TurnPlan(operations=[ParteDiarioOperation(**item) for item in operations])


# Construye el handler con los adaptadores controlados del test.
def proceso(llm, query=None):
    return handler.ParteDiarioSubprocess(llm_client=llm, carga_agent_client=FakeCargaAgent(), query_agent_client=query)


# Recupera el estado serializado de la respuesta como lo hace el siguiente turno.
def estado(result):
    return ParteDiarioV3State.from_dict(result.context.process_state)


@pytest.fixture
# Prepara empleados homonimos y una obra destino con dos encargados activos.
def datos(escenario, db_session):
    seed_parte_diario_estados(db_session)
    employees = []
    for index, (nombre, apellido) in enumerate([("Ivan", "Medina"), ("Pablo", "Vera"), ("Juan", "Perez"), ("Jose", "Perez")]):
        person = Nomina(nombre=nombre, apellido=apellido, dni=f"carga-{index}",
                        idproyecto=escenario.proyecto_id, encargado_contacto_id=escenario.contacto_id)
        db_session.add(person)
        employees.append(person)
    responsable_id = db_session.get(Proyecto, escenario.proyecto_id).responsable_id
    destination = Proyecto(nombre="Centro Industrial Destino Largo", estado="02-ejecucion", responsable_id=responsable_id)
    db_session.add(destination)
    db_session.flush()
    managers = [CRMContacto(nombre_completo="Ana Encargada", responsable_id=responsable_id),
                CRMContacto(nombre_completo="Bruno Encargado", responsable_id=responsable_id)]
    db_session.add_all(managers)
    db_session.flush()
    for manager in managers:
        db_session.add(ProyectoEncargado(proyecto_id=destination.id, contacto_id=manager.id, activo=True))
    db_session.commit()
    return SimpleNamespace(obra=escenario, empleados=employees, destino=destination, encargados=managers)


@pytest.mark.asyncio
async def test_texto_multiple_aplica_solo_al_draft(datos, db_session):
    llm = FakeLLM(plan(
        dict(type="agregar_novedad", nombre="Medina", estado_codigo="ACC", descripcion="accidente"),
        dict(type="agregar_novedad", nombre="Vera", estado_codigo="ENF", descripcion="enfermo"),
    ))
    original = contexto(datos.obra)
    snapshot = deepcopy(original.process_state)
    result = await proceso(llm).handle(mensaje("medina accidente y vera enfermo"), original)
    assert estado(result).etapa == "carga"
    assert [n.estado_codigo for n in estado(result).draft().novedades] == ["ACC", "ENF"]
    assert original.process_state == snapshot
    assert len(llm.calls) == 1
    assert llm.stages == ["carga"]
    assert not db_session.exec(select(ParteDiario)).all()


@pytest.mark.asyncio
async def test_texto_libre_descarta_ids_llm_y_resuelve_lote_por_nombre(datos, db_session):
    acosta = datos.empleados[2]
    acosta.apellido = "Acosta"
    db_session.add(acosta)
    db_session.commit()
    medina, vera = datos.empleados[:2]
    llm = FakeLLM(plan(
        dict(type="agregar_novedad", nombre="Medina", idnomina=99999, estado_codigo="ENF"),
        dict(type="agregar_novedad", nombre="Vera", idnomina=medina.id, estado_codigo="PER"),
        dict(type="agregar_novedad", nombre="Acosta", idnomina=vera.id, estado_codigo="P", horas=12),
    ))

    result = await proceso(llm).handle(
        mensaje("Medina enfermo, Vera pidio permiso y Acosta trabajo 12hs"),
        contexto(datos.obra),
    )

    current = estado(result)
    assert current.etapa == "carga"
    novedades_por_id = {item.idnomina: item for item in current.draft().novedades}
    assert set(novedades_por_id) == {medina.id, vera.id, acosta.id}
    assert novedades_por_id[medina.id].estado_codigo == "ENF"
    assert novedades_por_id[vera.id].estado_codigo == "PER"
    assert novedades_por_id[acosta.id].horas == 12
    assert "No encontre" not in result.reply_text


@pytest.mark.asyncio
@pytest.mark.parametrize("modo", ["carga", "listado"])
async def test_novedad_interna_bloquea_segunda_novedad_antes_de_guardar(datos, modo):
    ctx = contexto(datos.obra)
    current = ParteDiarioV3State.from_dict(ctx.process_state)
    draft = current.draft()
    draft.sin_novedades_informado = False
    draft.novedades_internas = [
        NovedadPersonal(
            nombre="Medina, Ivan",
            idnomina=datos.empleados[0].id,
            estado_codigo="ALT",
            horas=9,
        )
    ]
    current.set_draft(draft)
    ctx.process_state = current.to_dict()
    process = proceso(FakeLLM(plan(
        dict(type="modificar_novedad", nombre="Medina, Ivan", estado_codigo="PER", horas=4),
    )))
    text = "Medina con permiso trabajo 4hs"
    if modo == "listado":
        opened = await process.handle(mensaje("listado"), ctx)
        opened_state = estado(opened)
        option = next(
            item for item in opened_state.asistencia_opciones
            if item.idnomina == datos.empleados[0].id
        )
        assert f"{option.opcion} - Medina, Ivan - ALT, 9h" in opened.reply_text
        text = f"{option.opcion} permiso trabajo 4hs"
        ctx = opened.context

    result = await process.handle(mensaje(text), ctx)

    assert "ya tiene ALT registrado en este parte" in result.reply_text
    assert "Solo se admite una novedad por empleado" in result.reply_text
    assert estado(result).draft().novedades == []
    assert estado(result).draft().novedades_internas[0].estado_codigo == "ALT"
    assert estado(result).etapa == "carga_aclaracion"
    assert estado(result).aclaracion_origen == modo


# La aclaracion pasa por el cliente real, conserva el borrador y permite precisar el cambio.
@pytest.mark.asyncio
@pytest.mark.parametrize("texto", ["limpiar novedades", "quiero rehacer lo cargado", "cambia eso"])
async def test_pedido_ambiguo_recuperado_pasa_a_aclaracion(datos, texto):
    from agente.v3.subprocesses.parte_diario.adapters.llm import ParteDiarioLLMClient
    from tests.unit.test_parte_diario_llm_client import FakeChatClient

    cargado = await proceso(FakeLLM(plan(
        dict(type="agregar_novedad", nombre="Medina", estado_codigo="P", horas=12),
        dict(type="agregar_novedad", nombre="Vera", estado_codigo="ENF"),
    ))).handle(mensaje("Medina trabajo 12hs, Vera enfermo"), contexto(datos.obra))
    cargado.context.process_state["parte_state"]["retomado"] = True
    snapshot = deepcopy(cargado.context.process_state)
    pregunta = "Que novedades queres eliminar o corregir?"
    chat = FakeChatClient()
    chat.next_response = dict(
        message_kind="aclaracion", backend_action="ask_clarification",
        command_action="none", operations=[], reply=pregunta, alcance=None,
    )
    process = proceso(ParteDiarioLLMClient(chat_client=chat))
    result = await process.handle(mensaje(texto), cargado.context)
    assert result.context.process_state == {
        **snapshot, "historial": result.context.process_state["historial"],
        "etapa": "carga_aclaracion", "aclaracion_origen": "carga", "aclaracion_pregunta": pregunta,
    }
    assert result.reply_text == pregunta
    assert len(chat.calls) == 1
    prompt = chat.calls[0]["system_prompt"]
    assert texto in chat.calls[0]["user_content"]
    assert '"retomado":true' in chat.calls[0]["user_content"]
    assert "historial, en orden" in prompt
    assert "No uses una lista de frases" in prompt

    chat.next_response = dict(
        message_kind="novedad", backend_action="delete_novelty", command_action="none",
        operations=[dict(type="eliminar_novedad", nombre="Medina")], reply=None,
    )
    result = await process.handle(mensaje("elimina solo la de Medina"), result.context)
    assert estado(result).etapa == "carga"
    assert [n.idnomina for n in estado(result).draft().novedades] == [datos.empleados[1].id]

    chat.next_response = dict(
        message_kind="comando", backend_action="finish_loading", command_action="none",
        operations=[], reply=None,
    )
    result = await process.handle(mensaje("por mi ya terminamos con el parte"), result.context)
    assert estado(result).etapa == "revision"


# Una salida vacia del interprete tampoco se transforma en fin de carga.
@pytest.mark.asyncio
async def test_interpretacion_vacia_pide_aclaracion_y_conserva_borrador(datos):
    ctx = contexto(datos.obra)
    result = await proceso(FakeLLM(plan())).handle(mensaje("no se que poner aca"), ctx)
    assert result.context.process_state == {
        **ctx.process_state, "historial": result.context.process_state["historial"],
        "etapa": "carga_aclaracion", "aclaracion_origen": "carga", "aclaracion_pregunta": result.reply_text,
    }
    assert "No pude interpretar" in result.reply_text
    assert "Resumen del parte" not in result.reply_text
    assert "Hay alguna otra novedad?" not in result.reply_text


# El LLM recibe la pregunta previa y decide las operaciones del siguiente mensaje.
@pytest.mark.asyncio
async def test_aclaracion_global_recibe_historial_y_aplica_operaciones_del_llm(datos, db_session):
    from agente.v3.llm import compact_json
    from agente.v3.subprocesses.parte_diario.adapters.llm import ParteDiarioLLMClient
    from tests.unit.test_parte_diario_llm_client import FakeChatClient

    result = await proceso(FakeLLM(plan(
        dict(type="agregar_novedad", nombre="Medina", estado_codigo="P", horas=12),
        dict(type="agregar_novedad", nombre="Vera", estado_codigo="ENF"),
    ))).handle(mensaje("Medina trabajo 12hs, Vera enfermo"), contexto(datos.obra))
    chat = FakeChatClient()
    process = proceso(ParteDiarioLLMClient(chat_client=chat))
    question = "Que novedades queres eliminar o corregir?"
    chat.next_response = dict(backend_action="ask_clarification", operations=[], reply=question)
    result = await process.handle(mensaje("limpiar novedades"), result.context)
    snapshot = deepcopy(result.context.process_state)
    previous_history = estado(result).historial
    chat.next_response = dict(backend_action="delete_novelty", operations=[
        dict(type="eliminar_novedad", nombre="Medina"),
        dict(type="eliminar_novedad", nombre="Vera"),
    ])
    result = await process.handle(mensaje("quiero eliminar todas"), result.context)
    prompt = chat.calls[-1]["system_prompt"]
    expected_context = dict(
        etapa="carga_aclaracion", obra=datos.obra.nombre, fecha_parte="2026-09-11", historial=previous_history,
        pregunta_pendiente=question, opciones_listado=[],
    )
    assert compact_json(expected_context) in chat.calls[-1]["user_content"]
    assert chat.calls[-1]["history"][-1] == {"role": "assistant", "content": question}
    assert previous_history[-1]["usuario"] == "limpiar novedades"
    assert previous_history[-1]["asistente"] == question
    assert not any(turn["usuario"] == "quiero eliminar todas" for turn in previous_history)
    assert estado(result).etapa == "carga"
    assert not estado(result).draft().novedades
    assert snapshot["parte_state"]["novedades"]
    assert estado(result).historial[-1]["usuario"] == "quiero eliminar todas"
    assert not db_session.exec(select(ParteDiario)).all()


# La respuesta a una confirmacion contextual edita solo el borrador del parte recuperado.
@pytest.mark.asyncio
@pytest.mark.parametrize("respuesta,restantes", [("si", 0), ("ok", 0), ("no", 2)])
async def test_recuperar_parte_y_responder_confirmacion_contextual(datos, db_session, respuesta, restantes):
    from app.models import ParteDiarioDetalle
    from agente.v3.subprocesses.parte_diario.adapters.llm import ParteDiarioLLMClient
    from tests.unit.test_parte_diario_llm_client import FakeChatClient

    present = next(e.id for e in parte_diario.cargar_estados(db_session) if e.abreviatura == "P")
    saved = ParteDiario(idproyecto=datos.obra.proyecto_id, contacto_id=datos.obra.contacto_id,
                       fecha=date(2026, 9, 2))
    db_session.add(saved)
    db_session.flush()
    for person in datos.empleados[:2]:
        db_session.add(ParteDiarioDetalle(parte_diario_id=saved.id, idnomina=person.id,
                                         idestado=present, horas=9))
    db_session.commit()
    saved_id = saved.id
    chat = FakeChatClient()
    process = proceso(ParteDiarioLLMClient(chat_client=chat))
    result = await process.handle(mensaje("parte diario 02/09/2026"), V3ConversationContext(conversation_id="conv"))
    draft = estado(result).draft()
    assert draft.parte_id == saved_id
    assert len(draft.novedades) == 2
    assert not chat.calls
    question = "Queres eliminar todas las novedades del parte?"
    chat.next_response = dict(backend_action="ask_clarification", operations=[], reply=question)
    result = await process.handle(mensaje("limpiar todo"), result.context)
    chat.next_response = (
        dict(backend_action="delete_novelty", operations=[
            dict(type="eliminar_novedad", nombre=n.nombre, idnomina=n.idnomina) for n in draft.novedades
        ], reply=None) if restantes == 0 else
        dict(backend_action="none", operations=[dict(type="retomar_carga")], reply=None)
    )
    result = await process.handle(mensaje(respuesta), result.context)
    assert len(chat.calls) == 2
    assert chat.calls[-1]["history"][-2:] == [
        {"role": "user", "content": "limpiar todo"},
        {"role": "assistant", "content": question},
    ]
    current = estado(result)
    assert current.etapa == "carga"
    assert current.draft().parte_id == saved_id
    assert current.draft().fecha == "2026-09-02"
    assert len(current.draft().novedades) == restantes
    assert len(db_session.exec(select(ParteDiarioDetalle)).all()) == 2


# La normalizacion de LISTADO conserva el dialogo previo y el texto original en el historial.
@pytest.mark.asyncio
async def test_listado_envia_el_mismo_contexto_conversacional(datos):
    llm = FakeLLM(plan(dict(type="agregar_novedad", nombre="Medina, Ivan", estado_codigo="ENF")))
    process = proceso(llm)
    opened = await process.handle(mensaje("listado"), contexto(datos.obra))
    option = next(o.opcion for o in estado(opened).asistencia_opciones if o.idnomina == datos.empleados[0].id)
    original = f"{option} enfermo"
    result = await process.handle(mensaje(original), opened.context)
    assert llm.contexts[0]["etapa"] == "listado"
    assert llm.contexts[0]["historial"][-1]["asistente"] == opened.reply_text
    assert f"[idnomina={datos.empleados[0].id}]" in llm.calls[0]
    assert estado(result).historial[-1]["usuario"] == original


@pytest.mark.asyncio
async def test_primera_novedad_se_procesa_y_fecha_numerica_no(datos):
    llm = FakeLLM(plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="ENF")))
    process = proceso(llm)
    result = await process.handle(mensaje("Medina enfermo"), V3ConversationContext(conversation_id="conv"))
    assert estado(result).draft().novedades[0].estado_codigo == "ENF"
    result = await process.handle(mensaje("11/09/2026"), V3ConversationContext(conversation_id="conv2"))
    assert estado(result).etapa == "carga"
    assert len(llm.calls) == 1


@pytest.mark.asyncio
async def test_listado_normaliza_ids_y_comparte_interprete(datos):
    llm = FakeLLM(plan(
        dict(type="agregar_novedad", nombre="Medina, Ivan", idnomina=99999, estado_codigo="ACC"),
        dict(type="agregar_novedad", nombre="Vera, Pablo", estado_codigo="ENF"),
    ))
    process = proceso(llm)
    opened = await process.handle(mensaje("listado"), contexto(datos.obra))
    assert opened.context.process_state["etapa"] == "listado"
    options = {option.idnomina: option.opcion for option in estado(opened).asistencia_opciones}
    text = f"{options[datos.empleados[0].id]} accidente, {options[datos.empleados[1].id]} enfermo"
    result = await process.handle(mensaje(text), opened.context)
    assert len(llm.calls) == 1
    assert f"[idnomina={datos.empleados[0].id}]" in llm.calls[0]
    assert f"[idnomina={datos.empleados[1].id}]" in llm.calls[0]
    assert {n.idnomina for n in estado(result).draft().novedades} == {e.id for e in datos.empleados[:2]}
    assert estado(result).etapa == "revision"
    assert estado(result).revision_origen == "listado"
    assert "2. Volver al listado" in result.reply_text


@pytest.mark.asyncio
async def test_empleado_ambiguo_mantiene_el_resto_del_lote(datos):
    llm = FakeLLM(plan(
        dict(type="agregar_novedad", nombre="Perez", estado_codigo="ENF"),
        dict(type="agregar_novedad", nombre="Medina", estado_codigo="ACC"),
    ))
    process = proceso(llm)
    result = await process.handle(mensaje("Perez enfermo y Medina accidente"), contexto(datos.obra))
    assert estado(result).etapa == "carga_validar_empleado"
    assert len(estado(result).draft().novedades) == 1
    result = await process.handle(mensaje("999"), result.context)
    assert estado(result).etapa == "carga_validar_empleado"
    assert len(llm.calls) == 1
    result = await process.handle(mensaje("Juan Perez"), result.context)
    assert estado(result).etapa == "carga"
    assert {n.idnomina for n in estado(result).draft().novedades} == {datos.empleados[0].id, datos.empleados[2].id}


# Una obra mencionada para Ponce no convierte las horas de Medina en transferencia.
@pytest.mark.asyncio
@pytest.mark.parametrize("modo", ["carga", "listado"])
async def test_lote_no_comparte_destino_entre_novedades(datos, db_session, modo):
    medina, ponce, acosta = datos.empleados[:3]
    ponce.apellido = "Ponce"
    acosta.apellido = "Acosta"
    datos.destino.nombre = "Francia 118"
    db_session.add_all([ponce, acosta, datos.destino])
    db_session.commit()
    llm = FakeLLM(plan(
        dict(type="agregar_novedad", nombre="Acosta", estado_codigo="ACC", descripcion="fractura de pierna"),
        dict(type="agregar_novedad", nombre="Medina", estado_codigo="P", horas=12),
        dict(type="agregar_novedad", nombre="Ponce", estado_codigo="P",
             fuera_de_proyecto=True, nombre_proyecto="francia"),
    ))
    process = proceso(llm)
    ctx = contexto(datos.obra)
    text = "acosta se cayo de la moto y se quebro una pierna, medina trabajo 12 hs, ponce trabajo en francia"
    if modo == "listado":
        opened = await process.handle(mensaje("listado"), ctx)
        options = {option.idnomina: option.opcion for option in estado(opened).asistencia_opciones}
        text = (f"{options[acosta.id]} se cayo de la moto y se quebro una pierna, "
                f"{options[medina.id]} trabajo 12 hs, {options[ponce.id]} trabajo en francia")
        ctx = opened.context
    result = await process.handle(mensaje(text), ctx)
    draft = estado(result).draft()
    assert estado(result).etapa == "carga_validar_encargado"
    assert [item.idnomina_resuelto for item in draft.pendientes_ambiguos] == [ponce.id]
    by_id = {item.idnomina: item for item in draft.novedades}
    assert by_id[acosta.id].estado_codigo == "ACC"
    assert by_id[medina.id].horas == 12
    assert not by_id[medina.id].validar_destino_trabajo
    assert by_id[medina.id].idproyecto_destino is None
    result = await process.handle(mensaje("2"), result.context)
    assert estado(result).etapa == ("revision" if modo == "listado" else "carga")
    draft = estado(result).draft()
    assert not draft.pendientes_ambiguos
    by_id = {item.idnomina: item for item in draft.novedades}
    assert by_id[ponce.id].idproyecto_destino == datos.destino.id
    assert by_id[ponce.id].contacto_id_destino == datos.encargados[1].id
    assert by_id[medina.id].contacto_id_destino is None
    assert len(llm.calls) == 1


# Una transferencia sin obra identificada debe preguntar, no tomar la obra de otra persona.
@pytest.mark.asyncio
async def test_destino_omitido_no_se_completa_con_otra_novedad(datos):
    llm = FakeLLM(plan(
        dict(type="agregar_novedad", nombre="Medina", estado_codigo="P", fuera_de_proyecto=True),
        dict(type="agregar_novedad", nombre="Vera", estado_codigo="P",
             fuera_de_proyecto=True, nombre_proyecto=datos.destino.nombre),
    ))
    result = await proceso(llm).handle(
        mensaje(f"Medina fue a otra obra, Vera trabajo en {datos.destino.nombre}"), contexto(datos.obra),
    )
    assert estado(result).etapa == "carga_validar_obra"
    pending_medina, pending_vera = estado(result).draft().pendientes_ambiguos
    assert pending_medina.idproyecto_destino is None
    assert pending_medina.destino_pendiente == "obra"
    assert pending_vera.idproyecto_destino == datos.destino.id


@pytest.mark.asyncio
async def test_transferencia_desconocida_pide_obra_y_encargado(datos):
    llm = FakeLLM(plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="P", horas=4,
                           fuera_de_proyecto=True, nombre_proyecto="feqxz")))
    process = proceso(llm)
    result = await process.handle(mensaje("medina trabajo 4hs en feqxz"), contexto(datos.obra))
    assert estado(result).etapa == "carga_validar_obra"
    assert "1. Centro Industrial De" in result.reply_text
    assert not estado(result).draft().novedades
    invalid = await process.handle(mensaje("99"), result.context)
    assert estado(invalid).etapa == "carga_validar_obra"
    result = await process.handle(mensaje("1"), invalid.context)
    assert estado(result).etapa == "carga_validar_encargado"
    result = await process.handle(mensaje("2"), result.context)
    assert estado(result).etapa == "carga_validar_estado"
    assert "Cual fue el motivo de la jornada reducida?" in result.reply_text
    result = await process.handle(mensaje("permiso"), result.context)
    novelty = estado(result).draft().novedades[0]
    assert novelty.idproyecto_destino == datos.destino.id
    assert novelty.contacto_id_destino == datos.encargados[1].id
    assert novelty.horas == 4
    assert novelty.estado_codigo == "PER"
    assert estado(result).etapa == "carga"
    assert len(llm.calls) == 1


@pytest.mark.asyncio
async def test_persona_antes_de_obra_y_encargado(datos):
    llm = FakeLLM(plan(dict(type="agregar_novedad", nombre="Perez", estado_codigo="P", horas=9,
                           fuera_de_proyecto=True, nombre_proyecto="feqxz")))
    process = proceso(llm)
    result = await process.handle(mensaje("mande a Perez a feqxz"), contexto(datos.obra))
    assert estado(result).etapa == "carga_validar_empleado"
    result = await process.handle(mensaje("Juan Perez"), result.context)
    assert estado(result).etapa == "carga_validar_obra"
    result = await process.handle(mensaje("1"), result.context)
    assert estado(result).etapa == "carga_validar_encargado"
    result = await process.handle(mensaje("1"), result.context)
    assert estado(result).draft().novedades[0].idnomina == datos.empleados[2].id


@pytest.mark.asyncio
async def test_transferencia_un_encargado_no_pregunta(datos, db_session):
    db_session.delete(db_session.exec(select(ProyectoEncargado).where(ProyectoEncargado.contacto_id == datos.encargados[1].id)).one())
    db_session.commit()
    llm = FakeLLM(plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="P", horas=4,
                           fuera_de_proyecto=True, nombre_proyecto=datos.destino.nombre)))
    process = proceso(llm)
    result = await process.handle(mensaje(f"Medina trabajo 4hs en {datos.destino.nombre}"), contexto(datos.obra))
    assert estado(result).etapa == "carga_validar_estado"
    result = await process.handle(mensaje("permiso"), result.context)
    assert estado(result).etapa == "carga"
    assert estado(result).draft().novedades[0].contacto_id_destino == datos.encargados[0].id


# Avanza solo cuando termina todo el lote; la ultima pagina abre revision.
@pytest.mark.asyncio
@pytest.mark.parametrize("extras", [0, 9])
async def test_listado_avanza_despues_de_validar_todo_el_lote(datos, db_session, extras):
    for i in range(extras):
        db_session.add(Nomina(nombre="Extra", apellido=f"Zeta{i}", dni=f"avance-{i}",
                             idproyecto=datos.obra.proyecto_id, encargado_contacto_id=datos.obra.contacto_id))
    db_session.commit()
    llm = FakeLLM(plan(
        dict(type="agregar_novedad", nombre="Medina, Ivan", estado_codigo="P", horas=5,
             fuera_de_proyecto=True, nombre_proyecto="feqxz"),
        dict(type="agregar_novedad", nombre="Vera, Pablo", estado_codigo="P", horas=4,
             fuera_de_proyecto=True, nombre_proyecto=datos.destino.nombre),
        dict(type="agregar_novedad", nombre="Perez, Juan", estado_codigo="ENF"),
    ))
    process = proceso(llm)
    result = await process.handle(mensaje("listado"), contexto(datos.obra))
    options = {o.idnomina: o.opcion for o in estado(result).asistencia_opciones}
    texto = (f"{options[datos.empleados[0].id]} trabajo en feqxz 5hs, "
             f"{options[datos.empleados[1].id]} trabajo en {datos.destino.nombre} 4hs, "
             f"{options[datos.empleados[2].id]} tiene gripe")
    result = await process.handle(mensaje(texto), result.context)
    assert estado(result).validacion_origen == "listado"
    assert estado(result).etapa == "carga_validar_obra"
    assert estado(result).asistencia_offset == 0
    assert len(estado(result).draft().pendientes_ambiguos) == 2
    result = await process.handle(mensaje("99"), result.context)
    assert estado(result).etapa == "carga_validar_obra"
    assert estado(result).asistencia_offset == 0
    result = await process.handle(mensaje("1"), result.context)
    assert estado(result).etapa == "carga_validar_encargado"
    assert estado(result).asistencia_offset == 0
    result = await process.handle(mensaje("1"), result.context)
    assert estado(result).etapa == "carga_validar_estado"
    assert estado(result).asistencia_offset == 0
    assert len(estado(result).draft().pendientes_ambiguos) == 2
    result = await process.handle(mensaje("permiso"), result.context)
    assert estado(result).etapa == "carga_validar_encargado"
    assert estado(result).asistencia_offset == 0
    assert len(estado(result).draft().pendientes_ambiguos) == 1
    result = await process.handle(mensaje("2"), result.context)
    assert estado(result).etapa == "carga_validar_estado"
    result = await process.handle(mensaje("permiso"), result.context)
    assert not estado(result).draft().pendientes_ambiguos
    assert estado(result).validacion_origen is None
    assert len(estado(result).draft().novedades) == 3
    assert len(llm.calls) == 1
    if extras:
        assert estado(result).etapa == "listado"
        assert estado(result).asistencia_offset == 8
        assert "Pagina 2 de 2" in result.reply_text
        assert "Cargado:" in result.reply_text
        assert "1 - Medina, Ivan - PER, 5h" in result.reply_text
        assert [o.opcion for o in estado(result).asistencia_opciones] == list(range(9, 14))
        result = await process.handle(mensaje("FINALIZAR"), result.context)
    assert estado(result).etapa == "revision"
    assert estado(result).revision_origen == "listado"


@pytest.mark.asyncio
async def test_dos_pendientes_se_resuelven_sin_perder_la_cola(datos):
    llm = FakeLLM(plan(
        dict(type="agregar_novedad", nombre="zzzzz", estado_codigo="ENF"),
        dict(type="agregar_novedad", nombre="yyyyy", estado_codigo="ACC"),
    ))
    process = proceso(llm)
    result = await process.handle(mensaje("zzzzz enfermo y yyyyy accidente"), contexto(datos.obra))
    assert len(estado(result).draft().pendientes_ambiguos) == 2
    result = await process.handle(mensaje("no"), result.context)
    assert estado(result).etapa == "carga_validar_empleado"
    assert len(estado(result).draft().pendientes_ambiguos) == 1
    assert "yyyyy" in result.reply_text
    result = await process.handle(mensaje("ninguno"), result.context)
    assert estado(result).etapa == "carga"
    assert estado(result).draft().novedades[0].idnomina is None


@pytest.mark.asyncio
async def test_conflicto_de_novedades_pregunta_y_resuelve(datos, monkeypatch):
    llm = FakeLLM(
        plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="ENF")),
        plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="ACC")),
    )
    process = proceso(llm)
    result = await process.handle(mensaje("Medina enfermo"), contexto(datos.obra))
    # Un conflicto usa las novedades existentes, no prepara candidatos de empleados.
    def no_preparar_candidatos(state):
        pytest.fail("El menu de conflicto no debe consultar candidatos ni catalogos")

    monkeypatch.setattr(validacion_carga, "preparar_candidatos", no_preparar_candidatos)
    result = await process.handle(mensaje("Medina accidente"), result.context)
    assert estado(result).etapa == "carga_validar_conflicto"
    result = await process.handle(mensaje("2"), result.context)
    assert estado(result).etapa == "carga"
    assert len(estado(result).draft().novedades) == 1
    assert estado(result).draft().novedades[0].estado_codigo == "ACC"


@pytest.mark.asyncio
async def test_motivo_pendiente_no_es_transferencia(datos):
    llm = FakeLLM(plan(dict(type="agregar_novedad", nombre="Medina", horas=4)))
    process = proceso(llm)
    result = await process.handle(mensaje("Medina trabajo 4hs"), contexto(datos.obra))
    assert estado(result).etapa == "carga_validar_estado"
    result = await process.handle(mensaje("permiso"), result.context)
    assert estado(result).etapa == "carga"
    assert estado(result).draft().novedades[0].estado_codigo == "PER"


@pytest.mark.asyncio
@pytest.mark.parametrize("modo", ["carga", "listado"])
async def test_presente_con_jornada_parcial_pide_motivo_en_ambos_flujos(datos, modo):
    llm = FakeLLM(plan(dict(
        type="agregar_novedad",
        nombre="Medina, Ivan" if modo == "listado" else "Medina",
        estado_codigo="P",
        horas=4,
    )))
    process = proceso(llm)
    ctx = contexto(datos.obra)
    text = "Medina trabajo 4hs"
    if modo == "listado":
        opened = await process.handle(mensaje("listado"), ctx)
        option = next(
            item.opcion for item in estado(opened).asistencia_opciones
            if item.idnomina == datos.empleados[0].id
        )
        ctx = opened.context
        text = f"{option} trabajo 4hs"

    pending_result = await process.handle(mensaje(text), ctx)

    current = estado(pending_result)
    assert current.etapa == "carga_validar_estado"
    assert current.validacion_origen == modo
    assert not current.draft().novedades
    assert current.draft().pendientes_ambiguos[0].horas == 4
    assert "trabajo 4h" in pending_result.reply_text
    assert "Cual fue el motivo de la jornada reducida?" in pending_result.reply_text
    assert "BAJA" not in pending_result.reply_text

    resolved = await process.handle(mensaje("permiso"), pending_result.context)

    novelty = estado(resolved).draft().novedades[0]
    assert novelty.estado_codigo == "PER"
    assert novelty.horas == 4
    assert not estado(resolved).draft().pendientes_ambiguos


@pytest.mark.asyncio
async def test_corregir_a_jornada_parcial_conserva_original_hasta_resolver_motivo(datos):
    llm = FakeLLM(
        plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="P", horas=9)),
        plan(dict(type="modificar_novedad", nombre="Medina", estado_codigo="P", horas=4)),
    )
    process = proceso(llm)
    loaded = await process.handle(mensaje("Medina trabajo 9hs"), contexto(datos.obra))

    pending_result = await process.handle(mensaje("Medina trabajo 4hs"), loaded.context)

    current = estado(pending_result)
    assert current.etapa == "carga_validar_estado"
    assert [(item.estado_codigo, item.horas) for item in current.draft().novedades] == [("P", 9)]
    assert current.draft().pendientes_ambiguos[0].reemplaza_novedad is True

    resolved = await process.handle(mensaje("accidente"), pending_result.context)

    current = estado(resolved)
    assert [(item.estado_codigo, item.horas) for item in current.draft().novedades] == [("ACC", 4)]
    assert not current.draft().pendientes_ambiguos
    assert not current.draft().conflictos_novedad


@pytest.mark.asyncio
async def test_listado_paginado_rechaza_opcion_ajena(datos, db_session):
    for i in range(8):
        db_session.add(Nomina(nombre="Extra", apellido=f"Zeta{i}", dni=f"extra-{i}",
                             idproyecto=datos.obra.proyecto_id, encargado_contacto_id=datos.obra.contacto_id))
    db_session.commit()
    llm = FakeLLM()
    process = proceso(llm)
    result = await process.handle(mensaje("listado"), contexto(datos.obra))
    assert len(estado(result).asistencia_opciones) == 8
    assert "Fecha: 2026-09-11 - Pagina 1 de 2" in result.reply_text
    assert "Informa todas las novedades de esta pagina en un mensaje." in result.reply_text
    assert "Formato: numero + novedad." in result.reply_text
    assert "SALIR abandona el parte." in result.reply_text
    assert "9 - SIGUIENTE" in result.reply_text
    assert "99 - FINALIZAR" in result.reply_text
    result = await process.handle(mensaje("10 enfermo"), result.context)
    assert "no esta en esta pagina" in result.reply_text
    result = await process.handle(mensaje("9"), result.context)
    assert estado(result).asistencia_opciones[0].opcion == 9
    result = await process.handle(mensaje("99"), result.context)
    assert estado(result).etapa == "revision"
    assert not llm.calls


@pytest.mark.asyncio
async def test_listado_congela_numeracion_durante_todo_el_recorrido(datos, db_session):
    for i in range(9):
        db_session.add(Nomina(nombre="Extra", apellido=f"Zeta{i}", dni=f"frozen-{i}",
                             idproyecto=datos.obra.proyecto_id,
                             encargado_contacto_id=datos.obra.contacto_id))
    db_session.commit()
    process = proceso(FakeLLM())
    opened = await process.handle(mensaje("listado"), contexto(datos.obra))
    frozen = estado(opened).asistencia_catalogo
    assert len(frozen) == 13

    agregado = Nomina(nombre="Nuevo", apellido="Aardvark", dni="frozen-new",
                      idproyecto=datos.obra.proyecto_id,
                      encargado_contacto_id=datos.obra.contacto_id)
    db_session.add(agregado)
    db_session.flush()
    tarja = db_session.exec(select(Tarja).where(
        Tarja.idproyecto == datos.obra.proyecto_id,
        Tarja.contacto_id == datos.obra.contacto_id,
    )).one()
    db_session.add(TarjaNomina(tarja_id=tarja.id, nomina_id=agregado.id,
        fecha_desde=date(2026, 9, 11), fecha_hasta=date(2026, 9, 25)))
    db_session.commit()

    result = await process.handle(mensaje("SIGUIENTE"), opened.context)
    current = estado(result)
    assert current.asistencia_catalogo == frozen
    assert current.asistencia_opciones == frozen[8:]
    assert agregado.id not in {item.idnomina for item in current.asistencia_catalogo}


@pytest.mark.asyncio
async def test_listado_salir_confirma_y_cancelar_recupera_pagina(datos):
    process = proceso(FakeLLM())
    opened = await process.handle(mensaje("listado"), contexto(datos.obra))
    snapshot = estado(opened)

    result = await process.handle(mensaje("SALIR"), opened.context)
    assert estado(result).etapa == "confirmar_salida"
    result = await process.handle(mensaje("2"), result.context)

    current = estado(result)
    assert current.etapa == "listado"
    assert current.asistencia_catalogo == snapshot.asistencia_catalogo
    assert current.asistencia_opciones == snapshot.asistencia_opciones
    assert "LISTADO - Francia" in result.reply_text


@pytest.mark.asyncio
async def test_revision_de_listado_vuelve_al_catalogo_congelado(datos):
    llm = FakeLLM(plan(dict(type="agregar_novedad", nombre="Medina, Ivan", estado_codigo="ENF")))
    process = proceso(llm)
    opened = await process.handle(mensaje("listado"), contexto(datos.obra))
    option = next(item.opcion for item in estado(opened).asistencia_opciones
                  if item.idnomina == datos.empleados[0].id)
    reviewed = await process.handle(mensaje(f"{option} enfermo"), opened.context)
    assert estado(reviewed).etapa == "revision"

    result = await process.handle(mensaje("2"), reviewed.context)

    assert estado(result).etapa == "listado"
    assert estado(result).asistencia_catalogo == estado(opened).asistencia_catalogo
    assert "1 - Medina, Ivan - ENF, 0h" in result.reply_text


@pytest.mark.asyncio
async def test_volver_al_listado_muestra_y_conserva_destino_al_corregir_horas(datos, db_session):
    datos.destino.nombre = "Francia 118"
    db_session.add(datos.destino)
    db_session.commit()
    llm = FakeLLM(
        plan(dict(
            type="agregar_novedad", nombre="Medina, Ivan", estado_codigo="P",
            fuera_de_proyecto=True, nombre_proyecto="Francia", horas=9,
        )),
        plan(dict(type="modificar_novedad", nombre="Medina, Ivan", horas=4)),
    )
    process = proceso(llm)
    opened = await process.handle(mensaje("listado"), contexto(datos.obra))
    option = next(
        item.opcion for item in estado(opened).asistencia_opciones
        if item.idnomina == datos.empleados[0].id
    )

    reviewed = await process.handle(
        mensaje(f"{option} trabajo en Francia con Bruno 9hs"),
        opened.context,
    )
    assert estado(reviewed).etapa == "revision"
    assert "Destino: Francia 118 / Bruno Encargado" in reviewed.reply_text

    listed = await process.handle(mensaje("2"), reviewed.context)
    assert estado(listed).etapa == "listado"
    assert (
        f"{option} - Medina, Ivan - P, 9h - "
        "Destino: Francia 118 / Bruno Encargado"
    ) in listed.reply_text

    corrected = await process.handle(mensaje(f"{option} trabajo 4hs"), listed.context)
    assert estado(corrected).etapa == "carga_validar_estado"
    assert estado(corrected).draft().novedades[0].horas == 9
    corrected = await process.handle(mensaje("permiso"), corrected.context)
    novelty = estado(corrected).draft().novedades[0]
    assert novelty.horas == 4
    assert novelty.estado_codigo == "PER"
    assert novelty.idproyecto_destino == datos.destino.id
    assert novelty.contacto_id_destino == datos.encargados[1].id
    assert novelty.nombre_proyecto == "Francia 118"
    assert novelty.nombre_encargado_destino == "Bruno Encargado"
    assert "Destino: Francia 118 / Bruno Encargado" in corrected.reply_text


@pytest.mark.asyncio
async def test_listado_prioriza_tarja_vigente_sobre_asignacion_actual(datos, db_session):
    tarja = Tarja(idproyecto=datos.obra.proyecto_id, contacto_id=datos.obra.contacto_id,
                  fechainicio=date(2026, 9, 11), fechafinal=date(2026, 9, 25))
    db_session.add(tarja)
    db_session.flush()
    employee = datos.empleados[0]
    employee.activo = False
    db_session.add(employee)
    db_session.add(TarjaNomina(tarja_id=tarja.id, nomina_id=employee.id, fecha_desde=date(2026, 9, 1),
                              fecha_hasta=date(2026, 9, 15), documentos=[]))
    db_session.commit()
    result = await proceso(FakeLLM()).handle(mensaje("listado"), contexto(datos.obra))
    assert [o.idnomina for o in estado(result).asistencia_opciones] == [employee.id]


@pytest.mark.asyncio
@pytest.mark.parametrize("text,stage,action", [("no", "revision", "guardar"), ("cerrar", "revision", "guardar"),
                                               ("salir", "confirmar_salida", None), ("listo", "revision", "guardar")])
async def test_fin_de_carga_deriva_sin_guardar_ni_validacion_general(datos, db_session, monkeypatch, text, stage, action):
    # Finalizar la carga no debe volver a validar las novedades resueltas.
    def fail_general(*args, **kwargs):
        pytest.fail("La validacion general no pertenece al paso 5")
    monkeypatch.setattr(novedades, "_validate_pending_business_rules", fail_general)
    llm = FakeLLM()
    result = await proceso(llm).handle(mensaje(text), contexto(datos.obra))
    assert estado(result).etapa == stage
    assert estado(result).accion_cierre == action
    assert "Paso 7" not in result.reply_text
    assert ("1. Guardar" if stage == "revision" else "descartar") in result.reply_text
    assert not llm.calls
    assert not db_session.exec(select(ParteDiario)).all()


@pytest.mark.asyncio
async def test_llm_falla_abre_aclaracion_sin_interprete_alternativo(datos):
    llm = FakeLLM(RuntimeError("fallo simulado"), plan(dict(type="agregar_novedad", nombre="Medina", horas=25)))
    process = proceso(llm)
    result = await process.handle(mensaje("falto medina"), contexto(datos.obra))
    assert estado(result).etapa == "carga_aclaracion"
    assert not estado(result).draft().novedades
    snapshot = estado(result).draft().to_dict()
    result = await process.handle(mensaje("medina trabajo 25hs"), result.context)
    assert estado(result).draft().to_dict() == snapshot
    assert "0 y 24" in result.reply_text
    assert estado(result).etapa == "carga_aclaracion"


@pytest.mark.asyncio
async def test_nombre_inexistente_conserva_destino_al_corregirse(datos):
    llm = FakeLLM(plan(dict(type="agregar_novedad", nombre="zzzzz", estado_codigo="P", horas=9,
                           fuera_de_proyecto=True, nombre_proyecto="feqxz")))
    process = proceso(llm)
    result = await process.handle(mensaje("zzzzz trabajo en feqxz"), contexto(datos.obra))
    assert estado(result).etapa == "carga_validar_empleado"
    result = await process.handle(mensaje("Ivan Medina"), result.context)
    assert estado(result).etapa == "carga_validar_obra"
    result = await process.handle(mensaje("1"), result.context)
    assert estado(result).etapa == "carga_validar_encargado"
    result = await process.handle(mensaje("1"), result.context)
    novelty = estado(result).draft().novedades[0]
    assert novelty.idnomina == datos.empleados[0].id
    assert novelty.idproyecto_destino == datos.destino.id


@pytest.mark.asyncio
async def test_nueva_novedad_durante_aclaracion_no_descarta_pendiente(datos):
    llm = FakeLLM(
        plan(dict(type="agregar_novedad", nombre="Perez", estado_codigo="ENF")),
        plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="ACC")),
    )
    process = proceso(llm)
    result = await process.handle(mensaje("Perez enfermo"), contexto(datos.obra))
    result = await process.handle(mensaje("Medina accidente"), result.context)
    assert estado(result).etapa == "carga_validar_empleado"
    assert len(estado(result).draft().pendientes_ambiguos) == 1
    assert estado(result).draft().novedades[0].idnomina == datos.empleados[0].id
    assert len(llm.calls) == 2


@pytest.mark.asyncio
async def test_corregir_eliminar_y_mostrar_respetan_borrador(datos):
    llm = FakeLLM(
        plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="ENF")),
        plan(dict(type="modificar_novedad", nombre="Medina", estado_codigo="ACC")),
        plan(dict(type="mostrar_parte")),
        plan(dict(type="eliminar_novedad", nombre="Medina")),
    )
    process = proceso(llm)
    result = await process.handle(mensaje("Medina enfermo"), contexto(datos.obra))
    result = await process.handle(mensaje("corregi Medina, fue accidente"), result.context)
    assert estado(result).draft().novedades[0].estado_codigo == "ACC"
    snapshot = estado(result).draft().to_dict()
    result = await process.handle(mensaje("mostrar parte"), result.context)
    assert estado(result).etapa == "carga"
    assert estado(result).draft().to_dict() == snapshot
    assert "Parte diario cargado:" in result.reply_text
    assert "para confirmar" not in result.reply_text
    result = await process.handle(mensaje("elimina Medina"), result.context)
    assert not estado(result).draft().novedades


@pytest.mark.asyncio
async def test_consulta_durante_validacion_no_consume_la_seleccion(datos):
    llm = FakeLLM(plan(dict(type="agregar_novedad", nombre="Perez", estado_codigo="ENF")))
    process = proceso(llm)
    result = await process.handle(mensaje("Perez enfermo"), contexto(datos.obra))
    result = await process.handle(mensaje("mostrar nomina"), result.context)
    assert estado(result).etapa == "carga_validar_empleado"
    assert "NOMINA ACTIVA" in result.reply_text
    assert "A cual Perez" in result.reply_text
    assert len(llm.calls) == 1


@pytest.mark.asyncio
async def test_confirmacion_fecha_es_estado_de_carga(datos):
    llm = FakeLLM(plan(dict(type="set_fecha", fecha="2026-09-10")))
    process = proceso(llm)
    result = await process.handle(mensaje("cambiar al 10 de septiembre"), contexto(datos.obra))
    assert estado(result).etapa == "carga_cambiar_fecha"
    result = await process.handle(mensaje("3"), result.context)
    assert estado(result).etapa == "carga_cambiar_fecha"
    result = await process.handle(mensaje("1"), result.context)
    assert estado(result).etapa == "carga"
    assert estado(result).draft().fecha == "2026-09-10"


# Una consulta no confirma el cambio de fecha ni vuelve a interpretar la novedad.
@pytest.mark.asyncio
async def test_consulta_durante_cambio_fecha_conserva_confirmacion(datos):
    llm = FakeLLM(plan(dict(type="set_fecha", fecha="2026-09-10")))
    process = proceso(llm)
    result = await process.handle(mensaje("cambiar al 10 de septiembre"), contexto(datos.obra))
    snapshot = deepcopy(result.context.process_state)
    result = await process.handle(mensaje("mostrar nomina"), result.context)
    assert result.context.process_state == {**snapshot, "historial": result.context.process_state["historial"]}
    assert "NOMINA ACTIVA" in result.reply_text
    assert len(llm.calls) == 1
    result = await process.handle(mensaje("2"), result.context)
    assert estado(result).etapa == "carga"
    assert estado(result).draft().fecha == "2026-09-11"
    assert estado(result).draft().fecha_propuesta is None


@pytest.mark.asyncio
async def test_sin_novedades_hoy_deriva_a_guardar_sin_persistir(datos, db_session):
    llm = FakeLLM(plan(dict(type="sin_novedades")))
    ctx = contexto(datos.obra)
    ctx.process_state["parte_state"]["fecha"] = "2026-09-12"
    result = await proceso(llm).handle(mensaje("todos presentes"), ctx)
    assert estado(result).accion_cierre == "guardar"
    assert estado(result).draft().sin_novedades_informado is True
    assert not db_session.exec(select(ParteDiario)).all()


# Revision con pendientes rechaza el guardado sin iniciar una validacion conversacional.
@pytest.mark.asyncio
async def test_revision_rechaza_pendientes_sin_cambiar_estado(datos):
    llm = FakeLLM(plan(dict(type="agregar_novedad", nombre="Perez", estado_codigo="ENF")))
    process = proceso(llm)
    result = await process.handle(mensaje("Perez enfermo"), contexto(datos.obra))
    result.context.process_state["etapa"] = "revision"
    snapshot = deepcopy(result.context.process_state)
    result = await process.handle(mensaje("guardar"), result.context)
    assert result.context.process_state == {**snapshot, "historial": result.context.process_state["historial"]}
    assert "aclaraciones pendientes" in result.reply_text


@pytest.mark.asyncio
async def test_consulta_partes_pendientes_usa_adaptador_sin_modificar_draft(datos):
    from unittest.mock import AsyncMock

    query = SimpleNamespace(respond=AsyncMock(return_value="Quedan dos partes pendientes."))
    llm = FakeLLM()
    original = contexto(datos.obra)
    result = await proceso(llm, query).handle(mensaje("que partes pendientes tengo"), original)
    assert estado(result).draft().to_dict() == ParteDiarioV3State.from_dict(original.process_state).draft().to_dict()
    assert "Quedan dos partes pendientes" in result.reply_text
    query.respond.assert_awaited_once()
    assert not llm.calls


# Comprueba que cada modo se despacha desde el handler sin pasar por la entrada de carga.
@pytest.mark.asyncio
@pytest.mark.parametrize("stage,target", [
    ("carga", "carga"), ("listado", "listado"),
    ("carga_aclaracion", "aclaracion"),
    ("carga_validar_empleado", "validacion_carga"),
    ("carga_validar_obra", "validacion_carga"),
    ("carga_validar_encargado", "validacion_carga"),
    ("carga_validar_estado", "validacion_carga"),
    ("carga_validar_conflicto", "validacion_carga"),
    ("carga_cambiar_fecha", "validacion_carga"),
])
async def test_despacho_directo_por_estado(datos, monkeypatch, stage, target):
    from unittest.mock import AsyncMock

    routes = {}
    for name in ("carga", "listado", "validacion_carga", "aclaracion"):
        routes[name] = AsyncMock(return_value="Respuesta del flujo")
        monkeypatch.setattr(getattr(handler, name), "procesar", routes[name])
    # Ninguna inspeccion del borrador debe decidir que flujo atiende el mensaje.
    def fail_inspection(state):
        pytest.fail("El despacho debe depender exclusivamente de etapa")

    monkeypatch.setattr(handler.validacion_carga, "tiene_pendientes", fail_inspection)
    result = await proceso(FakeLLM()).handle(mensaje("1"), contexto(datos.obra, stage))
    assert result.reply_text == "Respuesta del flujo"
    assert result.context.process_state["etapa"] == stage
    for name, route in routes.items():
        assert route.await_count == (1 if name == target else 0)


# Los estados retirados se rechazan sin migrarlos ni reiniciar silenciosamente la conversacion.
@pytest.mark.parametrize("stage", ["novedades", "validacion_carga", "apoyos", "validacion", "cierre", "menu", "desconocido"])
def test_estado_no_admitido_no_se_corrige(stage):
    original = {"etapa": stage}
    with pytest.raises(ValueError, match="Etapa de parte diario no admitida"):
        ParteDiarioV3State.from_dict(original)
    assert original == {"etapa": stage}


# Resolver el conflicto de la ultima pagina abre revision sin validacion general.
@pytest.mark.asyncio
async def test_conflicto_en_listado_termina_ultima_pagina_sin_validacion_general(datos, monkeypatch):
    def fail_general(*args, **kwargs):
        pytest.fail("El conflicto de carga no debe ejecutar validacion general")

    monkeypatch.setattr(novedades, "_validate_pending_business_rules", fail_general)
    llm = FakeLLM(
        plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="ENF")),
        plan(dict(type="agregar_novedad", nombre="Medina, Ivan", estado_codigo="ACC")),
    )
    process = proceso(llm)
    result = await process.handle(mensaje("Medina enfermo"), contexto(datos.obra))
    result = await process.handle(mensaje("listado"), result.context)
    option = next(o.opcion for o in estado(result).asistencia_opciones if o.idnomina == datos.empleados[0].id)
    result = await process.handle(mensaje(f"{option} accidente"), result.context)
    assert estado(result).etapa == "carga_validar_conflicto"
    result = await process.handle(mensaje("2"), result.context)
    assert estado(result).etapa == "revision"
    assert estado(result).asistencia_offset == 0
    assert estado(result).revision_origen == "listado"
    assert estado(result).draft().novedades[0].estado_codigo == "ACC"
