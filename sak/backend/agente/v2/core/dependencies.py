"""Construccion centralizada del runtime del agente."""

from __future__ import annotations

from agente.v2.processes.general.handler import GeneralProcess
from agente.v2.processes.parte_diario.handler import ParteDiarioProcess
from agente.v2.processes.pedido_obra.handler import PedidoObraProcess, build_pedido_obra_dependencies


def build_agent_runtime_dependencies(*, session=None):
    state_store, pedido_obra = build_pedido_obra_dependencies(session=session)
    return state_store, [
        GeneralProcess(session=session),
        pedido_obra,
        ParteDiarioProcess(session=session),
    ]


def find_pedido_obra_process(processes: list) -> PedidoObraProcess:
    for process in processes:
        if process.name == "pedido_obra":
            return process
    raise RuntimeError("pedido_obra no configurado")
