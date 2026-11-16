"""Diagnostico directo del mismo interprete usado por Parte Diario v3.

Uso desde la raiz del repo:
  python backend/scripts/parte_diario_llm_diagnostic.py --dry-run
  python backend/scripts/parte_diario_llm_diagnostic.py --timeout 45
  python backend/scripts/parte_diario_llm_diagnostic.py --input turno.json

El JSON de entrada contiene mensaje, parte (draft.to_dict()), estados
([{id, abreviatura, nombre}]), contexto_conversacion y opcionalmente stage.
Sin --input usa una reconstruccion aproximada del turno "No hubo otras";
no representa el snapshot historico exacto. Usa OPENAI_API_KEY del entorno
o backend/.env y la misma resolucion de modelo que el adapter del agente.
No accede a la DB, no ejecuta operaciones del plan ni envia WhatsApp.
La ejecucion local no reproduce la conectividad de Cloud Run.
"""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import asdict
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

from agente.v3.llm import OpenAIChatClient
from agente.v3.subprocesses.parte_diario.adapters.llm import ParteDiarioLLMClient
from agente.v3.subprocesses.parte_diario.adapters.model_config import resolve_parte_diario_model
from agente.v3.subprocesses.parte_diario.domain.models import EstadoItem, ParteDiarioDraft


class DiagnosticChatClient(OpenAIChatClient):
    """Observa el pedido del adapter sin duplicar el armado del prompt/schema."""

    def __init__(self, *, dry_run: bool, **kwargs):
        super().__init__(**kwargs)
        self.dry_run = dry_run

    async def complete_json(self, **kwargs):
        print(json.dumps({
            "model": self.model,
            "reasoning_effort": self.reasoning_effort,
            "max_tokens": kwargs.get("max_tokens"),
            "system_prompt_chars": len(kwargs["system_prompt"]),
            "user_content_chars": len(kwargs.get("user_content", "")),
            "history_messages": len(kwargs.get("history") or []),
        }, ensure_ascii=False), flush=True)
        if self.dry_run:
            print(json.dumps(kwargs, ensure_ascii=False, indent=2))
            return {"operations": []}
        return await super().complete_json(**kwargs)


def sample_turn() -> dict:
    return {
        "mensaje": "No hubo otras",
        "parte": {"fecha": "2026-11-09", "jornada": 9},
        "estados": [{"id": 1, "abreviatura": "P", "nombre": "PRESENTE"}],
        "contexto_conversacion": {
            "etapa": "carga", "obra": "La Rioja 474-Boreal",
            "fecha_parte": "2026-11-09", "pregunta_pendiente": None,
            "opciones_listado": [],
            "historial": [{"usuario": "1", "asistente": "Que novedades hubo ese dia?"}],
        },
    }


async def run(args) -> int:
    load_dotenv(ROOT / ".env")
    data = json.loads(args.input.read_text(encoding="utf-8")) if args.input else sample_turn()
    print("Contexto:", str(args.input) if args.input else "RECONSTRUCCION APROXIMADA", flush=True)
    if args.message is not None:
        data["mensaje"] = args.message
    model, effort = resolve_parte_diario_model(args.model)
    chat = DiagnosticChatClient(dry_run=args.dry_run, model=model, reasoning_effort=effort)
    adapter = ParteDiarioLLMClient(stage=data.get("stage", "carga"), chat_client=chat)
    draft = ParteDiarioDraft.from_dict(
        data["parte"], oportunidad_id=data["parte"].get("oportunidad_id", 1),
    )
    estados = [EstadoItem(**item) for item in data["estados"]]
    started = time.perf_counter()
    try:
        call = adapter.interpret_turn(
            data["mensaje"], draft, [], estados,
            contexto_conversacion=data.get("contexto_conversacion", {}),
        )
        plan = await asyncio.wait_for(call, timeout=args.timeout) if args.timeout else await call
        print(json.dumps({"elapsed_seconds": round(time.perf_counter() - started, 3),
                          "plan": asdict(plan)}, ensure_ascii=False, indent=2))
        return 0
    except Exception as exc:
        errors = []
        seen = set()
        while exc is not None and id(exc) not in seen:
            seen.add(id(exc))
            detail = str(exc).replace(chat.api_key, "[REDACTED]") if chat.api_key else str(exc)
            errors.append({"type": type(exc).__name__, "message": detail})
            exc = exc.__cause__ or exc.__context__
        print(json.dumps({"elapsed_seconds": round(time.perf_counter() - started, 3),
                          "errors": errors}, ensure_ascii=False, indent=2))
        return 1
    finally:
        if chat._client is not None:
            await chat._client.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", type=Path, help="JSON con el contexto completo del turno")
    parser.add_argument("--message", help="Reemplazar el mensaje del JSON")
    parser.add_argument("--model", help="Override explicito del modelo")
    parser.add_argument("--timeout", type=float, help="Limite total en segundos, incluyendo reintentos; por defecto igual al cliente real")
    parser.add_argument("--dry-run", action="store_true", help="Mostrar prompt/schema sin llamar al LLM; puede mostrar datos del contexto")
    args = parser.parse_args()
    if args.timeout is not None and args.timeout <= 0:
        parser.error("--timeout debe ser mayor a cero")
    return asyncio.run(run(args))


if __name__ == "__main__":
    raise SystemExit(main())
