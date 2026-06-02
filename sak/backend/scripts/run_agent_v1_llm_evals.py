"""Ejecuta los datasets versionados del agente v1 contra el proveedor LLM."""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
import sys
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from agente.v2.processes.general.llm_client import GeneralLLMClient
from agente.v2.processes.parte_diario.llm_client import ParteDiarioLLMClient
from agente.v2.processes.parte_diario.models import EstadoItem, NominaItem, ParteDiarioState
from agente.v2.processes.pedido_obra.llm_client import PedidoObraLLMClient
from agente.v2.processes.pedido_obra.models import PedidoState


EVALS_DIR = BACKEND_DIR / "agente" / "v2" / "evals"
DATASETS = {
    "general": "general_intents.jsonl",
    "pedido_obra": "pedido_obra_operations.jsonl",
    "parte_diario": "parte_diario_operations.jsonl",
    "parte_diario_estado": "parte_diario_estado_pendiente.jsonl",
}
ESTADOS = [
    EstadoItem(1, "P", "PRESENTE"),
    EstadoItem(2, "ENF", "ENFERMEDAD"),
    EstadoItem(3, "ACC", "ACCIDENTE"),
    EstadoItem(4, "FAL", "FALTA"),
    EstadoItem(5, "VAC", "VACACIONES"),
    EstadoItem(6, "FER", "FERIADO"),
    EstadoItem(7, "PER", "PERMISO"),
    EstadoItem(8, "LLV", "LLUVIA"),
]
NOMINAS = [
    NominaItem(1, "Juan", "Garcia", idproyecto=1),
    NominaItem(2, "Pedro", "Perez", idproyecto=1),
    NominaItem(3, "Rafael", "Medina", idproyecto=1),
]


def _load_dataset(name: str) -> list[dict[str, Any]]:
    path = EVALS_DIR / DATASETS[name]
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def _is_subset(expected: Any, actual: Any) -> bool:
    if isinstance(expected, dict):
        return isinstance(actual, dict) and all(
            key in actual and _is_subset(value, actual[key])
            for key, value in expected.items()
        )
    if isinstance(expected, list):
        return isinstance(actual, list) and len(expected) == len(actual) and all(
            _is_subset(left, right) for left, right in zip(expected, actual)
        )
    return expected == actual


async def _evaluate_case(dataset: str, item: dict[str, Any]) -> dict[str, Any]:
    text = str(item["input"])
    if dataset == "general":
        result = await GeneralLLMClient().interpret_turn(text)
        actual: dict[str, Any] = {"type": result.type}
    elif dataset == "pedido_obra":
        state = PedidoState.from_dict(item.get("state") or {}, oportunidad_id=1)
        plan = await PedidoObraLLMClient().interpret_turn(text, state)
        actual = {"operations": [operation.type for operation in plan.operations]}
    elif dataset == "parte_diario":
        plan = await ParteDiarioLLMClient().interpret_turn(
            text,
            ParteDiarioState(oportunidad_id=1, idproyecto=1),
            NOMINAS,
            ESTADOS,
        )
        actual = {
            "operations": [
                {
                    "type": operation.type,
                    "nombre": operation.nombre,
                    "estado_codigo": operation.estado_codigo,
                    "horas": operation.horas,
                    "horas_extra": operation.horas_extra,
                    "requested": operation.requested,
                }
                for operation in plan.operations
            ]
        }
    else:
        code = await ParteDiarioLLMClient().interpretar_estado_pendiente(text, ESTADOS)
        actual = {"estado_codigo": code}
    return {
        "dataset": dataset,
        "input": text,
        "expected": item["expected"],
        "actual": actual,
        "passed": _is_subset(item["expected"], actual),
    }


async def _main(selected: list[str]) -> int:
    results = []
    for dataset in selected:
        for item in _load_dataset(dataset):
            result = await _evaluate_case(dataset, item)
            results.append(result)
            print(json.dumps(result, ensure_ascii=False))
    passed = sum(1 for item in results if item["passed"])
    print(json.dumps({"total": len(results), "passed": passed, "failed": len(results) - passed}))
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dataset",
        action="append",
        choices=sorted(DATASETS),
        help="Dataset a ejecutar. Puede repetirse; por defecto ejecuta todos.",
    )
    args = parser.parse_args()
    raise SystemExit(asyncio.run(_main(args.dataset or list(DATASETS))))
