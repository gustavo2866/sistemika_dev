"""Consultas activas del dominio con base aislada y sin llamadas al LLM."""

from datetime import date
from decimal import Decimal
import sys
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from sqlmodel import select

from agente.v3.subprocesses.parte_diario.domain.parte_diario import ParteDiarioQueryService
from agente.v3.subprocesses.parte_diario.adapters.query_agent import _build_tools
from app.models import EstadoParteDiario, ParteDiario, ParteDiarioDetalle, ParteDiarioEstado
from tests.unit.test_parte_diario_carga_flow import datos
from tests.unit.test_parte_diario_handler_inicial import escenario


# Prepara un parte con enfermedad y un movimiento interno que no debe mostrarse.
@pytest.fixture
def consulta(datos, db_session):
    parte = ParteDiario(
        idproyecto=datos.obra.proyecto_id, contacto_id=datos.obra.contacto_id,
        fecha=date(2026, 9, 12), estado=EstadoParteDiario.BORRADOR,
    )
    db_session.add(parte)
    db_session.flush()
    for empleado, codigo in zip(datos.empleados, ("ENF", "BAJ")):
        motivo = db_session.exec(
            select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == codigo)
        ).one()
        db_session.add(ParteDiarioDetalle(
            parte_diario_id=parte.id, idnomina=empleado.id,
            idestado=motivo.id, horas=Decimal("0"),
        ))
    db_session.commit()
    return ParteDiarioQueryService(
        session=db_session, proyecto_id=datos.obra.proyecto_id,
        contacto_id=datos.obra.contacto_id, nombre_obra=datos.obra.nombre,
        fecha="2026-09-12",
    )


# La consulta generica cubre ausencias y oculta movimientos internos de nomina.
def test_novedades_filtra_ausencias_y_movimientos_internos(consulta):
    respuesta = consulta.consultar_novedades(desde="2026-09-12", hasta="2026-09-12", horas_igual_a=0)
    assert "Medina, Ivan: ENF, 0h" in respuesta
    assert "Vera" not in respuesta
    assert "BAJ" not in respuesta
    por_persona = consulta.consultar_novedades(
        desde="2026-09-12", hasta="2026-09-12", persona="Medina",
        horas_igual_a=0, agrupar_por="persona",
    )
    assert "Medina, Ivan: 12/09/2026" in por_persona


# Las consultas expuestas conservan borradores, fechas sin cargar y contexto de obra.
def test_partes_pendientes_y_contexto_no_modifican_datos(consulta, db_session):
    respuesta = consulta.consultar_partes_pendientes(desde="2026-09-11", hasta="2026-09-12")
    assert "Partes pendientes:" in respuesta
    assert "12/09/2026: borrador" in respuesta
    assert "11/09/2026: sin cargar" in respuesta
    assert "Medina, Ivan" in consulta.consultar_contexto_parte(tipo="nomina")
    assert "Obra seleccionada:" in consulta.consultar_contexto_parte(tipo="obra")
    assert "Estados disponibles:" in consulta.consultar_contexto_parte(tipo="estados")
    assert db_session.exec(select(ParteDiario)).one().estado == EstadoParteDiario.BORRADOR
    assert len(db_session.exec(select(ParteDiarioDetalle)).all()) == 2


# Los rangos invalidos se rechazan sin ejecutar consultas ambiguas.
@pytest.mark.parametrize("desde,hasta,esperado", [
    ("2026-09-13", "2026-09-12", "rango de fechas esta invertido"),
    ("sin fecha", "2026-09-12", "No pude interpretar la fecha"),
])
def test_consultas_rechazan_rangos_invalidos(consulta, desde, hasta, esperado):
    assert esperado in consulta.consultar_novedades(desde=desde, hasta=hasta)
    assert esperado in consulta.consultar_partes(desde=desde, hasta=hasta)


# La herramienta conserva el mensaje para distinguir nomina de obra y nomina global.
def test_herramienta_contexto_recibe_el_pedido_original(monkeypatch):
    monkeypatch.setitem(sys.modules, "agents", SimpleNamespace(function_tool=lambda function: function))
    servicio = Mock()
    servicio.consultar_contexto_parte.return_value = "NOMINA COMPLETA"
    tools = _build_tools(servicio, message_text="mostrar personal de toda la empresa")
    consultar = next(tool for tool in tools if tool.__name__ == "consultar_contexto_parte")
    assert consultar(tipo="nomina") == "NOMINA COMPLETA"
    servicio.consultar_contexto_parte.assert_called_once_with(
        tipo="nomina", pedido_usuario="mostrar personal de toda la empresa",
    )


# Las etiquetas de empleados externos se forman con datos precargados, sin consultas del renderer.
def test_nomina_completa_incluye_procedencia(consulta, datos, db_session):
    empleado = datos.empleados[1]
    empleado.idproyecto = datos.destino.id
    db_session.add(empleado)
    db_session.commit()
    respuesta = consulta.consultar_contexto_parte(tipo="toda la nomina")
    assert f"Vera, Pablo ({datos.destino.nombre})" in respuesta
