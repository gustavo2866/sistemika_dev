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

from agente.v3.subprocesses.parte_diario.llm_client import ParteDiarioLLMClient
from agente.v3.subprocesses.parte_diario.models import EstadoItem, NominaItem, ParteDiarioState


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
    state = ParteDiarioState(oportunidad_id=1, idproyecto=10, fecha="2026-07-30")

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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("messages", nargs="*", help="Mensajes a interpretar.")
    args = parser.parse_args()
    return asyncio.run(_run(args.messages or DEFAULT_MESSAGES))


if __name__ == "__main__":
    raise SystemExit(main())
