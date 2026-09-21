"""Smoke test directo del interprete LLM de parteDiario v3.

Uso:
    python backend/scripts/parte_diario_llm_smoke.py "medina esta enfermo"
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from agente.v3.subprocesses.parte_diario.adapters.llm import ParteDiarioLLMClient
from agente.v3.subprocesses.parte_diario.domain.models import EstadoItem, NominaItem, NovedadPersonal, ParteDiarioDraft


DEFAULT_MESSAGES = [
    "faltaron vera y serrano",
    "medina esta enfermo",
    "ruiz trabajo 12hs",
]


async def _run(messages: list[str]) -> int:
    logging.basicConfig(level=logging.INFO)
    client = ParteDiarioLLMClient()
    estados = [
        EstadoItem(id=1, abreviatura="P", nombre="PRESENTE"),
        EstadoItem(id=2, abreviatura="FAL", nombre="FALTA"),
        EstadoItem(id=3, abreviatura="ENF", nombre="ENFERMEDAD"),
    ]
    nominas = [
        NominaItem(idnomina=101, nombre="Daniela", apellido="Vera", idproyecto=10),
        NominaItem(idnomina=102, nombre="Juan David", apellido="Serrano", idproyecto=10, nro_legajo="501183"),
        NominaItem(idnomina=103, nombre="Pablo", apellido="Ruiz", idproyecto=10),
        NominaItem(idnomina=104, nombre="Carlos", apellido="Medina", idproyecto=10),
    ]
    state = ParteDiarioDraft(oportunidad_id=1, idproyecto=10, fecha="2026-07-30")

    print(f"model={os.getenv('OPENAI_CHAT_REPLY_MODEL', 'gpt-4.1-mini')}")
    for message in messages:
        print(f"\nmensaje={message!r}")
        try:
            plan = await client.interpret_turn(message, state, nominas, estados)
        except Exception as exc:
            print(f"ERROR {type(exc).__name__}: {exc}")
            return 1
        print(
            json.dumps(
                {
                    "operations": [
                        {
                            "type": item.type,
                            "nombre": item.nombre,
                            "estado_codigo": item.estado_codigo,
                            "horas": item.horas,
                            "horas_extra": item.horas_extra,
                        }
                        for item in plan.operations
                    ],
                    "reply": plan.reply,
                    "llm_ms": plan.llm_ms,
                    "raw_response": plan.raw_response,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    return 0


# Verifica interpretacion real y ejecucion local con datos ficticios, sin escribir en DB.
async def _verificar_confirmacion_contextual() -> int:
    from agente.v3.subprocesses.parte_diario.domain.novedades import execute_plan

    client = ParteDiarioLLMClient()
    estados = [EstadoItem(1, "P", "PRESENTE")]
    nominas = [NominaItem(101, "Juan", "Perez"), NominaItem(102, "Ana", "Lopez")]
    state = ParteDiarioDraft(
        oportunidad_id=1, idproyecto=10, fecha="2026-09-02", parte_id=123, retomado=True,
        novedades=[NovedadPersonal(p.nombre_completo, idnomina=p.idnomina,
                                  idestado=1, estado_codigo="P", horas=9) for p in nominas],
    )
    contexto = {
        "etapa": "carga_aclaracion", "obra": "Obra de prueba", "fecha_parte": state.fecha,
        "pregunta_pendiente": "Queres eliminar todas las novedades del parte?",
        "historial": [
            {"usuario": "parte diario 02/09/2026",
             "asistente": "Parte diario recuperado con Perez, Juan y Lopez, Ana. Queres agregar o corregir alguna novedad?"},
            {"usuario": "limpiar todo", "asistente": "Queres eliminar todas las novedades del parte?"},
        ],
    }
    for message, expected, consulta in [("si", 0, False), ("ok", 0, False), ("no", 2, False),
                                       ("si", 0, True), ("no", 2, True)]:
        turno_contexto = {**contexto, "historial": list(contexto["historial"])}
        if consulta:
            turno_contexto["historial"].append({
                "usuario": "nomina", "asistente": "NOMINA ACTIVA: Perez, Juan; Lopez, Ana.\n\n"
                + contexto["pregunta_pendiente"],
            })
        plan = await asyncio.wait_for(client.interpret_turn(
            message, state, nominas, estados, contexto_conversacion=turno_contexto,
        ), timeout=45)
        result = execute_plan(state, plan, nominas, nominas, estados)
        print(json.dumps({
            "mensaje": message,
            "consulta_intermedia": consulta,
            "operaciones": [{"type": op.type, "nombre": op.nombre} for op in plan.operations],
            "respuesta_llm": plan.reply,
            "novedades_restantes": len(result.next_state.novedades),
            "errores": result.errors,
        }, ensure_ascii=False))
        if result.errors or len(result.next_state.novedades) != expected:
            return 1
        if expected == 0 and [op.type for op in plan.operations] != ["eliminar_novedad"] * 2:
            return 1
        if expected == 2 and [op.type for op in plan.operations] != ["retomar_carga"]:
            return 1
        if result.next_state.fecha != state.fecha or result.next_state.parte_id != state.parte_id:
            return 1
    return 0


# Evalua el prompt real en texto libre y LISTADO normalizado, sin acceso a datos reales.
async def _verificar_clasificacion_novedades() -> int:
    from agente.v3.subprocesses.parte_diario.domain.novedades import execute_plan
    from app.services.parte_diario_estado_service import DEFAULT_PARTE_DIARIO_ESTADOS

    client = ParteDiarioLLMClient()
    estados = [EstadoItem(i, e.abreviatura, e.nombre)
               for i, e in enumerate(DEFAULT_PARTE_DIARIO_ESTADOS, start=1)]
    nominas = [NominaItem(101, "Xavier", "Delgado"), NominaItem(102, "Paco", "Gerlo"),
               NominaItem(103, "Ivan", "Medina")]
    casos = [
        (["se quebro el braso", "pidio salir para ir al banco trabajo 3hs"],
         [("ACC", None), ("PER", 3)]),
        (["se lastimo al caerse de la escalera", "le dieron permiso para hacer un tramite y alcanzo a trabajar 4hs"],
         [("ACC", None), ("PER", 4)]),
        (["no vino", "esta con fiebre", "trabajo 12hs"],
         [("FAL", None), ("ENF", None), ("P", 12)]),
    ]
    fallos = 0
    for motivos, expected in casos:
        for modo in ("carga", "listado"):
            draft = ParteDiarioDraft(oportunidad_id=1, idproyecto=10, fecha="2026-09-12")
            mensaje = "\n".join(
                f"[idnomina={p.idnomina}] {p.nombre_completo}: {motivo}"
                if modo == "listado" else f"{p.apellido} {motivo}"
                for p, motivo in zip(nominas, motivos)
            )
            plan = await asyncio.wait_for(client.interpret_turn(
                mensaje, draft, nominas, estados,
                contexto_conversacion={"etapa": modo, "obra": "Obra de prueba",
                                       "fecha_parte": draft.fecha, "historial": []},
            ), timeout=45)
            result = execute_plan(draft, plan, nominas, nominas, estados)
            actual = [(op.estado_codigo, op.horas) for op in plan.operations]
            novedades = [(n.idnomina, n.estado_codigo, n.horas) for n in result.next_state.novedades]
            expected_draft = [(p.idnomina, codigo, horas if horas is not None else 0)
                              for p, (codigo, horas) in zip(nominas, expected)]
            ok = (
                actual == expected and novedades == expected_draft
                and all(op.type == "agregar_novedad" and not op.fuera_de_proyecto
                        and not op.nombre_proyecto and op.horas_extra is None for op in plan.operations)
                and (modo != "listado" or [op.idnomina for op in plan.operations]
                     == [p.idnomina for p in nominas[:len(expected)]])
                and not plan.reply and not result.errors and not result.next_state.pendientes_ambiguos
            )
            print(json.dumps({"modo": modo, "mensaje": mensaje, "operaciones": actual,
                              "novedades": novedades, "errores": result.errors, "ok": ok},
                             ensure_ascii=False))
            fallos += not ok
    return int(fallos > 0)


# Comprueba solicitudes nuevas despues de cargar, sin confundirlas con rechazos del historial.
async def _verificar_solicitudes_carga() -> int:
    from agente.v3.subprocesses.parte_diario.domain.novedades import execute_plan

    client = ParteDiarioLLMClient()
    estados = [EstadoItem(1, "P", "PRESENTE")]
    nominas = [NominaItem(101, "Juan", "Perez"), NominaItem(102, "Ana", "Lopez")]
    draft = ParteDiarioDraft(oportunidad_id=1, idproyecto=10, fecha="2026-09-12",
                            novedades=[NovedadPersonal(p.nombre_completo, idnomina=p.idnomina,
                                                       idestado=1, estado_codigo="P", horas=9) for p in nominas])
    contexto = {
        "etapa": "carga", "pregunta_pendiente": None, "obra": "Obra de prueba",
        "historial": [
            {"usuario": "limpiar", "asistente": "Queres eliminar todas las novedades?"},
            {"usuario": "no", "asistente": "No se aplicaron cambios. Hay alguna otra novedad?"},
            {"usuario": "Perez y Lopez trabajaron 9hs", "asistente": "Cargado.\n"
             "Perez, Juan: P, 9h\nLopez, Ana: P, 9h\n\nHay alguna otra novedad?"},
        ],
    }
    fallos = 0
    for message in ("limpia todo", "quiero quitar todas las novedades del parte", "cambia eso"):
        plan = await asyncio.wait_for(client.interpret_turn(
            message, draft, nominas, estados, contexto_conversacion=contexto,
        ), timeout=45)
        result = execute_plan(draft, plan, nominas, nominas, estados)
        operaciones = [op.type for op in plan.operations]
        pregunta = (result.status == "clarification" and bool(plan.reply)
                    and set(operaciones) <= {"pedir_aclaracion"}
                    and result.next_state.to_dict() == draft.to_dict())
        eliminacion = (message != "cambia eso" and operaciones == ["eliminar_novedad"] * 2
                       and result.status == "updated" and not result.next_state.novedades)
        ok = not result.errors and (pregunta or eliminacion)
        print(json.dumps({"mensaje": message, "operaciones": operaciones,
                          "respuesta": plan.reply, "status": result.status, "ok": ok}, ensure_ascii=False))
        fallos += not ok
    return int(fallos > 0)


# Selecciona la prueba explicita para evitar llamadas adicionales no solicitadas.
def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("messages", nargs="*", help="Mensajes a interpretar.")
    parser.add_argument("--confirmacion-contextual", action="store_true",
                        help="Verifica respuestas a una confirmacion con historial y borrador ficticios.")
    parser.add_argument("--clasificacion-novedades", action="store_true",
                        help="Verifica motivos y horas con el LLM real y borradores ficticios.")
    parser.add_argument("--solicitudes-carga", action="store_true",
                        help="Verifica solicitudes nuevas de cambio y preguntas sin accion de retorno.")
    args = parser.parse_args()
    if args.solicitudes_carga:
        return asyncio.run(_verificar_solicitudes_carga())
    if args.clasificacion_novedades:
        return asyncio.run(_verificar_clasificacion_novedades())
    if args.confirmacion_contextual:
        return asyncio.run(_verificar_confirmacion_contextual())
    return asyncio.run(_run(args.messages or DEFAULT_MESSAGES))


if __name__ == "__main__":
    raise SystemExit(main())
