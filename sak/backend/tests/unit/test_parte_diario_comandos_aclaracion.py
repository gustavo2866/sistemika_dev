"""Comandos por estado y aclaraciones con DB aislada, sin llamadas externas."""

from copy import deepcopy

import pytest
from sqlmodel import select

from agente.v3.subprocesses.parte_diario.models import TurnPlan
from app.models import Nomina, ParteDiario
from tests.unit.test_parte_diario_carga_flow import (
    FakeLLM, contexto, datos, escenario, estado, mensaje, plan, proceso,
)


# Los comandos comunes no dependen del estado ni consumen un mensaje del interprete.
@pytest.mark.asyncio
@pytest.mark.parametrize("etapa", ["carga", "revision", "seleccionar_fecha", "listado", "confirmar_salida"])
@pytest.mark.parametrize("comando", ["nomina", "N\u00d3MINA", "mostrar nomina"])
async def test_nomina_comun_conserva_contexto(datos, etapa, comando):
    llm = FakeLLM()
    process = proceso(llm)
    ctx = contexto(datos.obra)
    if etapa == "listado":
        ctx = (await process.handle(mensaje("listado"), ctx)).context
    ctx.process_state["etapa"] = etapa
    original = deepcopy(ctx.process_state)
    result = await process.handle(mensaje(comando), ctx)
    assert "NOMINA ACTIVA" in result.reply_text
    assert "Medina" in result.reply_text
    assert result.context.process_state == {**original, "historial": result.context.process_state["historial"]}
    assert not llm.calls


# Sin obra resuelta la consulta no adivina contexto ni cambia la etapa de seleccion.
@pytest.mark.asyncio
async def test_nomina_sin_obra_no_inicia_carga(datos):
    from agente.v3.contracts import V3ConversationContext

    llm = FakeLLM()
    result = await proceso(llm).handle(mensaje("nomina"), V3ConversationContext(conversation_id="conv"))
    assert estado(result).etapa == "inicial"
    assert not estado(result).has_resolved_obra()
    assert "Primero selecciona" in result.reply_text
    assert not llm.calls


# NO en carga abre revision sin LLM ni persistencia, aun cuando el borrador este vacio.
@pytest.mark.asyncio
@pytest.mark.parametrize("con_novedades", [False, True])
async def test_no_local_en_carga(datos, db_session, con_novedades):
    llm = FakeLLM(plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="ENF")))
    process = proceso(llm)
    ctx = contexto(datos.obra)
    if con_novedades:
        ctx = (await process.handle(mensaje("Medina enfermo"), ctx)).context
    antes = len(llm.calls)
    result = await process.handle(mensaje("NO"), ctx)
    assert estado(result).etapa == "revision"
    assert "1. Guardar" in result.reply_text
    assert len(llm.calls) == antes
    assert not db_session.exec(select(ParteDiario)).all()


# NO durante la aclaracion rechaza la accion via LLM; luego NO en carga abre revision.
@pytest.mark.asyncio
async def test_aclaracion_consulta_rechazo_y_fin_de_carga(datos, db_session):
    pregunta = "Queres eliminar todas las novedades del parte?"
    llm = FakeLLM(
        plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="ENF")),
        TurnPlan(reply=pregunta),
        plan(dict(type="retomar_carga")),
    )
    process = proceso(llm)
    result = await process.handle(mensaje("Medina enfermo"), contexto(datos.obra))
    borrador = estado(result).draft().to_dict()
    result = await process.handle(mensaje("limpiar todo"), result.context)
    assert estado(result).etapa == "carga_aclaracion"
    assert estado(result).aclaracion_origen == "carga"
    assert estado(result).aclaracion_pregunta == pregunta
    snapshot = deepcopy(result.context.process_state)
    for _ in range(2):
        result = await process.handle(mensaje("nomina"), result.context)
        assert result.reply_text.count(pregunta) == 1
        assert result.context.process_state == {**snapshot, "historial": result.context.process_state["historial"]}
    result = await process.handle(mensaje("no"), result.context)
    assert len(llm.calls) == 3
    assert llm.contexts[-1]["etapa"] == "carga_aclaracion"
    assert llm.contexts[-1]["pregunta_pendiente"] == pregunta
    assert estado(result).etapa == "carga"
    assert estado(result).draft().to_dict() == borrador
    assert estado(result).aclaracion_origen is None
    assert estado(result).aclaracion_pregunta is None
    result = await process.handle(mensaje("no"), result.context)
    assert estado(result).etapa == "revision"
    assert len(llm.calls) == 3
    assert not db_session.exec(select(ParteDiario)).all()


# Otra pregunta y una consulta libre conservan el estado de aclaracion y su pregunta vigente.
@pytest.mark.asyncio
async def test_aclaracion_incompleta_y_consulta_libre(datos):
    llm = FakeLLM(TurnPlan(reply="Que queres modificar?"), TurnPlan(reply="De que empleado?"),
                  plan(dict(type="mostrar_parte")))
    process = proceso(llm)
    result = await process.handle(mensaje("corregir"), contexto(datos.obra))
    result = await process.handle(mensaje("las horas"), result.context)
    assert estado(result).etapa == "carga_aclaracion"
    assert estado(result).aclaracion_origen == "carga"
    result = await process.handle(mensaje("antes mostrame lo que cargue"), result.context)
    assert estado(result).etapa == "carga_aclaracion"
    assert result.reply_text.endswith("De que empleado?")


# CANCELAR y SALIR piden descarte; VOLVER termina solo la aclaracion.
@pytest.mark.asyncio
async def test_aclaracion_cancelar_descarte_y_volver(datos):
    llm = FakeLLM(TurnPlan(reply="Que novedades queres quitar?"))
    process = proceso(llm)
    result = await process.handle(mensaje("limpiar"), contexto(datos.obra))
    snapshot = deepcopy(result.context.process_state)
    result = await process.handle(mensaje("cancelar"), result.context)
    assert estado(result).etapa == "confirmar_salida"
    result = await process.handle(mensaje("no"), result.context)
    assert result.context.process_state == {**snapshot, "historial": result.context.process_state["historial"]}
    assert result.reply_text == "Que novedades queres quitar?"
    result = await process.handle(mensaje("salir"), result.context)
    assert estado(result).etapa == "confirmar_salida"
    result = await process.handle(mensaje("2"), result.context)
    assert estado(result).etapa == "carga_aclaracion"
    result = await process.handle(mensaje("volver"), result.context)
    assert estado(result).etapa == "carga"
    assert estado(result).aclaracion_origen is None
    assert len(llm.calls) == 1


# SALIR pide descartar desde aclaracion y cancelar recupera la pregunta y su pagina.
@pytest.mark.asyncio
@pytest.mark.parametrize("modo", ["carga", "listado"])
@pytest.mark.parametrize("fallo", ["sin_interpretacion", "horas_invalidas"])
async def test_fallo_abre_loop_y_salir_conserva_origen(datos, modo, fallo):
    first = (RuntimeError("fallo simulado") if fallo == "sin_interpretacion" else
             plan(dict(type="agregar_novedad", nombre="Medina", horas=25)))
    llm = FakeLLM(
        plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="ENF")),
        first, RuntimeError("segundo fallo"),
    )
    process = proceso(llm)
    result = await process.handle(mensaje("Medina enfermo"), contexto(datos.obra))
    if modo == "listado":
        result = await process.handle(mensaje("listado"), result.context)
    snapshot = estado(result)
    texto = "no se que paso" if fallo == "sin_interpretacion" else "Medina trabajo 25hs"
    if modo == "listado":
        opcion = next(o.opcion for o in snapshot.asistencia_opciones if o.idnomina == datos.empleados[0].id)
        texto = f"{opcion} " + texto
    result = await process.handle(mensaje(texto), result.context)
    assert estado(result).etapa == "carga_aclaracion"
    assert estado(result).aclaracion_origen == modo
    assert "?" in result.reply_text
    result = await process.handle(mensaje("sigue sin quedar claro"), result.context)
    assert estado(result).etapa == "carga_aclaracion"
    assert estado(result).aclaracion_origen == modo
    result = await process.handle(mensaje("SALIR"), result.context)
    current = estado(result)
    assert current.etapa == "confirmar_salida"
    assert current.salida_origen == "carga_aclaracion"
    result = await process.handle(mensaje("2"), result.context)
    current = estado(result)
    assert current.etapa == "carga_aclaracion"
    assert current.draft().to_dict() == snapshot.draft().to_dict()
    assert current.asistencia_offset == snapshot.asistencia_offset
    assert current.asistencia_opciones == snapshot.asistencia_opciones
    assert current.aclaracion_pregunta is not None
    assert current.aclaracion_origen == modo
    assert current.salida_origen is None
    result = await process.handle(mensaje("VOLVER"), result.context)
    assert estado(result).etapa == modo
    assert estado(result).aclaracion_pregunta is None
    assert estado(result).aclaracion_origen is None
    assert len(llm.calls) == 3


# Corregir datos luego de un fallo vuelve a usar el ejecutor comun, sin otro circuito.
@pytest.mark.asyncio
async def test_fallo_se_aclara_y_aplica(datos):
    llm = FakeLLM(plan(dict(type="agregar_novedad", nombre="Medina", horas=25)),
                  plan(dict(type="agregar_novedad", nombre="Medina", estado_codigo="PER", horas=3)))
    process = proceso(llm)
    result = await process.handle(mensaje("Medina trabajo 25hs"), contexto(datos.obra))
    assert estado(result).etapa == "carga_aclaracion"
    result = await process.handle(mensaje("fueron 3hs y se fue con permiso"), result.context)
    assert estado(result).etapa == "carga"
    assert estado(result).aclaracion_pregunta is None
    assert [(n.estado_codigo, n.horas) for n in estado(result).draft().novedades] == [("PER", 3)]


# Un error de ejecucion conserva las novedades validas del lote y pregunta por lo que falta.
@pytest.mark.asyncio
async def test_error_parcial_de_lote_abre_aclaracion(datos):
    llm = FakeLLM(plan(
        dict(type="agregar_novedad", nombre="Medina", estado_codigo="ENF"),
        dict(type="eliminar_novedad", nombre="Inexistente"),
    ))
    process = proceso(llm)
    result = await process.handle(mensaje("Medina enfermo y quitar Inexistente"), contexto(datos.obra))
    assert estado(result).etapa == "carga_aclaracion"
    assert estado(result).draft().novedades[0].estado_codigo == "ENF"
    assert "?" in result.reply_text
    result = await process.handle(mensaje("salir"), result.context)
    assert estado(result).etapa == "confirmar_salida"
    result = await process.handle(mensaje("2"), result.context)
    assert estado(result).etapa == "carga_aclaracion"
    assert estado(result).draft().novedades[0].estado_codigo == "ENF"


# LISTADO conserva identidad y pagina al aclarar; solo avanza al completar novedades.
@pytest.mark.asyncio
@pytest.mark.parametrize("resolucion", ["novedad", "validacion", "rechazo"])
async def test_aclaracion_de_listado_retorna_por_camino_comun(datos, db_session, resolucion):
    for i in range(9):
        db_session.add(Nomina(nombre="Extra", apellido=f"Zeta{i}", dni=f"acl-{i}",
                             idproyecto=datos.obra.proyecto_id, encargado_contacto_id=datos.obra.contacto_id))
    db_session.commit()
    persona = datos.empleados[0]
    operacion = (dict(type="retomar_carga") if resolucion == "rechazo" else
                 dict(type="agregar_novedad", nombre="Medina, Ivan", idnomina=persona.id,
                      estado_codigo="ENF") if resolucion == "novedad" else
                 dict(type="agregar_novedad", nombre="Medina, Ivan", idnomina=persona.id,
                      estado_codigo="P", horas=5, fuera_de_proyecto=True, nombre_proyecto="feqxz"))
    llm = FakeLLM(TurnPlan(reply="Que paso con Medina?"), plan(operacion))
    process = proceso(llm)
    result = await process.handle(mensaje("listado"), contexto(datos.obra))
    opcion = next(o.opcion for o in estado(result).asistencia_opciones if o.idnomina == persona.id)
    result = await process.handle(mensaje(f"{opcion} algo paso"), result.context)
    assert estado(result).etapa == "carga_aclaracion"
    assert estado(result).aclaracion_origen == "listado"
    assert estado(result).asistencia_offset == 0
    result = await process.handle(mensaje("nomina"), result.context)
    result = await process.handle(mensaje("no" if resolucion == "rechazo" else "te aclaro lo que paso"), result.context)
    assert any(o["idnomina"] == persona.id for o in llm.contexts[-1]["opciones_listado"])
    assert len(llm.calls) == 2
    assert estado(result).aclaracion_origen is None
    if resolucion == "validacion":
        assert estado(result).etapa == "carga_validar_obra"
        assert estado(result).validacion_origen == "listado"
        assert estado(result).asistencia_offset == 0
        result = await process.handle(mensaje("1"), result.context)
        result = await process.handle(mensaje("2"), result.context)
    assert estado(result).etapa == "listado"
    assert estado(result).asistencia_offset == (0 if resolucion == "rechazo" else 8)
    if resolucion != "rechazo":
        assert estado(result).draft().novedades[0].idnomina == persona.id


# Las frases libres no se convierten en comandos comunes por contener la palabra nomina.
@pytest.mark.asyncio
async def test_consulta_libre_no_se_intercepta_como_comando(datos):
    llm = FakeLLM(plan(dict(type="mostrar_nomina", nombre="Medina")))
    result = await proceso(llm).handle(mensaje("mostrame los Medina de la nomina"), contexto(datos.obra))
    assert len(llm.calls) == 1
    assert "Medina" in result.reply_text
    assert "Vera" not in result.reply_text


# La pregunta de un pedido de limpieza activa aclaracion; la respuesta ejecuta la eliminacion.
@pytest.mark.asyncio
async def test_solicitud_nueva_pregunta_y_ejecuta_desde_aclaracion(datos, db_session):
    from agente.v3.subprocesses.parte_diario.adapters.llm import ParteDiarioLLMClient
    from tests.unit.test_parte_diario_llm_client import FakeChatClient

    result = await proceso(FakeLLM(plan(
        dict(type="agregar_novedad", nombre="Medina", estado_codigo="ENF"),
    ))).handle(mensaje("Medina enfermo"), contexto(datos.obra))
    chat = FakeChatClient()
    process = proceso(ParteDiarioLLMClient(chat_client=chat))
    chat.next_response = {"backend_action": "ask_clarification", "operations": [],
                          "reply": "Queres quitar todas las novedades de este parte?"}
    result = await process.handle(mensaje("limpia todo"), result.context)
    assert estado(result).etapa == "carga_aclaracion"
    assert len(estado(result).draft().novedades) == 1
    assert "No se aplicaron cambios" not in result.reply_text
    properties = chat.calls[0]["response_format"]["json_schema"]["schema"]["properties"]
    assert "resume_loading" not in properties["backend_action"]["enum"]
    chat.next_response = {"backend_action": "delete_novelty", "operations": [
        {"type": "eliminar_novedad", "nombre": "Medina", "idnomina": datos.empleados[0].id},
    ], "reply": None}
    result = await process.handle(mensaje("si"), result.context)
    assert estado(result).etapa == "carga"
    assert not estado(result).draft().novedades
    assert estado(result).aclaracion_pregunta is None
    assert not db_session.exec(select(ParteDiario)).all()
