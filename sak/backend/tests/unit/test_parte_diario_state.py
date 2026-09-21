"""Contratos del borrador y del estado conversacional activo."""

from dataclasses import fields
from typing import get_args

import pytest

from agente.v3.subprocesses.parte_diario.domain.models import (
    ConflictoNovedad,
    DestinoEncargadoOption,
    DestinoProyectoOption,
    NominaItem,
    NovedadPersonal,
    ParteDiarioDraft,
    PendienteAmbiguo,
)
from agente.v3.subprocesses.parte_diario.state import (
    ParteDiarioAsistenciaOption,
    ParteDiarioFechaOption,
    ParteDiarioOption,
    ParteDiarioStage,
    ParteDiarioV3State,
)


# Conserva datos anidados y evita compartir listas al copiar el borrador.
def test_borrador_roundtrip_y_copia_independiente():
    novedad = NovedadPersonal("Medina", idnomina=10, estado_codigo="P", horas=4)
    interna = NovedadPersonal("Neto", idnomina=13, estado_codigo="ALT", horas=9)
    pendiente = PendienteAmbiguo(
        "Perez", candidatos=[NominaItem(11, "Juan", "Perez")],
        candidatos_externos=[NominaItem(12, "Pedro", "Perez", fuera_de_proyecto=True)],
        opciones_proyecto_destino=[DestinoProyectoOption(1, 20, "Francia")],
        opciones_encargado_destino=[DestinoEncargadoOption(1, 30, "Gustavo")],
        destino_pendiente="obra", fuera_de_proyecto=True,
    )
    draft = ParteDiarioDraft(
        oportunidad_id=1, idproyecto=2, contacto_id=3, fecha="2026-09-11",
        novedades=[novedad], novedades_internas=[interna], pendientes_ambiguos=[pendiente],
        conflictos_novedad=[ConflictoNovedad(10, "Medina", [novedad])],
        fecha_propuesta="2026-09-10",
    )
    restored = ParteDiarioDraft.from_dict(draft.to_dict(), oportunidad_id=1)
    assert restored == draft
    copied = draft.copy()
    copied.pendientes_ambiguos[0].candidatos.clear()
    copied.conflictos_novedad[0].opciones[0].horas = 8
    copied.novedades_internas[0].horas = 0
    assert draft.pendientes_ambiguos[0].candidatos
    assert draft.conflictos_novedad[0].opciones[0].horas == 4
    assert draft.novedades_internas[0].horas == 9


# La serializacion preserva etapa, origen y pagina sin controles dentro del draft.
def test_conversacion_roundtrip_con_menus_y_retorno():
    state = ParteDiarioV3State(
        etapa="carga_validar_empleado", contacto_id=3, oportunidad_id=1, proyecto_id=2,
        nombre_obra="Francia", validacion_origen="listado", asistencia_offset=20,
        salida_origen="carga_validar_empleado", fecha_siguiente="2026-09-12",
        opciones_obra=[ParteDiarioOption(1, "Francia", 3, 1, 2)],
        opciones_fecha=[ParteDiarioFechaOption(1, "2026-09-11", "BORRADOR", 4)],
        asistencia_opciones=[ParteDiarioAsistenciaOption(21, 10, "Juan", "Perez")],
        asistencia_catalogo=[
            ParteDiarioAsistenciaOption(21, 10, "Juan", "Perez"),
            ParteDiarioAsistenciaOption(22, 11, "Pedro", "Sosa"),
        ],
        revision_origen="listado",
    )
    state.set_draft(ParteDiarioDraft(
        oportunidad_id=1, idproyecto=2, fecha="2026-09-11",
        pendientes_ambiguos=[PendienteAmbiguo("Perez", candidatos=[NominaItem(10, "Juan", "Perez")])],
    ))
    restored = ParteDiarioV3State.from_dict(state.to_dict())
    assert restored == state
    assert restored.draft().contacto_id == 3
    assert restored.draft().pendientes_ambiguos[0].nombre == "Perez"
    assert not {"esperando", "validacion_origen", "etapa"} & restored.draft().to_dict().keys()


# La pregunta y el origen sobreviven entre mensajes sin convertirse en estados paralelos.
def test_aclaracion_roundtrip():
    state = ParteDiarioV3State(etapa="carga_aclaracion", aclaracion_origen="listado",
                              aclaracion_pregunta="Que paso con Medina?", asistencia_offset=8)
    assert ParteDiarioV3State.from_dict(state.to_dict()) == state
    assert "aclaracion_pregunta" not in state.draft().to_dict()


# Todos los estados admitidos sobreviven a la reconstruccion sin ser redirigidos.
@pytest.mark.parametrize("etapa", get_args(ParteDiarioStage))
def test_etapa_es_preservada(etapa):
    assert ParteDiarioV3State.from_dict({"etapa": etapa}).etapa == etapa


# Impide reintroducir los campos y controles retirados en los contratos activos.
def test_contratos_no_conservan_campos_obsoletos():
    retirados = {
        ParteDiarioV3State: {
            "apoyo_proyecto_id", "apoyo_proyecto_nombre", "opciones_apoyo_proyecto",
            "asistencia_registros", "asistencia_reemplazo_pendiente", "validacion_tipo",
            "fecha_menu_pendiente", "fecha_objetivo", "dia_semana_objetivo",
        },
        ParteDiarioDraft: {"esperando", "validacion_origen"},
        PendienteAmbiguo: {"pagina_candidatos", "lista_candidatos_mostrada"},
    }
    for model, obsolete in retirados.items():
        assert not obsolete & {item.name for item in fields(model)}


# El historial tiene limite, mantiene pares completos y no comparte datos entre copias.
def test_historial_se_serializa_separado_del_borrador():
    state = ParteDiarioV3State(etapa="carga", parte_state={"fecha": "2026-09-11"})
    for index in range(15):
        state.registrar_turno(f"mensaje {index}", f"respuesta {index}")
    assert len(state.historial) == 12
    assert state.historial[0]["usuario"] == "mensaje 3"
    assert state.historial[-1] == {
        "usuario": "mensaje 14", "asistente": "respuesta 14",
        "etapa": "carga", "fecha_parte": "2026-09-11",
    }
    raw = state.to_dict()
    restored = ParteDiarioV3State.from_dict(raw)
    assert restored.historial == state.historial
    restored.historial[0]["asistente"] = "otra respuesta"
    raw["historial"][1]["usuario"] = "otro mensaje"
    assert state.historial[0]["asistente"] == "respuesta 3"
    assert state.historial[1]["usuario"] == "mensaje 4"
    assert state.parte_state == {"fecha": "2026-09-11"}
